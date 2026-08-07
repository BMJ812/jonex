import { describe, expect, it } from "vitest";

import {
  createRuntimeIncident,
  normalizeUnknownError,
} from "./runtimeError";

describe("runtime error normalization", () => {
  it("preserves Error instances", () => {
    const source = new TypeError("telemetry failed");

    expect(normalizeUnknownError(source)).toBe(source);
  });

  it("normalizes string failures", () => {
    const normalized = normalizeUnknownError("plugin failed");

    expect(normalized.message).toBe("plugin failed");
  });

  it("creates a support-safe incident record", () => {
    const incident = createRuntimeIncident(
      new Error("render failed"),
      Date.UTC(2026, 7, 7, 4, 0, 0),
    );

    expect(incident.id).toMatch(/^JX-[A-Z0-9]+-[A-Z0-9]{2}$/);
    expect(incident.message).toBe("render failed");
    expect(incident.occurredAt).toBe("2026-08-07T04:00:00.000Z");
  });
});