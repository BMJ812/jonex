import { describe, expect, it } from "vitest";

import { selectEnabledWidgetPlugins } from "./catalog";
import type { PluginCatalog, PluginRecord } from "./models";

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
  it("returns enabled dashboard widgets in name order", () => {
    const catalog: PluginCatalog = {
      plugins: [
        createPlugin("jonex.zulu", "Zulu", true),
        createPlugin("jonex.disabled", "Disabled", false),
        createPlugin("jonex.alpha", "Alpha", true),
        createPlugin("jonex.integration", "Integration", true, "integration"),
      ],
      diagnostics: [],
    };

    const selected = selectEnabledWidgetPlugins(catalog);

    expect(selected.map(({ manifest }) => manifest.id)).toEqual([
      "jonex.alpha",
      "jonex.zulu",
    ]);
  });
});
