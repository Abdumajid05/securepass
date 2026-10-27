import { useEffect, useState, type FormEvent } from "react";
import type { PasswordEntry, PasswordEntryInput, PasswordValidation } from "../types";
import { validatePassword } from "../password/validator";
import { PasswordGenerator } from "./PasswordGenerator";

interface PasswordFormProps {
  entry?: PasswordEntry;
  onSave: (entry: PasswordEntryInput) => Promise<void>;
  onCancel: () => void;
  initialPassword?: string;
  initialValues?: Partial<PasswordEntryInput>;
}

const CHECK_LABELS: Record<keyof PasswordValidation["checks"], string> = {
  minimumLength: "8+ belgidan iborat",
  uppercase: "Katta harf",
  lowercase: "Kichik harf",
  number: "Raqam",
  specialCharacter: "Maxsus belgi",
};

export function PasswordForm({ entry, onSave, onCancel, initialPassword = "", initialValues }: PasswordFormProps) {
  const [website, setWebsite] = useState(entry?.website ?? initialValues?.website ?? "");
  const [username, setUsername] = useState(entry?.username ?? initialValues?.username ?? "");
  const [password, setPassword] = useState(entry?.password ?? initialValues?.password ?? initialPassword);
  const [notes, setNotes] = useState(entry?.notes ?? initialValues?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showGenerator, setShowGenerator] = useState(false);
  const validation = validatePassword(password);

  useEffect(() => {
    setWebsite(entry?.website ?? initialValues?.website ?? "");
    setUsername(entry?.username ?? initialValues?.username ?? "");
    setPassword(entry?.password ?? initialValues?.password ?? initialPassword);
    setNotes(entry?.notes ?? initialValues?.notes ?? "");
  }, [entry, initialPassword, initialValues]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave({
        website: website.trim(),
        username: username.trim(),
        password,
        notes: notes.trim(),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ma’lumotni saqlab bo‘lmadi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form className="stack password-form" onSubmit={handleSubmit}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{entry ? "Yozuvni tahrirlash" : "Yangi yozuv"}</p>
            <h2>{entry ? "Parolni tahrirlash" : "Parol qo‘shish"}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Yopish">×</button>
        </div>
        <label htmlFor="website">Veb-sayt</label>
        <input id="website" type="text" value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="example.com" required maxLength={200} />
        <label htmlFor="username">Foydalanuvchi nomi / Email</label>
        <input id="username" type="text" autoComplete="off" value={username} onChange={(event) => setUsername(event.target.value)} required maxLength={200} />
        <label htmlFor="entry-password">Parol</label>
        <input id="entry-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={1024} />
        <section className={`strength-panel strength-${validation.strength.toLowerCase()}`}>
          <div className="strength-title">
            <span>Kuchlilik:</span>
            <strong>{validation.strength}</strong>
          </div>
          <div className="check-grid">
            {(Object.entries(validation.checks) as [keyof typeof validation.checks, boolean][]).map(([key, passed]) => (
              <span className={passed ? "check passed" : "check"} key={key}>
                {passed ? "✓" : "○"} {CHECK_LABELS[key]}
              </span>
            ))}
          </div>
        </section>
        <button className="button secondary" type="button" onClick={() => setShowGenerator(true)}>
          Kuchli parol yaratish
        </button>
        <label htmlFor="notes">Izohlar <span className="muted">(ixtiyoriy)</span></label>
        <textarea id="notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="button-row">
          <button className="button primary" type="submit" disabled={busy}>{busy ? "Saqlanmoqda..." : "Saqlash"}</button>
          <button className="button ghost" type="button" onClick={onCancel}>Bekor qilish</button>
        </div>
      </form>
      {showGenerator && (
        <PasswordGenerator
          onUse={(generated) => {
            setPassword(generated);
            setShowGenerator(false);
          }}
          onClose={() => setShowGenerator(false)}
        />
      )}
    </>
  );
}
