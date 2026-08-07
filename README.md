# JØNEX

**JØNEX** is a local-first cyberpunk operations platform for developers,
homelab operators, and self-hosting enthusiasts.

The public product name uses `JØNEX`. Internal identifiers use the ASCII slug
`jonex` for compatibility with Cargo, npm, filesystems, URLs, environment
variables, and application identifiers.

## Milestone 1 foundation

This archive contains a working foundation for:

- Tauri 2 desktop shell
- React 19 and TypeScript interface
- Rust-native host telemetry
- Declarative plugin discovery and validation
- Trusted widget registry
- Browser development fallback
- Architecture, API, plugin, UI, security, and contribution documentation
- GitHub Actions validation
- Windows bootstrap and launch scripts

## Extract and build on Windows

Extract this archive, open PowerShell in the extracted folder, and run:

```powershell
.\Bootstrap-Jonex.ps1
```

The script installs dependencies, formats the Rust workspace, runs tests and
Clippy, builds the frontend, and builds the Rust workspace.

Launch the native desktop shell:

```powershell
.\Run-Jonex.ps1
```

The native shell displays actual CPU, memory, storage, host, kernel, and uptime
data. Browser mode displays generated telemetry:

```powershell
.\Run-Jonex-Browser.ps1
```

## Recommended permanent location

```text
C:\Dev\Jonex
```

The scripts do not require this path. The repository can be built from any
normal writable directory.

## Repository structure

```text
apps/
  shell/                  React + Tauri desktop shell

crates/
  jonex-core/             Platform metadata and shared native contracts
  jonex-plugin-api/       Plugin manifest contracts and validation
  jonex-plugin-host/      Filesystem discovery and diagnostics
  jonex-telemetry/        Native system telemetry

plugins/
  system-overview/        Built-in system telemetry widget
  local-clock/            Built-in local clock widget

docs/
  api/                    Desktop IPC contracts
  architecture/           Platform boundaries and decisions
  development/            Windows and Fedora Atomic workflows
  plugins/                Plugin authoring contract
  ui/                     Design system and interface standards
```

## Project rules

1. Fedora Atomic remains a distinct operating-system layer.
2. Native services are isolated from presentation code.
3. Integrations do not bypass the permission model.
4. Core operation remains local-first.
5. Documentation and tests change with implementation.
6. Public branding uses JØNEX; technical identifiers use `jonex`.

## Status

Pre-alpha. The plugin framework currently discovers and validates declarative
manifests. It does not execute arbitrary third-party native code.
