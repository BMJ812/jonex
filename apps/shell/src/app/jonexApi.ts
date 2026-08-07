import { invoke } from "@tauri-apps/api/core";

import type {
  PlatformInfo,
  PluginCatalog,
  TelemetrySnapshot,
} from "./models";

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
    appVersion: "0.1.0",
    targetOs: "browser",
    targetArch: "development",
    debugBuild: true,
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
