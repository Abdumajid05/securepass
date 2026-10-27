import { useState } from "react";
import type { PasswordGeneratorOptions } from "../types";
import { generatePassphrase, generatePassword } from "../password/generator";

interface PasswordGeneratorProps {
  onUse: (password: string) => void;
  onClose: () => void;
}

const INITIAL_OPTIONS: PasswordGeneratorOptions = {
  length: 20,
  lowercase: true,
  uppercase: true,
  numbers: true,
  specialCharacters: true,
};

export function PasswordGenerator({ onUse, onClose }: PasswordGeneratorProps) {
  const [options, setOptions] = useState(INITIAL_OPTIONS);
  const [mode, setMode] = useState<"password" | "passphrase">("password");
  const [wordCount, setWordCount] = useState(7);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function createPassword() {
    try {
      setPassword(mode === "passphrase" ? generatePassphrase(wordCount) : generatePassword(options));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Parol yaratilmadi.");
    }
  }

  function toggle(key: keyof Omit<PasswordGeneratorOptions, "length">, checked: boolean) {
    setOptions((current) => ({ ...current, [key]: checked }));
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-card generator-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="generator-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">SecurePass</p>
            <h2 id="generator-title">Kuchli parol yaratish</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Yopish">×</button>
        </div>
        <div className="generator-mode" role="group" aria-label="Parol turi">
          <button type="button" aria-pressed={mode === "password"} onClick={() => setMode("password")}>Tasodifiy parol</button>
          <button type="button" aria-pressed={mode === "passphrase"} onClick={() => setMode("passphrase")}>Esda qolarli ibora</button>
        </div>
        {mode === "password" ? (
          <>
            <label htmlFor="password-length">Uzunligi: {options.length} belgi</label>
            <input
              id="password-length"
              type="range"
              min="8"
              max="64"
              value={options.length}
              onChange={(event) => setOptions((current) => ({
                ...current,
                length: Number(event.target.value),
              }))}
            />
            <div className="option-grid">
              <label><input type="checkbox" checked={options.lowercase} onChange={(event) => toggle("lowercase", event.target.checked)} /> Kichik harflar</label>
              <label><input type="checkbox" checked={options.uppercase} onChange={(event) => toggle("uppercase", event.target.checked)} /> Katta harflar</label>
              <label><input type="checkbox" checked={options.numbers} onChange={(event) => toggle("numbers", event.target.checked)} /> Raqamlar</label>
              <label><input type="checkbox" checked={options.specialCharacters} onChange={(event) => toggle("specialCharacters", event.target.checked)} /> Maxsus belgilar</label>
            </div>
          </>
        ) : (
          <>
            <label htmlFor="passphrase-length">So‘zlar soni: {wordCount}</label>
            <input
              id="passphrase-length"
              type="range"
              min="4"
              max="12"
              value={wordCount}
              onChange={(event) => setWordCount(Number(event.target.value))}
            />
            <p className="muted generator-hint">Tasodifiy tanlangan so‘zlardan ibora tuziladi.</p>
          </>
        )}
        <button className="button secondary full-width" type="button" onClick={createPassword}>
          {mode === "passphrase" ? "Yangi ibora yaratish" : "Yangi parol yaratish"}
        </button>
        {error && <p className="form-error" role="alert">{error}</p>}
        {password && (
          <>
            <output className="generated-password">{password}</output>
            <button className="button primary full-width" type="button" onClick={() => onUse(password)}>
              Ushbu paroldan foydalanish
            </button>
          </>
        )}
      </section>
    </div>
  );
}
