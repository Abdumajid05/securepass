import type { PasswordEntry } from "../types";
import { validatePassword } from "../password/validator";
import { analyzeReuse } from "../password/reuse";

export function getRecommendations(entries: PasswordEntry[]): Array<{ entry: PasswordEntry; reason: string }> {
  const reused = new Set(analyzeReuse(entries).flatMap((group) => group.entryIds));
  return entries.flatMap((entry) => {
    const weak = ["VERY_WEAK", "WEAK"].includes(validatePassword(entry.password).strength);
    const old = Date.now() - entry.lastChangedAt > 365 * 86_400_000;
    if (weak || reused.has(entry.id) || old) return [{ entry, reason: weak ? "Kuchsiz parol" : reused.has(entry.id) ? "Qayta ishlatilgan parol" : "Eski parol" }];
    return [];
  });
}
