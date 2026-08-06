#!/usr/bin/gjs -m

// Nexus Launcher - standalone GTK4 version.
// Works on any desktop environment. Bind it to a global shortcut in your DE,
// or just launch it from a panel/terminal.

import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';

const APP_ID = 'dev.nexus.NexusLauncher';
const SCHEMA_ID = 'org.gnome.shell.extensions.nexus-launcher';
const WINDOW_WIDTH = 680;
const WINDOW_HEIGHT = 520;

const CSS = `
window.nexus-toplevel {
  background-color: transparent;
}
.nexus-surface {
  background-color: rgba(16, 67, 44, 0.85);
  border: 1px solid rgba(236, 244, 248, 0.30);
  border-radius: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.50);
}
.nexus-brand {
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 3px;
  color: rgba(249, 252, 253, 0.98);
}
.nexus-brand-sub {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: rgba(224, 235, 240, 0.68);
}
.nexus-entry {
  background-color: rgba(9, 13, 17, 0.76);
  border-radius: 999px;
  padding: 12px 18px;
  font-size: 14px;
  color: rgba(246, 250, 252, 0.96);
  caret-color: rgba(246, 250, 252, 0.90);
}
.nexus-list {
  background-color: transparent;
  border-radius: 18px;
}
.nexus-list > row {
  background-color: transparent;
  border-radius: 18px;
  padding: 10px 14px;
}
.nexus-list > row:hover {
  background-color: rgba(232, 241, 246, 0.10);
}
.nexus-list > row:selected {
  background-color: rgba(232, 241, 246, 0.14);
  border: 1px solid rgba(246, 250, 252, 0.46);
}
.nexus-row-label {
  color: rgba(246, 250, 252, 0.96);
  font-size: 14px;
}
.nexus-dock {
  background-color: rgba(9, 13, 17, 0.72);
  border-radius: 999px;
  padding: 8px 12px;
}
.nexus-dock-btn {
  background-color: rgba(9, 13, 17, 0.72);
  border-radius: 999px;
  padding: 10px 16px;
}
.nexus-dock-btn:hover {
  background-color: rgba(232, 241, 246, 0.16);
}
`;

function loadSettings() {
    try {
        return new Gio.Settings({ schema_id: SCHEMA_ID });
    } catch (e) {
        return null;
    }
}

function getInstalledApps() {
    return Gio.AppInfo.get_all()
        .filter(app => app.should_show())
        .sort((a, b) => a.get_name().localeCompare(b.get_name(), undefined, {sensitivity: 'base'}));
}

function launchApp(appInfo) {
    try {
        appInfo.launch([], null);
    } catch (e) {
        console.log(`[NexusLauncher] failed to launch ${appInfo.get_id()}: ${e}`);
    }
}

function matchScore(appInfo, query) {
    const q = query.trim().toLowerCase();
    if (!q)
        return 0;

    const fields = [
        appInfo.get_name() || '',
        appInfo.get_description() || '',
        appInfo.get_executable() || '',
    ];
    fields.push(...(appInfo.get_keywords?.() || []));

    let best = null;
    for (const value of fields) {
        if (!value)
            continue;
        const index = value.toLowerCase().indexOf(q);
        if (index >= 0) {
            const score = index + (value.length - q.length) / 100;
            best = best === null ? score : Math.min(best, score);
        }
    }
    return best;
}

function searchApps(apps, query) {
    return apps
        .map(app => ({app, score: matchScore(app, query)}))
        .filter(result => result.score !== null)
        .sort((a, b) => a.score - b.score || a.app.get_name().localeCompare(b.app.get_name()));
}

function assetsDir() {
    try {
        const uri = new URL('./assets/', import.meta.url);
        return Gio.File.new_for_uri(uri.href);
    } catch (e) {
        return null;
    }
}

function brandIcon(fileName) {
    const dir = assetsDir();
    const file = dir?.get_child(fileName);
    if (file?.query_exists(null))
        return new Gio.FileIcon({file});
    return new Gio.ThemedIcon({name: 'web-browser-symbolic'});
}

function iconFromApp(appInfo) {
    return appInfo.get_icon() || new Gio.ThemedIcon({name: 'application-x-executable'});
}

let settings = null;
let apps = [];
let filtered = [];
let win = null;
let entry = null;
let listbox = null;

function buildRow(result) {
    const row = new Gtk.ListBoxRow({activatable: true});
    row._app = result.app;

    const box = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 14});
    box.append(new Gtk.Image({gicon: iconFromApp(result.app), pixel_size: 38}));
    box.append(new Gtk.Label({
        label: result.app.get_name(),
        halign: Gtk.Align.START,
        css_classes: ['nexus-row-label'],
    }));
    row.set_child(box);
    return row;
}

function refreshList() {
    listbox.remove_all();
    for (const result of filtered)
        listbox.append(buildRow(result));
    const first = listbox.get_row_at_index(0);
    if (first)
        listbox.select_row(first);
}

function activateSelected() {
    const row = listbox.get_selected_row();
    if (row?._app) {
        launchApp(row._app);
        win.hide();
    }
}

function moveSelection(delta) {
    const row = listbox.get_selected_row();
    const current = row ? row.get_index() : -1;
    const next = Math.max(0, Math.min(filtered.length - 1, current + delta));
    const target = listbox.get_row_at_index(next);
    if (target)
        listbox.select_row(target);
}

function addDockButton(icon, callback, image = null) {
    const button = new Gtk.Button({css_classes: ['nexus-dock-btn']});
    button.set_child(image || new Gtk.Image({gicon: icon, pixel_size: 20}));
    button.connect('clicked', callback);
    return button;
}

function launchFirstAvailable(desktopIds) {
    for (const desktopId of desktopIds) {
        const appInfo = Gio.DesktopAppInfo.new(desktopId);
        if (appInfo && appInfo.should_show()) {
            launchApp(appInfo);
            return;
        }
    }
}

function buildDock() {
    const dock = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 8,
        css_classes: ['nexus-dock'],
    });

    dock.append(addDockButton(
        new Gio.ThemedIcon({name: 'utilities-terminal-symbolic'}), () => {
            launchFirstAvailable([
                'org.gnome.Ptyxis.desktop',
                'org.gnome.Terminal.desktop',
                'org.gnome.Console.desktop',
                'kgx.desktop',
                'tilix.desktop',
                'kitty.desktop',
                'alacritty.desktop',
                'org.xfce.Terminal.desktop',
                'konsole.desktop',
                'xterm.desktop',
            ]);
        }));

    dock.append(addDockButton(
        new Gio.ThemedIcon({name: 'folder-symbolic'}), () => {
            launchFirstAvailable([
                'org.gnome.Nautilus.desktop',
                'org.gnome.Files.desktop',
                'nautilus.desktop',
                'nemo.desktop',
                'dolphin.desktop',
                'org.xfce.thunar.desktop',
                'thunar.desktop',
                'pcmanfm.desktop',
            ]);
        }));

    dock.append(addDockButton(
        brandIcon('github.svg'),
        () => {
            Gio.AppInfo.launch_default_for_uri(
                settings?.get_string('github-url') || 'https://github.com', null);
            win.hide();
        }));
    dock.append(addDockButton(
        brandIcon('linkedin.svg'),
        () => {
            Gio.AppInfo.launch_default_for_uri(
                settings?.get_string('linkedin-url') || 'https://www.linkedin.com', null);
            win.hide();
        }));

    const pinned = settings?.get_strv('dock-apps') || [];
    for (const desktopId of pinned) {
        const appInfo = Gio.DesktopAppInfo.new(desktopId);
        if (appInfo && appInfo.should_show()) {
            dock.append(addDockButton(iconFromApp(appInfo), () => {
                launchApp(appInfo);
                win.hide();
            }));
        }
    }
    return dock;
}

function buildWindow() {
    const window = new Gtk.Window({
        application: null,
        title: 'Nexus Launcher',
        decorated: false,
        resizable: false,
        width_request: WINDOW_WIDTH,
        height_request: WINDOW_HEIGHT,
        css_classes: ['nexus-toplevel'],
    });

    // The default display only exists once GTK is initialised by the first
    // window, so register the theme here rather than at module scope.
    const provider = new Gtk.CssProvider();
    provider.load_from_string(CSS);
    Gtk.StyleContext.add_provider_for_display(
        window.get_display(),
        provider,
        Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
    );

    entry = new Gtk.SearchEntry({
        placeholder_text: 'Search apps and commands',
        css_classes: ['nexus-entry'],
        hexpand: true,
    });

    listbox = new Gtk.ListBox({
        css_classes: ['nexus-list'],
        selection_mode: Gtk.SelectionMode.SINGLE,
    });
    listbox.connect('row-activated', () => activateSelected());
    listbox.connect('row-selected', () => listbox.scroll_to_selected_row?.());

    const scrolled = new Gtk.ScrolledWindow({vexpand: true});
    scrolled.set_child(listbox);

    const brand = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 0,
    });
    brand.append(new Gtk.Label({label: 'NEXUS', css_classes: ['nexus-brand']}));
    brand.append(new Gtk.Label({label: 'DEVELOPED BY NE-X-US-VAULT', css_classes: ['nexus-brand-sub']}));

    const surface = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 18,
        css_classes: ['nexus-surface'],
    });
    surface.set_margin_top(24);
    surface.set_margin_bottom(24);
    surface.set_margin_start(24);
    surface.set_margin_end(24);
    surface.append(brand);
    surface.append(entry);
    surface.append(scrolled);
    surface.append(buildDock());

    window.set_child(surface);

    entry.connect('search-changed', () => {
        filtered = searchApps(apps, entry.get_text());
        refreshList();
    });
    // GtkSearchEntry emits `activate` (and stops further propagation) on
    // Return, so hook the launch directly here.
    entry.connect('activate', () => activateSelected());

    // Navigation must win over the entry's own key handling. A controller in
    // the capture phase runs before the focused widget's default controllers,
    // so Up/Down/Return/Escape always reach us even while typing.
    const navKeys = new Gtk.EventControllerKey({
        propagation_phase: Gtk.PropagationPhase.CAPTURE,
    });
    entry.add_controller(navKeys);
    navKeys.connect('key-pressed', (_, keyval, _keycode, _state) => {
        if (keyval === Gdk.KEY_Up) {
            moveSelection(-1);
            return true;
        }
        if (keyval === Gdk.KEY_Down) {
            moveSelection(1);
            return true;
        }
        if (keyval === Gdk.KEY_Return || keyval === Gdk.KEY_KP_Enter) {
            activateSelected();
            return true;
        }
        if (keyval === Gdk.KEY_Escape) {
            window.hide();
            return true;
        }
        return false;
    });

    // Fallback handling for keys that arrive while the entry is not focused
    // (e.g. right after the window regains focus).
    const controller = new Gtk.EventControllerKey();
    window.add_controller(controller);
    controller.connect('key-pressed', (_, keyval, _keycode, state) => {
        if (keyval === Gdk.KEY_Escape) {
            window.hide();
            return true;
        }
        if (keyval === Gdk.KEY_Up) {
            moveSelection(-1);
            return true;
        }
        if (keyval === Gdk.KEY_Down) {
            moveSelection(1);
            return true;
        }
        if (keyval === Gdk.KEY_Return || keyval === Gdk.KEY_KP_Enter) {
            activateSelected();
            return true;
        }
        if (keyval === Gdk.KEY_q && (state & Gdk.ModifierType.CONTROL_MASK)) {
            window.destroy();
            return true;
        }
        return false;
    });

    // GTK4 has no window-positioning API: the WM handles placement (most
    // window managers centre new windows). We only focus the search box.
    window.connect('map', () => {
        entry.grab_focus();
    });

    filtered = apps.map(app => ({app, score: 0}));
    refreshList();
    return window;
}

settings = loadSettings();
apps = getInstalledApps();

const app = new Gtk.Application({application_id: APP_ID});
app.connect('activate', () => {
    if (!win) {
        win = buildWindow();
        app.add_window(win);
    }
    win.present();
});
app.run([]);
