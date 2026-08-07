import { useEffect, useState } from "react";

import type { TelemetrySnapshot } from "../app/models";
import { getSystemSnapshot } from "../app/jonexApi";

interface TelemetryState {
  snapshot: TelemetrySnapshot | null;
  error: string | null;
}

export function useTelemetry(intervalMilliseconds = 1500): TelemetryState {
  const [state, setState] = useState<TelemetryState>({
    snapshot: null,
    error: null,
  });

  useEffect(() => {
    let active = true;

    const update = async (): Promise<void> => {
      try {
        const snapshot = await getSystemSnapshot();

        if (active) {
          setState({
            snapshot,
            error: null,
          });
        }
      } catch (error) {
        if (active) {
          setState((current) => ({
            snapshot: current.snapshot,
            error: error instanceof Error ? error.message : String(error),
          }));
        }
      }
    };

    void update();

    const timer = window.setInterval(() => {
      void update();
    }, intervalMilliseconds);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [intervalMilliseconds]);

  return state;
}
