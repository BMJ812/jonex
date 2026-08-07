import {
  debug as nativeDebug,
  error as nativeError,
  info as nativeInfo,
  warn as nativeWarn,
} from "@tauri-apps/plugin-log";

import { isNativeRuntime } from "./jonexApi";
import { normalizeUnknownError } from "./runtimeError";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Readonly<Record<string, unknown>> | unknown;

const nativeWriters: Readonly<Record<LogLevel, (message: string) => Promise<void>>> = {
  debug: nativeDebug,
  info: nativeInfo,
  warn: nativeWarn,
  error: nativeError,
};

export const logger = {
  debug(message: string, context?: LogContext): Promise<void> {
    return writeLog("debug", message, context);
  },

  info(message: string, context?: LogContext): Promise<void> {
    return writeLog("info", message, context);
  },

  warn(message: string, context?: LogContext): Promise<void> {
    return writeLog("warn", message, context);
  },

  error(message: string, context?: LogContext): Promise<void> {
    return writeLog("error", message, context);
  },
};

let globalHandlersInstalled = false;

export function installGlobalRuntimeLogging(): void {
  if (globalHandlersInstalled || typeof window === "undefined") {
    return;
  }

  globalHandlersInstalled = true;

  window.addEventListener("error", (event) => {
    void logger.error("Unhandled window error", {
      message: event.message,
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
      error: event.error,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    void logger.error("Unhandled promise rejection", {
      reason: event.reason,
    });
  });

  void logger.info("Frontend runtime initialized", {
    nativeRuntime: isNativeRuntime(),
    userAgent: navigator.userAgent,
  });
}

async function writeLog(
  level: LogLevel,
  message: string,
  context?: LogContext,
): Promise<void> {
  const formatted = formatLogMessage(message, context);

  if (isNativeRuntime()) {
    try {
      await nativeWriters[level](formatted);
      return;
    } catch (loggingError) {
      console.warn(
        "JØNEX native logging failed; using console fallback.",
        normalizeUnknownError(loggingError),
      );
    }
  }

  console[level](formatted);
}

function formatLogMessage(message: string, context?: LogContext): string {
  if (context === undefined) {
    return message;
  }

  return `${message} ${safeSerialize(context)}`;
}

function safeSerialize(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, nestedValue: unknown) => {
      if (nestedValue instanceof Error) {
        return {
          name: nestedValue.name,
          message: nestedValue.message,
          stack: nestedValue.stack,
        };
      }

      if (typeof nestedValue === "bigint") {
        return nestedValue.toString();
      }

      return nestedValue;
    });
  } catch {
    return JSON.stringify({ value: String(value) });
  }
}