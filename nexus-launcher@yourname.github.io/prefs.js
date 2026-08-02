import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const CARD_SIZES = ['small', 'medium', 'large'];

function acceleratorName(keyval, state) {
  const normalizedState = state & ~Gdk.ModifierType.LOCK_MASK;
  return Gtk.accelerator_name(keyval, normalizedState);
}

function getAppName(appId) {
  try {
    const appInfo = Gio.DesktopAppInfo.new(appId);
    return appInfo ? appInfo.get_name() : appId;
  } catch (e) {
    return appId;
  }
}

export default class NexusLauncherPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    try {
      const provider = new Gtk.CssProvider();
      const stylesheetPath = GLib.build_filenamev([this.path, 'stylesheet.css']);
      provider.load_from_path(stylesheetPath);

      const display = Gdk.Display.get_default();
      if (display) {
        Gtk.StyleContext.add_provider_for_display(
          display,
          provider,
          Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );
      }
    } catch (e) {
      console.warn(`NexusLauncher: failed to apply prefs stylesheet: ${e}`);
    }

    const settings = this.getSettings();
    window.set_title(_('Nexus Launcher Preferences'));
    window.set_default_size(620, 720);

    const page = new Adw.PreferencesPage({ title: _('Nexus Launcher') });

    page.add(this._buildHotkeyGroup(settings));
    page.add(this._buildDockGroup(settings, window));
    page.add(this._buildSearchGroup(settings));
    page.add(this._buildLayoutGroup(settings));

    window.add(page);
  }

  _buildHotkeyGroup(settings) {
    const group = new Adw.PreferencesGroup({ title: _('Hotkey') });

    const hotkeyRow = new Adw.ActionRow({
      title: _('Toggle launcher'),
      subtitle: _('Click the shortcut, then press the combination you want to use.'),
    });
    const hotkeyEntry = new Gtk.Entry({
      text: settings.get_strv('hotkey').join(', '),
      editable: false,
      can_focus: true,
      hexpand: true,
      placeholder_text: _('Press a key combination'),
    });

    const keyController = new Gtk.EventControllerKey();
    keyController.connect('key-pressed', (_, keyval, _keycode, state) => {
      const accelerator = acceleratorName(keyval, state);
      if (!accelerator) {
        return Gdk.EVENT_PROPAGATE;
      }
      settings.set_strv('hotkey', [accelerator]);
      hotkeyEntry.text = accelerator;
      return Gdk.EVENT_STOP;
    });
    hotkeyEntry.add_controller(keyController);

    hotkeyEntry.connect('notify::has-focus', () => {
      if (hotkeyEntry.has_focus) {
        hotkeyEntry.text = '';
      }
    });

    hotkeyRow.add_suffix(hotkeyEntry);
    group.add(hotkeyRow);

    return group;
  }

  _buildDockGroup(settings, window) {
    const group = new Adw.PreferencesGroup({
      title: _('Dock Apps'),
      description: _('The Terminal, Files, GitHub and LinkedIn pills are always shown. Add optional application shortcuts below.'),
    });
    this._dockSettings = settings;
    this._dockGroup = group;
    this._dockRows = [];

    const addRow = new Adw.ActionRow({
      title: _('Pinned applications'),
      subtitle: _('Add an app, then use the arrows to set its order.'),
    });
    const addButton = new Gtk.Button({ label: _('Add') });
    addButton.connect('clicked', () => this._showAppChooser(window));
    addRow.add_suffix(addButton);
    group.add(addRow);

    this._refreshDockRows();
    settings.connect('changed::dock-apps', () => this._refreshDockRows());

    return group;
  }

  _showAppChooser(window) {
    const dialog = new Gtk.Dialog({ transient_for: window, use_header_bar: true, title: _('Add pinned app') });
    dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
    dialog.add_button(_('Add'), Gtk.ResponseType.OK);

    const chooser = new Gtk.AppChooserButton({ show_default: false, show_fallback: false });
    dialog.get_content_area().append(chooser);
    dialog.set_default_size(420, 180);
    dialog.show();

    dialog.connect('response', (d, response) => {
      if (response === Gtk.ResponseType.OK) {
        const appInfo = chooser.get_app_info();
        if (appInfo) {
          this._addDockApp(appInfo.get_id());
        }
      }
      d.destroy();
    });
  }

  _refreshDockRows() {
    if (!this._dockGroup) {
      return;
    }

    this._dockRows.forEach(row => this._dockGroup.remove(row));
    this._dockRows = [];

    const apps = this._dockSettings.get_strv('dock-apps');
    if (apps.length === 0) {
      const emptyRow = new Adw.ActionRow({
        title: _('No pinned applications'),
        subtitle: _('Select Add to put an application in the launcher dock.'),
      });
      emptyRow.add_css_class('property');
      this._dockGroup.add(emptyRow);
      this._dockRows.push(emptyRow);
      return;
    }

    apps.forEach((appId, index) => {
      const row = new Adw.ActionRow({
        title: getAppName(appId),
        subtitle: appId,
      });
      const controls = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 });

      const upButton = new Gtk.Button({ label: '↑', tooltip_text: _('Move up') });
      upButton.connect('clicked', () => this._moveDockApp(index, -1));
      controls.append(upButton);

      const downButton = new Gtk.Button({ label: '↓', tooltip_text: _('Move down') });
      downButton.connect('clicked', () => this._moveDockApp(index, 1));
      controls.append(downButton);

      const removeButton = new Gtk.Button({ label: _('Remove') });
      removeButton.connect('clicked', () => this._removeDockApp(index));
      controls.append(removeButton);

      row.add_suffix(controls);
      this._dockGroup.add(row);
      this._dockRows.push(row);
    });
  }

  _addDockApp(appId) {
    const apps = this._dockSettings.get_strv('dock-apps');
    if (!apps.includes(appId)) {
      this._dockSettings.set_strv('dock-apps', [...apps, appId]);
    }
  }

  _moveDockApp(index, direction) {
    const apps = this._dockSettings.get_strv('dock-apps');
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= apps.length) {
      return;
    }
    const moved = [...apps];
    [moved[index], moved[nextIndex]] = [moved[nextIndex], moved[index]];
    this._dockSettings.set_strv('dock-apps', moved);
  }

  _removeDockApp(index) {
    const apps = this._dockSettings.get_strv('dock-apps');
    apps.splice(index, 1);
    this._dockSettings.set_strv('dock-apps', apps);
  }

  _buildSearchGroup(settings) {
    const group = new Adw.PreferencesGroup({ title: _('Search Settings') });

    group.add(this._buildToggleRow(settings, 'name', _('Search name')));
    group.add(this._buildToggleRow(settings, 'description', _('Search description')));
    group.add(this._buildToggleRow(settings, 'exec', _('Search exec')));

    const caseRow = new Adw.ActionRow({ title: _('Case sensitive') });
    const caseSwitch = new Gtk.Switch({ active: settings.get_boolean('case-sensitive') });
    caseSwitch.connect('state-set', (_, state) => {
      settings.set_boolean('case-sensitive', state);
      return false;
    });
    caseRow.add_suffix(caseSwitch);
    group.add(caseRow);

    const hintRow = new Adw.ActionRow({ title: _('Search hint') });
    const hintEntry = new Gtk.Entry({ text: settings.get_string('search-hint'), hexpand: true });
    hintEntry.connect('changed', () => settings.set_string('search-hint', hintEntry.text));
    hintRow.add_suffix(hintEntry);
    group.add(hintRow);

    return group;
  }

  _buildToggleRow(settings, field, title) {
    const row = new Adw.ActionRow({ title });
    const toggle = new Gtk.Switch({ active: settings.get_strv('search-fields').includes(field) });
    toggle.connect('state-set', (_, state) => {
      const fields = new Set(settings.get_strv('search-fields'));
      if (state) {
        fields.add(field);
      } else {
        fields.delete(field);
      }
      settings.set_strv('search-fields', Array.from(fields));
      return false;
    });
    row.add_suffix(toggle);
    return row;
  }

  _buildLayoutGroup(settings) {
    const group = new Adw.PreferencesGroup({ title: _('Layout') });

    const sizeRow = new Adw.ActionRow({ title: _('Card size') });
    const dropdown = Gtk.DropDown.new_from_strings(CARD_SIZES);
    dropdown.set_selected(CARD_SIZES.indexOf(settings.get_string('card-size')));
    dropdown.connect('notify::selected', () => {
      settings.set_string('card-size', CARD_SIZES[dropdown.get_selected()]);
    });
    sizeRow.add_suffix(dropdown);
    group.add(sizeRow);

    const opacityRow = new Adw.ActionRow({ title: _('Opacity') });
    const opacityScale = new Gtk.Scale({ orientation: Gtk.Orientation.HORIZONTAL, adjustment: new Gtk.Adjustment({ lower: 0.0, upper: 1.0, step_increment: 0.01, value: settings.get_double('opacity') }), hexpand: true, });
    opacityScale.set_value_pos(Gtk.PositionType.RIGHT);
    opacityScale.connect('value-changed', () => settings.set_double('opacity', opacityScale.get_value()));
    opacityRow.add_suffix(opacityScale);
    group.add(opacityRow);

    return group;
  }
}
