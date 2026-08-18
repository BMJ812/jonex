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

export type ModuleId =
  | "dashboard"
  | "systems"
  | "containers"
  | "automation"
  | "media"
  | "development"
  | "plugins"
  | "settings";

export interface JonexSettings {
  schemaVersion: number;
  lastModule: ModuleId;
  pluginStates: Record<string, boolean>;
  dashboardWidgetOrder: string[];
  updatedAtUnixMs: number;
}

export type SettingsLoadSource =
  | "default"
  | "stored"
  | "migrated"
  | "recovered";

export interface SettingsLoadResult {
  settings: JonexSettings;
  source: SettingsLoadSource;
  storagePath: string;
  backupPath: string | null;
}

export type ServiceKind =
  | "home_assistant"
  | "unraid"
  | "jellyfin"
  | "plex"
  | "generic";

export interface ServiceRecord {
  id: string;
  kind: ServiceKind;
  name: string;
  baseUrl: string;
  enabled: boolean;
}

export interface ServiceRegistry {
  schemaVersion: number;
  services: ServiceRecord[];
  updatedAtUnixMs: number;
}

export type ServiceRegistryLoadSource =
  | "default"
  | "stored"
  | "recovered";

export interface ServiceRegistryLoadResult {
  registry: ServiceRegistry;
  source: ServiceRegistryLoadSource;
  storagePath: string;
  backupPath: string | null;
}

export type ServiceHealthStatus =
  | "online"
  | "auth_required"
  | "auth_failed"
  | "offline"
  | "fault"
  | "unsupported";

export interface ServiceProbeResult {
  serviceId: string;
  status: ServiceHealthStatus;
  probeUrl: string;
  httpStatus: number | null;
  latencyMs: number;
  checkedAtUnixMs: number;
  detail: string;
}
