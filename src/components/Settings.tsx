import type { EncryptedVault } from "../types";
import { SyncPanel } from "./SyncPanel";
import { BackupPanel } from "./BackupPanel";

interface SettingsProps {
  onEnableSiteWatch: () => Promise<void>;
  siteWatchMessage: string;
  syncEndpoint: string;
  syncToken: string;
  onSaveSyncSettings: (endpoint: string, token: string) => Promise<void>;
  getLocalEncryptedVault: () => Promise<EncryptedVault | null>;
  onRestoreRemoteVault: (vault: EncryptedVault) => Promise<void>;
}

export function Settings({
  onEnableSiteWatch,
  siteWatchMessage,
  syncEndpoint,
  syncToken,
  onSaveSyncSettings,
  getLocalEncryptedVault,
  onRestoreRemoteVault,
}: SettingsProps) {
  return (
    <div className="dashboard-content settings-content">
      <header className="page-heading">
        <p className="eyebrow">SecurePass</p>
        <h1>Sozlamalar</h1>
      </header>

      <section className="dashboard-card settings-card">
        <div>
          <h2>Saytdan parol saqlash</h2>
          <p className="muted">
            Joriy saytga ruxsat bering. Keyingi login paytida saqlash taklifi ko‘rsatiladi.
          </p>
          {siteWatchMessage && <p className="autofill-message" role="status">{siteWatchMessage}</p>}
        </div>
        <button
          className="button secondary"
          type="button"
          onClick={() => void onEnableSiteWatch().catch(() => undefined)}
        >
          Joriy saytni ulash
        </button>
      </section>

      <SyncPanel
        endpoint={syncEndpoint}
        token={syncToken}
        onSaveSettings={onSaveSyncSettings}
        getLocalVault={getLocalEncryptedVault}
        onRestore={onRestoreRemoteVault}
      />

      <BackupPanel getVault={getLocalEncryptedVault} onRestore={onRestoreRemoteVault} />

    </div>
  );
}
