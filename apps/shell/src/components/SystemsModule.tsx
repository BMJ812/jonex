import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  getServiceRegistry,
  probeRemoteService,
  saveServiceRegistry,
} from "../app/jonexApi";
import type {
  PlatformInfo,
  ServiceKind,
  ServiceProbeResult,
  ServiceRecord,
  ServiceRegistry,
  TelemetrySnapshot,
} from "../app/models";
import { Panel } from "./Panel";

interface SystemsModuleProps {
  telemetry: TelemetrySnapshot | null;
  telemetryError: string | null;
  platform: PlatformInfo | null;
  isNative: boolean;
}

const serviceKinds: Array<{
  value: ServiceKind;
  label: string;
}> = [
  { value: "home_assistant", label: "Home Assistant" },
  { value: "unraid", label: "Unraid" },
  { value: "jellyfin", label: "Jellyfin" },
  { value: "plex", label: "Plex" },
  { value: "generic", label: "Generic HTTP Service" },
];

const emptyRegistry: ServiceRegistry = {
  schemaVersion: 1,
  services: [],
  updatedAtUnixMs: 0,
};

export function SystemsModule({
  telemetry,
  telemetryError,
  platform,
  isNative,
}: SystemsModuleProps) {
  const [registry, setRegistry] =
    useState<ServiceRegistry>(emptyRegistry);
  const [registryLoaded, setRegistryLoaded] = useState(false);
  const [registrySaving, setRegistrySaving] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [serviceHealth, setServiceHealth] = useState<
    Record<string, ServiceProbeResult>
  >({});
  const [probingServices, setProbingServices] = useState<
    Record<string, boolean>
  >({});
  const [serviceKind, setServiceKind] =
    useState<ServiceKind>("home_assistant");
  const [serviceName, setServiceName] = useState("Home Assistant");
  const [serviceUrl, setServiceUrl] = useState("");

  useEffect(() => {
    let active = true;

    void getServiceRegistry()
      .then((loaded) => {
        if (!active) {
          return;
        }

        setRegistry(loaded.registry);
        setRegistryError(null);
        setRegistryLoaded(true);
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setRegistryError(
          error instanceof Error ? error.message : String(error),
        );
        setRegistryLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const persistRegistry = async (
    nextRegistry: ServiceRegistry,
  ): Promise<ServiceRegistry | null> => {
    setRegistrySaving(true);
    setRegistryError(null);

    try {
      const saved = await saveServiceRegistry(nextRegistry);
      setRegistry(saved);
      return saved;
    } catch (error) {
      setRegistryError(
        error instanceof Error ? error.message : String(error),
      );
      return null;
    } finally {
      setRegistrySaving(false);
    }
  };

  const handleProbeService = async (
    service: ServiceRecord,
  ): Promise<void> => {
    if (!service.enabled) {
      return;
    }

    setProbingServices((current) => ({
      ...current,
      [service.id]: true,
    }));

    try {
      const result = await probeRemoteService(service);

      setServiceHealth((current) => ({
        ...current,
        [service.id]: result,
      }));
    } catch (error) {
      setServiceHealth((current) => ({
        ...current,
        [service.id]: {
          serviceId: service.id,
          status: "fault",
          probeUrl: service.baseUrl,
          httpStatus: null,
          latencyMs: 0,
          checkedAtUnixMs: Date.now(),
          detail:
            error instanceof Error
              ? error.message
              : String(error),
        },
      }));
    } finally {
      setProbingServices((current) => ({
        ...current,
        [service.id]: false,
      }));
    }
  };

  const handleAddService = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const name = serviceName.trim();
    const baseUrl = serviceUrl.trim();

    if (!name) {
      setRegistryError("Service name is required.");
      return;
    }

    if (!/^https?:\/\//i.test(baseUrl)) {
      setRegistryError(
        "Service URL must begin with http:// or https://.",
      );
      return;
    }

    const service: ServiceRecord = {
      id: `${serviceKind}-${Date.now()}`,
      kind: serviceKind,
      name,
      baseUrl,
      enabled: true,
    };

    void persistRegistry({
      ...registry,
      services: [...registry.services, service],
    }).then((saved) => {
      if (saved) {
        setServiceUrl("");
      }
    });
  };

  const handleToggleService = (serviceId: string): void => {
    const currentService = registry.services.find(
      ({ id }) => id === serviceId,
    );

    if (!currentService) {
      return;
    }

    const enabled = !currentService.enabled;

    void persistRegistry({
      ...registry,
      services: registry.services.map((service) =>
        service.id === serviceId
          ? { ...service, enabled }
          : service,
      ),
    }).then((saved) => {
      if (!saved) {
        return;
      }

      if (!enabled) {
        setServiceHealth((current) => {
          const next = { ...current };
          delete next[serviceId];
          return next;
        });
        return;
      }

      const service = saved.services.find(({ id }) => id === serviceId);

      if (service) {
        void handleProbeService(service);
      }
    });
  };

  const handleRemoveService = (serviceId: string): void => {
    const service = registry.services.find(
      ({ id }) => id === serviceId,
    );

    if (!service) {
      return;
    }

    if (!window.confirm(`Remove ${service.name} from JØNEX?`)) {
      return;
    }

    void persistRegistry({
      ...registry,
      services: registry.services.filter(
        ({ id }) => id !== serviceId,
      ),
    }).then((saved) => {
      if (!saved) {
        return;
      }

      setServiceHealth((current) => {
        const next = { ...current };
        delete next[serviceId];
        return next;
      });
    });
  };

  const handleKindChange = (kind: ServiceKind): void => {
    setServiceKind(kind);

    const option = serviceKinds.find(
      ({ value }) => value === kind,
    );

    if (option) {
      setServiceName(option.label);
    }
  };

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
              <SystemRow label="Hostname" value={telemetry.host.hostname} />
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
        title="Remote Service Registry"
        eyebrow="SYSTEMS // SERVICES"
        action={
          <span
            className={`status-chip ${
              registryError
                ? "status-chip--warning"
                : "status-chip--online"
            }`}
          >
            {registrySaving
              ? "SYNCING"
              : registryLoaded
                ? `${registry.services.length} REGISTERED`
                : "LOADING"}
          </span>
        }
      >
        {registryError ? (
          <div className="inline-warning">{registryError}</div>
        ) : null}

        {!registryLoaded ? (
          <div className="loading-state">
            <span className="loading-state__indicator" />
            Loading remote service registry...
          </div>
        ) : registry.services.length === 0 ? (
          <div className="empty-state">
            No remote services are registered yet.
          </div>
        ) : (
          <div className="plugin-list">
            {registry.services.map((service) => (
              <div
                className="plugin-list__item service-registry__item"
                key={service.id}
              >
                <div>
                  <strong>{service.name}</strong>
                  <span>
                    {formatServiceKind(service.kind)} // {service.baseUrl}
                  </span>
                </div>

                <div className="service-registry__actions">
                  <ServiceHealthChip
                    enabled={service.enabled}
                    probing={Boolean(probingServices[service.id])}
                    result={serviceHealth[service.id]}
                  />

                  <button
                    type="button"
                    className="service-button"
                    disabled={
                      registrySaving ||
                      !service.enabled ||
                      Boolean(probingServices[service.id])
                    }
                    onClick={() => void handleProbeService(service)}
                  >
                    {probingServices[service.id] ? "PROBING..." : "PROBE"}
                  </button>

                  <button
                    type="button"
                    className="service-button"
                    disabled={registrySaving}
                    onClick={() => handleToggleService(service.id)}
                  >
                    {service.enabled ? "ENABLED" : "DISABLED"}
                  </button>

                  <button
                    type="button"
                    className="service-button service-button--danger"
                    disabled={registrySaving}
                    onClick={() => handleRemoveService(service.id)}
                  >
                    REMOVE
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="service-registry__note">
          Registry entries contain endpoint metadata only. Authentication
          credentials are not stored here.
        </div>
      </Panel>

      <Panel
        title="Register Service"
        eyebrow="SYSTEMS // ENDPOINT ENROLLMENT"
      >
        <form
          className="service-form"
          onSubmit={handleAddService}
        >
          <label className="service-field">
            <span>TYPE</span>
            <select
              value={serviceKind}
              disabled={registrySaving}
              onChange={(event) =>
                handleKindChange(event.target.value as ServiceKind)
              }
            >
              {serviceKinds.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </select>
          </label>

          <label className="service-field">
            <span>DISPLAY NAME</span>
            <input
              type="text"
              value={serviceName}
              disabled={registrySaving}
              onChange={(event) => setServiceName(event.target.value)}
              placeholder="Home Assistant"
            />
          </label>

          <label className="service-field service-field--wide">
            <span>BASE URL</span>
            <input
              type="url"
              value={serviceUrl}
              disabled={registrySaving}
              onChange={(event) => setServiceUrl(event.target.value)}
              placeholder="http://homeassistant.local:8123"
            />
          </label>

          <div className="service-form__actions">
            <button
              type="submit"
              className="service-button service-button--primary"
              disabled={registrySaving}
            >
              {registrySaving ? "SAVING..." : "REGISTER ENDPOINT"}
            </button>
          </div>
        </form>
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
            Remote service registry active
          </div>
          <div>
            <span className="staged-list__marker" />
            Native remote-service health probes active
          </div>
          <div>
            <span className="staged-list__marker" />
            Secure Home Assistant credentials next
          </div>
        </div>
      </Panel>
    </div>
  );
}

interface ServiceHealthChipProps {
  enabled: boolean;
  probing: boolean;
  result?: ServiceProbeResult;
}

function ServiceHealthChip({
  enabled,
  probing,
  result,
}: ServiceHealthChipProps) {
  if (!enabled) {
    return (
      <span className="status-chip status-chip--neutral">
        DISABLED
      </span>
    );
  }

  if (probing) {
    return (
      <span className="status-chip status-chip--warning">
        PROBING
      </span>
    );
  }

  if (!result) {
    return (
      <span className="status-chip status-chip--neutral">
        UNKNOWN
      </span>
    );
  }

  const className =
    result.status === "online"
      ? "status-chip status-chip--online"
      : result.status === "auth_required"
        ? "status-chip status-chip--warning"
        : result.status === "unsupported"
          ? "status-chip status-chip--neutral"
          : "status-chip service-health--fault";

  const label =
    result.status === "online"
      ? "ONLINE"
      : result.status === "auth_required"
        ? "AUTH REQUIRED"
        : result.status === "offline"
          ? "OFFLINE"
          : result.status === "unsupported"
            ? "NATIVE ONLY"
            : "FAULT";

  const title = [
    result.detail,
    result.httpStatus ? `HTTP ${result.httpStatus}` : null,
    result.latencyMs ? `${result.latencyMs} ms` : null,
    result.probeUrl,
  ]
    .filter(Boolean)
    .join(" // ");

  return (
    <span className={className} title={title}>
      {label}
    </span>
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

function formatServiceKind(kind: ServiceKind): string {
  return (
    serviceKinds.find(({ value }) => value === kind)?.label ??
    kind.toUpperCase()
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
