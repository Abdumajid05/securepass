import type { CSSProperties } from "react";
import type { PasswordEntry } from "../types";
import { analyzeReuse } from "../password/reuse";
import { validatePassword } from "../password/validator";
import { calculatePasswordHealth } from "../security/health";
import { getRecommendations } from "../security/recommendations";
import { calculateSecurityScore } from "../security/score";

interface DashboardProps {
  entries: PasswordEntry[];
  onFix: (entry: PasswordEntry) => void;
  onVault: () => void;
}

export function Dashboard({
  entries,
  onFix,
  onVault,
}: DashboardProps) {
  const groups = analyzeReuse(entries);
  const weakEntries = entries.filter((entry) => {
    const strength = validatePassword(entry.password).strength;
    return strength === "VERY_WEAK" || strength === "WEAK";
  });
  const oldEntries = entries.filter(
    (entry) => Date.now() - entry.lastChangedAt > 365 * 86_400_000,
  );
  const recommendations = getRecommendations(entries);
  const score = calculateSecurityScore(entries);

  return (
    <div className="dashboard-content">
      <header className="page-heading">
        <p className="eyebrow">SecurePass</p>
        <h1>Xavfsizlik tekshiruvi</h1>
      </header>
      <section className="score-card">
        <div className="score-copy">
          <p className="eyebrow">Umumiy xavfsizlik</p>
          <h1>Xavfsizlik bahosi</h1>
          <p className="muted">Vault holatining tushunarli tahlili</p>
        </div>
        <div
          className="score-ring"
          style={{ "--score": `${score}%` } as CSSProperties}
          aria-label={`Xavfsizlik bahosi: ${score} / 100`}
        >
          <strong>{score}</strong>
          <span>/ 100</span>
        </div>
        <div className="score-track" aria-hidden="true">
          <span style={{ width: `${score}%` }} />
        </div>
        <div className="stat-row">
          <span><b>{entries.length - weakEntries.length}</b> zaif bo‘lmagan</span>
          <span><b>{weakEntries.length}</b> kuchsiz</span>
          <span><b>{groups.length}</b> qayta ishlatilgan guruh</span>
        </div>
      </section>

      <section className="dashboard-card">
        <div className="section-heading">
          <h2>Xavfsizlik muammolari</h2>
          <span className="muted">{weakEntries.length + groups.length + oldEntries.length} ta</span>
        </div>
        {!weakEntries.length && !groups.length && !oldEntries.length ? (
          <p className="muted">Hozircha aniqlangan muammo yo‘q.</p>
        ) : (
          <ul className="issue-list">
            {weakEntries.length > 0 && (
              <li>
                <b>{weakEntries.length} ta kuchsiz parol</b>
                <span>Uzun va noyob parolga almashtiring.</span>
              </li>
            )}
            {groups.map((group) => (
              <li key={group.passwordGroupId}>
                <b>{group.count} ta akkauntda bir xil parol</b>
                <span>Har bir akkaunt uchun alohida parol yarating.</span>
              </li>
            ))}
            {oldEntries.length > 0 && (
              <li>
                <b>{oldEntries.length} ta eski parol</b>
                <span>Bir yildan oshgan parollarni yangilang.</span>
              </li>
            )}
          </ul>
        )}
      </section>

      <section className="dashboard-card">
        <div className="section-heading"><h2>Parol salomatligi</h2></div>
        {entries.slice(0, 4).map((entry) => {
          const health = calculatePasswordHealth(entry, entries);
          return (
            <div className="health-row" key={entry.id}>
              <div>
                <b>{entry.website}</b>
                <small>
                  {health.overall} · Kuchlilik {health.strength}% · Noyoblik {health.uniqueness}%
                </small>
              </div>
              <button className="button ghost small" onClick={() => onFix(entry)}>
                Ko‘rib chiqish
              </button>
            </div>
          );
        })}
        {!entries.length && (
          <p className="muted">Birinchi parolingizni qo‘shing, tahlil shu yerda ko‘rinadi.</p>
        )}
      </section>

      <section className="dashboard-card">
        <div className="section-heading"><h2>Amaliy tavsiyalar</h2></div>
        {recommendations.slice(0, 3).map(({ entry, reason }) => (
          <div className="health-row" key={entry.id}>
            <div>
              <b>{entry.website}: {reason}</b>
              <small>Yangi parol yarating, saytda almashtiring va SecurePass’da saqlang.</small>
            </div>
            <button className="button secondary small" onClick={() => onFix(entry)}>
              Tuzatish
            </button>
          </div>
        ))}
        {!recommendations.length && <p className="muted">Hozircha tavsiya yo‘q.</p>}
      </section>

      <section className="dashboard-card vault-summary">
        <div>
          <p className="eyebrow">Parollar ombori</p>
          <b>{entries.length} ta yozuv</b>
        </div>
        <button className="button primary" onClick={onVault}>Vaultni ko‘rish</button>
      </section>

      {groups.length > 0 && (
        <section className="dashboard-card">
          <h2>Qayta ishlatilgan parollar</h2>
          {groups.map((group) => (
            <details className="reuse-cluster" key={group.passwordGroupId}>
              <summary>{group.count} akkaunt bitta parolni ishlatadi</summary>
              <p>
                {group.entryIds
                  .map((id) => entries.find((entry) => entry.id === id)?.website)
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
