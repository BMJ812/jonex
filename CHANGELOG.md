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
- Persistent native and frontend runtime logging.
- React render-error containment with incident identifiers.
- Global browser error and unhandled rejection logging.
- Runtime observability documentation and architecture decision record.
- Versioned native settings storage with atomic replacement.
- Settings schema migration and malformed-file recovery.
- Persistent last-module navigation.
- Persistent plugin enable/disable overrides.
- Persistent dashboard widget ordering.
- Functional Settings subsystem with local-state status and recovery controls.
- Canonical repository `VERSION` source and synchronization tool.
- Fedora Kinoite 44 Atomic Desktop target.
- Fedora Toolbx provisioning and AppImage build scripts.
- Fedora AppImage installer with optional graphical-session autostart.
- Hyper-V Fedora Atomic VM creation script.

### Changed

- CI now installs dependencies from the npm lockfile with `npm ci`.
- Cargo build, test, and Clippy commands enforce `Cargo.lock`.
- CI uses the current Tauri Linux dependency set.
- Runtime logs use bounded five-file rotation.
- Dashboard plugin selection honors persisted local state.
- JØNEX UI version is derived from synchronized build metadata instead of a hardcoded label.
- CI rejects inconsistent JØNEX version metadata.

### Fixed

- Added the Windows `icon.ico` resource required by the Tauri build process.
- Updated bootstrap commands to use `npm.cmd`, avoiding PowerShell script-policy conflicts.
- Removed generated TypeScript build-information files from source control.
- Corrected Cargo workspace repository metadata.