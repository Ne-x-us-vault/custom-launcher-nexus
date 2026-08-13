# Nexus Launcher

> A frost-glass, keyboard-first application launcher for GNOME Shell.

![Version](https://img.shields.io/badge/version-1.0.0-7c3aed?style=flat-square)
![GNOME Shell](https://img.shields.io/badge/GNOME%20Shell-45%E2%80%9350-4a86cf?style=flat-square)
![Language](https://img.shields.io/badge/language-JavaScript-f7df1e?style=flat-square)
[![License: MIT](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)](LICENSE)

Open it with a shortcut, start typing, and launch any installed app without
leaving your current task.

## Features

- Frost-glass overlay with a dimmed backdrop, adjustable blur, and background magnification
- Click-outside or `Escape` to close
- Fast installed-app search, ranked by name, description, executable, and desktop keywords
- Keyboard-first controls: `Super + Enter`, arrows, `Tab`, `Enter`, and `Escape`
- Four quick-action pills: Terminal, Files, GitHub, and LinkedIn
- Pinnable dock apps
- Native GNOME search-provider results (respecting your enabled-providers preferences) plus a web-search result that uses your default browser's search engine, with a custom URL option
- Launched apps and opened links are raised to the foreground
- Opens centered on the monitor under the pointer (multi-monitor friendly)
- Customizable appearance: colors, opacities, blur radius, magnification, and overlay opacity

## Preview

![Nexus Launcher overlay](nexus-launcher@Ne-x-us-vault.github.io/assets/screenshots/Screenshot%20From%202026-08-03%2002-27-40.png)

![Nexus Launcher preferences](nexus-launcher@Ne-x-us-vault.github.io/assets/screenshots/Screenshot%20From%202026-08-03%2002-28-12.png)

## Requirements

- Any distro running GNOME Shell 45–50 (Debian, Ubuntu, Fedora, Arch,
  openSUSE, and derivatives). GNOME 44 and older are not supported.

## Installation

### Option 1 — Install script

Download the script to a file and review it before running (avoid piping
remote code straight into your shell):

```bash
curl -fsSL -o install.sh https://raw.githubusercontent.com/Ne-x-us-vault/custom-launcher-nexus/main/install.sh
less install.sh
bash install.sh
```

Installs missing dependencies (glib-compile-schemas) using the detected
package manager (apt/dnf/pacman/zypper), then installs the extension. For a
system-wide install append `--system`.

> Prefer the native package for your distro (Options 2–4): they are built
> from the same sources and give you clean removal with your package manager.
> Package scripts cannot reach your GNOME session, so enable the extension
> once after login:
>
> ```bash
> gnome-extensions enable custom-launcher@nexus.dev
> ```

### Option 2 — Debian / Ubuntu package

```bash
cd custom-launcher-nexus/nexus-launcher@Ne-x-us-vault.github.io/packaging
./build-deb.sh 1.0.0
sudo apt install ./dist/nexus-launcher_1.0.0_all.deb
```

Remove with `sudo dpkg -r nexus-launcher`.

### Option 3 — Fedora / RHEL / openSUSE RPM

Needs `rpmbuild` (`sudo dnf install rpm-build`).

```bash
cd custom-launcher-nexus/nexus-launcher@Ne-x-us-vault.github.io/packaging
./build-rpm.sh 1.0.0
sudo dnf install ./dist/nexus-launcher-1.0.0-1.*.rpm
```

Remove with `sudo dnf remove nexus-launcher` (or `sudo zypper rm nexus-launcher`).

### Option 4 — Arch Linux package

Needs `makepkg` (Arch / Manjaro / EndeavourOS).

```bash
cd custom-launcher-nexus/nexus-launcher@Ne-x-us-vault.github.io/packaging
./build-arch.sh 1.0.0
sudo pacman -U ./dist/nexus-launcher-1.0.0-1-any.pkg.tar.zst
```

Remove with `sudo pacman -R nexus-launcher`.

### Option 5 — From source

```bash
cd custom-launcher-nexus/nexus-launcher@Ne-x-us-vault.github.io
./install.sh
```

On **Wayland**, log out and back in after installing. On **Xorg**, press
`Alt + F2`, enter `r`, then press Enter.

Verify with:

```bash
gnome-extensions info custom-launcher@nexus.dev
```

It should show `Enabled: Yes` and `State: ACTIVE`.

## Usage

| Action | Control |
| --- | --- |
| Open or close Nexus | `Super + Enter` (configurable) |
| Search | Start typing |
| Move through apps | `Up` / `Down` or `Tab` |
| Move through dock pills | `Left` / `Right` (when not typing) |
| Launch selected item | `Enter` |
| Close | `Escape`, click outside, or `Super + Enter` |

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
| Web search URL | url | auto | URL template for the web search result (`%s` = query). Leave empty to use the default browser's search engine |

The preferences panel also includes a **Reset to defaults** button that
restores every key and rebuilds the page.

## Troubleshooting

- **Shortcut does nothing:** run `gnome-extensions info custom-launcher@nexus.dev`; log out/in on Wayland if it is inactive.
- **Extension became inactive after an update:** GNOME Shell needs a reload; log out/in on Wayland.
- **Need diagnostics:** run `journalctl --user -f -o cat`, then open Nexus and look for `NexusLauncher` errors.

## License

Released under the [MIT License](LICENSE).
