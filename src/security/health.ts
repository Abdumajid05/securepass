import type { PasswordEntry } from "../types";
import { validatePassword } from "../password/validator";
import { analyzeReuse } from "../password/reuse";

export interface EntryHealth { strength: number; uniqueness: number; age: number; overall: "SOG'LOM" | "DIQQAT" | "XAVFLI"; reasons: string[] }
export function calculatePasswordHealth(entry: PasswordEntry, entries: PasswordEntry[], now = Date.now()): EntryHealth {
  const analysis = validatePassword(entry.password);
  const strength = Math.round(analysis.score * 20);
  const reuseGroup = analyzeReuse(entries).find((group) => group.entryIds.includes(entry.id));
  const uniqueness = reuseGroup ? Math.max(0, Math.round(100 / reuseGroup.count)) : 100;
  const ageDays = Math.max(0, (now - entry.lastChangedAt) / 86_400_000);
  const age = Math.max(0, Math.round(100 - Math.max(0, ageDays - 90) / 3.65));
  const reasons: string[] = [];
  if (analysis.strength === "VERY_WEAK" || analysis.strength === "WEAK") reasons.push("Parol kuchsiz.");
  if (reuseGroup) reasons.push(`Parol yana ${reuseGroup.count - 1} ta akkauntda ishlatilgan.`);
  if (ageDays > 365) reasons.push("Parol bir yildan ko‘proq vaqt oldin yangilangan.");
  const overall = strength < 40 || uniqueness < 50 || age < 20 ? "XAVFLI" : strength < 70 || uniqueness < 100 || age < 60 ? "DIQQAT" : "SOG'LOM";
  return { strength, uniqueness, age, overall, reasons };
}
