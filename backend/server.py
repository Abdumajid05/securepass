from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
from contextlib import closing
import sqlite3
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


APP_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("SECUREPASS_DB_PATH", APP_DIR / "data" / "vaults.sqlite3"))
MAX_BODY_BYTES = 10 * 1024 * 1024
LOG = logging.getLogger("securepass.sync")


class ApiError(Exception):
    def __init__(self, status: int, message: str, *, etag: str | None = None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.etag = etag


def configured_token() -> str:
    token = os.environ.get("SECUREPASS_SYNC_TOKEN", "")
    if len(token.encode("utf-8")) < 32:
        raise RuntimeError("SECUREPASS_SYNC_TOKEN must contain at least 32 bytes")
    return token


def configured_origins() -> set[str]:
    return {
        item.strip()
        for item in os.environ.get("SECUREPASS_ALLOWED_ORIGIN", "").split(",")
        if item.strip()
    }


def configured_hosts() -> set[str]:
    return {
        item.strip().lower()
        for item in os.environ.get("SECUREPASS_ALLOWED_HOSTS", "localhost,127.0.0.1,::1").split(",")
        if item.strip()
    }


def account_key(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def validate_vault(value: object) -> dict[str, object]:
    if not isinstance(value, dict) or set(value) != {"version", "salt", "iv", "ciphertext"}:
        raise ApiError(400, "Invalid encrypted vault format")
    if type(value["version"]) is not int or value["version"] != 1:
        raise ApiError(400, "Unsupported encrypted vault version")

    decoded: dict[str, bytes] = {}
    for key in ("salt", "iv", "ciphertext"):
        encoded = value[key]
        if not isinstance(encoded, str) or not encoded or len(encoded) > MAX_BODY_BYTES * 2:
            raise ApiError(400, "Invalid encrypted vault data")
        try:
            decoded[key] = base64.b64decode(encoded, validate=True)
        except (ValueError, base64.binascii.Error):
            raise ApiError(400, "Invalid encrypted vault data") from None

    if len(decoded["salt"]) < 16 or len(decoded["iv"]) != 12:
        raise ApiError(400, "Invalid encrypted vault parameters")
    if not 16 <= len(decoded["ciphertext"]) <= MAX_BODY_BYTES:
        raise ApiError(400, "Encrypted vault is empty or too large")
    return value


class VaultStore:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with closing(self.connect()) as connection:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute(
                """CREATE TABLE IF NOT EXISTS encrypted_vaults (
                    account_key TEXT PRIMARY KEY,
                    revision INTEGER NOT NULL,
                    vault_json TEXT NOT NULL,
                    updated_at INTEGER NOT NULL
                )"""
            )

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path, timeout=10, isolation_level=None)
        connection.row_factory = sqlite3.Row
        return connection

    def get(self, key: str) -> tuple[int, dict[str, object]] | None:
        with closing(self.connect()) as connection:
            row = connection.execute(
                "SELECT revision, vault_json FROM encrypted_vaults WHERE account_key = ?",
                (key,),
            ).fetchone()
        if row is None:
            return None
        return int(row["revision"]), json.loads(row["vault_json"])

    def put(
        self,
        key: str,
        vault: dict[str, object],
        if_match: str | None,
        if_none_match: str | None,
    ) -> tuple[int, str]:
        connection = self.connect()
        try:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT revision FROM encrypted_vaults WHERE account_key = ?", (key,)
            ).fetchone()
            if row is None:
                if if_none_match != "*":
                    raise ApiError(428, "If-None-Match: * is required to create the vault")
                revision = 1
                connection.execute(
                    "INSERT INTO encrypted_vaults(account_key, revision, vault_json, updated_at) VALUES (?, ?, ?, ?)",
                    (key, revision, json.dumps(vault, separators=(",", ":")), int(time.time())),
                )
            else:
                current_revision = int(row["revision"])
                current_etag = f'"{current_revision}"'
                if if_match is None:
                    raise ApiError(428, "If-Match is required to update the vault", etag=current_etag)
                if not hmac.compare_digest(if_match, current_etag):
                    raise ApiError(412, "Vault changed on another device; download it before retrying", etag=current_etag)
                revision = current_revision + 1
                connection.execute(
                    "UPDATE encrypted_vaults SET revision = ?, vault_json = ?, updated_at = ? WHERE account_key = ?",
                    (revision, json.dumps(vault, separators=(",", ":")), int(time.time()), key),
                )
            connection.commit()
            return revision, f'"{revision}"'
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()


def make_handler(store: VaultStore, token: str, origins: set[str], hosts: set[str]):
    class Handler(BaseHTTPRequestHandler):
        server_version = "SecurePassSync/1.0"
        sys_version = ""

        def log_message(self, format: str, *args: object) -> None:
            # Never log request bodies, Authorization headers, or query strings.
            LOG.info("%s %s", self.command, self.path.split("?", 1)[0])

        def _send_json(
            self,
            status: int,
            body: dict[str, object],
            *,
            etag: str | None = None,
        ) -> None:
            encoded = json.dumps(body, separators=(",", ":")).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            if etag:
                self.send_header("ETag", etag)
            origin = self.headers.get("Origin")
            if origin and origin in origins:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
            self.end_headers()
            self.wfile.write(encoded)

        def _validate_host(self) -> bool:
            raw_host = self.headers.get("Host", "")
            try:
                host = urlsplit(f"//{raw_host}").hostname
            except ValueError:
                host = None
            if host and host.lower() in hosts:
                return True
            self._send_json(400, {"error": "Invalid Host header"})
            return False

        def _authenticate(self) -> str | None:
            supplied = self.headers.get("Authorization", "")
            prefix = "Bearer "
            if not supplied.startswith(prefix):
                self._send_json(401, {"error": "Unauthorized"})
                return None
            candidate = supplied[len(prefix):]
            if not hmac.compare_digest(candidate.encode("utf-8"), token.encode("utf-8")):
                self._send_json(401, {"error": "Unauthorized"})
                return None
            return account_key(candidate)

        def _read_vault(self) -> dict[str, object] | None:
            content_type = self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
            if content_type != "application/json":
                raise ApiError(415, "Content-Type must be application/json")
            raw_length = self.headers.get("Content-Length", "")
            if not raw_length.isdecimal():
                raise ApiError(411, "Content-Length is required")
            length = int(raw_length)
            if length > MAX_BODY_BYTES + 16_384:
                raise ApiError(413, "Request body is too large")
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise ApiError(400, "Incomplete request body")
            try:
                document = json.loads(raw)
            except (UnicodeDecodeError, json.JSONDecodeError):
                raise ApiError(400, "Invalid JSON") from None
            if not isinstance(document, dict) or set(document) != {"vault"}:
                raise ApiError(400, "Request must contain only a vault object")
            return validate_vault(document["vault"])

        def do_OPTIONS(self) -> None:
            if not self._validate_host():
                return
            origin = self.headers.get("Origin", "")
            if origin not in origins:
                self._send_json(403, {"error": "Origin is not allowed"})
                return
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "GET, PUT, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type, If-Match, If-None-Match")
            self.send_header("Access-Control-Max-Age", "300")
            self.send_header("Vary", "Origin")
            self.end_headers()

        def do_GET(self) -> None:
            if not self._validate_host():
                return
            if self.path == "/health":
                self._send_json(200, {"status": "ok"})
                return
            if self.path != "/v1/vault":
                self._send_json(404, {"error": "Not found"})
                return
            key = self._authenticate()
            if key is None:
                return
            try:
                record = store.get(key)
            except sqlite3.Error:
                self._send_json(503, {"error": "Vault storage is temporarily unavailable"})
                return
            if record is None:
                self._send_json(404, {"error": "Vault not found"})
                return
            revision, vault = record
            self._send_json(200, {"revision": revision, "vault": vault}, etag=f'"{revision}"')

        def do_PUT(self) -> None:
            if not self._validate_host():
                return
            if self.path != "/v1/vault":
                self._send_json(404, {"error": "Not found"})
                return
            key = self._authenticate()
            if key is None:
                return
            try:
                vault = self._read_vault()
                assert vault is not None
                revision, etag = store.put(
                    key,
                    vault,
                    self.headers.get("If-Match"),
                    self.headers.get("If-None-Match"),
                )
            except ApiError as error:
                self._send_json(error.status, {"error": error.message}, etag=error.etag)
                return
            except sqlite3.Error:
                self._send_json(503, {"error": "Vault storage is temporarily unavailable"})
                return
            self._send_json(200, {"revision": revision}, etag=etag)

        def do_POST(self) -> None:
            self._send_json(405, {"error": "Method not allowed"})

        def do_DELETE(self) -> None:
            self._send_json(405, {"error": "Method not allowed"})

    return Handler


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    token = configured_token()
    host = os.environ.get("SECUREPASS_HOST", "127.0.0.1")
    port_text = os.environ.get("SECUREPASS_PORT", "8765")
    if not port_text.isdecimal() or not 1 <= int(port_text) <= 65535:
        raise RuntimeError("SECUREPASS_PORT must be between 1 and 65535")
    port = int(port_text)
    hosts = configured_hosts()
    if host not in {"127.0.0.1", "localhost", "::1"} and not os.environ.get("SECUREPASS_TLS_TERMINATED"):
        raise RuntimeError("Non-loopback binding requires a TLS reverse proxy and SECUREPASS_TLS_TERMINATED=1")

    store = VaultStore(DB_PATH)
    server = ThreadingHTTPServer((host, port), make_handler(store, token, configured_origins(), hosts))
    server.daemon_threads = True
    LOG.info("SecurePass sync API listening on %s:%d", host, port)
    LOG.info("Encrypted vault database: %s", DB_PATH)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        LOG.info("Shutting down SecurePass sync API")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
