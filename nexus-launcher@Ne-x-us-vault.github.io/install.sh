#!/usr/bin/env bash
#
# Nexus Launcher - Ubuntu/GNOME installer.
#
# Installs the GNOME Shell extension (custom-launcher@nexus.dev).
# Run from the source directory.

set -e

EXT_UUID="custom-launcher@nexus.dev"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYSTEM=0

usage() {
  cat <<'EOF'
Usage: ./install.sh [--system] [--help]

Options:
  --system   Install system-wide under /usr/share (needs sudo)
  --help     Show this help

Installs missing runtime dependencies via apt, copies the extension, and
enables it on GNOME Shell.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --system) SYSTEM=1 ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage >&2; exit 1 ;;
  esac
done

# Run privileged commands without sudo when already root.
if [[ "$(id -u)" -eq 0 ]]; then
  PRIV=()
else
  PRIV=(sudo)
fi

install_deps() {
  local missing=()
  for tool in glib-compile-schemas zip; do
    command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
  done

  if [[ ${#missing[@]} -eq 0 ]]; then
    echo "Required build tools are already installed."
    return
  fi

  echo "Installing dependencies via apt..."
  "${PRIV[@]}" apt-get update
  "${PRIV[@]}" apt-get install -y "${missing[@]}"
}

install_extension() {
  local dest
  if [[ "$SYSTEM" -eq 1 ]]; then
    dest="/usr/share/gnome-shell/extensions/$EXT_UUID"
    echo "Installing extension to $dest"
    "${PRIV[@]}" rm -rf "$dest"
    "${PRIV[@]}" mkdir -p "$dest"
    "${PRIV[@]}" cp -r "$SCRIPT_DIR"/extension.js "$SCRIPT_DIR"/prefs.js \
      "$SCRIPT_DIR"/metadata.json "$SCRIPT_DIR"/stylesheet.css \
      "$SCRIPT_DIR"/schemas "$SCRIPT_DIR"/lib "$SCRIPT_DIR"/assets "$dest"/
    "${PRIV[@]}" glib-compile-schemas "$dest/schemas"
    "${PRIV[@]}" chmod -R a+rX "$dest"
  else
    dest="$HOME/.local/share/gnome-shell/extensions/$EXT_UUID"
    echo "Installing extension to $dest"
    rm -rf "$dest"
    mkdir -p "$dest"
    cp -r "$SCRIPT_DIR"/extension.js "$SCRIPT_DIR"/prefs.js \
      "$SCRIPT_DIR"/metadata.json "$SCRIPT_DIR"/stylesheet.css \
      "$SCRIPT_DIR"/schemas "$SCRIPT_DIR"/lib "$SCRIPT_DIR"/assets "$dest"/
    glib-compile-schemas "$dest/schemas"
  fi
}

enable_extension() {
  if command -v gnome-extensions >/dev/null 2>&1; then
    echo "Enabling $EXT_UUID..."
    gnome-extensions enable "$EXT_UUID"
    echo "Done. Press Super+Enter (or your configured hotkey) to open the launcher."
  else
    echo "gnome-extensions not found. Enable the extension from the Extensions app"
    echo "after logging out and back in."
  fi
}

install_deps
install_extension
enable_extension

echo
echo "Nexus Launcher installed successfully."
echo "  - GNOME extension : $( [[ $SYSTEM -eq 1 ]] && echo system-wide || echo user )"
