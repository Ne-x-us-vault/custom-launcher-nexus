#!/usr/bin/env bash
#
# Nexus Launcher - cross-distro installer.
#
# Installs:
#   1. The GNOME Shell extension        (custom-launcher@nexus.dev)
#   2. A standalone GTK4 launcher       (~/.local/bin/nexus-launcher)
#   3. A Rofi theme                     (~/.local/share/rofi/themes/nexus.rasi)
#
# Works on Debian-based (apt), Arch-based (pacman), Fedora (dnf) and
# openSUSE (zypper) systems. Run from the source directory.

set -e

EXT_UUID="custom-launcher@nexus.dev"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYSTEM=0

usage() {
  cat <<'EOF'
Usage: ./install.sh [--system] [--help]

Options:
  --system   Install the extension system-wide under /usr/share (needs sudo)
  --help     Show this help

This script detects your package manager (apt/pacman/dnf/zypper), installs any
missing runtime/build dependencies, copies the extension to the correct
location, installs the standalone launcher + Rofi theme, and enables the
extension if you are running GNOME Shell.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --system) SYSTEM=1 ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage >&2; exit 1 ;;
  esac
done

detect_pm() {
  if command -v apt-get >/dev/null 2>&1; then echo "apt"
  elif command -v pacman >/dev/null 2>&1; then echo "pacman"
  elif command -v dnf >/dev/null 2>&1; then echo "dnf"
  elif command -v zypper >/dev/null 2>&1; then echo "zypper"
  else echo ""; fi
}

PM="$(detect_pm)"
if [[ -z "$PM" ]]; then
  echo "Warning: could not detect a supported package manager. I will install the" >&2
  echo "files, but you must install runtime dependencies yourself:" >&2
  echo "  gnome-shell, glib2, gjs, gtk4, libadwaita, zip, rofi (optional)" >&2
  PM="manual"
fi

# Run privileged commands without sudo when already root.
if [[ "$(id -u)" -eq 0 ]]; then
  PRIV=()
else
  PRIV=(sudo)
fi

DEP_GROUPS=(
  "apt:gjs gir1.2-gtk-4.0 gir1.2-adw-1 libglib2.0-bin zip"
  "pacman:gjs gtk4 libadwaita glib2 zip"
  "dnf:gjs gtk4 libadwaita glib2 zip"
  "zypper:gjs gtk4 libadwaita-gtk4 zip"
  "manual:"
)

# The GNOME Shell extension is only meaningful on GNOME; other desktop
# environments still get the standalone launcher and Rofi theme.
is_gnome() {
  [[ -n "$XDG_CURRENT_DESKTOP" ]] \
    && { [[ "$XDG_CURRENT_DESKTOP" == *GNOME* || "$XDG_CURRENT_DESKTOP" == *Unity* ]]; }
}

need() {
  command -v "$1" >/dev/null 2>&1
}

install_deps() {
  local group=""
  for g in "${DEP_GROUPS[@]}"; do
    [[ "$g" == "${PM}:"* ]] && group="${g#*:}" && break
  done

  if is_gnome; then
    case "$PM" in
      apt) group+=" gnome-shell" ;;
      pacman) group+=" gnome-shell" ;;
      dnf) group+=" gnome-shell" ;;
      zypper) group+=" gnome-shell" ;;
    esac
  fi

  local missing=()
  for tool in gjs glib-compile-schemas zip; do
    need "$tool" || missing+=("$tool")
  done
  is_gnome && ! need gnome-shell && missing+=("gnome-shell")

  if [[ ${#missing[@]} -eq 0 ]]; then
    echo "All required build tools are already installed."
    return
  fi

  if [[ "$PM" == "manual" ]]; then
    echo "Install the missing tools manually: ${missing[*]}"
    return
  fi

  echo "Installing dependencies via $PM..."
  case "$PM" in
    apt)
      "${PRIV[@]}" apt-get update
      "${PRIV[@]}" apt-get install -y $group
      ;;
    pacman)
      "${PRIV[@]}" pacman -S --needed --noconfirm $group
      ;;
    dnf)
      "${PRIV[@]}" dnf install -y $group
      ;;
    zypper)
      "${PRIV[@]}" zypper install -y $group
      ;;
  esac
}

install_extension() {
  if [[ "$SYSTEM" -eq 1 ]]; then
    local dest="/usr/share/gnome-shell/extensions/$EXT_UUID"
    echo "Installing extension to $dest"
    "${PRIV[@]}" rm -rf "$dest"
    "${PRIV[@]}" mkdir -p "$dest"
    "${PRIV[@]}" cp -r "$SCRIPT_DIR"/extension.js "$SCRIPT_DIR"/prefs.js \
      "$SCRIPT_DIR"/metadata.json "$SCRIPT_DIR"/stylesheet.css \
      "$SCRIPT_DIR"/schemas "$SCRIPT_DIR"/lib "$SCRIPT_DIR"/assets "$dest"/
    "${PRIV[@]}" glib-compile-schemas "$dest/schemas"
    "${PRIV[@]}" chmod -R a+rX "$dest"
  else
    local dest="$HOME/.local/share/gnome-shell/extensions/$EXT_UUID"
    echo "Installing extension to $dest"
    rm -rf "$dest"
    mkdir -p "$dest"
    cp -r "$SCRIPT_DIR"/extension.js "$SCRIPT_DIR"/prefs.js \
      "$SCRIPT_DIR"/metadata.json "$SCRIPT_DIR"/stylesheet.css \
      "$SCRIPT_DIR"/schemas "$SCRIPT_DIR"/lib "$SCRIPT_DIR"/assets "$dest"/
    glib-compile-schemas "$dest/schemas"
  fi
}

install_standalone() {
  local base="$HOME/.local/share/nexus-launcher"
  local bin_dir="$HOME/.local/bin"
  local apps_dir="$HOME/.local/share/applications"

  echo "Installing standalone GTK4 launcher..."
  mkdir -p "$base" "$bin_dir" "$apps_dir"
  cp "$SCRIPT_DIR/bin/nexus-launcher.mjs" "$base/"
  cp -r "$SCRIPT_DIR/assets" "$base/"
  chmod +x "$base/nexus-launcher.mjs"

  ln -sf "$base/nexus-launcher.mjs" "$bin_dir/nexus-launcher"

  cat > "$apps_dir/nexus-launcher.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Nexus Launcher
Comment=Frost-glass application launcher (standalone)
Exec=$bin_dir/nexus-launcher
Icon=system-search
Terminal=false
Categories=Utility;System;
Keywords=launcher;search;apps;run;
EOF

  # Register the user schema so the standalone launcher reads the same
  # settings as the extension (colors, blur, hotkey-independent preferences).
  local user_schema_dir="$HOME/.local/share/glib-2.0/schemas"
  mkdir -p "$user_schema_dir"
  cp "$SCRIPT_DIR/schemas/org.gnome.shell.extensions.nexus-launcher.gschema.xml" "$user_schema_dir/"
  glib-compile-schemas "$user_schema_dir"
}

install_rofi_theme() {
  local theme_dir="$HOME/.local/share/rofi/themes"
  echo "Installing Rofi theme..."
  mkdir -p "$theme_dir"
  cp "$SCRIPT_DIR/rofi/nexus.rasi" "$theme_dir/"
}

enable_extension() {
  if command -v gnome-extensions >/dev/null 2>&1 \
     && [[ -n "$XDG_CURRENT_DESKTOP" ]] \
     && [[ "$XDG_CURRENT_DESKTOP" == *GNOME* || "$XDG_CURRENT_DESKTOP" == *Unity* ]]; then
    echo "Enabling $EXT_UUID..."
    gnome-extensions enable "$EXT_UUID"
    echo "Done. Press Super+Return (or your configured hotkey) to open the launcher."
  else
    echo
    echo "You are not on GNOME Shell, so the extension is not enabled."
    echo "Use the standalone launcher instead:"
    echo "  $HOME/.local/bin/nexus-launcher"
    echo "Or run Rofi with the Nexus theme:"
    echo "  rofi -show drun -theme nexus"
  fi
}

install_deps
install_extension
install_standalone
install_rofi_theme
enable_extension

echo
echo "Nexus Launcher installed successfully."
echo "  - GNOME extension : $( [[ $SYSTEM -eq 1 ]] && echo system-wide || echo user )"
echo "  - Standalone      : $HOME/.local/bin/nexus-launcher"
echo "  - Rofi theme      : rofi -show drun -theme nexus"
