# ADR 0003: Runtime observability and containment

- Status: Accepted
- Date: 2026-08-06

## Context

JØNEX is intended to become an operations control plane. Silent failures and
uncontained interface crashes are unacceptable because they obscure system
state and make diagnostics unreliable.

The first foundation release had native telemetry and plugin diagnostics but
no persistent runtime log and no React error boundary.

## Decision

JØNEX uses the official Tauri logging plugin as the desktop logging boundary.
Native Rust records and frontend JavaScript records are written through the
same local logging facility.

The React application is mounted inside a top-level error boundary. Rendering
failures produce a support-safe incident identifier, write structured context
to the local log, and display a containment interface instead of a blank
window.

Global browser errors and unhandled promise rejections are also forwarded to
the local logging facility.

## Retention

Desktop logs are limited to 5 MB per file and retain the five most recent
rotated files.

## Privacy

Logs remain local by default. JØNEX does not upload logs, telemetry, stack
traces, usernames, hostnames, or plugin diagnostics to an external service.

Future support-bundle export must require an explicit user action and must
show the files and fields included before export.

## Consequences

### Positive

- Native and frontend failures share one diagnostic channel.
- Interface failures do not automatically destroy the native process state.
- Incident identifiers can be referenced without exposing a full stack trace
  in the interface.
- Log retention is bounded.

### Negative

- The shell gains an additional official Tauri plugin dependency.
- Logs can contain operational metadata and must be treated as sensitive local
  data.
- An error boundary cannot recover from every native-process failure.