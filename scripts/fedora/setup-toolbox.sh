#!/usr/bin/env bash
set -euo pipefail

CONTAINER="${1:-jonex-dev}"

if ! command -v toolbox >/dev/null 2>&1; then
  echo "toolbox is not installed on this Fedora Atomic host." >&2
  exit 1
fi

if ! command -v podman >/dev/null 2>&1; then
  echo "podman is not installed on this Fedora Atomic host." >&2
  exit 1
fi

if ! podman container exists "$CONTAINER"; then
  echo "Creating Toolbx container: $CONTAINER"
  toolbox create "$CONTAINER"
fi

echo "Installing JØNEX build dependencies in $CONTAINER..."

toolbox run --container "$CONTAINER" sudo dnf install -y \
  git \
  gcc \
  gcc-c++ \
  make \
  pkgconf-pkg-config \
  webkit2gtk4.1-devel \
  openssl-devel \
  curl \
  wget \
  file \
  libappindicator-gtk3-devel \
  librsvg2-devel \
  libxdo-devel \
  nodejs \
  npm

toolbox run --container "$CONTAINER" bash -lc '
  set -euo pipefail

  if ! command -v rustup >/dev/null 2>&1; then
    curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs -o /tmp/rustup-init.sh
    sh /tmp/rustup-init.sh -y
    rm -f /tmp/rustup-init.sh
  fi

  source "$HOME/.cargo/env"
  rustup default stable
  rustup component add clippy rustfmt

  echo
  echo "JØNEX Toolbx ready."
  node --version
  npm --version
  rustc --version
  cargo --version
'

echo
echo "Enter the environment with:"
echo "  toolbox enter $CONTAINER"