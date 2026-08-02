import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

function acceleratorName(keyval, state) {
  return Gtk.accelerator_name(keyval, state & ~Gdk.ModifierType.LOCK_MASK);
}

export default class NexusLauncherPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings();

    window.set_title(_('Nexus Launcher Preferences'));
    window.set_default_size(560, 500);

    const page = new Adw.PreferencesPage({ title: _('Nexus Launcher') });
    page.add(this._buildHotkeyGroup(settings));
    page.add(this._buildLayoutGroup(settings));
    page.add(this._buildConnectivityGroup(settings));
    window.add(page);
  }

  _buildHotkeyGroup(settings) {
    const group = new Adw.PreferencesGroup({
      title: _('Hotkey'),
      description: _('Choose the shortcut that toggles Nexus Launcher.'),
    });
    const row = new Adw.ActionRow({ title: _('Toggle launcher') });
    const entry = new Gtk.Entry({
      text: settings.get_strv('hotkey').join(', '),
      editable: false,
      can_focus: true,
      hexpand: true,
      placeholder_text: _('Click, then press a shortcut'),
    });

    const controller = new Gtk.EventControllerKey();
    entry.add_controller(controller);
    controller.connect('key-pressed', (_, keyval, _keycode, state) => {
      const accelerator = acceleratorName(keyval, state);
      if (!accelerator)
        return Gdk.EVENT_PROPAGATE;

      settings.set_strv('hotkey', [accelerator]);
      entry.text = accelerator;
      return Gdk.EVENT_STOP;
    });

    row.add_suffix(entry);
    group.add(row);
    return group;
  }

  _buildLayoutGroup(settings) {
    const group = new Adw.PreferencesGroup({
      title: _('Layout'),
      description: _('Control how strongly the launcher surface shows through the desktop.'),
    });
    const row = new Adw.ActionRow({ title: _('Opacity') });
    const scale = new Gtk.Scale({
      orientation: Gtk.Orientation.HORIZONTAL,
      adjustment: new Gtk.Adjustment({
        lower: 0.2,
        upper: 1.0,
        step_increment: 0.01,
        value: settings.get_double('opacity'),
      }),
      digits: 0,
      draw_value: false,
      hexpand: true,
      width_request: 220,
    });
    scale.connect('value-changed', () => settings.set_double('opacity', scale.get_value()));
    row.add_suffix(scale);
    group.add(row);
    return group;
  }

  _buildConnectivityGroup(settings) {
    const group = new Adw.PreferencesGroup({
      title: _('Connectivity'),
      description: _('These links are opened by the GitHub and LinkedIn pills in the launcher.'),
    });
    group.add(this._buildUrlRow(settings, 'github-url', _('GitHub link')));
    group.add(this._buildUrlRow(settings, 'linkedin-url', _('LinkedIn link')));
    return group;
  }

  _buildUrlRow(settings, key, title) {
    const row = new Adw.ActionRow({ title });
    const entry = new Gtk.Entry({
      text: settings.get_string(key),
      hexpand: true,
      width_request: 300,
      placeholder_text: 'https://',
    });
    entry.connect('changed', () => settings.set_string(key, entry.text.trim()));
    row.add_suffix(entry);
    return row;
  }
}
