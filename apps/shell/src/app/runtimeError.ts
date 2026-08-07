export interface RuntimeIncident {
  id: string;
  name: string;
  message: string;
  stack: string | null;
  occurredAt: string;
}

let incidentSequence = 0;

export function createRuntimeIncident(
  value: unknown,
  timestamp = Date.now(),
): RuntimeIncident {
  incidentSequence = (incidentSequence + 1) % 1_296;

  const error = normalizeUnknownError(value);
  const sequence = incidentSequence.toString(36).padStart(2, "0").toUpperCase();

  return {
    id: `JX-${timestamp.toString(36).toUpperCase()}-${sequence}`,
    name: error.name,
    message: error.message,
    stack: error.stack ?? null,
    occurredAt: new Date(timestamp).toISOString(),
  };
}

export function normalizeUnknownError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return new Error(value.trim());
  }

  try {
    const serialized = JSON.stringify(value);

    if (serialized && serialized !== "{}") {
      return new Error(serialized);
    }
  } catch {
    // Circular and non-serializable values fall through to the safe message.
  }

  return new Error("Unknown runtime error");
}