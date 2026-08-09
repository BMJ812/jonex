import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { selectEnabledWidgetPlugins } from "./app/catalog";
import {
  getPlatformInfo,
  getPluginCatalog,
  getSettings,
  isNativeRuntime,
  resetSettings,
  saveSettings,
} from "./app/jonexApi";
import type {
  JonexSettings,
  ModuleId,
  PlatformInfo,
  PluginCatalog,
  SettingsLoadSource,
  WidgetContext,
} from "./app/models";
import {
  createDefaultSettings,
  isPluginEnabled,
  normalizeSettings,
  orderDashboardPlugins,
} from "./app/settings";
import { resolveWidget } from "./app/widgetRegistry";
import { JONEX_VERSION } from "./app/version";
import { Panel } from "./components/Panel";
import { SettingsModule } from "./components/SettingsModule";
import { useTelemetry } from "./hooks/useTelemetry";

interface NavigationItem {
  id: ModuleId;
  label: string;
  code: string;
}

const navigationItems: NavigationItem[] = [
  { id: "dashboard", label: "Operations", code: "01" },
  { id: "systems", label: "Systems", code: "02" },
  { id: "containers", label: "Containers", code: "03" },
  { id: "automation", label: "Automation", code: "04" },
  { id: "media", label: "Media", code: "05" },
  { id: "development", label: "Development", code: "06" },
  { id: "plugins", label: "Plugins", code: "07" },
  { id: "settings", label: "Settings", code: "08" },
];

const emptyCatalog: PluginCatalog = {
  plugins: [],
  diagnostics: [],
};

export function App() {
  const nativeRuntime = isNativeRuntime();
  const telemetry = useTelemetry();

  const [activeModule, setActiveModule] = useState<ModuleId>("dashboard");
  const [catalog, setCatalog] = useState<PluginCatalog>(emptyCatalog);
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [settings, setSettingsState] = useState<JonexSettings>(
    createDefaultSettings(),
  );
  const [settingsSource, setSettingsSource] =
    useState<SettingsLoadSource>("default");
  const [settingsStoragePath, setSettingsStoragePath] = useState("");
  const [settingsBackupPath, setSettingsBackupPath] =
    useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [pendingSettingsWrites, setPendingSettingsWrites] = useState(0);

  const settingsRef = useRef(settings);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const replaceSettings = useCallback((nextSettings: JonexSettings) => {
    const normalized = normalizeSettings(nextSettings);
    settingsRef.current = normalized;
    setSettingsState(normalized);
    return normalized;
  }, []);

  useEffect(() => {
    let active = true;

    const loadPlatform = async (): Promise<void> => {
      try {
        const [nextCatalog, nextPlatform, loadedSettings] = await Promise.all([
          getPluginCatalog(),
          getPlatformInfo(),
          getSettings(),
        ]);

        if (active) {
          setCatalog(nextCatalog);
          setPlatform(nextPlatform);
          setCatalogError(null);

          const nextSettings = replaceSettings(loadedSettings.settings);
          setSettingsSource(loadedSettings.source);
          setSettingsStoragePath(loadedSettings.storagePath);
          setSettingsBackupPath(loadedSettings.backupPath);
          setSettingsError(null);
          setSettingsLoaded(true);
          setActiveModule(nextSettings.lastModule);
        }
      } catch (error) {
        if (active) {
          const message =
            error instanceof Error ? error.message : String(error);
          setCatalogError(message);
          setSettingsError(message);
          setSettingsLoaded(true);
        }
      }
    };

    void loadPlatform();

    return () => {
      active = false;
    };
  }, [replaceSettings]);

  const queueSettingsSave = useCallback(
    (nextSettings: JonexSettings): void => {
      const normalized = replaceSettings(nextSettings);

      setPendingSettingsWrites((count) => count + 1);
      setSettingsError(null);

      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          const saved = await saveSettings(normalized);

          if (settingsRef.current === normalized) {
            replaceSettings(saved);
          }

          setSettingsSource("stored");
        })
        .catch((error) => {
          setSettingsError(
            error instanceof Error ? error.message : String(error),
          );
        })
        .finally(() => {
          setPendingSettingsWrites((count) => Math.max(0, count - 1));
        });
    },
    [replaceSettings],
  );

  const updateSettings = useCallback(
    (transform: (current: JonexSettings) => JonexSettings): void => {
      const next = transform(settingsRef.current);
      queueSettingsSave(next);
    },
    [queueSettingsSave],
  );

  const handleModuleChange = useCallback(
    (moduleId: ModuleId): void => {
      setActiveModule(moduleId);

      if (settingsLoaded) {
        updateSettings((current) => ({
          ...current,
          lastModule: moduleId,
        }));
      }
    },
    [settingsLoaded, updateSettings],
  );

  const handlePluginToggle = useCallback(
    (pluginId: string): void => {
      const plugin = catalog.plugins.find(
        ({ manifest }) => manifest.id === pluginId,
      );

      if (!plugin) {
        return;
      }

      updateSettings((current) => ({
        ...current,
        pluginStates: {
          ...current.pluginStates,
          [pluginId]: !isPluginEnabled(plugin, current),
        },
      }));
    },
    [catalog.plugins, updateSettings],
  );

  const handleMoveWidget = useCallback(
    (pluginId: string, direction: -1 | 1): void => {
      updateSettings((current) => {
        const widgetPlugins = orderDashboardPlugins(
          catalog.plugins.filter(
            ({ manifest }) =>
              manifest.entry.kind === "widget" &&
              manifest.capabilities.includes("dashboard.widget"),
          ),
          current,
        );

        const order = widgetPlugins.map(({ manifest }) => manifest.id);
        const currentIndex = order.indexOf(pluginId);
        const destinationIndex = currentIndex + direction;

        if (
          currentIndex < 0 ||
          destinationIndex < 0 ||
          destinationIndex >= order.length
        ) {
          return current;
        }

        [order[currentIndex], order[destinationIndex]] = [
          order[destinationIndex],
          order[currentIndex],
        ];

        return {
          ...current,
          dashboardWidgetOrder: order,
        };
      });
    },
    [catalog.plugins, updateSettings],
  );

  const handleResetSettings = useCallback((): void => {
    setPendingSettingsWrites((count) => count + 1);
    setSettingsError(null);

    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const loaded = await resetSettings();
        const nextSettings = replaceSettings(loaded.settings);

        setSettingsSource(loaded.source);
        setSettingsStoragePath(loaded.storagePath);
        setSettingsBackupPath(loaded.backupPath);
        setActiveModule(nextSettings.lastModule);
      })
      .catch((error) => {
        setSettingsError(
          error instanceof Error ? error.message : String(error),
        );
      })
      .finally(() => {
        setPendingSettingsWrites((count) => Math.max(0, count - 1));
      });
  }, [replaceSettings]);

  const enabledWidgets = useMemo(
    () => selectEnabledWidgetPlugins(catalog, settings),
    [catalog, settings],
  );

  const connectionState = telemetry.error
    ? "degraded"
    : telemetry.snapshot
      ? "online"
      : "connecting";

  const widgetContext: WidgetContext = {
    telemetry: telemetry.snapshot,
    telemetryError: telemetry.error,
    isNative: nativeRuntime,
  };

  return (
    <div className="jonex-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand__mark" aria-hidden="true">
            JØ
          </div>
          <div>
            <div className="brand__name">JØNEX</div>
            <div className="brand__subtitle">
              OPERATIONS PLATFORM // {platform?.appVersion ?? JONEX_VERSION}
            </div>
          </div>
        </div>

        <div className="topbar__telemetry">
          <div>
            <span>NODE</span>
            <strong>{telemetry.snapshot?.host.hostname ?? "ACQUIRING"}</strong>
          </div>
          <div>
            <span>RUNTIME</span>
            <strong>{nativeRuntime ? "TAURI / RUST" : "WEB FALLBACK"}</strong>
          </div>
          <div>
            <span>STATUS</span>
            <strong
              className={`connection-state connection-state--${connectionState}`}
            >
              {connectionState.toUpperCase()}
            </strong>
          </div>
        </div>
      </header>

      <div className="shell-grid">
        <aside className="navigation">
          <div className="navigation__label">CONTROL INDEX</div>

          <nav aria-label="JØNEX modules">
            {navigationItems.map((item) => (
              <button
                type="button"
                className={`navigation-item ${
                  activeModule === item.id ? "navigation-item--active" : ""
                }`}
                key={item.id}
                onClick={() => handleModuleChange(item.id)}
              >
                <span className="navigation-item__code">{item.code}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="navigation__footer">
            <div className="micro-label">BUILD TARGET</div>
            <strong>
              {platform
                ? `${platform.targetOs}/${platform.targetArch}`
                : "RESOLVING"}
            </strong>
            <span>
              {platform?.debugBuild
                ? "Development channel"
                : "Release channel"}
            </span>
          </div>
        </aside>

        <main className="workspace">
          <div className="workspace-heading">
            <div>
              <div className="workspace-heading__eyebrow">
                JØNEX // {activeModule.toUpperCase()}
              </div>
              <h1>
                {activeModule === "dashboard"
                  ? "Operational overview"
                  : navigationItems.find((item) => item.id === activeModule)
                      ?.label ?? "Module"}
              </h1>
            </div>

            <div className="workspace-heading__status">
              <span>{enabledWidgets.length} active widgets</span>
              <span>{catalog.plugins.length} plugins found</span>
              <span>
                {pendingSettingsWrites > 0
                  ? "state syncing"
                  : settingsLoaded
                    ? "state persistent"
                    : "state loading"}
              </span>
            </div>
          </div>

          {activeModule === "dashboard" ? (
            <div className="dashboard-grid">
              {enabledWidgets.map(({ manifest }) => {
                const Widget = resolveWidget(manifest.entry.component);

                if (!Widget) {
                  return (
                    <Panel
                      key={manifest.id}
                      title={manifest.name}
                      eyebrow={`PLUGIN // ${manifest.id.toUpperCase()}`}
                    >
                      <div className="inline-warning">
                        Component <code>{manifest.entry.component}</code> is not
                        registered in this shell build.
                      </div>
                    </Panel>
                  );
                }

                return <Widget key={manifest.id} {...widgetContext} />;
              })}

              {enabledWidgets.length === 0 ? (
                <Panel title="No active widgets" eyebrow="PLUGIN HOST">
                  <div className="empty-state">
                    Dashboard widgets are disabled. Enable at least one widget
                    in Settings.
                  </div>
                </Panel>
              ) : null}
            </div>
          ) : activeModule === "settings" ? (
            <SettingsModule
              settings={settings}
              source={settingsSource}
              storagePath={settingsStoragePath}
              backupPath={settingsBackupPath}
              plugins={catalog.plugins}
              pendingWrites={pendingSettingsWrites}
              error={settingsError}
              onTogglePlugin={handlePluginToggle}
              onMoveWidget={handleMoveWidget}
              onReset={handleResetSettings}
            />
          ) : (
            <ModulePlaceholder
              moduleId={activeModule}
              pluginCount={catalog.plugins.length}
            />
          )}
        </main>

        <aside className="right-rail">
          <Panel
            title="Plugin Host"
            eyebrow="RUNTIME STATUS"
            action={
              <span
                className={`status-chip ${
                  catalogError ? "status-chip--warning" : "status-chip--online"
                }`}
              >
                {catalogError ? "FAULT" : "READY"}
              </span>
            }
          >
            <div className="plugin-summary">
              <div>
                <span>DISCOVERED</span>
                <strong>{catalog.plugins.length}</strong>
              </div>
              <div>
                <span>ACTIVE</span>
                <strong>{enabledWidgets.length}</strong>
              </div>
              <div>
                <span>DIAGNOSTICS</span>
                <strong>{catalog.diagnostics.length}</strong>
              </div>
            </div>

            <div className="plugin-list">
              {catalog.plugins.map((plugin) => {
                const { manifest } = plugin;
                const enabled = isPluginEnabled(plugin, settings);

                return (
                  <div className="plugin-list__item" key={manifest.id}>
                    <div>
                      <strong>{manifest.name}</strong>
                      <span>{manifest.id}</span>
                    </div>
                    <span className="plugin-version">
                      {enabled ? `v${manifest.version}` : "OFF"}
                    </span>
                  </div>
                );
              })}
            </div>

            {catalogError ? (
              <div className="inline-warning">{catalogError}</div>
            ) : null}

            {catalog.diagnostics.map((diagnostic) => (
              <div
                className="inline-warning"
                key={`${diagnostic.path}:${diagnostic.message}`}
              >
                {diagnostic.message}
              </div>
            ))}
          </Panel>

          <Panel title="Command Channel" eyebrow="UNIFIED SEARCH // STAGED">
            <button
              type="button"
              className="command-prompt"
              onClick={() => {
                window.alert(
                  "Unified command search is scheduled for JØNEX 0.2.",
                );
              }}
            >
              <span>&gt;_</span>
              <span>Search systems, actions, services...</span>
              <kbd>CTRL K</kbd>
            </button>

            <div className="staged-list">
              <div>
                <span className="staged-list__marker" />
                Podman control adapter
              </div>
              <div>
                <span className="staged-list__marker" />
                Home Assistant event bridge
              </div>
              <div>
                <span className="staged-list__marker" />
                Remote node registry
              </div>
            </div>
          </Panel>
        </aside>
      </div>

      <footer className="statusbar">
        <div>
          <span className="statusbar__pulse" />
          LOCAL-FIRST CHANNEL ACTIVE
        </div>
        <div>
          STATE{" "}
          {pendingSettingsWrites > 0
            ? "SYNCING"
            : settingsError
              ? "FAULT"
              : "STABLE"}
        </div>
        <div>
          {platform ? `CORE ${platform.appVersion}` : "CORE INITIALIZING"}
        </div>
      </footer>
    </div>
  );
}

interface ModulePlaceholderProps {
  moduleId: Exclude<ModuleId, "dashboard" | "settings">;
  pluginCount: number;
}

function ModulePlaceholder({
  moduleId,
  pluginCount,
}: ModulePlaceholderProps) {
  const module = navigationItems.find((item) => item.id === moduleId);

  return (
    <Panel
      title={`${module?.label ?? "Module"} subsystem`}
      eyebrow={`MODULE // ${moduleId.toUpperCase()}`}
    >
      <div className="module-placeholder">
        <div className="module-placeholder__code">{module?.code ?? "--"}</div>
        <div>
          <h2>Subsystem boundary established</h2>
          <p>
            This module is intentionally isolated from the initial telemetry
            and plugin-host milestone. Its navigation boundary is operational
            and ready for implementation.
          </p>
          <div className="module-placeholder__metadata">
            <span>{pluginCount} plugins visible</span>
            <span>API contract pending</span>
            <span>Execution disabled</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}