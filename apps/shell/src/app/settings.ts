import type {
  JonexSettings,
  ModuleId,
  PluginRecord,
} from "./models";

export const CURRENT_SETTINGS_SCHEMA = 1;

export const moduleIds: readonly ModuleId[] = [
  "dashboard",
  "systems",
  "containers",
  "automation",
  "media",
  "development",
  "plugins",
  "settings",
];

export function createDefaultSettings(): JonexSettings {
  return {
    schemaVersion: CURRENT_SETTINGS_SCHEMA,
    lastModule: "dashboard",
    pluginStates: {},
    dashboardWidgetOrder: [],
    updatedAtUnixMs: 0,
  };
}

export function normalizeSettings(
  candidate: Partial<JonexSettings> | null | undefined,
): JonexSettings {
  const defaults = createDefaultSettings();
  const lastModule = moduleIds.includes(candidate?.lastModule as ModuleId)
    ? (candidate?.lastModule as ModuleId)
    : defaults.lastModule;

  const pluginStates: Record<string, boolean> = {};

  for (const [pluginId, enabled] of Object.entries(
    candidate?.pluginStates ?? {},
  )) {
    if (pluginId.trim().length > 0 && typeof enabled === "boolean") {
      pluginStates[pluginId] = enabled;
    }
  }

  const dashboardWidgetOrder = Array.from(
    new Set(
      (candidate?.dashboardWidgetOrder ?? []).filter(
        (pluginId): pluginId is string =>
          typeof pluginId === "string" && pluginId.trim().length > 0,
      ),
    ),
  );

  return {
    schemaVersion: CURRENT_SETTINGS_SCHEMA,
    lastModule,
    pluginStates,
    dashboardWidgetOrder,
    updatedAtUnixMs:
      typeof candidate?.updatedAtUnixMs === "number"
        ? candidate.updatedAtUnixMs
        : 0,
  };
}

export function isPluginEnabled(
  plugin: PluginRecord,
  settings: JonexSettings,
): boolean {
  return settings.pluginStates[plugin.manifest.id] ??
    plugin.manifest.defaultEnabled;
}

export function orderDashboardPlugins(
  plugins: PluginRecord[],
  settings: JonexSettings,
): PluginRecord[] {
  const order = new Map(
    settings.dashboardWidgetOrder.map((pluginId, index) => [pluginId, index]),
  );

  return [...plugins].sort((left, right) => {
    const leftIndex = order.get(left.manifest.id);
    const rightIndex = order.get(right.manifest.id);

    if (leftIndex !== undefined && rightIndex !== undefined) {
      return leftIndex - rightIndex;
    }

    if (leftIndex !== undefined) {
      return -1;
    }

    if (rightIndex !== undefined) {
      return 1;
    }

    return left.manifest.name.localeCompare(right.manifest.name);
  });
}