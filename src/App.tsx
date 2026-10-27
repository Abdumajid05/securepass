import { useEffect, useState } from "react";
import { decryptVault, encryptVault, VaultUnlockError } from "./crypto/crypto";
import { Login } from "./components/Login";
import { Vault } from "./components/Vault";
import { loadEncryptedVault, saveEncryptedVault } from "./storage/storage";
import type { EncryptedVault, PasswordEntry, PasswordEntryInput, PendingLogin, Vault as VaultData } from "./types";
import { normalizeDomain } from "./utils/domain";

function errorMessage(error: unknown): string {
  if (error instanceof VaultUnlockError) return "Master password noto‘g‘ri";
  return error instanceof Error ? error.message : "Kutilmagan xatolik yuz berdi.";
}

export default function App() {
  const [hasVault, setHasVault] = useState<boolean | null>(null);
  const [storageError, setStorageError] = useState("");
  const [vault, setVault] = useState<VaultData | null>(null);
  const [masterPassword, setMasterPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingLogin, setPendingLogin] = useState<PendingLogin | null>(null);
  const [activeOrigin, setActiveOrigin] = useState("");
  const [siteWatchMessage, setSiteWatchMessage] = useState("");
  const [syncEndpoint, setSyncEndpoint] = useState("http://127.0.0.1:8765");
  const [syncToken, setSyncToken] = useState("");

  useEffect(() => {
    let active = true;
    loadEncryptedVault()
      .then((stored) => {
        if (active) setHasVault(stored !== null);
      })
      .catch((caught: unknown) => {
        if (active) {
          // Never treat unreadable storage as an empty vault: doing so would let
          // the create flow overwrite data that may still be recoverable.
          setStorageError(errorMessage(caught));
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([
      chrome.storage.local.get("securepassSyncEndpoint"),
      chrome.storage.session.get("securepassSyncToken"),
    ]).then(([local, session]) => {
      if (!active) return;
      if (typeof local.securepassSyncEndpoint === "string") setSyncEndpoint(local.securepassSyncEndpoint);
      if (typeof session.securepassSyncToken === "string") setSyncToken(session.securepassSyncToken);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function saveSyncSettings(endpoint: string, token: string) {
    await Promise.all([
      chrome.storage.local.set({ securepassSyncEndpoint: endpoint }),
      chrome.storage.session.set({ securepassSyncToken: token }),
    ]);
    setSyncEndpoint(endpoint);
    setSyncToken(token);
  }

  async function restoreRemoteVault(encrypted: EncryptedVault) {
    if (!masterPassword) throw new Error("Vault qulflangan.");
    const decrypted = await decryptVault(encrypted, masterPassword);
    await saveEncryptedVault(encrypted);
    setVault(decrypted);
  }

  useEffect(() => {
    let active = true;
    void chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([tab]) => {
      if (!active || !tab?.url) return;
      try {
        const url = new URL(tab.url);
        if (url.protocol === "http:" || url.protocol === "https:") setActiveOrigin(url.origin);
      } catch { /* Restricted browser pages do not support site access. */ }
    });
    void chrome.storage.session.get("securepassPendingLogin").then((stored) => {
      if (!active) return;
      const candidate = stored.securepassPendingLogin as PendingLogin | undefined;
      if (candidate && Date.now() - candidate.capturedAt < 10 * 60_000) setPendingLogin(candidate);
      else if (candidate) void chrome.runtime.sendMessage({ type: "SECUREPASS_CLEAR_PENDING" });
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function enableSiteWatch() {
    try {
      if (!activeOrigin) throw new Error("Joriy sahifa uchun sayt ruxsati mavjud emas.");
      const originPattern = `${activeOrigin}/*`;
      const granted = await chrome.permissions.request({ origins: [originPattern] });
      if (!granted) throw new Error("Sayt kuzatuviga ruxsat berilmadi.");
      const id = `securepass-${btoa(activeOrigin).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)}`;
      const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
      if (!existing.length) {
        await chrome.scripting.registerContentScripts([{
          id,
          matches: [originPattern],
          js: ["content.js"],
          runAt: "document_idle",
          persistAcrossSessions: true,
        }]);
      }
      // Registered scripts run on future navigations. Inject once now as well,
      // including when this origin was enabled in an earlier session.
      const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (activeTab?.id !== undefined) {
        await chrome.scripting.executeScript({ target: { tabId: activeTab.id }, files: ["content.js"] });
      }
      setSiteWatchMessage(`${new URL(activeOrigin).hostname} uchun saqlash taklifi yoqildi.`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Sayt ruxsatini yoqib bo‘lmadi.";
      setSiteWatchMessage(message);
      throw caught;
    }
  }

  async function clearPendingLogin() {
    await chrome.runtime.sendMessage({ type: "SECUREPASS_CLEAR_PENDING" });
    setPendingLogin(null);
  }

  async function autofillEntry(entry: PasswordEntry) {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id === undefined || !tab.url) throw new Error("Faol sahifani aniqlab bo‘lmadi.");
    const url = new URL(tab.url);
    if (!/^https?:$/.test(url.protocol) || normalizeDomain(url.hostname) !== entry.domain) {
      throw new Error("Bu login joriy sayt domeniga mos emas.");
    }
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [entry.username, entry.password],
      func: (username: string, password: string) => {
        const visible = (input: HTMLInputElement) => !input.disabled && input.getClientRects().length > 0;
        const passwordInput = [...document.querySelectorAll<HTMLInputElement>('input[type="password"]')].find(visible);
        if (!passwordInput) return false;
        const form = passwordInput.form;
        const userSelector = 'input[autocomplete="username"], input[type="email"], input[name*="user" i], input[name*="login" i], input[type="text"]';
        const usernameInput = [...(form ?? document).querySelectorAll<HTMLInputElement>(userSelector)].find(visible);
        if (!usernameInput) return false;
        const setInput = (input: HTMLInputElement, value: string) => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
          if (setter) setter.call(input, value);
          else input.value = value;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        };
        setInput(usernameInput, username);
        setInput(passwordInput, password);
        return true;
      },
    });
    if (!result) throw new Error("Sahifada to‘ldirish mumkin bo‘lgan login formasi topilmadi.");
  }

  async function createVault(password: string) {
    if (password.length < 8) {
      setError("Master password kamida 8 ta belgidan iborat bo‘lishi kerak.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const emptyVault: VaultData = { entries: [] };
      const encrypted = await encryptVault(emptyVault, password);
      await saveEncryptedVault(encrypted);
      setMasterPassword(password);
      setVault(emptyVault);
      setHasVault(true);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function unlockVault(password: string) {
    setBusy(true);
    setError("");
    try {
      const encrypted = await loadEncryptedVault();
      if (!encrypted) {
        setHasVault(false);
        setError("Vault topilmadi. Iltimos, yangidan yarating.");
        return;
      }
      const decrypted = await decryptVault(encrypted, password);
      setMasterPassword(password);
      setVault(decrypted);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function updateVault(entries: PasswordEntry[]) {
    if (!masterPassword) throw new Error("Vault qulflangan. Qayta oching.");
    const nextVault: VaultData = { entries };
    const encrypted = await encryptVault(nextVault, masterPassword);
    await saveEncryptedVault(encrypted);
    setVault(nextVault);
  }

  async function saveEntry(
    values: PasswordEntryInput,
    existing?: PasswordEntry,
  ) {
    if (!vault) throw new Error("Vault ochilmagan.");
    const domain = normalizeDomain(values.website);
    if (!domain) throw new Error("Yaroqli sayt manzilini kiriting (masalan, example.com).");
    if (!existing && vault.entries.some((entry) => entry.domain === domain
      && entry.username.trim().toLocaleLowerCase() === values.username.trim().toLocaleLowerCase())) {
      const proceed = window.confirm(`${domain} uchun “${values.username.trim()}” akkaunti allaqachon saqlangan. Yana bir yozuv qo‘shilsinmi?`);
      if (!proceed) throw new Error("Yangi yozuv qo‘shish bekor qilindi.");
    }
    const now = Date.now();
    const passwordChanged = Boolean(existing && existing.password !== values.password);
    const nextEntry: PasswordEntry = existing
      ? {
          ...existing,
          ...values,
          domain,
          updatedAt: now,
          lastChangedAt: passwordChanged ? now : existing.lastChangedAt,
          passwordHistory: passwordChanged
            ? [...(existing.passwordHistory ?? []), { password: existing.password, changedAt: now }].slice(-5)
            : existing.passwordHistory,
        }
      : {
          ...values,
          domain,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
          lastChangedAt: now,
        };
    const entries = existing
      ? vault.entries.map((entry) => entry.id === existing.id ? nextEntry : entry)
      : [...vault.entries, nextEntry];
    await updateVault(entries);
  }

  async function deleteEntry(entry: PasswordEntry) {
    if (!vault) throw new Error("Vault ochilmagan.");
    await updateVault(vault.entries.filter((candidate) => candidate.id !== entry.id));
  }

  async function toggleFavorite(entry: PasswordEntry) {
    if (!vault) throw new Error("Vault ochilmagan.");
    await updateVault(vault.entries.map((item) =>
      item.id === entry.id ? { ...item, favorite: !item.favorite } : item,
    ));
  }

  function lockVault() {
    setVault(null);
    setMasterPassword("");
    setError("");
  }

  useEffect(() => {
    const listener = (message: { type?: string }) => {
      if (message?.type !== "SECUREPASS_LOCK_NOW") return;
      setVault(null);
      setMasterPassword("");
      setError("Vault tezkor tugma orqali qulflandi.");
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  useEffect(() => {
    if (!vault) return;
    let timer = 0;
    const resetIdleTimer = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setVault(null);
        setMasterPassword("");
        setError("Vault harakatsizlik sababli xavfsizlik uchun qulflandi.");
      }, 5 * 60 * 1000);
    };
    const activityEvents = ["pointerdown", "keydown", "input"] as const;
    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetIdleTimer));
    resetIdleTimer();
    return () => {
      window.clearTimeout(timer);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetIdleTimer));
    };
  }, [Boolean(vault)]);

  if (hasVault === null && storageError) {
    return <main className="login-screen"><section className="login-card" role="alert">
      <div className="brand-mark" aria-hidden="true">S</div><h1>Vaultni o‘qib bo‘lmadi</h1>
      <p className="form-error">{storageError}</p>
      <p className="security-note">Ma’lumotlaringizni tasodifan ustidan yozmaslik uchun yangi vault yaratish vaqtincha to‘xtatildi.</p>
      <button className="button secondary full-width" type="button" onClick={() => {
        setStorageError("");
        void loadEncryptedVault().then((stored) => setHasVault(stored !== null)).catch((caught: unknown) => setStorageError(errorMessage(caught)));
      }}>Qayta urinish</button>
    </section></main>;
  }

  if (hasVault === null) {
    return <main className="loading-screen"><div className="spinner" /><span>SecurePass yuklanmoqda...</span></main>;
  }

  if (!vault) {
    return (
      <Login
        key={hasVault ? "unlock" : "create"}
        hasVault={hasVault}
        busy={busy}
        error={error}
        onCreate={createVault}
        onUnlock={unlockVault}
      />
    );
  }

  return (
    <Vault
      entries={vault.entries}
      onSave={saveEntry}
      onDelete={deleteEntry}
      onFavorite={toggleFavorite}
      onLock={lockVault}
      pendingLogin={pendingLogin}
      onPendingHandled={clearPendingLogin}
      onEnableSiteWatch={enableSiteWatch}
      siteWatchMessage={siteWatchMessage}
      currentDomain={normalizeDomain(activeOrigin)}
      onAutofill={autofillEntry}
      syncEndpoint={syncEndpoint}
      syncToken={syncToken}
      onSaveSyncSettings={saveSyncSettings}
      getLocalEncryptedVault={loadEncryptedVault}
      onRestoreRemoteVault={restoreRemoteVault}
    />
  );
}
