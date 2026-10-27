import type { PasswordEntry } from "../types";

export interface ReuseGroup { passwordGroupId: string; entryIds: string[]; count: number }

// Group identifiers are ephemeral and reveal no password material.
export function analyzeReuse(entries: PasswordEntry[]): ReuseGroup[] {
  const groups = new Map<string, string[]>();
  for (const entry of entries) {
    const ids = groups.get(entry.password) ?? [];
    ids.push(entry.id);
    groups.set(entry.password, ids);
  }
  let index = 0;
  return [...groups.values()].filter((ids) => ids.length > 1).map((entryIds) => ({
    passwordGroupId: `reuse-${index++}`, entryIds, count: entryIds.length,
  }));
}
