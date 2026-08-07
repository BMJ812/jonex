# JØNEX Architecture

## System context

JØNEX has three principal layers.

### Fedora Atomic base

Responsible for:

- Kernel and hardware support
- Boot, rollback, and host updates
- Desktop session
- Flatpak runtime
- Podman runtime
- System security policy

JØNEX does not casually mutate the immutable base. Host-level changes must be
small, documented, reversible, and justified.

### JØNEX platform services

Rust crates and native services provide:

- Local telemetry
- Plugin discovery
- Event routing
- Settings
- Notifications
- Search indexing
- Credential access
- Integration lifecycle
- Audit logging

These services do not own presentation.

### JØNEX clients

Clients include:

- Desktop shell
- Mobile companion
- Remote interface
- Command-line utilities

Clients consume versioned contracts.

## Initial process model

The first milestone runs the React shell and Rust services inside one Tauri
process:

```text
React shell
    |
    | Tauri invoke
    v
Native command boundary
    |
    +-- JØNEX Core
    +-- Telemetry Service
    +-- Plugin Host
```

This is a deployment simplification, not permanent coupling. Crate boundaries
allow services to move into dedicated processes later.

## Plugin model

The first plugin layer is declarative. A plugin contains `manifest.json`
declaring:

- Identifier and version
- Publisher
- Entry type
- Registered component
- Permissions
- Capabilities
- Default state

The native plugin host discovers and validates manifests. The shell maps
registered component identifiers to trusted widget implementations.

Future plugin levels may add:

- WebAssembly components
- Sandboxed subprocesses
- Signed native extensions
- Remote integration adapters

Arbitrary dynamic-library loading is excluded from the initial security model.

## Architectural constraints

- UI code must not execute arbitrary system commands.
- Integrations must not bypass JØNEX permission checks.
- Secrets must not be stored in plugin manifests.
- Discovery must not imply execution.
- Remote access must be separately authenticated and audited.
- Core operation must remain available without internet access.
