import type { EncryptedVault, Vault } from "../types";
import { normalizeDomain } from "../utils/domain";

const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;
const PBKDF2_ITERATIONS = 600_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export class VaultUnlockError extends Error {
  constructor() {
    super("Vaultni ochib bo‘lmadi.");
    this.name = "VaultUnlockError";
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function deriveKey(masterPassword: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(encoder.encode(masterPassword)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
    },
    material,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}

function isVault(value: unknown): value is Vault {
  if (typeof value !== "object" || value === null || !("entries" in value)) {
    return false;
  }
  const entries = value.entries;
  return (
    Array.isArray(entries) &&
    entries.every((entry: unknown) => {
      if (typeof entry !== "object" || entry === null) return false;
      const candidate = entry as Record<string, unknown>;
      return (
        typeof candidate.id === "string" &&
        typeof candidate.website === "string" &&
        (candidate.domain === undefined || typeof candidate.domain === "string") &&
        typeof candidate.username === "string" &&
        typeof candidate.password === "string" &&
        (candidate.notes === undefined || typeof candidate.notes === "string") &&
        typeof candidate.createdAt === "number" &&
        typeof candidate.updatedAt === "number" &&
        (candidate.lastChangedAt === undefined || typeof candidate.lastChangedAt === "number") &&
        (candidate.favorite === undefined || typeof candidate.favorite === "boolean") &&
        (candidate.passwordHistory === undefined || (
          Array.isArray(candidate.passwordHistory) &&
          candidate.passwordHistory.every((item: unknown) => {
            if (typeof item !== "object" || item === null) return false;
            const historyItem = item as Record<string, unknown>;
            return typeof historyItem.password === "string" && typeof historyItem.changedAt === "number";
          })
        ))
      );
    })
  );
}

export async function encryptVault(vault: Vault, masterPassword: string): Promise<EncryptedVault> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(masterPassword, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(encoder.encode(JSON.stringify(vault))),
  );

  return {
    version: 1,
    salt: encodeBase64(salt),
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptVault(encrypted: EncryptedVault, masterPassword: string): Promise<Vault> {
  try {
    if (encrypted.version !== 1) throw new Error("Unsupported vault version");
    const salt = decodeBase64(encrypted.salt);
    const iv = decodeBase64(encrypted.iv);
    const ciphertext = decodeBase64(encrypted.ciphertext);
    if (salt.length < SALT_LENGTH || iv.length !== IV_LENGTH) {
      throw new Error("Invalid vault metadata");
    }

    const key = await deriveKey(masterPassword, salt);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(ciphertext),
    );
    const parsed: unknown = JSON.parse(decoder.decode(plaintext));
    if (!isVault(parsed)) throw new Error("Invalid vault contents");
    return { entries: parsed.entries.map((entry) => ({
      ...entry,
      domain: entry.domain || normalizeDomain(entry.website),
      lastChangedAt: entry.lastChangedAt ?? entry.updatedAt,
    })) };
  } catch {
    // A single public error avoids distinguishing a wrong password from damaged vault data.
    throw new VaultUnlockError();
  }
}
