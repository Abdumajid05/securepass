import { useState, type FormEvent } from "react";

interface LoginProps {
  hasVault: boolean;
  busy: boolean;
  error: string;
  onCreate: (masterPassword: string) => Promise<void>;
  onUnlock: (masterPassword: string) => Promise<void>;
}

export function Login({ hasVault, busy, error, onCreate, onUnlock }: LoginProps) {
  const [masterPassword, setMasterPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasVault && masterPassword !== confirmation) return;
    if (hasVault) await onUnlock(masterPassword);
    else await onCreate(masterPassword);
    setMasterPassword("");
    setConfirmation("");
  }

  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="brand-mark" aria-hidden="true">S</div>
        <h1>SecurePass</h1>
        <p className="muted">Xavfsiz password manager</p>
        <form onSubmit={handleSubmit} className="stack">
          <label htmlFor="master-password">Master password</label>
          <input
            id="master-password"
            type="password"
            autoComplete={hasVault ? "current-password" : "new-password"}
            value={masterPassword}
            onChange={(event) => setMasterPassword(event.target.value)}
            minLength={8}
            required
            autoFocus
          />
          {!hasVault && (
            <>
              <label htmlFor="confirm-password">Master parolni tasdiqlang</label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                minLength={8}
                required
              />
            </>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          {!hasVault && masterPassword && confirmation && masterPassword !== confirmation && (
            <p className="form-error" role="status">Master parollar mos kelmadi.</p>
          )}
          <button className="button primary full-width" type="submit" disabled={busy}>
            {busy ? "Kutilmoqda..." : hasVault ? "Vaultni ochish" : "Vault yaratish"}
          </button>
        </form>
        <p className="security-note">
          Master parol qurilmangizda saqlanmaydi. Uni unutsangiz, vaultni tiklab bo‘lmaydi.
        </p>
      </section>
    </main>
  );
}
