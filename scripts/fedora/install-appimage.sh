#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
VERSION="$(tr -d '[:space:]' < "$ROOT/VERSION")"

SOURCE="${1:-$ROOT/dist/fedora/JONEX-${VERSION}-x86_64.AppImage}"
AUTOSTART="${2:-}"

if [[ ! -f "$SOURCE" ]]; then
  echo "AppImage not found: $SOURCE" >&2
  exit 1
fi

INSTALL_DIR="$HOME/.local/lib/jonex"
APPIMAGE="$INSTALL_DIR/JONEX.AppImage"
DESKTOP_DIR="$HOME/.local/share/applications"
DESKTOP_FILE="$DESKTOP_DIR/io.jonex.platform.desktop"
ICON_DIR="$HOME/.local/share/icons/hicolor/128x128/apps"
ICON_FILE="$ICON_DIR/io.jonex.platform.png"

mkdir -p "$INSTALL_DIR" "$DESKTOP_DIR" "$ICON_DIR"
install -m 0755 "$SOURCE" "$APPIMAGE"
install -m 0644 \
  "$ROOT/apps/shell/src-tauri/icons/128x128.png" \
  "$ICON_FILE"

cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=JØNEX
Comment=Local-first operations platform
Exec=$APPIMAGE
Icon=io.jonex.platform
Terminal=false
Categories=Utility;System;
StartupNotify=true
EOF

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$DESKTOP_DIR" >/dev/null 2>&1 || true
fi

if [[ "$AUTOSTART" == "--autostart" ]]; then
  mkdir -p "$HOME/.config/autostart"
  cp -- "$DESKTOP_FILE" "$HOME/.config/autostart/io.jonex.platform.desktop"
  echo "JØNEX graphical-session autostart enabled."
fi

echo
echo "Installed JØNEX ${VERSION}"
echo "  AppImage: $APPIMAGE"
echo "  Launcher: $DESKTOP_FILE"
echo
echo "Launch with:"
echo "  $APPIMAGE"