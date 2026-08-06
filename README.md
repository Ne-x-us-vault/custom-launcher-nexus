# Nexus Launcher

> A frost-glass, keyboard-first application launcher for GNOME Shell — plus a
> standalone GTK4 version and a matching Rofi theme that work on any desktop.

![Version](https://img.shields.io/badge/version-1.0.0-7c3aed?style=flat-square)
![GNOME Shell](https://img.shields.io/badge/GNOME%20Shell-45%E2%80%9350-4a86cf?style=flat-square)
![Language](https://img.shields.io/badge/language-JavaScript-f7df1e?style=flat-square)
[![License: MIT](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)](LICENSE)

Nexus Launcher opens with a shortcut, searches installed applications instantly,
and provides a clean frost-glass workspace for launching apps and essential
quick actions without leaving your current task.

## Components

Nexus Launcher ships as three pieces so it works on every desktop:

| Component | What it is | Where it runs |
| --- | --- | --- |
| **GNOME Shell extension** | The full overlay with frosted blur, magnification, and native GNOME search-provider results | GNOME Shell 45–50 |
| **Standalone launcher** | A GTK4 app (`nexus-launcher`) with the same look and keyboard controls | Any desktop environment |
| **Rofi theme** | A matching glass dark-green theme (`nexus.rasi`) | Any desktop with Rofi |

## Highlights

- Frost-glass overlay with a dimmed backdrop, adjustable blur, and background magnification
- Click-outside or `Escape` to close
- Fast installed-app search, ranked by name, description, executable, and desktop keywords
- Keyboard-first controls: `Super + Enter`, arrows, `Tab`, `Enter`, and `Escape`
- Smooth mouse-wheel and trackpad scrolling over the complete overlay
- Four quick-action pills: Terminal, Files, GitHub, and LinkedIn
- Pinnable dock apps (`dock-apps` GSettings key)
- Optional native GNOME search-provider results plus a built-in web-search fallback
- Customizable appearance: surface/card colors, individual opacities, blur radius, magnification, and overlay opacity
- "Reset to defaults" button in the preferences panel

## Preview

### Launcher overlay

![Nexus Launcher overlay](nexus-launcher@Ne-x-us-vault.github.io/assets/screenshots/Screenshot%20From%202026-08-03%2002-27-40.png)

### Preferences

![Nexus Launcher preferences](nexus-launcher@Ne-x-us-vault.github.io/assets/screenshots/Screenshot%20From%202026-08-03%2002-28-12.png)

## Tech stack

| Layer | Technology |
| --- | --- |
| Platform | GNOME Shell Extension API |
| Language | Modern JavaScript (GJS, ESM) |
| UI | GNOME Shell `St` / Clutter (extension) and GTK 4 / libadwaita (standalone) |
| Settings | GSettings / GLib schemas |
| Packaging | Bash, `glib-compile-schemas`, `zip`, `dpkg-deb`, `makepkg` |

## Requirements

| To use… | You need |
| --- | --- |
| GNOME Shell extension | GNOME Shell 45, 46, 47, 48, 49, or 50 |
| Standalone launcher | `gjs`, GTK 4, libadwaita |
| Rofi theme | `rofi` |

Dependencies installed automatically by `install.sh`, per package manager:

| Package manager | Packages |
| --- | --- |
| `apt` (Debian/Ubuntu) | `gjs`, `gir1.2-gtk-4.0`, `gir1.2-adw-1`, `libglib2.0-bin`, `zip` (+ `gnome-shell` on GNOME) |
| `pacman` (Arch) | `gjs`, `gtk4`, `libadwaita`, `glib2`, `zip` (+ `gnome-shell` on GNOME) |
| `dnf` (Fedora) | `gjs`, `gtk4`, `libadwaita`, `glib2`, `zip` |
| `zypper` (openSUSE) | `gjs`, `gtk4`, `libadwaita-gtk4`, `zip` |

## Installation

### Option 1 — One-liner (any terminal)

```bash
curl -fsSL https://raw.githubusercontent.com/Ne-x-us-vault/custom-launcher-nexus/main/install.sh | bash
```

Downloads the current `main` branch, detects your package manager
(`apt`/`pacman`/`dnf`/`zypper`), installs missing dependencies, then installs
the extension, the standalone launcher, and the Rofi theme. For a system-wide
install append `--system`:

```bash
curl -fsSL https://raw.githubusercontent.com/Ne-x-us-vault/custom-launcher-nexus/main/install.sh | bash -s -- --system
```

On non-GNOME desktops the extension is skipped gracefully and the standalone
launcher + Rofi theme are installed instead.

### Option 2 — Installer script (clone)

```bash
git clone https://github.com/Ne-x-us-vault/custom-launcher-nexus.git
cd custom-launcher-nexus/nexus-launcher@Ne-x-us-vault.github.io
./install.sh            # add --system for a system-wide install
```

### Option 3 — Debian / Ubuntu package

```bash
cd custom-launcher-nexus/nexus-launcher@Ne-x-us-vault.github.io/packaging
./build-deb.sh 1.0.0
sudo apt install ./dist/nexus-launcher_1.0.0_all.deb
```

The package installs everything under `/usr/share`, compiles the schemas, and
enables the extension in `postinst`. Remove with `sudo dpkg -r nexus-launcher`.

### Option 4 — Arch Linux (PKGBUILD)

The PKGBUILD pulls the tarball from the GitHub tag matching `pkgver`:

```bash
cd custom-launcher-nexus/nexus-launcher@Ne-x-us-vault.github.io/packaging/arch
makepkg -si
```

### Option 5 — Manual build (GNOME Shell extension only)

```bash
cd custom-launcher-nexus/nexus-launcher@Ne-x-us-vault.github.io
./build.sh
gnome-extensions install --force custom-launcher@nexus.dev.zip
gnome-extensions enable custom-launcher@nexus.dev
```

On **Wayland**, log out and back in after installing or updating JavaScript
extension code. On **Xorg**, press `Alt + F2`, enter `r`, then press Enter.

Verify the result:

```bash
gnome-extensions info custom-launcher@nexus.dev
```

It should show `Enabled: Yes` and `State: ACTIVE`.

### Uninstalling

- **Installer / clone install:** delete
  `~/.local/share/gnome-shell/extensions/custom-launcher@nexus.dev/` (or
  `/usr/share/gnome-shell/extensions/custom-launcher@nexus.dev/` for
  `--system`), plus `~/.local/bin/nexus-launcher`,
  `~/.local/share/nexus-launcher/`,
  `~/.local/share/applications/nexus-launcher.desktop`, and
  `~/.local/share/rofi/themes/nexus.rasi`.
- **`.deb`:** `sudo dpkg -r nexus-launcher`
- **Arch:** `sudo pacman -R nexus-launcher`

## Usage

### GNOME Shell extension

| Action | Control |
| --- | --- |
| Open or close Nexus | `Super + Enter` (configurable) |
| Search | Start typing |
| Move through apps | `Up` / `Down` or `Tab` |
| Move through dock pills | `Left` / `Right` (when not typing) |
| Launch selected item | `Enter` |
| Close | `Escape`, click outside, or `Super + Enter` |

### Standalone launcher (any desktop)

```bash
nexus-launcher
```

Same search and keyboard behaviour. Launch it from a panel, terminal, or bind
it to a global shortcut in your desktop's settings. `Ctrl + Q` quits it
entirely.

### Rofi theme

```bash
rofi -show drun -theme nexus
```

### Quick-action detection

The Terminal pill opens the first available of Ptyxis, GNOME Terminal, GNOME
Console, KGX, Tilix, Kitty, Alacritty, Xfce Terminal, Konsole, or xterm. The
Files pill uses the first of Nautilus, Files, Nemo, Dolphin, Thunar, or PCManFM.

## Configuration

Open the preferences panel with:

```bash
gnome-extensions prefs custom-launcher@nexus.dev
```

| Setting | Type | Default | Effect |
| --- | --- | --- | --- |
| Hotkey | keybinding | `Super+Enter` | Keybinding used to toggle the overlay |
| Search placeholder | string | `Search` | Hint text in the search entry |
| Search fields | string[] | `name, description` | Fields used when filtering apps |
| Case-sensitive search | bool | `false` | Whether filtering is case sensitive |
| Card size | enum | `medium` | Layout scale of the launcher cards |
| Pinned dock apps | string[] | — | Desktop IDs pinned to the dock |
| Surface color | color | `#10432c` | Background color of the launcher surface |
| Surface opacity | float | `0.15` | Opacity of the surface background |
| Card color | color | `#0a0f14` | Background color of the app card panel |
| Card opacity | float | `0.88` | Opacity of the card panel background |
| Frosted blur | bool | `true` | Blur the desktop behind the surface |
| Blur radius | float | `8.87` | Strength of the frost-glass effect |
| Magnification | float | `1.2` | How much the surface magnifies the background |
| Overlay opacity | float | `1.0` | Overall opacity of the entire overlay |
| GitHub link | url | `https://github.com/Ne-x-us-vault` | GitHub pill destination |
| LinkedIn link | url | `https://www.linkedin.com/in/jaswa-j-r/` | LinkedIn pill destination |

The preferences panel also includes a destructive **Reset to defaults** button
that restores every key to its default and rebuilds the page.

All keys live under the schema
`org.gnome.shell.extensions.nexus-launcher` and can be read or written with
`gsettings` (the standalone launcher reads the same settings):

```bash
gsettings set org.gnome.shell.extensions.nexus-launcher blur-radius 12.0
gsettings get org.gnome.shell.extensions.nexus-launcher hotkey
```

## Development and release

Run the release checks and create a fresh package:

```bash
cd nexus-launcher@Ne-x-us-vault.github.io
node --check extension.js
for file in lib/*.js prefs.js; do node --check "$file"; done
node --check bin/nexus-launcher.mjs
glib-compile-schemas --strict schemas
./build.sh
unzip -t custom-launcher@nexus.dev.zip
```

Build and validate the distribution packages:

```bash
cd nexus-launcher@Ne-x-us-vault.github.io/packaging
bash -n build-deb.sh build-all.sh
./build-all.sh 1.0.0
dpkg-deb --info dist/nexus-launcher_1.0.0_all.deb
dpkg-deb -c dist/nexus-launcher_1.0.0_all.deb
```

The `packaging/` directory layout:

```
packaging/
├── build-deb.sh        # builds packaging/dist/*.deb from ./debian templates
├── build-all.sh        # orchestrates all distribution builds
├── debian/
│   ├── control.template
│   ├── postinst        # compiles schemas + enables the extension
│   ├── prerm           # disables the extension before removal
│   └── postrm          # recompiles schemas after removal
└── arch/
    ├── PKGBUILD
    └── nexus-launcher.install
```

To publish a future release after committing:

```bash
git tag -a vX.Y.Z -m "Nexus Launcher vX.Y.Z"
git push origin main --tags
```

Create a GitHub Release from the tag and attach
`nexus-launcher@Ne-x-us-vault.github.io/custom-launcher@nexus.dev.zip` as the
installable asset.

## Troubleshooting

- **Shortcut does nothing:** run `gnome-extensions info custom-launcher@nexus.dev`; log out/in on Wayland if it is inactive.
- **Extension became inactive after an update:** GNOME Shell needs a reload; log out/in on Wayland.
- **A quick action does not open:** ensure a compatible terminal/file manager exists and social URLs begin with `https://`.
- **Standalone launcher does not start:** run `nexus-launcher` from a terminal and check for `gjs` errors; confirm `gjs`, GTK 4, and libadwaita are installed.
- **`gjs: module 'gi://Gtk' ... failed`:** the standalone launcher needs GTK 4 and the GObject introspection typelibs (`gir1.2-gtk-4.0` and `gir1.2-adw-1` on Debian/Ubuntu).
- **`.deb` install does not enable the extension:** run `sudo glib-compile-schemas /usr/share/glib-2.0/schemas` and `gnome-extensions enable custom-launcher@nexus.dev`, then log out/in.
- **Need diagnostics:** run `journalctl --user -f -o cat`, then open Nexus and look for `NexusLauncher` errors.

## License

Released under the [MIT License](LICENSE).
