import { useRef, useState, type ChangeEvent } from "react";
import type { EncryptedVault } from "../types";

interface BackupPanelProps {
  getVault: () => Promise<EncryptedVault | null>;
  onRestore: (vault: EncryptedVault) => Promise<void>;
}

function isEncryptedVault(value: unknown): value is EncryptedVault {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.version === 1 && typeof record.salt === "string"
    && typeof record.iv === "string" && typeof record.ciphertext === "string";
}

export function BackupPanel({ getVault, onRestore }: BackupPanelProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function exportBackup() {
    setBusy(true);
    setStatus("");
    try {
      const vault = await getVault();
      if (!vault) throw new Error("Eksport qilish uchun shifrlangan vault topilmadi.");
      const backup = { format: "securepass-encrypted-backup", version: 1, vault };
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `securepass-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("Shifrlangan zaxira nusxasi yuklab olindi. Faylni xavfsiz joyda saqlang.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Zaxira nusxasini yaratib bo‘lmadi.");
    } finally {
      setBusy(false);
    }
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setBusy(true);
    setStatus("");
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("Zaxira fayli 10 MiB dan katta.");
      const parsed: unknown = JSON.parse(await file.text());
      if (typeof parsed !== "object" || parsed === null) throw new Error("Zaxira fayli formati noto‘g‘ri.");
      const backup = parsed as Record<string, unknown>;
      if (backup.format !== "securepass-encrypted-backup" || backup.version !== 1 || !isEncryptedVault(backup.vault)) {
        throw new Error("Bu SecurePass’ning mos zaxira fayli emas.");
      }
      if (!window.confirm("Import qilingan zaxira hozirgi vaultni to‘liq almashtiradi. Davom etilsinmi?")) {
        setStatus("Import bekor qilindi.");
        return;
      }
      await onRestore(backup.vault);
      setStatus("Zaxira tiklandi. Uni ochish uchun o‘sha master parol kerak bo‘ladi.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Zaxirani tiklab bo‘lmadi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="dashboard-card backup-card">
      <div>
        <h2>Zaxira nusxasi</h2>
        <p className="muted">Backup faylida faqat shifrlangan vault bo‘ladi. Uni ochish uchun master parolingiz kerak.</p>
      </div>
      <div className="backup-actions">
        <button className="button secondary" type="button" disabled={busy} onClick={() => void exportBackup()}>
          Shifrlangan nusxani yuklab olish
        </button>
        <button className="button ghost" type="button" disabled={busy} onClick={() => fileInput.current?.click()}>
          Zaxiradan tiklash
        </button>
        <input ref={fileInput} className="visually-hidden" type="file" accept=".json,application/json" onChange={(event) => void importBackup(event)} />
      </div>
      {status && <p className="sync-status" role="status">{status}</p>}
    </section>
  );
}
