import type { EncryptedVault } from "../types";

export interface RemoteVault {
  vault: EncryptedVault;
  etag: string;
  revision: number;
}

function vaultUrl(endpoint: string): string {
  let url: URL;
  try { url = new URL(endpoint.trim()); } catch { throw new Error("Server manzili noto‘g‘ri."); }
  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && localHosts.has(url.hostname))) {
    throw new Error("Masofaviy server HTTPS manzilidan foydalanishi kerak.");
  }
  if (url.pathname !== "/" || url.search || url.hash || !url.host) {
    throw new Error("Server manziliga faqat domen va portni kiriting.");
  }
  return `${url.origin}/v1/vault`;
}

async function request(endpoint: string, token: string, init: RequestInit): Promise<Response> {
  if (!token.trim()) throw new Error("Server tokenini kiriting.");
  try {
    return await fetch(vaultUrl(endpoint), {
      ...init,
      cache: "no-store",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new Error("Serverga ulanib bo‘lmadi. Server manzili, ruxsat va ish holatini tekshiring.");
  }
}

function isEncryptedVault(value: unknown): value is EncryptedVault {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.version === 1 && typeof candidate.salt === "string"
    && typeof candidate.iv === "string" && typeof candidate.ciphertext === "string";
}

function readError(status: number): string {
  if (status === 401) return "Server tokeni noto‘g‘ri.";
  if (status === 412) return "Serverdagi vault boshqa qurilmada yangilangan. Qayta sinxronlang.";
  if (status === 413) return "Vault server ruxsat etgan hajmdan katta.";
  if (status === 404) return "Serverda vault topilmadi.";
  return `Server so‘rovni qabul qilmadi (${status}).`;
}

export async function getRemoteVault(endpoint: string, token: string): Promise<RemoteVault | null> {
  const response = await request(endpoint, token, { method: "GET" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(readError(response.status));
  const result: unknown = await response.json();
  if (typeof result !== "object" || result === null) throw new Error("Server javobi noto‘g‘ri.");
  const record = result as Record<string, unknown>;
  const etag = response.headers.get("ETag");
  if (!etag || !isEncryptedVault(record.vault) || typeof record.revision !== "number") {
    throw new Error("Server javobida vault yoki versiya topilmadi.");
  }
  return { vault: record.vault, etag, revision: record.revision };
}

export async function putRemoteVault(
  endpoint: string,
  token: string,
  vault: EncryptedVault,
  expectedEtag: string | null,
): Promise<string> {
  const response = await request(endpoint, token, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(expectedEtag ? { "If-Match": expectedEtag } : { "If-None-Match": "*" }),
    },
    body: JSON.stringify({ vault }),
  });
  if (!response.ok) throw new Error(readError(response.status));
  const etag = response.headers.get("ETag");
  if (!etag) throw new Error("Server yangi vault versiyasini qaytarmadi.");
  return etag;
}
