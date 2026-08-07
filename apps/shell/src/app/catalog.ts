import type { PluginCatalog, PluginRecord } from "./models";

export function selectEnabledWidgetPlugins(
  catalog: PluginCatalog,
): PluginRecord[] {
  return catalog.plugins
    .filter(
      ({ manifest }) =>
        manifest.defaultEnabled &&
        manifest.entry.kind === "widget" &&
        manifest.capabilities.includes("dashboard.widget"),
    )
    .sort((left, right) =>
      left.manifest.name.localeCompare(right.manifest.name),
    );
}
