import { useEffect, useMemo, useState } from "react";
import type { PasswordEntry, PasswordEntryInput, PendingLogin } from "../types";
import { PasswordForm } from "./PasswordForm";
import { PasswordList } from "./PasswordList";
import { Dashboard } from "./Dashboard";
import { PasswordGenerator } from "./PasswordGenerator";
import { Settings } from "./Settings";
import type { EncryptedVault } from "../types";
import { VaultGarden } from "./VaultGarden";

interface VaultProps {
  entries: PasswordEntry[];
  onSave: (entry: PasswordEntryInput, existing?: PasswordEntry) => Promise<void>;
  onDelete: (entry: PasswordEntry) => Promise<void>;
  onFavorite: (entry: PasswordEntry) => Promise<void>;
  onLock: () => void;
  pendingLogin: PendingLogin | null;
  onPendingHandled: () => Promise<void>;
  onEnableSiteWatch: () => Promise<void>;
  siteWatchMessage: string;
  currentDomain: string;
  onAutofill: (entry: PasswordEntry) => Promise<void>;
  syncEndpoint: string;
  syncToken: string;
  onSaveSyncSettings: (endpoint: string, token: string) => Promise<void>;
  getLocalEncryptedVault: () => Promise<EncryptedVault | null>;
  onRestoreRemoteVault: (vault: EncryptedVault) => Promise<void>;
}

type VaultPage = "Passwords" | "Checkup" | "Garden" | "Generator" | "Settings";

export function Vault({ entries, onSave, onDelete, onFavorite, onLock, pendingLogin, onPendingHandled, onEnableSiteWatch, siteWatchMessage, currentDomain, onAutofill, syncEndpoint, syncToken, onSaveSyncSettings, getLocalEncryptedVault, onRestoreRemoteVault }: VaultProps) {
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [editing, setEditing] = useState<PasswordEntry | null>(null);
  const [adding, setAdding] = useState(Boolean(pendingLogin));
  const [deleteCandidate, setDeleteCandidate] = useState<PasswordEntry | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState<VaultPage>("Passwords");
  const [generatedDraft, setGeneratedDraft] = useState("");
  const [autofillChooser, setAutofillChooser] = useState(false);
  const [autofillMessage, setAutofillMessage] = useState("");
  const matchingEntries = entries.filter((entry) => entry.domain && entry.domain === currentDomain);

  useEffect(() => {
    if (pendingLogin) {
      setPage("Passwords");
      setAdding(true);
      setEditing(null);
    }
  }, [pendingLogin]);

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return entries
      .filter((entry) =>
        (!favoritesOnly || entry.favorite) && (!query ||
          entry.website.toLocaleLowerCase().includes(query) ||
          entry.domain.toLocaleLowerCase().includes(query) ||
          entry.username.toLocaleLowerCase().includes(query)),
      )
      .sort((left, right) => Number(Boolean(right.favorite)) - Number(Boolean(left.favorite))
        || left.website.localeCompare(right.website));
  }, [entries, favoritesOnly, search]);

  function closeForm() {
    setAdding(false);
    setEditing(null);
    setError("");
    setGeneratedDraft("");
    if (pendingLogin) void onPendingHandled();
  }

  async function save(
    values: PasswordEntryInput,
    existing?: PasswordEntry,
  ) {
    await onSave(values, existing);
    closeForm();
  }

  async function confirmDelete() {
    if (!deleteCandidate) return;
    try {
      await onDelete(deleteCandidate);
      setDeleteCandidate(null);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Yozuvni o‘chirib bo‘lmadi.");
    }
  }

  async function fill(entry: PasswordEntry) {
    try {
      await onAutofill(entry);
      setAutofillMessage(`${entry.website} login ma’lumoti to‘ldirildi. Formani tekshirib, o‘zingiz yuboring.`);
      setAutofillChooser(false);
    } catch (caught) {
      setAutofillMessage(caught instanceof Error ? caught.message : "Loginni to‘ldirib bo‘lmadi.");
    }
  }

  return (
    <main className="vault-screen">
      <header className="topbar">
        <div className="brand-inline"><span className="mini-mark">S</span><strong>SecurePass</strong></div>
        <div className="topbar-actions">
          <span className="entry-count">{entries.length} ta parol</span>
          {matchingEntries.length > 0 && <button className="button primary small" type="button" onClick={() => { setAutofillMessage(""); if (matchingEntries.length === 1) void fill(matchingEntries[0]); else setAutofillChooser(true); }}>Loginni to‘ldirish</button>}
          <button className="button ghost small" type="button" onClick={onLock}>Qulflash</button>
        </div>
      </header>
      <nav className="main-nav" aria-label="Asosiy navigatsiya">
        {([
          ["Passwords", "Parollar"],
          ["Checkup", "Tekshiruv"],
          ["Garden", "Bog‘"],
          ["Generator", "Generator"],
          ["Settings", "Sozlamalar"],
        ] as const).map(([item, label]) => (
          <button
            key={item}
            className={page === item ? "active" : ""}
            aria-current={page === item ? "page" : undefined}
            onClick={() => setPage(item)}
          >
            {label}
          </button>
        ))}
      </nav>
      {autofillMessage && <p className="autofill-message" role="status">{autofillMessage}</p>}
      {page === "Checkup" && (
        <Dashboard
          entries={entries}
          onFix={(entry) => { setPage("Passwords"); setEditing(entry); setAdding(false); }}
          onVault={() => setPage("Passwords")}
        />
      )}
      {page === "Garden" && (
        <VaultGarden
          entries={entries}
          onSelect={(entry) => {
            setSearch(entry.website);
            setFavoritesOnly(false);
            setAdding(false);
            setEditing(entry);
            setPage("Passwords");
          }}
        />
      )}
      {page === "Settings" && (
        <Settings
          onEnableSiteWatch={onEnableSiteWatch}
          siteWatchMessage={siteWatchMessage}
          syncEndpoint={syncEndpoint}
          syncToken={syncToken}
          onSaveSyncSettings={onSaveSyncSettings}
          getLocalEncryptedVault={getLocalEncryptedVault}
          onRestoreRemoteVault={onRestoreRemoteVault}
        />
      )}
      {page === "Generator" && (
        <PasswordGenerator
          onUse={(generated) => {
            setGeneratedDraft(generated);
            setPage("Passwords");
            setAdding(true);
            setEditing(null);
          }}
          onClose={() => setPage("Passwords")}
        />
      )}
      {page === "Passwords" && <>
      <section className="vault-content">
        <div className="vault-title-row">
          <div><p className="eyebrow">Shaxsiy vault</p><h1>Parollaringiz</h1></div>
          <button className="button primary add-button" type="button" onClick={() => { setEditing(null); setAdding(true); }}>+ Qo‘shish</button>
        </div>
        {pendingLogin && <p className="clipboard-message" role="status">Saytdan login saqlash taklifi keldi. Saqlashdan oldin ma’lumotlarni tekshiring.</p>}
        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <input type="search" placeholder="Qidirish..." value={search} onChange={(event) => setSearch(event.target.value)} />
          {search && <button type="button" className="icon-button" aria-label="Qidiruvni tozalash" onClick={() => setSearch("")}>×</button>}
        </label>
        <div className="password-filters">
          <button className={`filter-chip${favoritesOnly ? " active" : ""}`} type="button" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly((current) => !current)}>
            {favoritesOnly ? "★ Sevimlilar" : "☆ Barchasi / sevimlilar"}
          </button>
          <span>{favoritesOnly ? `${filteredEntries.length} ta sevimli` : `${entries.length} ta yozuv`}</span>
        </div>
        {error && !adding && !editing && <p className="form-error" role="alert">{error}</p>}
        {adding || editing ? (
          <div className="form-card">
            <PasswordForm
              entry={editing ?? undefined}
              initialPassword={generatedDraft}
              initialValues={pendingLogin && !editing ? pendingLogin : undefined}
              onSave={(values) => save(values, editing ?? undefined)}
              onCancel={closeForm}
            />
          </div>
        ) : (
          <>
            {search && <p className="result-count">{filteredEntries.length} ta natija</p>}
            {favoritesOnly && filteredEntries.length === 0 ? <div className="empty-state"><span className="empty-icon">☆</span><h2>Sevimlilar hozircha yo‘q</h2><p>Login yonidagi yulduzchani bosib sevimlilarga qo‘shing.</p></div> : <PasswordList
              entries={filteredEntries}
              allEntries={entries}
              onFavorite={onFavorite}
              onEdit={(entry) => { setAdding(false); setEditing(entry); }}
              onDelete={(entry) => { setError(""); setDeleteCandidate(entry); }}
            />}
          </>
        )}
      </section></>}
      {deleteCandidate && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
            <div className="warning-mark">!</div>
            <h2 id="delete-title">Bu parolni o‘chirishni xohlaysizmi?</h2>
            <p>{deleteCandidate.website} · {deleteCandidate.username}</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="button-row">
              <button className="button danger" type="button" onClick={() => void confirmDelete()}>O‘chirish</button>
              <button className="button ghost" type="button" onClick={() => { setDeleteCandidate(null); setError(""); }}>Bekor qilish</button>
            </div>
          </section>
        </div>
      )}
      {autofillChooser && <div className="modal-backdrop" role="presentation" onMouseDown={() => setAutofillChooser(false)}><section className="modal-card autofill-card" role="dialog" aria-modal="true" aria-labelledby="autofill-title" onMouseDown={(event) => event.stopPropagation()}><div className="section-heading"><div><p className="eyebrow">{currentDomain}</p><h2 id="autofill-title">Qaysi loginni to‘ldiramiz?</h2></div><button className="icon-button" type="button" aria-label="Yopish" onClick={() => setAutofillChooser(false)}>×</button></div><p className="muted">Parol avtomatik yuborilmaydi. Formani tekshirib, o‘zingiz kiring.</p>{matchingEntries.map((entry) => <button className="autofill-option" type="button" key={entry.id} onClick={() => void fill(entry)}><span className="autofill-site-icon">{entry.website.slice(0, 1).toUpperCase()}</span><span><b>{entry.website}</b><small>{entry.username}</small></span><span aria-hidden="true">→</span></button>)}</section></div>}
    </main>
  );
}
