import { useEffect, useState } from "react";
import type { EncryptedVault } from "../types";
import { getRemoteVault, putRemoteVault, type RemoteVault } from "../sync/client";

interface SyncPanelProps {
  endpoint: string;
  token: string;
  onSaveSettings: (endpoint: string, token: string) => Promise<void>;
  getLocalVault: () => Promise<EncryptedVault | null>;
  onRestore: (vault: EncryptedVault) => Promise<void>;
}

function sameVault(left: EncryptedVault, right: EncryptedVault): boolean {
  return left.version === right.version && left.salt === right.salt
    && left.iv === right.iv && left.ciphertext === right.ciphertext;
}

export function SyncPanel({ endpoint, token, onSaveSettings, getLocalVault, onRestore }: SyncPanelProps) {
  const [draftEndpoint, setDraftEndpoint] = useState(endpoint);
  const [draftToken, setDraftToken] = useState(token);
  const [remote, setRemote] = useState<RemoteVault | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setDraftEndpoint(endpoint); }, [endpoint]);
  useEffect(() => { setDraftToken(token); }, [token]);

  async function syncNow() {
    setBusy(true);
    setStatus("");
    setRemote(null);
    try {
      const server = new URL(draftEndpoint.trim());
      const permission = chrome.permissions.request({ origins: [`${server.origin}/*`] });
      if (!(await permission)) throw new Error("Server manziliga ulanish ruxsati berilmadi.");
      await onSaveSettings(draftEndpoint.trim(), draftToken);
      const local = await getLocalVault();
      if (!local) throw new Error("Qurilmada shifrlangan vault topilmadi.");
      const currentRemote = await getRemoteVault(draftEndpoint, draftToken);
      if (!currentRemote) {
        await putRemoteVault(draftEndpoint, draftToken, local, null);
        setStatus("Vault serverga shifrlangan holda yuborildi.");
      } else if (sameVault(local, currentRemote.vault)) {
        setStatus(`Vault sinxron. Server versiyasi: ${currentRemote.revision}.`);
      } else {
        setRemote(currentRemote);
        setStatus(`Serverda boshqa nusxa bor (versiya ${currentRemote.revision}). Qaysi nusxani ishlatishni tanlang.`);
      }
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Sinxronlashni bajarib bo‘lmadi.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadLocal() {
    if (!remote) return;
    setBusy(true);
    try {
      const local = await getLocalVault();
      if (!local) throw new Error("Qurilmada vault topilmadi.");
      await putRemoteVault(draftEndpoint, draftToken, local, remote.etag);
      setRemote(null);
      setStatus("Qurilmadagi shifrlangan vault serverga yuborildi.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Yuborib bo‘lmadi.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadRemote() {
    if (!remote) return;
    setBusy(true);
    try {
      await onRestore(remote.vault);
      setRemote(null);
      setStatus("Serverdagi vault tekshirildi va qurilmaga tiklandi.");
    } catch {
      setStatus("Serverdagi vault ochilmadi. Master password mosligini tekshiring; qurilmadagi nusxa o‘zgartirilmadi.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="dashboard-card sync-card">
    <div className="section-heading"><div><p className="eyebrow">Python backend</p><h2>Shifrlangan sinxronlash</h2></div><span className="sync-lock" aria-hidden="true">◆</span></div>
    <p className="muted">Server faqat shifrlangan vaultni ko‘radi. Master password va ochiq parollar yuborilmaydi.</p>
    <label htmlFor="sync-endpoint">Server manzili</label>
    <input id="sync-endpoint" type="url" value={draftEndpoint} onChange={(event) => setDraftEndpoint(event.target.value)} placeholder="http://127.0.0.1:8765" autoComplete="url" />
    <label htmlFor="sync-token">Sync token</label>
    <input id="sync-token" type="password" value={draftToken} onChange={(event) => setDraftToken(event.target.value)} placeholder="Python serverdagi SECUREPASS_SYNC_TOKEN" autoComplete="off" />
    <button className="button primary full-width" type="button" disabled={busy || !draftEndpoint || !draftToken} onClick={() => void syncNow()}>{busy ? "Sinxronlanmoqda…" : "Hozir sinxronlash"}</button>
    {status && <p className="sync-status" role="status">{status}</p>}
    {remote && <div className="sync-conflict"><strong>Vault nusxalari farq qiladi</strong><p>Serverdan olish qurilmadagi nusxani almashtiradi. Avval to‘g‘ri master password bilan ochilishi tekshiriladi.</p><div className="button-row"><button className="button secondary" type="button" disabled={busy} onClick={() => void downloadRemote()}>Serverdagini olish</button><button className="button ghost" type="button" disabled={busy} onClick={() => void uploadLocal()}>Qurilmadagisini yuborish</button></div></div>}
  </section>;
}
