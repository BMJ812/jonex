import { useState, type FormEvent } from "react";

import {
  getCredentialVaultStatus,
  lockCredentialVault,
  unlockCredentialVault,
} from "../app/credentialVault";
import type {
  JonexSettings,
  PluginRecord,
  SettingsLoadSource,
} from "../app/models";
import {
  isPluginEnabled,
  orderDashboardPlugins,
} from "../app/settings";
import { Panel } from "./Panel";
import "./settings-module.css";

interface SettingsModuleProps {
  settings: JonexSettings;
  source: SettingsLoadSource;
  storagePath: string;
  backupPath: string | null;
  plugins: PluginRecord[];
  pendingWrites: number;
  error: string | null;
  onTogglePlugin: (pluginId: string) => void;
  onMoveWidget: (pluginId: string, direction: -1 | 1) => void;
  onReset: () => void;
}

export function SettingsModule({
  settings,
  source,
  storagePath,
  backupPath,
  plugins,
  pendingWrites,
  error,
  onTogglePlugin,
  onMoveWidget,
  onReset,
}: SettingsModuleProps) {
  const widgetPlugins = orderDashboardPlugins(
    plugins.filter(
      ({ manifest }) =>
        manifest.entry.kind === "widget" &&
        manifest.capabilities.includes("dashboard.widget"),
    ),
    settings,
  );

  return (
    <div className="settings-grid">
      <Panel
        title="Persistence Core"
        eyebrow="SETTINGS // LOCAL STATE"
        action={
          <span
            className={`status-chip ${
              error ? "status-chip--warning" : "status-chip--online"
            }`}
          >
            {error ? "FAULT" : pendingWrites > 0 ? "SYNCING" : "READY"}
          </span>
        }
      >
        <div className="settings-summary">
          <div>
            <span>SCHEMA</span>
            <strong>{settings.schemaVersion}</strong>
          </div>
          <div>
            <span>LOAD SOURCE</span>
            <strong>{source.toUpperCase()}</strong>
          </div>
          <div>
            <span>LAST MODULE</span>
            <strong>{settings.lastModule.toUpperCase()}</strong>
          </div>
          <div>
            <span>PLUGIN OVERRIDES</span>
            <strong>{Object.keys(settings.pluginStates).length}</strong>
          </div>
        </div>

        <div className="settings-path">
          <span>STORAGE PATH</span>
          <code>{storagePath || "RESOLVING"}</code>
        </div>

        {backupPath ? (
          <div className="settings-recovery">
            <strong>RECOVERY COMPLETED</strong>
            <span>
              A malformed settings file was preserved at:
              <code>{backupPath}</code>
            </span>
          </div>
        ) : null}

        {error ? <div className="inline-warning">{error}</div> : null}
      </Panel>

      <Panel
        title="Plugin State"
        eyebrow="SETTINGS // CAPABILITY CONTROL"
      >
        <div className="settings-list">
          {plugins.map((plugin) => {
            const enabled = isPluginEnabled(plugin, settings);
            const explicit =
              settings.pluginStates[plugin.manifest.id] !== undefined;

            return (
              <div className="settings-row" key={plugin.manifest.id}>
                <div className="settings-row__identity">
                  <strong>{plugin.manifest.name}</strong>
                  <span>{plugin.manifest.id}</span>
                  <small>
                    {explicit
                      ? "Persisted override"
                      : `Manifest default: ${
                          plugin.manifest.defaultEnabled
                            ? "enabled"
                            : "disabled"
                        }`}
                  </small>
                </div>

                <button
                  type="button"
                  className={`settings-toggle ${
                    enabled ? "settings-toggle--enabled" : ""
                  }`}
                  aria-pressed={enabled}
                  onClick={() => onTogglePlugin(plugin.manifest.id)}
                >
                  {enabled ? "ENABLED" : "DISABLED"}
                </button>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel
        title="Dashboard Order"
        eyebrow="SETTINGS // WIDGET SEQUENCE"
      >
        <div className="settings-order">
          {widgetPlugins.map((plugin, index) => (
            <div className="settings-order__row" key={plugin.manifest.id}>
              <span className="settings-order__index">
                {(index + 1).toString().padStart(2, "0")}
              </span>

              <div>
                <strong>{plugin.manifest.name}</strong>
                <span>
                  {isPluginEnabled(plugin, settings)
                    ? "ACTIVE"
                    : "DISABLED"}
                </span>
              </div>

              <div className="settings-order__controls">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => onMoveWidget(plugin.manifest.id, -1)}
                  aria-label={`Move ${plugin.manifest.name} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={index === widgetPlugins.length - 1}
                  onClick={() => onMoveWidget(plugin.manifest.id, 1)}
                  aria-label={`Move ${plugin.manifest.name} down`}
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <CredentialVaultPanel />

      <Panel
        title="Recovery"
        eyebrow="SETTINGS // DEFAULT PROFILE"
      >
        <div className="settings-reset">
          <div>
            <strong>Restore JØNEX defaults</strong>
            <p>
              Clears plugin overrides, restores dashboard ordering, and
              returns the startup module to Operations. Runtime logs and
              plugin files are not removed.
            </p>
          </div>

          <button
            type="button"
            onClick={onReset}
            disabled={pendingWrites > 0}
          >
            RESET LOCAL STATE
          </button>
        </div>
      </Panel>
    </div>
  );
}

function CredentialVaultPanel() {
  const initialStatus = getCredentialVaultStatus();
  const [passphrase, setPassphrase] = useState("");
  const [unlocked, setUnlocked] = useState(initialStatus.unlocked);
  const [vaultPath, setVaultPath] = useState<string | null>(
    initialStatus.path,
  );
  const [busy, setBusy] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);

  const handleUnlock = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    setBusy(true);
    setVaultError(null);

    void unlockCredentialVault(passphrase)
      .then((status) => {
        setUnlocked(status.unlocked);
        setVaultPath(status.path);
        setPassphrase("");
      })
      .catch((error) => {
        setVaultError(
          error instanceof Error ? error.message : String(error),
        );
      })
      .finally(() => {
        setBusy(false);
      });
  };

  const handleLock = (): void => {
    setBusy(true);
    setVaultError(null);

    void lockCredentialVault()
      .then(() => {
        setUnlocked(false);
        setVaultPath(null);
        setPassphrase("");
      })
      .catch((error) => {
        setVaultError(
          error instanceof Error ? error.message : String(error),
        );
      })
      .finally(() => {
        setBusy(false);
      });
  };

  return (
    <Panel
      title="Secure Credential Vault"
      eyebrow="SETTINGS // STRONGHOLD"
      action={
        <span
          className={`status-chip ${
            vaultError
              ? "status-chip--warning"
              : unlocked
                ? "status-chip--online"
                : "status-chip--neutral"
          }`}
        >
          {vaultError ? "FAULT" : unlocked ? "UNLOCKED" : "LOCKED"}
        </span>
      }
    >
      <div className="credential-vault">
        <div className="credential-vault__description">
          <strong>Encrypted integration credentials</strong>
          <p>
            JØNEX keeps service secrets in an encrypted Stronghold snapshot,
            separate from the remote service registry. The vault passphrase is
            required after JØNEX starts and is not persisted in settings.
          </p>
        </div>

        {unlocked ? (
          <>
            <div className="settings-path">
              <span>VAULT SNAPSHOT</span>
              <code>{vaultPath ?? "ACTIVE"}</code>
            </div>

            <button
              type="button"
              className="credential-vault__button"
              disabled={busy}
              onClick={handleLock}
            >
              {busy ? "LOCKING..." : "LOCK VAULT"}
            </button>
          </>
        ) : (
          <form
            className="credential-vault__form"
            onSubmit={handleUnlock}
          >
            <label>
              <span>VAULT PASSPHRASE</span>
              <input
                type="password"
                autoComplete="off"
                value={passphrase}
                disabled={busy}
                minLength={12}
                onChange={(event) => setPassphrase(event.target.value)}
                placeholder="12+ characters"
              />
            </label>

            <button
              type="submit"
              className="credential-vault__button"
              disabled={busy || passphrase.trim().length < 12}
            >
              {busy ? "UNLOCKING..." : "UNLOCK VAULT"}
            </button>
          </form>
        )}

        {vaultError ? (
          <div className="inline-warning">{vaultError}</div>
        ) : null}

        <div className="credential-vault__note">
          This slice establishes the encrypted vault only. Home Assistant token
          enrollment and authenticated probes are wired in the next step.
        </div>
      </div>
    </Panel>
  );
}
