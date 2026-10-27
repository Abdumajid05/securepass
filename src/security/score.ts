import type { PasswordEntry } from "../types";
import { validatePassword } from "../password/validator";
import { analyzeReuse } from "../password/reuse";

// Starts at 100. Per entry, subtract up to 35 for strength, 25 for reuse,
// and 20 for age (>1 year); subtract 15 for any weak entry. Normalize by count.
export function calculateSecurityScore(entries: PasswordEntry[]): number {
  if (!entries.length) return 100;
  const reusedIds = new Set(analyzeReuse(entries).flatMap((group) => group.entryIds));
  const now = Date.now();
  const deductions = entries.reduce((sum, entry) => {
    const strength = validatePassword(entry.password);
    const weak = strength.strength === "VERY_WEAK" || strength.strength === "WEAK";
    const age = now - entry.lastChangedAt > 365 * 24 * 60 * 60 * 1000;
    return sum + (weak ? 15 + (5 - strength.score) * 4 : (5 - strength.score) * 3)
      + (reusedIds.has(entry.id) ? 25 : 0) + (age ? 20 : 0);
  }, 0);
  return Math.max(0, Math.min(100, Math.round(100 - deductions / entries.length)));
}
