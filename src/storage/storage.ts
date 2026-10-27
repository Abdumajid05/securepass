import type { EncryptedVault } from "../types";

const VAULT_KEY = "securepassEncryptedVault";

function isEncryptedVault(value: unknown): value is EncryptedVault {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === 1 &&
    typeof candidate.salt === "string" &&
    typeof candidate.iv === "string" &&
    typeof candidate.ciphertext === "string"
  );
}

export async function loadEncryptedVault(): Promise<EncryptedVault | null> {
  const result = await chrome.storage.local.get(VAULT_KEY);
  const stored = result[VAULT_KEY] as unknown;
  if (stored === undefined) return null;
  if (!isEncryptedVault(stored)) {
    throw new Error("Saqlangan vault ma’lumoti yaroqsiz.");
  }
  return stored;
}

export async function saveEncryptedVault(vault: EncryptedVault): Promise<void> {
  await chrome.storage.local.set({ [VAULT_KEY]: vault });
}
