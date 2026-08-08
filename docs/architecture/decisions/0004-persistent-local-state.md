# ADR 0004: Persistent local state

- Status: Accepted
- Date: 2026-08-07

## Context

JØNEX must preserve operator state across restarts without requiring an
external service, browser storage, or cloud account.

The shell needs to remember navigation state, plugin enablement, and dashboard
ordering while remaining resilient to interrupted writes and malformed
configuration.

## Decision

Native JØNEX stores versioned JSON settings under the Tauri application-data
directory.

The settings file is written through a temporary file created in the same
directory and persisted over the destination. The temporary file is flushed
and synchronized before replacement.

Schema version 1 stores:

- Last active module.
- Explicit plugin enabled/disabled overrides.
- Dashboard widget ordering.
- Last successful write timestamp.

Malformed JSON is moved to a timestamped recovery file and JØNEX creates a new
default settings file. Schema 0 is migrated to schema 1. Settings created by a
newer unsupported schema are rejected rather than silently overwritten.

The browser development fallback uses localStorage only because it has no
native application-data directory. Native desktop builds do not use browser
storage as their source of truth.

## Consequences

### Positive

- JØNEX state survives native application restarts.
- Plugin controls have a durable source of truth.
- Interrupted writes do not expose a partially written destination file.
- Malformed settings can be recovered without silently discarding the
  original bytes.
- Future settings migrations have an explicit schema boundary.

### Negative

- The settings schema becomes a compatibility contract.
- Recovery files can accumulate after repeated corruption events.
- Cross-device state synchronization is intentionally not provided.