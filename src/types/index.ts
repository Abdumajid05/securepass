export interface PasswordEntry {
  id: string;
  website: string;
  domain: string;
  username: string;
  password: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  lastChangedAt: number;
  favorite?: boolean;
  passwordHistory?: PasswordHistoryItem[];
}

export interface PasswordHistoryItem {
  password: string;
  changedAt: number;
}

export interface Vault {
  entries: PasswordEntry[];
}

export type PasswordEntryInput = Omit<
  PasswordEntry,
  "id" | "domain" | "createdAt" | "updatedAt" | "lastChangedAt" | "favorite" | "passwordHistory"
>;

export interface PendingLogin {
  website: string;
  username: string;
  password: string;
  capturedAt: number;
}

export interface EncryptedVault {
  version: 1;
  salt: string;
  iv: string;
  ciphertext: string;
}

export type PasswordStrength =
  | "VERY_WEAK"
  | "WEAK"
  | "MEDIUM"
  | "STRONG"
  | "VERY_STRONG";

export interface PasswordChecks {
  minimumLength: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  specialCharacter: boolean;
}

export interface PasswordValidation {
  score: number;
  strength: PasswordStrength;
  checks: PasswordChecks;
  suggestions: string[];
}

export interface PasswordGeneratorOptions {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  specialCharacters: boolean;
}
