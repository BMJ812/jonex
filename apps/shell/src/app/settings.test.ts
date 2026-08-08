import { describe, expect, it } from "vitest";

import {
  createDefaultSettings,
  normalizeSettings,
} from "./settings";
import type { JonexSettings } from "./models";

describe("JØNEX frontend settings", () => {
  it("creates dashboard-first defaults", () => {
    expect(createDefaultSettings()).toEqual({
      schemaVersion: 1,
      lastModule: "dashboard",
      pluginStates: {},
      dashboardWidgetOrder: [],
      updatedAtUnixMs: 0,
    });
  });

  it("normalizes invalid modules and duplicate widget order entries", () => {
    const candidate = {
      schemaVersion: 99,
      lastModule: "invalid-module",
      pluginStates: {
        "jonex.local-clock": false,
      },
      dashboardWidgetOrder: [
        "jonex.local-clock",
        "jonex.local-clock",
        "",
      ],
      updatedAtUnixMs: 42,
    } as unknown as JonexSettings;

    expect(normalizeSettings(candidate)).toEqual({
      schemaVersion: 1,
      lastModule: "dashboard",
      pluginStates: {
        "jonex.local-clock": false,
      },
      dashboardWidgetOrder: ["jonex.local-clock"],
      updatedAtUnixMs: 42,
    });
  });
});