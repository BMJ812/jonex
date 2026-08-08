import { describe, expect, it } from "vitest";

import { selectEnabledWidgetPlugins } from "./catalog";
import type {
  JonexSettings,
  PluginCatalog,
  PluginRecord,
} from "./models";
import { createDefaultSettings } from "./settings";

function createPlugin(
  id: string,
  name: string,
  enabled: boolean,
  kind: "widget" | "integration" = "widget",
): PluginRecord {
  return {
    sourcePath: `${id}/manifest.json`,
    manifest: {
      schemaVersion: 1,
      id,
      name,
      version: "0.1.0",
      description: "Test plugin",
      publisher: "JØNEX",
      entry: {
        kind,
        component: `${id}.component`,
      },
      permissions: [],
      capabilities:
        kind === "widget" ? ["dashboard.widget"] : ["integration.provider"],
      defaultEnabled: enabled,
    },
  };
}

describe("selectEnabledWidgetPlugins", () => {
  const catalog: PluginCatalog = {
    plugins: [
      createPlugin("jonex.zulu", "Zulu", true),
      createPlugin("jonex.disabled", "Disabled", false),
      createPlugin("jonex.alpha", "Alpha", true),
      createPlugin("jonex.integration", "Integration", true, "integration"),
    ],
    diagnostics: [],
  };

  it("returns default-enabled dashboard widgets in name order", () => {
    const selected = selectEnabledWidgetPlugins(
      catalog,
      createDefaultSettings(),
    );

    expect(selected.map(({ manifest }) => manifest.id)).toEqual([
      "jonex.alpha",
      "jonex.zulu",
    ]);
  });

  it("applies persisted plugin overrides", () => {
    const settings: JonexSettings = {
      ...createDefaultSettings(),
      pluginStates: {
        "jonex.alpha": false,
        "jonex.disabled": true,
      },
    };

    const selected = selectEnabledWidgetPlugins(catalog, settings);

    expect(selected.map(({ manifest }) => manifest.id)).toEqual([
      "jonex.disabled",
      "jonex.zulu",
    ]);
  });

  it("applies persisted dashboard order", () => {
    const settings: JonexSettings = {
      ...createDefaultSettings(),
      dashboardWidgetOrder: ["jonex.zulu", "jonex.alpha"],
    };

    const selected = selectEnabledWidgetPlugins(catalog, settings);

    expect(selected.map(({ manifest }) => manifest.id)).toEqual([
      "jonex.zulu",
      "jonex.alpha",
    ]);
  });
});