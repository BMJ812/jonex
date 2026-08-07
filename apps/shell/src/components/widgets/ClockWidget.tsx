import { useEffect, useState } from "react";

import type { WidgetContext } from "../../app/models";
import { Panel } from "../Panel";

export function ClockWidget({ isNative }: WidgetContext) {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <Panel
      title="Local Chronometer"
      eyebrow="PLUGIN // JONEX.LOCAL-CLOCK"
      action={
        <span className="status-chip status-chip--neutral">
          {isNative ? "HOST TIME" : "BROWSER TIME"}
        </span>
      }
    >
      <div className="clock">
        <time className="clock__time" dateTime={currentTime.toISOString()}>
          {currentTime.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </time>

        <div className="clock__date">
          {currentTime.toLocaleDateString([], {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "2-digit",
          })}
        </div>

        <div className="clock__zone">
          {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </div>
      </div>
    </Panel>
  );
}
