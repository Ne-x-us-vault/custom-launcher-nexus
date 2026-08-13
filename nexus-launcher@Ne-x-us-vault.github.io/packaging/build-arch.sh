#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SRC="$ROOT_DIR"
VERSION="${1:-1.0.0}"
DIST="$SCRIPT_DIR/dist"
STAGE_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGE_DIR"' EXIT

if ! command -v makepkg >/dev/null 2>&1; then
  echo "makepkg not found. This requires pacman (Arch Linux / Manjaro / EndeavourOS)." >&2
  exit 1
fi

if [[ "$(id -u)" -eq 0 ]]; then
  echo "makepkg must not run as root. Run this script as a regular user." >&2
  exit 1
fi

# Stage the extension sources in the layout makepkg expects.
PKG_DIR="$STAGE_DIR/nexus-launcher-$VERSION"
mkdir -p "$PKG_DIR"
cp -r "$SRC/extension.js" "$SRC/prefs.js" "$SRC/metadata.json" \
      "$SRC/stylesheet.css" "$SRC/schemas" "$SRC/lib" "$SRC/assets" \
      "$PKG_DIR/"
cp "$SCRIPT_DIR/arch/PKGBUILD" "$STAGE_DIR/PKGBUILD"
tar -C "$STAGE_DIR" -czf "$STAGE_DIR/nexus-launcher-$VERSION.tar.gz" \
  "nexus-launcher-$VERSION"

mkdir -p "$DIST"
(
  cd "$STAGE_DIR"
  makepkg -f
)
cp "$STAGE_DIR"/*.pkg.tar.zst "$DIST/" 2>/dev/null || \
  cp "$STAGE_DIR"/*.pkg.tar.* "$DIST/"

echo "Built: $DIST"
echo "Install: sudo pacman -U $DIST/nexus-launcher-${VERSION}-1-any.pkg.tar.zst"
