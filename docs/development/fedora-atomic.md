# Fedora Atomic Development and Deployment

## Target

JØNEX Milestone 1.3 targets **Fedora Kinoite 44 x86_64** for the first Atomic
Desktop VM.

Kinoite provides the Fedora Atomic model with KDE Plasma. This matches the
JØNEX direction because the project requires a normal graphical desktop during
development while retaining a path toward a dedicated operations session.

## Operating-system policy

JØNEX treats Fedora Atomic as a managed base image.

Prefer:

- Flatpak for ordinary graphical applications.
- Toolbx for development toolchains.
- Podman for services.
- User-level graphical-session integration.
- Minimal `rpm-ostree` layering.

JØNEX itself is initially deployed as an AppImage because it needs host-level
telemetry access and should not require a large development dependency layer on
the Atomic host.

## Development Toolbx

From the repository:

```bash
bash scripts/fedora/setup-toolbox.sh
toolbox enter jonex-dev
```

The Toolbx installs the Fedora packages required by Tauri v2, Node.js, npm,
Rust, Clippy, and rustfmt.

## Build

Inside `jonex-dev`:

```bash
cd /path/to/jonex
bash scripts/fedora/build-appimage.sh
```

The release artifact is copied to:

```text
dist/fedora/JONEX-<version>-x86_64.AppImage
```

## Install on the Atomic host

Outside Toolbx:

```bash
bash scripts/fedora/install-appimage.sh
```

To opt into graphical-session autostart during testing:

```bash
bash scripts/fedora/install-appimage.sh \
  dist/fedora/JONEX-<version>-x86_64.AppImage \
  --autostart
```

Autostart is not enabled by default.

## Progression

1. Fedora Kinoite VM.
2. Native JØNEX AppImage.
3. Host telemetry validation.
4. Controlled graphical-session autostart.
5. Remote-access layer.
6. Dedicated JØNEX session.
7. Custom Atomic image.

Every stage must retain a recovery path to a normal KDE Plasma session.