# Nexus Launcher

> A frost-glass, keyboard-first application launcher for GNOME Shell.

![Version](https://img.shields.io/badge/version-1.0.0-7c3aed?style=flat-square)
![GNOME Shell](https://img.shields.io/badge/GNOME%20Shell-45%E2%80%9350-4a86cf?style=flat-square)
![Language](https://img.shields.io/badge/language-JavaScript-f7df1e?style=flat-square)
[![License: MIT](https://img.shields.io/badge/license-MIT-22c55e?style=flat-square)](LICENSE)

**✅ Status: Complete — v1.0.0 released.** This project is feature-complete; contributions and bug reports are welcome.

Nexus Launcher opens with a shortcut, searches installed applications instantly, and provides a clean workspace for launching apps and essential quick actions without leaving your current task.

> The extension source lives in [`nexus-launcher@yourname.github.io/`](nexus-launcher@yourname.github.io/).

## Highlights

- Frost-glass overlay with a dimmed backdrop and click-outside close behaviour
- Fast installed-app search, ranked by name, description, executable, and desktop keywords
- Keyboard-first controls: `Super + Enter`, arrows, `Tab`, `Enter`, and `Escape`
- Smooth mouse-wheel and trackpad scrolling over the complete overlay
- Four quick-action pills: Terminal, Files, GitHub, and LinkedIn
- Configurable hotkey, visual opacity, and GitHub/LinkedIn destinations
- Optional native GNOME search-provider results plus a safe web-search fallback
- Supports GNOME Shell **45–50** on Wayland and Xorg

## Tech stack

| Layer | Technology |
| --- | --- |
| Platform | GNOME Shell Extension API |
| Language | Modern JavaScript (GJS) |
| UI | GNOME Shell `St` / Clutter |
| Settings | GSettings / GLib schemas |
| Packaging | Bash, `glib-compile-schemas`, `zip` |

## Requirements

- GNOME Shell 45, 46, 47, 48, 49, or 50
- `gnome-extensions`, `glib-compile-schemas`, and `zip`

## Installation

Clone the repository and build the extension:

```bash
git clone https://github.com/Ne-x-us-vault/custom-launcher-nexus.git
cd custom-launcher-nexus/nexus-launcher@yourname.github.io
./build.sh
```

Install and enable the package:

```bash
gnome-extensions install --force custom-launcher@nexus.dev.zip
gnome-extensions enable custom-launcher@nexus.dev
```

On **Wayland**, log out and log back in after installing or updating JavaScript extension code. On **Xorg**, press `Alt + F2`, enter `r`, then press Enter.

Verify the result:

```bash
gnome-extensions info custom-launcher@nexus.dev
```

It should show `Enabled: Yes` and `State: ACTIVE`.

## Usage

| Action | Control |
| --- | --- |
| Open or close Nexus | `Super + Enter` |
| Search | Start typing |
| Move through apps | `Up` / `Down` or `Tab` |
| Move through quick actions | `Left` / `Right` |
| Launch selected item | `Enter` |
| Close | `Escape`, click outside, or `Super + Enter` |

The Terminal pill detects Ptyxis, GNOME Terminal, GNOME Console, KGX, or Kitty. The Files pill uses the system file manager.

There is no web demo because this is a native GNOME Shell extension; the installed overlay is the product experience.

## Preferences

Open the native preferences panel:

```bash
gnome-extensions prefs custom-launcher@nexus.dev
```

| Setting | Effect |
| --- | --- |
| Hotkey | Replaces the default `Super + Enter` shortcut |
| Opacity | Controls the transparency of the complete launcher surface |
| GitHub link | Destination of the GitHub quick-action pill |
| LinkedIn link | Destination of the LinkedIn quick-action pill |

## Development and release

Run the release checks and create a fresh package:

```bash
cd nexus-launcher@yourname.github.io
node --check extension.js
for file in lib/*.js prefs.js; do node --check "$file"; done
glib-compile-schemas --strict schemas
./build.sh
unzip -t custom-launcher@nexus.dev.zip
```

To publish a future release after committing:

```bash
git tag -a vX.Y.Z -m "Nexus Launcher vX.Y.Z"
git push origin main --tags
```

Create a GitHub Release from the tag and attach `nexus-launcher@yourname.github.io/custom-launcher@nexus.dev.zip` as the installable asset.

## Troubleshooting

- **Shortcut does nothing:** run `gnome-extensions info custom-launcher@nexus.dev`; log out/in on Wayland if it is inactive.
- **Extension became inactive after an update:** GNOME Shell needs a reload; log out/in on Wayland.
- **A quick action does not open:** ensure a compatible terminal/file manager exists and social URLs begin with `https://`.
- **Need diagnostics:** run `journalctl --user -f -o cat`, then open Nexus and look for `NexusLauncher` errors.

## License

Released under the [MIT License](LICENSE).
