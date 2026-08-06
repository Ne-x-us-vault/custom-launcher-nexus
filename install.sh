#!/usr/bin/env bash
set -euo pipefail

# Nexus Launcher — remote one-liner installer.
#
#   curl -fsSL https://raw.githubusercontent.com/Ne-x-us-vault/custom-launcher-nexus/main/install.sh | bash
#
# Downloads the current main branch, then runs the bundled installer, which
# detects your package manager, installs runtime dependencies, and installs:
#   - the GNOME Shell extension (custom-launcher@nexus.dev)
#   - the standalone GTK4 launcher (nexus-launcher) on any desktop
#   - the matching Rofi theme
# Pass-through flags are forwarded, e.g. | bash -s -- --system

REPO="Ne-x-us-vault/custom-launcher-nexus"
BRANCH="${NEXUS_BRANCH:-main}"
URL="${NEXUS_URL:-https://codeload.github.com/$REPO/tar.gz/refs/heads/$BRANCH}"

have() { command -v "$1" >/dev/null 2>&1; }

if ! have curl && ! have wget; then
  echo "Error: this installer needs 'curl' or 'wget' to download the source." >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading Nexus Launcher ($BRANCH)..."
if have curl; then
  curl -fsSL "$URL" -o "$TMP/nexus.tar.gz"
else
  wget -qO "$TMP/nexus.tar.gz" "$URL"
fi

tar -xzf "$TMP/nexus.tar.gz" -C "$TMP" --strip-components=1

echo "Running installer..."
bash "$TMP/nexus-launcher@Ne-x-us-vault.github.io/install.sh" "$@"
