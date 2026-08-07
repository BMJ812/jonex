import type { ComponentType } from "react";

import { ClockWidget } from "../components/widgets/ClockWidget";
import { SystemTelemetryWidget } from "../components/widgets/SystemTelemetryWidget";
import type { WidgetContext } from "./models";

const registry: Readonly<Record<string, ComponentType<WidgetContext>>> = {
  "system.telemetry": SystemTelemetryWidget,
  "system.clock": ClockWidget,
};

export function resolveWidget(
  componentIdentifier: string,
): ComponentType<WidgetContext> | undefined {
  return registry[componentIdentifier];
}
