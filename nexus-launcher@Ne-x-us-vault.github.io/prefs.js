import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

function acceleratorName(keyval, state) {
  return Gtk.accelerator_name(keyval, state & ~Gdk.ModifierType.LOCK_MASK);
}

function rgbaFromString(str) {
  const rgba = new Gdk.RGBA();
  if (!rgba.parse(str)) {
    rgba.red = 0;
    rgba.green = 0;
    rgba.blue = 0;
    rgba.alpha = 0.5;
  }
  return rgba;
}

export default class NexusLauncherPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    this._settings = this.getSettings();
    this._window = window;

    window.set_title(_('Nexus Launcher Preferences'));
    window.set_default_size(560, 620);

    this._page = new Adw.PreferencesPage({ title: _('Nexus Launcher') });
    this._rebuildGroups();
    window.add(this._page);
  }

  // A full rebuild lets the widgets pick up the freshly reset values without
  // having to update each control individually.
  _rebuildGroups() {
    if (this._groups) {
      for (const group of this._groups)
        this._page.remove(group);
    }

    this._groups = [
      this._buildHotkeyGroup(this._settings),
      this._buildAppearanceGroup(this._settings),
      this._buildConnectivityGroup(this._settings),
      this._buildResetGroup(),
    ];
    for (const group of this._groups)
      this._page.add(group);
  }

  _buildResetGroup() {
    const group = new Adw.PreferencesGroup({
      title: _('Reset'),
      description: _('Restore every Nexus Launcher setting to its original value.'),
    });
    const row = new Adw.ActionRow({
      title: _('Reset to defaults'),
      subtitle: _('Brings back the look and behaviour the launcher shipped with.'),
    });
    const button = new Gtk.Button({
      label: _('Reset'),
      css_classes: ['destructive-action'],
      valign: Gtk.Align.CENTER,
    });
    button.connect('clicked', () => {
      this._settings.settings_schema.list_keys().forEach(key => this._settings.reset(key));
      this._rebuildGroups();
    });
    row.add_suffix(button);
    row.activatable_widget = button;
    group.add(row);
    return group;
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
      // Navigation/editing keys must not become the launcher hotkey.
      if (keyval === Gdk.KEY_Escape || keyval === Gdk.KEY_BackSpace || keyval === Gdk.KEY_Delete)
        return Gdk.EVENT_PROPAGATE;

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

  _buildAppearanceGroup(settings) {
    const group = new Adw.PreferencesGroup({
      title: _('Appearance'),
      description: _('Customize the look of the launcher surface.'),
    });

    group.add(this._buildColorRow(settings, 'surface-color', _('Surface color')));
    group.add(this._buildOpacityRow(settings, 'surface-opacity', _('Surface opacity')));
    group.add(this._buildColorRow(settings, 'card-color', _('Card color')));
    group.add(this._buildOpacityRow(settings, 'card-opacity', _('Card opacity')));

    const blurRow = new Adw.ActionRow({
      title: _('Frosted blur'),
      subtitle: _('Blur the desktop behind the launcher surface.'),
    });
    const blurSwitch = new Gtk.Switch({
      active: settings.get_boolean('blur-enabled'),
      valign: Gtk.Align.CENTER,
    });
    blurRow.add_suffix(blurSwitch);
    blurRow.activatable_widget = blurSwitch;
    group.add(blurRow);

    const radiusRow = new Adw.ActionRow({ title: _('Blur radius') });
    const radiusScale = new Gtk.Scale({
      orientation: Gtk.Orientation.HORIZONTAL,
      adjustment: new Gtk.Adjustment({
        lower: 0,
        upper: 100,
        step_increment: 1,
        value: settings.get_double('blur-radius'),
      }),
      digits: 0,
      draw_value: false,
      hexpand: true,
      width_request: 220,
    });
    radiusScale.connect('value-changed', () => settings.set_double('blur-radius', radiusScale.get_value()));
    radiusRow.add_suffix(radiusScale);
    radiusRow.sensitive = settings.get_boolean('blur-enabled');
    blurSwitch.connect('state-set', (_, state) => {
      settings.set_boolean('blur-enabled', state);
      radiusRow.sensitive = state;
      return true;
    });
    group.add(radiusRow);

    const magRow = new Adw.ActionRow({
      title: _('Glass magnification'),
      subtitle: _('How much the surface magnifies the background behind it, like a thick pane of glass.'),
    });
    const magScale = new Gtk.Scale({
      orientation: Gtk.Orientation.HORIZONTAL,
      adjustment: new Gtk.Adjustment({
        lower: 1.0,
        upper: 1.2,
        step_increment: 0.01,
        value: settings.get_double('magnification'),
      }),
      digits: 2,
      draw_value: false,
      hexpand: true,
      width_request: 220,
    });
    magScale.connect('value-changed', () => settings.set_double('magnification', magScale.get_value()));
    magRow.add_suffix(magScale);
    group.add(magRow);

    const opacityRow = new Adw.ActionRow({
      title: _('Overlay opacity'),
      subtitle: _('Overall transparency of the entire launcher overlay.'),
    });
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
    opacityRow.add_suffix(scale);
    group.add(opacityRow);
    return group;
  }

  _buildColorRow(settings, key, title) {
    const row = new Adw.ActionRow({ title });
    const colorButton = new Gtk.ColorButton({
      rgba: rgbaFromString(settings.get_string(key)),
      use_alpha: false,
    });
    colorButton.connect('color-set', () => {
      settings.set_string(key, colorButton.get_rgba().to_string());
    });
    row.add_suffix(colorButton);
    return row;
  }

  _buildOpacityRow(settings, key, title) {
    const row = new Adw.ActionRow({ title });
    const scale = new Gtk.Scale({
      orientation: Gtk.Orientation.HORIZONTAL,
      adjustment: new Gtk.Adjustment({
        lower: 0.05,
        upper: 1.0,
        step_increment: 0.01,
        value: settings.get_double(key),
      }),
      digits: 0,
      draw_value: false,
      hexpand: true,
      width_request: 220,
    });
    scale.connect('value-changed', () => settings.set_double(key, scale.get_value()));
    row.add_suffix(scale);
    return row;
  }

  _buildConnectivityGroup(settings) {
    const group = new Adw.PreferencesGroup({
      title: _('Connectivity'),
      description: _('Links opened by the GitHub and LinkedIn pills, and the URL template used by the web search result (leave empty to use the default browser’s search engine).'),
    });
    group.add(this._buildUrlRow(settings, 'github-url', _('GitHub link')));
    group.add(this._buildUrlRow(settings, 'linkedin-url', _('LinkedIn link')));
    group.add(this._buildUrlRow(settings, 'web-search-url', _('Web search URL')));
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
