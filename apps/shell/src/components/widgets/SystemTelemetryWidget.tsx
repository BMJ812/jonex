import type { WidgetContext } from "../../app/models";
import { MetricCard } from "../MetricCard";
import { Panel } from "../Panel";

export function SystemTelemetryWidget({
  telemetry,
  telemetryError,
  isNative,
}: WidgetContext) {
  if (!telemetry) {
    return (
      <Panel title="System Overview" eyebrow="PLUGIN // JONEX.SYSTEM-OVERVIEW">
        <div className="loading-state">
          <span className="loading-state__indicator" />
          Establishing telemetry channel
        </div>
      </Panel>
    );
  }

  const primaryDisk = telemetry.disks[0];

  return (
    <Panel
      title="System Overview"
      eyebrow="PLUGIN // JONEX.SYSTEM-OVERVIEW"
      className="widget--wide"
      action={
        <span
          className={`status-chip ${
            telemetryError ? "status-chip--warning" : "status-chip--online"
          }`}
        >
          {telemetryError ? "DEGRADED" : isNative ? "NATIVE" : "SIMULATED"}
        </span>
      }
    >
      <div className="metric-grid">
        <MetricCard
          label="CPU LOAD"
          value={`${telemetry.cpu.usagePercent.toFixed(1)}%`}
          detail={`${telemetry.cpu.logicalCores} logical / ${
            telemetry.cpu.physicalCores || "?"
          } physical cores`}
          percentage={telemetry.cpu.usagePercent}
          tone={telemetry.cpu.usagePercent >= 85 ? "amber" : "cyan"}
        />

        <MetricCard
          label="MEMORY"
          value={`${telemetry.memory.usagePercent.toFixed(1)}%`}
          detail={`${formatBytes(telemetry.memory.usedBytes)} of ${formatBytes(
            telemetry.memory.totalBytes,
          )}`}
          percentage={telemetry.memory.usagePercent}
          tone={telemetry.memory.usagePercent >= 85 ? "amber" : "magenta"}
        />

        <MetricCard
          label="PRIMARY VOLUME"
          value={primaryDisk ? `${primaryDisk.usagePercent.toFixed(1)}%` : "N/A"}
          detail={
            primaryDisk
              ? `${formatBytes(primaryDisk.availableBytes)} available`
              : "No mounted volume reported"
          }
          percentage={primaryDisk?.usagePercent}
          tone={
            primaryDisk && primaryDisk.usagePercent >= 90 ? "amber" : "success"
          }
        />

        <MetricCard
          label="UPTIME"
          value={formatDuration(telemetry.host.uptimeSeconds)}
          detail={`sample sequence ${telemetry.sequence}`}
        />
      </div>

      <div className="host-strip">
        <div>
          <span>HOST</span>
          <strong>{telemetry.host.hostname}</strong>
        </div>
        <div>
          <span>OPERATING SYSTEM</span>
          <strong>{telemetry.host.operatingSystem}</strong>
        </div>
        <div>
          <span>KERNEL</span>
          <strong>{telemetry.host.kernelVersion}</strong>
        </div>
      </div>

      <div className="disk-list">
        <div className="subsection-heading">
          <span>Mounted volumes</span>
          <span>{telemetry.disks.length} detected</span>
        </div>

        {telemetry.disks.length === 0 ? (
          <div className="empty-inline">No mounted disks reported.</div>
        ) : (
          telemetry.disks.map((disk) => (
            <div
              className="disk-row"
              key={`${disk.name}:${disk.mountPoint}`}
            >
              <div className="disk-row__identity">
                <strong>{disk.mountPoint}</strong>
                <span>
                  {disk.name}
                  {disk.removable ? " // removable" : ""}
                </span>
              </div>

              <div className="disk-row__usage">
                <span>
                  {formatBytes(disk.usedBytes)} / {formatBytes(disk.totalBytes)}
                </span>
                <div className="meter meter--compact">
                  <div
                    className="meter__fill meter__fill--success"
                    style={{ width: `${Math.min(100, disk.usagePercent)}%` }}
                  />
                </div>
              </div>

              <strong className="disk-row__percent">
                {disk.usagePercent.toFixed(1)}%
              </strong>
            </div>
          ))
        )}
      </div>

      {telemetryError ? (
        <div className="inline-warning">
          Telemetry refresh error: {telemetryError}
        </div>
      ) : null}
    </Panel>
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

function formatDuration(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}
