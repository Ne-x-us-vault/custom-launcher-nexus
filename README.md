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
- Native GNOME search-provider results plus a built-in web-search fallback
- Customizable appearance: colors, opacities, blur radius, magnification, and overlay opacity

## Preview

![Nexus Launcher overlay](nexus-launcher@Ne-x-us-vault.github.io/assets/screenshots/Screenshot%20From%202026-08-03%2002-27-40.png)

![Nexus Launcher preferences](nexus-launcher@Ne-x-us-vault.github.io/assets/screenshots/Screenshot%20From%202026-08-03%2002-28-12.png)

## Requirements

- Ubuntu with GNOME Shell 45–50

## Installation

### Option 1 — One-liner

```bash
curl -fsSL https://raw.githubusercontent.com/Ne-x-us-vault/custom-launcher-nexus/main/install.sh | bash
```

Installs missing dependencies via apt, then installs the extension. For a
system-wide install append `--system`.

### Option 2 — Debian / Ubuntu package

```bash
cd custom-launcher-nexus/nexus-launcher@Ne-x-us-vault.github.io/packaging
./build-deb.sh 1.0.0
sudo apt install ./dist/nexus-launcher_1.0.0_all.deb
```

Remove with `sudo dpkg -r nexus-launcher`.

### Option 3 — From source

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

The preferences panel also includes a **Reset to defaults** button that
restores every key and rebuilds the page.

## Troubleshooting

- **Shortcut does nothing:** run `gnome-extensions info custom-launcher@nexus.dev`; log out/in on Wayland if it is inactive.
- **Extension became inactive after an update:** GNOME Shell needs a reload; log out/in on Wayland.
- **Need diagnostics:** run `journalctl --user -f -o cat`, then open Nexus and look for `NexusLauncher` errors.

## License

Released under the [MIT License](LICENSE).
