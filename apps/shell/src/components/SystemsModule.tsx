import type {
  PlatformInfo,
  TelemetrySnapshot,
} from "../app/models";
import { Panel } from "./Panel";

interface SystemsModuleProps {
  telemetry: TelemetrySnapshot | null;
  telemetryError: string | null;
  platform: PlatformInfo | null;
  isNative: boolean;
}

export function SystemsModule({
  telemetry,
  telemetryError,
  platform,
  isNative,
}: SystemsModuleProps) {
  return (
    <div className="dashboard-grid">
      <Panel
        title="Local Node"
        eyebrow="SYSTEMS // HOST"
        action={
          <span
            className={`status-chip ${
              telemetryError
                ? "status-chip--warning"
                : telemetry
                  ? "status-chip--online"
                  : ""
            }`}
          >
            {telemetryError ? "FAULT" : telemetry ? "ONLINE" : "ACQUIRING"}
          </span>
        }
      >
        {telemetryError ? (
          <div className="inline-warning">{telemetryError}</div>
        ) : null}

        {!telemetry ? (
          <div className="empty-state">
            Acquiring native system telemetry...
          </div>
        ) : (
          <>
            <div className="plugin-summary">
              <div>
                <span>CPU</span>
                <strong>{telemetry.cpu.usagePercent.toFixed(1)}%</strong>
              </div>

              <div>
                <span>MEMORY</span>
                <strong>{telemetry.memory.usagePercent.toFixed(1)}%</strong>
              </div>

              <div>
                <span>UPTIME</span>
                <strong>{formatUptime(telemetry.host.uptimeSeconds)}</strong>
              </div>
            </div>

            <div className="plugin-list">
              <SystemRow
                label="Hostname"
                value={telemetry.host.hostname}
              />
              <SystemRow
                label="Operating System"
                value={telemetry.host.operatingSystem}
              />
              <SystemRow
                label="Kernel"
                value={telemetry.host.kernelVersion}
              />
              <SystemRow
                label="Processor Topology"
                value={`${telemetry.cpu.logicalCores} logical / ${telemetry.cpu.physicalCores} physical cores`}
              />
              <SystemRow
                label="Memory"
                value={`${formatBytes(telemetry.memory.usedBytes)} used / ${formatBytes(
                  telemetry.memory.totalBytes,
                )} total`}
              />
              <SystemRow
                label="Runtime"
                value={isNative ? "Tauri / Rust native" : "Browser fallback"}
              />
              <SystemRow
                label="Build Target"
                value={
                  platform
                    ? `${platform.targetOs}/${platform.targetArch}`
                    : "Resolving"
                }
              />
              <SystemRow
                label="JØNEX Core"
                value={platform?.appVersion ?? "Resolving"}
              />
            </div>
          </>
        )}
      </Panel>

      <Panel
        title="Storage Topology"
        eyebrow="SYSTEMS // FILESYSTEMS"
        action={
          telemetry ? (
            <span className="status-chip status-chip--online">
              {telemetry.disks.length} VOLUME
              {telemetry.disks.length === 1 ? "" : "S"}
            </span>
          ) : undefined
        }
      >
        {!telemetry ? (
          <div className="empty-state">
            Storage topology unavailable until telemetry is acquired.
          </div>
        ) : telemetry.disks.length === 0 ? (
          <div className="empty-state">
            No persistent storage volumes were reported.
          </div>
        ) : (
          <div className="plugin-list">
            {telemetry.disks.map((disk) => (
              <div
                className="plugin-list__item"
                key={`${disk.name}:${disk.mountPoint}`}
              >
                <div>
                  <strong>{disk.mountPoint}</strong>
                  <span>
                    {disk.name} // {formatBytes(disk.availableBytes)} available
                    {disk.removable ? " // removable" : ""}
                  </span>
                </div>

                <span className="plugin-version">
                  {disk.usagePercent.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Control Surface"
        eyebrow="SYSTEMS // CAPABILITIES"
      >
        <div className="staged-list">
          <div>
            <span className="staged-list__marker" />
            Native host telemetry active
          </div>
          <div>
            <span className="staged-list__marker" />
            Persistent storage discovery active
          </div>
          <div>
            <span className="staged-list__marker" />
            Remote service registry next
          </div>
          <div>
            <span className="staged-list__marker" />
            Home Assistant bridge next
          </div>
        </div>
      </Panel>
    </div>
  );
}

interface SystemRowProps {
  label: string;
  value: string;
}

function SystemRow({ label, value }: SystemRowProps) {
  return (
    <div className="plugin-list__item">
      <div>
        <strong>{label}</strong>
        <span>{value}</span>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** index;

  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function formatUptime(seconds: number): string {
  const totalMinutes = Math.floor(seconds / 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}
