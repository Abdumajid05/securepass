import { useEffect, useRef, useState } from "react";
import type { PasswordEntry } from "../types";

interface PasswordListProps {
  entries: PasswordEntry[];
  allEntries: PasswordEntry[];
  onEdit: (entry: PasswordEntry) => void;
  onDelete: (entry: PasswordEntry) => void;
  onFavorite: (entry: PasswordEntry) => Promise<void>;
}

export function PasswordList({ entries, allEntries, onEdit, onDelete, onFavorite }: PasswordListProps) {
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [clipboardMessage, setClipboardMessage] = useState("");
  const visibleTimers = useRef(new Map<string, number>());

  useEffect(() => () => {
    visibleTimers.current.forEach((timer) => window.clearTimeout(timer));
    visibleTimers.current.clear();
  }, []);

  async function copyValue(value: string, kind: string) {
    try {
      await navigator.clipboard.writeText(value);
      // Clearing on a timer can erase a different value the user copied later.
      setClipboardMessage(`${kind} clipboardga nusxalandi.`);
    } catch {
      setClipboardMessage("Clipboardga nusxalab bo‘lmadi.");
    }
  }

  async function toggleFavorite(entry: PasswordEntry) {
    try {
      await onFavorite(entry);
    } catch {
      setClipboardMessage("Sevimlilar ro‘yxatini yangilab bo‘lmadi.");
    }
  }

  function toggleVisible(id: string) {
    const existingTimer = visibleTimers.current.get(id);
    if (existingTimer !== undefined) window.clearTimeout(existingTimer);
    visibleTimers.current.delete(id);
    if (visiblePasswords.has(id)) {
      setVisiblePasswords((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      return;
    }
    setVisiblePasswords((current) => new Set(current).add(id));
    const timer = window.setTimeout(() => {
      setVisiblePasswords((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      visibleTimers.current.delete(id);
    }, 15_000);
    visibleTimers.current.set(id, timer);
  }

  if (entries.length === 0) {
    return <div className="empty-state"><span className="empty-icon">⌁</span><h2>Hozircha parollar yo‘q</h2><p>Birinchi login ma’lumotini qo‘shing.</p></div>;
  }

  return (
    <section className="entry-list" aria-label="Parollar ro‘yxati">
      {clipboardMessage && <p className="clipboard-message" role="status">{clipboardMessage}</p>}
      {entries.map((entry) => {
        const reused = allEntries.filter((other) => other.password === entry.password).length > 1;
        const visible = visiblePasswords.has(entry.id);
        return (
          <article className="entry-card" key={entry.id}>
            <div className="entry-heading">
              <div className="site-icon">{entry.website.trim().slice(0, 1).toUpperCase() || "?"}</div>
              <div className="entry-title">
                <h2 title={entry.website}>{entry.website}</h2>
                <p title={entry.username}>{entry.username}</p>
              </div>
              <button
                className={`icon-button favorite-button${entry.favorite ? " is-favorite" : ""}`}
                type="button"
                onClick={() => void toggleFavorite(entry)}
                aria-label={entry.favorite ? "Sevimlilardan olib tashlash" : "Sevimlilarga qo‘shish"}
                aria-pressed={Boolean(entry.favorite)}
                title={entry.favorite ? "Sevimlilardan olib tashlash" : "Sevimlilarga qo‘shish"}
              >
                {entry.favorite ? "★" : "☆"}
              </button>
              <button className="icon-button" type="button" onClick={() => onEdit(entry)} aria-label={`${entry.website} yozuvini tahrirlash`}>✎</button>
              <button className="icon-button danger-icon" type="button" onClick={() => onDelete(entry)} aria-label={`${entry.website} yozuvini o‘chirish`}>×</button>
            </div>
            <div className="password-preview">
              <span className="password-text">{visible ? entry.password : "••••••••••••"}</span>
              <button className="text-button" type="button" onClick={() => toggleVisible(entry.id)}>{visible ? "Yashirish · 15s" : "Ko‘rsatish"}</button>
            </div>
            {reused && <p className="reuse-warning" role="status">⚠ Bu parol boshqa accountlarda ham ishlatilgan</p>}
            {entry.notes && <p className="entry-notes">{entry.notes}</p>}
            {!!entry.passwordHistory?.length && (
              <details className="password-history">
                <summary>Oldingi parollar ({entry.passwordHistory.length})</summary>
                {entry.passwordHistory.slice().reverse().map((item, index) => (
                  <div className="history-item" key={`${item.changedAt}-${index}`}>
                    <span>
                      <code>{item.password}</code>
                      <small>{new Date(item.changedAt).toLocaleDateString()}</small>
                    </span>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => void copyValue(item.password, "Oldingi parol")}
                    >Nusxalash</button>
                  </div>
                ))}
              </details>
            )}
            <div className="entry-actions">
              <button className="button small ghost" type="button" onClick={() => void copyValue(entry.username, "Foydalanuvchi nomi")}>Nomni nusxalash</button>
              <button className="button small ghost" type="button" onClick={() => void copyValue(entry.password, "Parol")}>Parolni nusxalash</button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
