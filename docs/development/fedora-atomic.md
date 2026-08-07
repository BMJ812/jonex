# Fedora Atomic Development and Deployment

## Operating-system policy

JØNEX treats Fedora Atomic as a managed base image.

Prefer:

- Flatpak for graphical applications
- Toolbx for development toolchains
- Podman for services
- User-level systemd services where appropriate
- Minimal `rpm-ostree` layering

## Development workflow

```bash
toolbox create jonex-dev
toolbox enter jonex-dev
```

Install Rust, Node.js, compiler, and WebKit development packages inside the
Toolbx rather than layering every development dependency onto the host.

Package names vary by Fedora release. Confirm the current Tauri Linux
prerequisites for the target Fedora release.

## Session progression

1. Normal desktop application
2. Fullscreen operations shell
3. Optional autostart session
4. Dedicated desktop session
5. Custom Atomic image

Every stage must retain a documented recovery path.
