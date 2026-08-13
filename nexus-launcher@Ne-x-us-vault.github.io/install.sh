#!/usr/bin/env bash
#
# Nexus Launcher - cross-distro GNOME Shell installer.
#
# Installs the GNOME Shell extension (custom-launcher@nexus.dev) on any
# distro running GNOME Shell 45+, using the detected package manager
# (apt-get, dnf, pacman, or zypper) when build tools are missing.
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

Installs missing runtime dependencies (glib-compile-schemas) using the
detected package manager, copies the extension, and enables it on GNOME
Shell.
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

find_pkg_manager() {
  for pm in apt-get dnf pacman zypper; do
    command -v "$pm" >/dev/null 2>&1 && { echo "$pm"; return; }
  done
  return 1
}

# Map a missing build tool to the package that ships it on each distro.
# Installing by binary name fails on Arch (glib2) and Fedora/openSUSE
# (glib2-devel), where glib-compile-schemas is not a package.
pkg_for_tool() {
  local tool="$1" pm="$2"
  case "$pm" in
    apt-get)  case "$tool" in glib-compile-schemas) echo "libglib2.0-bin";; *) echo "$tool";; esac ;;
    dnf|zypper) case "$tool" in glib-compile-schemas) echo "glib2-devel";; *) echo "$tool";; esac ;;
    pacman)   case "$tool" in glib-compile-schemas) echo "glib2";; *) echo "$tool";; esac ;;
  esac
}

install_deps() {
  # Only the schema compiler is needed by this installer; `zip` is only used
  # by build.sh and is not a runtime requirement.
  local missing=()
  if ! command -v glib-compile-schemas >/dev/null 2>&1; then
    missing+=("glib-compile-schemas")
  fi

  if [[ ${#missing[@]} -eq 0 ]]; then
    echo "Required build tools are already installed."
    return
  fi

  local pm
  if ! pm="$(find_pkg_manager)"; then
    echo "No supported package manager found (apt/dnf/pacman/zypper)." >&2
    echo "Please install ${missing[*]} manually, then rerun this installer." >&2
    exit 1
  fi

  local packages=()
  for tool in "${missing[@]}"; do
    packages+=("$(pkg_for_tool "$tool" "$pm")")
  done

  echo "Installing ${packages[*]} via $pm..."
  case "$pm" in
    apt-get)
      "${PRIV[@]}" apt-get update
      "${PRIV[@]}" apt-get install -y "${packages[@]}"
      ;;
    dnf)
      "${PRIV[@]}" dnf install -y "${packages[@]}"
      ;;
    pacman)
      "${PRIV[@]}" pacman -S --needed --noconfirm "${packages[@]}"
      ;;
    zypper)
      "${PRIV[@]}" zypper --non-interactive install "${packages[@]}"
      ;;
  esac
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
