#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SRC="$ROOT_DIR"
VERSION="${1:-1.0.0}"
EXT_UUID="custom-launcher@nexus.dev"
STAGE="$SCRIPT_DIR/root"
DIST="$SCRIPT_DIR/dist"
DEB="$STAGE/DEBIAN"

EXT_DIR="$STAGE/usr/share/gnome-shell/extensions/$EXT_UUID"
SCHEMA_DIR="$STAGE/usr/share/glib-2.0/schemas"
LAUNCHER_DIR="$STAGE/usr/share/nexus-launcher"
ROFI_DIR="$STAGE/usr/share/rofi/themes"

rm -rf "$STAGE"
mkdir -p "$DEB" "$EXT_DIR" "$SCHEMA_DIR" "$LAUNCHER_DIR" \
  "$STAGE/usr/share/applications" "$ROFI_DIR" "$STAGE/usr/bin" "$DIST"

# GNOME Shell extension
cp -r "$SRC/extension.js" "$SRC/prefs.js" "$SRC/metadata.json" \
      "$SRC/stylesheet.css" "$SRC/schemas" "$SRC/lib" "$SRC/assets" \
      "$EXT_DIR/"

# System schema (shared by the standalone launcher and Rofi theme)
cp "$SRC/schemas/org.gnome.shell.extensions.nexus-launcher.gschema.xml" \
   "$SCHEMA_DIR/"

# Standalone launcher + assets, exposed on PATH
cp "$SRC/bin/nexus-launcher.mjs" "$LAUNCHER_DIR/"
cp -r "$SRC/assets" "$LAUNCHER_DIR/assets"
ln -s /usr/share/nexus-launcher/nexus-launcher.mjs "$STAGE/usr/bin/nexus-launcher"

# Desktop entry so the launcher shows up in any app menu
cat > "$STAGE/usr/share/applications/nexus-launcher.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=Nexus Launcher
Comment=Frost-glass application launcher (standalone)
Exec=/usr/bin/nexus-launcher
Icon=system-search
Terminal=false
Categories=Utility;System;
Keywords=launcher;search;apps;run;
EOF

# Rofi theme
cp "$SRC/rofi/nexus.rasi" "$ROFI_DIR/"

# Control + maintainer scripts
sed "s/@VERSION@/${VERSION}/" "$SCRIPT_DIR/debian/control.template" > "$DEB/control"
cp "$SCRIPT_DIR/debian/postinst" "$SCRIPT_DIR/debian/prerm" "$SCRIPT_DIR/debian/postrm" "$DEB/"
chmod 0755 "$DEB/postinst" "$DEB/prerm" "$DEB/postrm"

dpkg-deb --build --root-owner-group "$STAGE" "$DIST/nexus-launcher_${VERSION}_all.deb"
echo "Built: $DIST/nexus-launcher_${VERSION}_all.deb"
echo "Install: sudo apt install $DIST/nexus-launcher_${VERSION}_all.deb"
