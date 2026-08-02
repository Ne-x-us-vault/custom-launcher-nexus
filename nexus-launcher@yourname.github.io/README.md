# Nexus Launcher

A GNOME Shell extension launcher overlay built for modern GNOME Shell.

## Build

```bash
cd ~/Projects/VS-Code/custom-launcher@nexus.dev/nexus-launcher@yourname.github.io
./build.sh
```

## Install

```bash
cd ~/Projects/VS-Code/custom-launcher@nexus.dev/nexus-launcher@yourname.github.io
gnome-extensions install -f custom-launcher@nexus.dev.zip
```

## Run / Enable

The extension is installed, but GNOME Shell needs to reload its extension registry before it can activate the extension.

### On Xorg
1. Press `Alt+F2`
2. Type `r`
3. Press Enter

### On Wayland
1. Log out
2. Log back in

Then enable the extension:

```bash
gnome-extensions enable custom-launcher@nexus.dev
```

### Usage

Press `Super+Return` to open the launcher overlay.

## Preferences

Open preferences with:

```bash
gnome-extensions prefs custom-launcher@nexus.dev
```
