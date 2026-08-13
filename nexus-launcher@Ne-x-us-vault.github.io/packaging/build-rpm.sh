#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SRC="$ROOT_DIR"
VERSION="${1:-1.0.0}"
EXT_UUID="custom-launcher@nexus.dev"
DIST="$SCRIPT_DIR/dist"
STAGE_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGE_DIR"' EXIT

if ! command -v rpmbuild >/dev/null 2>&1; then
  echo "rpmbuild not found. Install rpm-build (dnf install rpm-build, or" >&2
  echo "zypper install rpm-build), then rerun this script." >&2
  exit 1
fi

# Stage the extension sources in the layout rpmbuild expects.
PKG_DIR="$STAGE_DIR/nexus-launcher-$VERSION"
mkdir -p "$PKG_DIR"
cp -r "$SRC/extension.js" "$SRC/prefs.js" "$SRC/metadata.json" \
      "$SRC/stylesheet.css" "$SRC/schemas" "$SRC/lib" "$SRC/assets" \
      "$PKG_DIR/"
sed "s/@VERSION@/${VERSION}/" "$SCRIPT_DIR/nexus-launcher.spec.in" \
  > "$STAGE_DIR/nexus-launcher.spec"
tar -C "$STAGE_DIR" -czf "$STAGE_DIR/nexus-launcher-$VERSION.tar.gz" \
  "nexus-launcher-$VERSION"

mkdir -p "$DIST"
rpmbuild --define "_topdir $STAGE_DIR/rpmbuild" \
         --define "_sourcedir $STAGE_DIR" \
         -bb "$STAGE_DIR/nexus-launcher.spec"
find "$STAGE_DIR/rpmbuild/RPMS" -name '*.rpm' -exec cp {} "$DIST/" \;

echo "Built: $DIST"
echo "Install: sudo dnf install $DIST/nexus-launcher-${VERSION}-1.*.rpm"
