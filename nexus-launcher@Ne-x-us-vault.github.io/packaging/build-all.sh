#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="${1:-1.0.0}"

echo "== Building Debian/Ubuntu package =="
"$SCRIPT_DIR/build-deb.sh" "$VERSION"

echo
echo "== Arch Linux =="
echo "The PKGBUILD pulls from the GitHub tag v$VERSION. From packaging/arch:"
echo "  makepkg -si"
echo "  # or, to skip the download on a machine that already has the repo:"
echo "  makepkg -f -p PKGBUILD.local"
echo
echo "Done."
