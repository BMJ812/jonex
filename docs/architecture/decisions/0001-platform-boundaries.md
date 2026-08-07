# ADR 0001: Platform boundaries

- Status: Accepted
- Date: 2026-08-02

## Context

JØNEX is intended to grow from a workstation shell into a multi-machine
operations platform. A monolithic application would make integrations,
security review, testing, and remote operation progressively harder.

## Decision

JØNEX separates:

1. Fedora Atomic operating-system concerns
2. Native platform services
3. User-interface clients
4. External integrations
5. Plugins and extension contracts

The initial Tauri binary may host multiple native services in one process, but
those services remain separate Rust crates with serializable boundaries.

## Consequences

### Positive

- Components can be tested independently.
- Native services can later move out of process.
- Plugin contracts remain independent of React internals.
- Fedora-specific work remains isolated.
- Mobile and remote clients can reuse service contracts.

### Negative

- More packages and explicit contracts are required.
- Cross-component changes require documentation.
- Early features carry more structure than a prototype.
