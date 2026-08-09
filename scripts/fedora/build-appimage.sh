#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"

if [[ -f "$HOME/.cargo/env" ]]; then
  source "$HOME/.cargo/env"
fi

cd "$ROOT"

VERSION="$(tr -d '[:space:]' < VERSION)"

echo "Building JØNEX ${VERSION} AppImage..."
echo

npm ci
npm run version:check
npm run check

npm --workspace @jonex/shell run tauri:build -- \
  --config src-tauri/tauri.fedora.conf.json \
  --bundles appimage

mapfile -t CANDIDATES < <(
  find \
    "$ROOT/target/release/bundle/appimage" \
    "$ROOT/apps/shell/src-tauri/target/release/bundle/appimage" \
    -maxdepth 1 \
    -type f \
    -name '*.AppImage' \
    2>/dev/null \
    | sort
)

if [[ "${#CANDIDATES[@]}" -eq 0 ]]; then
  echo "Tauri completed but no AppImage artifact was found." >&2
  exit 1
fi

ARTIFACT="${CANDIDATES[-1]}"
OUTPUT_DIR="$ROOT/dist/fedora"
OUTPUT="$OUTPUT_DIR/JONEX-${VERSION}-x86_64.AppImage"

mkdir -p "$OUTPUT_DIR"
cp -- "$ARTIFACT" "$OUTPUT"
chmod +x "$OUTPUT"

echo
echo "JØNEX Fedora artifact:"
echo "  $OUTPUT"