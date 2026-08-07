export interface TelemetrySnapshot {
  sequence: number;
  sampledAtUnixMs: number;
  host: HostSnapshot;
  cpu: CpuSnapshot;
  memory: MemorySnapshot;
  disks: DiskSnapshot[];
}

export interface HostSnapshot {
  hostname: string;
  operatingSystem: string;
  kernelVersion: string;
  uptimeSeconds: number;
}

export interface CpuSnapshot {
  usagePercent: number;
  logicalCores: number;
  physicalCores: number;
}

export interface MemorySnapshot {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usagePercent: number;
}

export interface DiskSnapshot {
  name: string;
  mountPoint: string;
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usagePercent: number;
  removable: boolean;
}

export type PluginEntryKind = "widget" | "integration" | "service";

export interface PluginManifest {
  schemaVersion: number;
  id: string;
  name: string;
  version: string;
  description: string;
  publisher: string;
  entry: {
    kind: PluginEntryKind;
    component: string;
  };
  permissions: string[];
  capabilities: string[];
  defaultEnabled: boolean;
}

export interface PluginRecord {
  manifest: PluginManifest;
  sourcePath: string;
}

export interface PluginDiagnostic {
  path: string;
  message: string;
}

export interface PluginCatalog {
  plugins: PluginRecord[];
  diagnostics: PluginDiagnostic[];
}

export interface PlatformInfo {
  appVersion: string;
  targetOs: string;
  targetArch: string;
  debugBuild: boolean;
}

export interface WidgetContext {
  telemetry: TelemetrySnapshot | null;
  telemetryError: string | null;
  isNative: boolean;
}
