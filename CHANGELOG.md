# Changelog

## [Unreleased]

### Added

- JØNEX Cargo and npm workspaces.
- Tauri desktop shell.
- Native CPU, memory, storage, host, kernel, and uptime telemetry.
- Declarative plugin manifest API.
- Filesystem-backed plugin discovery and validation.
- Built-in system overview and local clock plugins.
- Browser development fallback.
- Initial architecture, API, plugin, UI, security, and contribution docs.
- Windows bootstrap and launch scripts.
- GitHub Actions validation.
- Geometric JØNEX application icon source.
- Automated Tauri platform-icon generation during bootstrap.

### Fixed

- Added the Windows `icon.ico` resource required by the Tauri build process.
- Updated bootstrap commands to use `npm.cmd`, avoiding PowerShell script-policy conflicts.