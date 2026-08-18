import { invoke } from "@tauri-apps/api/core";

import type {
  JonexSettings,
  PlatformInfo,
  PluginCatalog,
  ServiceProbeResult,
  ServiceRecord,
  ServiceRegistry,
  ServiceRegistryLoadResult,
  SettingsLoadResult,
  TelemetrySnapshot,
} from "./models";
import {
  createDefaultSettings,
  normalizeSettings,
} from "./settings";
import { JONEX_VERSION } from "./version";

const browserSettingsKey = "jonex.settings.v1";
const browserServiceRegistryKey = "jonex.services.v1";

export function isNativeRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getSystemSnapshot(): Promise<TelemetrySnapshot> {
  if (isNativeRuntime()) {
    return invoke<TelemetrySnapshot>("get_system_snapshot");
  }

  return createMockSnapshot();
}

export async function getPluginCatalog(): Promise<PluginCatalog> {
  if (isNativeRuntime()) {
    return invoke<PluginCatalog>("list_plugins");
  }

  return mockPluginCatalog;
}

export async function getPlatformInfo(): Promise<PlatformInfo> {
  if (isNativeRuntime()) {
    return invoke<PlatformInfo>("get_platform_info");
  }

  return {
    appVersion: JONEX_VERSION,
    targetOs: "browser",
    targetArch: "development",
    debugBuild: true,
  };
}

export async function getSettings(): Promise<SettingsLoadResult> {
  if (isNativeRuntime()) {
    return invoke<SettingsLoadResult>("get_settings");
  }

  const stored = window.localStorage.getItem(browserSettingsKey);

  if (!stored) {
    return {
      settings: createDefaultSettings(),
      source: "default",
      storagePath: `localStorage:${browserSettingsKey}`,
      backupPath: null,
    };
  }

  try {
    return {
      settings: normalizeSettings(
        JSON.parse(stored) as Partial<JonexSettings>,
      ),
      source: "stored",
      storagePath: `localStorage:${browserSettingsKey}`,
      backupPath: null,
    };
  } catch {
    window.localStorage.removeItem(browserSettingsKey);

    return {
      settings: createDefaultSettings(),
      source: "recovered",
      storagePath: `localStorage:${browserSettingsKey}`,
      backupPath: null,
    };
  }
}

export async function saveSettings(
  settings: JonexSettings,
): Promise<JonexSettings> {
  if (isNativeRuntime()) {
    return invoke<JonexSettings>("save_settings", { settings });
  }

  const normalized = normalizeSettings(settings);
  const saved = {
    ...normalized,
    updatedAtUnixMs: Date.now(),
  };

  window.localStorage.setItem(
    browserSettingsKey,
    JSON.stringify(saved),
  );

  return saved;
}

export async function resetSettings(): Promise<SettingsLoadResult> {
  if (isNativeRuntime()) {
    return invoke<SettingsLoadResult>("reset_settings");
  }

  const settings = {
    ...createDefaultSettings(),
    updatedAtUnixMs: Date.now(),
  };

  window.localStorage.setItem(
    browserSettingsKey,
    JSON.stringify(settings),
  );

  return {
    settings,
    source: "default",
    storagePath: `localStorage:${browserSettingsKey}`,
    backupPath: null,
  };
}

export async function getServiceRegistry(): Promise<ServiceRegistryLoadResult> {
  if (isNativeRuntime()) {
    return invoke<ServiceRegistryLoadResult>("get_service_registry");
  }

  const stored = window.localStorage.getItem(browserServiceRegistryKey);

  if (!stored) {
    return {
      registry: createEmptyServiceRegistry(),
      source: "default",
      storagePath: `localStorage:${browserServiceRegistryKey}`,
      backupPath: null,
    };
  }

  try {
    const registry = JSON.parse(stored) as ServiceRegistry;

    if (!Array.isArray(registry.services)) {
      throw new Error("service registry services must be an array");
    }

    return {
      registry,
      source: "stored",
      storagePath: `localStorage:${browserServiceRegistryKey}`,
      backupPath: null,
    };
  } catch {
    window.localStorage.removeItem(browserServiceRegistryKey);

    return {
      registry: createEmptyServiceRegistry(),
      source: "recovered",
      storagePath: `localStorage:${browserServiceRegistryKey}`,
      backupPath: null,
    };
  }
}

export async function saveServiceRegistry(
  registry: ServiceRegistry,
): Promise<ServiceRegistry> {
  if (isNativeRuntime()) {
    return invoke<ServiceRegistry>("save_service_registry", { registry });
  }

  const saved = {
    ...registry,
    schemaVersion: 1,
    services: registry.services.map((service) => ({
      ...service,
      id: service.id.trim(),
      name: service.name.trim(),
      baseUrl: service.baseUrl.trim().replace(/\/+$/, ""),
    })),
    updatedAtUnixMs: Date.now(),
  };

  window.localStorage.setItem(
    browserServiceRegistryKey,
    JSON.stringify(saved),
  );

  return saved;
}

export async function probeRemoteService(
  service: ServiceRecord,
  bearerToken: string | null = null,
): Promise<ServiceProbeResult> {
  if (isNativeRuntime()) {
    return invoke<ServiceProbeResult>("probe_remote_service", {
      service,
      bearerToken,
    });
  }

  return {
    serviceId: service.id,
    status: "unsupported",
    probeUrl:
      service.kind === "home_assistant"
        ? `${service.baseUrl.replace(/\/+$/, "")}/api/`
        : `${service.baseUrl.replace(/\/+$/, "")}/`,
    httpStatus: null,
    latencyMs: 0,
    checkedAtUnixMs: Date.now(),
    detail: "Native service probes require the JØNEX desktop runtime.",
  };
}

function createEmptyServiceRegistry(): ServiceRegistry {
  return {
    schemaVersion: 1,
    services: [],
    updatedAtUnixMs: 0,
  };
}

function createMockSnapshot(): TelemetrySnapshot {
  const elapsed = performance.now() / 1000;
  const totalMemory = 32 * 1024 ** 3;
  const memoryPercent = 41 + Math.sin(elapsed / 5) * 6;
  const usedMemory = totalMemory * (memoryPercent / 100);
  const diskTotal = 1024 * 1024 ** 3;
  const diskPercent = 46.8;

  return {
    sequence: Math.floor(elapsed),
    sampledAtUnixMs: Date.now(),
    host: {
      hostname: "jonex-browser",
      operatingSystem: "Interface development mode",
      kernelVersion: "native telemetry unavailable",
      uptimeSeconds: Math.floor(elapsed),
    },
    cpu: {
      usagePercent: Number((24 + Math.sin(elapsed * 0.8) * 11).toFixed(1)),
      logicalCores: 16,
      physicalCores: 8,
    },
    memory: {
      totalBytes: totalMemory,
      usedBytes: Math.floor(usedMemory),
      availableBytes: Math.floor(totalMemory - usedMemory),
      usagePercent: Number(memoryPercent.toFixed(1)),
    },
    disks: [
      {
        name: "jonex-development-volume",
        mountPoint: "C:\\",
        totalBytes: diskTotal,
        usedBytes: Math.floor(diskTotal * (diskPercent / 100)),
        availableBytes: Math.floor(diskTotal * ((100 - diskPercent) / 100)),
        usagePercent: diskPercent,
        removable: false,
      },
    ],
  };
}

const mockPluginCatalog: PluginCatalog = {
  plugins: [
    {
      sourcePath: "plugins/system-overview/manifest.json",
      manifest: {
        schemaVersion: 1,
        id: "jonex.system-overview",
        name: "System Overview",
        version: "0.1.0",
        description:
          "Displays native CPU, memory, storage, host, and uptime telemetry.",
        publisher: "JØNEX Project",
        entry: {
          kind: "widget",
          component: "system.telemetry",
        },
        permissions: ["telemetry:read"],
        capabilities: ["dashboard.widget"],
        defaultEnabled: true,
      },
    },
    {
      sourcePath: "plugins/local-clock/manifest.json",
      manifest: {
        schemaVersion: 1,
        id: "jonex.local-clock",
        name: "Local Chronometer",
        version: "0.1.0",
        description: "Displays local date, time, and session state.",
        publisher: "JØNEX Project",
        entry: {
          kind: "widget",
          component: "system.clock",
        },
        permissions: [],
        capabilities: ["dashboard.widget"],
        defaultEnabled: true,
      },
    },
  ],
  diagnostics: [],
};
