import type {
  JonexSettings,
  PluginCatalog,
  PluginRecord,
} from "./models";
import {
  isPluginEnabled,
  orderDashboardPlugins,
} from "./settings";

export function selectEnabledWidgetPlugins(
  catalog: PluginCatalog,
  settings: JonexSettings,
): PluginRecord[] {
  const widgets = catalog.plugins.filter(
    (plugin) =>
      isPluginEnabled(plugin, settings) &&
      plugin.manifest.entry.kind === "widget" &&
      plugin.manifest.capabilities.includes("dashboard.widget"),
  );

  return orderDashboardPlugins(widgets, settings);
}