import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

function acceleratorName(keyval, state) {
  return Gtk.accelerator_name(keyval, state & ~Gdk.ModifierType.LOCK_MASK);
}

function formatHotkey(strv) {
  const raw = strv.join(', ');
  return raw
    .replace(/<Super>/g, 'Super + ')
    .replace(/<Shift>/g, 'Shift + ')
    .replace(/<Control>/g, 'Ctrl + ')
    .replace(/<Alt>/g, 'Alt + ')
    .replace(/<Primary>/g, 'Ctrl + ')
    .replace(/Return/g, 'Enter')
    .replace(/KP_Enter/g, 'Numpad Enter');
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

    window.set_title(_('Nexus Launcher'));
    window.set_default_size(600, 720);

    this._page = new Adw.PreferencesPage({
      title: _('Nexus Launcher'),
      icon_name: 'view-app-grid-symbolic',
    });
    this._rebuildGroups();
    window.add(this._page);
  }

  _rebuildGroups() {
    if (this._groups) {
      for (const group of this._groups)
        this._page.remove(group);
    }

    this._groups = [
      this._buildGeneralGroup(this._settings),
      this._buildAppearanceGroup(this._settings),
      this._buildConnectivityGroup(this._settings),
      this._buildResetGroup(),
      this._buildAboutGroup(),
    ];
    for (const group of this._groups)
      this._page.add(group);
  }

  // ─── General ────────────────────────────────────────────────────────

  _buildGeneralGroup(settings) {
    const group = new Adw.PreferencesGroup({
      title: _('General'),
      description: _('Core launcher behaviour and keybinding.'),
    });

    // ── Hotkey ──
    const hotkeyRow = new Adw.ActionRow({
      title: _('Toggle launcher'),
      subtitle: _('Keyboard shortcut that opens and closes the overlay.'),
    });

    const hotkeyBtn = new Gtk.Button({
      css_classes: ['flat', 'nexus-hotkey-btn'],
      can_focus: true,
      valign: Gtk.Align.CENTER,
    });

    const updateHotkeyLabel = (strv) => {
      hotkeyBtn.set_label(`  ${formatHotkey(strv)}  `);
    };
    updateHotkeyLabel(settings.get_strv('hotkey'));

    const hotkeyCtrl = new Gtk.EventControllerKey();
    hotkeyBtn.add_controller(hotkeyCtrl);
    hotkeyCtrl.connect('key-pressed', (_, keyval, _code, state) => {
      if (keyval === Gdk.KEY_Escape || keyval === Gdk.KEY_BackSpace || keyval === Gdk.KEY_Delete)
        return Gdk.EVENT_PROPAGATE;

      const acc = acceleratorName(keyval, state);
      if (!acc)
        return Gdk.EVENT_PROPAGATE;

      settings.set_strv('hotkey', [acc]);
      updateHotkeyLabel([acc]);
      return Gdk.EVENT_STOP;
    });

    hotkeyBtn.connect('clicked', () => hotkeyBtn.grab_focus());
    hotkeyRow.add_suffix(hotkeyBtn);
    group.add(hotkeyRow);

    // ── Card Size ──
    const sizeRow = new Adw.ActionRow({
      title: _('Card size'),
      subtitle: _('Controls the layout scale of the launcher cards.'),
    });
    const sizeCombo = new Gtk.ComboBoxText({ valign: Gtk.Align.CENTER });
    for (const [val, label] of [['compact', _('Compact')], ['medium', _('Medium')], ['large', _('Large')]]) {
      sizeCombo.append(val, label);
      if (val === settings.get_string('card-size'))
        sizeCombo.set_active_id(val);
    }
    sizeCombo.connect('changed', () => settings.set_string('card-size', sizeCombo.get_active_id()));
    sizeRow.add_suffix(sizeCombo);
    group.add(sizeRow);

    // ── Search Fields ──
    const searchFieldsRow = new Adw.ActionRow({
      title: _('Search fields'),
      subtitle: _('Which app properties are matched when filtering.'),
    });
    const searchCombo = new Gtk.ComboBoxText({ valign: Gtk.Align.CENTER });
    const fieldOptions = [
      ['name', _('Name only')],
      ['description', _('Description only')],
      ['name,description', _('Name + description')],
    ];
    const currentFields = settings.get_strv('search-fields').join(',');
    for (const [val, label] of fieldOptions) {
      searchCombo.append(val, label);
      if (val === currentFields)
        searchCombo.set_active_id(val);
    }
    searchCombo.connect('changed', () => {
      settings.set_strv('search-fields', searchCombo.get_active_id().split(','));
    });
    searchFieldsRow.add_suffix(searchCombo);
    group.add(searchFieldsRow);

    // ── Case Sensitive ──
    const caseRow = new Adw.ActionRow({
      title: _('Case-sensitive search'),
      subtitle: _('Match app names exactly rather than ignoring case.'),
    });
    const caseSwitch = new Gtk.Switch({
      active: settings.get_boolean('case-sensitive'),
      valign: Gtk.Align.CENTER,
    });
    caseSwitch.connect('state-set', (_, state) => {
      settings.set_boolean('case-sensitive', state);
      return true;
    });
    caseRow.add_suffix(caseSwitch);
    caseRow.activatable_widget = caseSwitch;
    group.add(caseRow);

    // ── Search Hint ──
    const hintRow = new Adw.ActionRow({
      title: _('Search hint text'),
      subtitle: _('Placeholder text shown in the search bar when empty.'),
    });
    const hintEntry = new Gtk.Entry({
      text: settings.get_string('search-hint'),
      halign: Gtk.Align.END,
      valign: Gtk.Align.CENTER,
      width_chars: 18,
      placeholder_text: _('Search'),
    });
    hintEntry.connect('changed', () => settings.set_string('search-hint', hintEntry.text.trim()));
    hintRow.add_suffix(hintEntry);
    group.add(hintRow);

    return group;
  }

  // ─── Appearance ─────────────────────────────────────────────────────

  _buildAppearanceGroup(settings) {
    const group = new Adw.PreferencesGroup({
      title: _('Appearance'),
      description: _('Frost-glass surface colours, blur, and magnification.'),
    });

    group.add(this._buildColorRow(settings, 'surface-color', _('Surface colour'),
      _('Background tint of the main launcher panel.')));
    group.add(this._buildOpacityRow(settings, 'surface-opacity', _('Surface opacity'),
      0.05, 1.0, settings.get_double('surface-opacity')));

    group.add(this._buildColorRow(settings, 'card-color', _('Card colour'),
      _('Background tint of the right app card.')));
    group.add(this._buildOpacityRow(settings, 'card-opacity', _('Card opacity'),
      0.05, 1.0, settings.get_double('card-opacity')));

    // ── Blur toggle ──
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

    // ── Blur radius ──
    const radiusRow = new Adw.ActionRow({
      title: _('Blur radius'),
      subtitle: _('Strength of the frost-glass blur effect.'),
    });
    const radiusValue = this._formatPercent(settings.get_double('blur-radius'), 0, 100);
    const radiusLabel = new Gtk.Label({ label: radiusValue, css_classes: ['dim-label', 'monospace'] });
    const radiusScale = new Gtk.Scale({
      orientation: Gtk.Orientation.HORIZONTAL,
      adjustment: new Gtk.Adjustment({
        lower: 0, upper: 100, step_increment: 1,
        value: settings.get_double('blur-radius'),
      }),
      digits: 0,
      draw_value: false,
      hexpand: true,
      width_request: 200,
    });
    radiusScale.connect('value-changed', () => {
      const v = radiusScale.get_value();
      settings.set_double('blur-radius', v);
      radiusLabel.set_text(this._formatPercent(v, 0, 100));
    });
    radiusRow.add_suffix(radiusLabel);
    radiusRow.add_suffix(radiusScale);
    radiusRow.sensitive = settings.get_boolean('blur-enabled');
    blurSwitch.connect('state-set', (_, state) => {
      settings.set_boolean('blur-enabled', state);
      radiusRow.sensitive = state;
      return true;
    });
    group.add(radiusRow);

    // ── Magnification ──
    const magRow = new Adw.ActionRow({
      title: _('Glass magnification'),
      subtitle: _('How much the surface magnifies the background, like thick glass.'),
    });
    const magValue = this._formatMultiplier(settings.get_double('magnification'));
    const magLabel = new Gtk.Label({ label: magValue, css_classes: ['dim-label', 'monospace'] });
    const magScale = new Gtk.Scale({
      orientation: Gtk.Orientation.HORIZONTAL,
      adjustment: new Gtk.Adjustment({
        lower: 1.0, upper: 1.2, step_increment: 0.01,
        value: settings.get_double('magnification'),
      }),
      digits: 2,
      draw_value: false,
      hexpand: true,
      width_request: 200,
    });
    magScale.connect('value-changed', () => {
      const v = magScale.get_value();
      settings.set_double('magnification', v);
      magLabel.set_text(this._formatMultiplier(v));
    });
    magRow.add_suffix(magLabel);
    magRow.add_suffix(magScale);
    group.add(magRow);

    // ── Overlay opacity ──
    const ovRow = new Adw.ActionRow({
      title: _('Overlay opacity'),
      subtitle: _('Overall transparency of the entire launcher overlay.'),
    });
    const ovValue = this._formatPercent(settings.get_double('opacity'), 0.2, 1.0);
    const ovLabel = new Gtk.Label({ label: ovValue, css_classes: ['dim-label', 'monospace'] });
    const ovScale = new Gtk.Scale({
      orientation: Gtk.Orientation.HORIZONTAL,
      adjustment: new Gtk.Adjustment({
        lower: 0.2, upper: 1.0, step_increment: 0.01,
        value: settings.get_double('opacity'),
      }),
      digits: 2,
      draw_value: false,
      hexpand: true,
      width_request: 200,
    });
    ovScale.connect('value-changed', () => {
      const v = ovScale.get_value();
      settings.set_double('opacity', v);
      ovLabel.set_text(this._formatPercent(v, 0.2, 1.0));
    });
    ovRow.add_suffix(ovLabel);
    ovRow.add_suffix(ovScale);
    group.add(ovRow);

    return group;
  }

  // ─── Connectivity ───────────────────────────────────────────────────

  _buildConnectivityGroup(settings) {
    const group = new Adw.PreferencesGroup({
      title: _('Connectivity'),
      description: _('URLs opened by the dock quick-action pills.'),
    });
    group.add(this._buildUrlRow(settings, 'github-url', _('GitHub'),
      _('Opened by the GitHub dock pill.'), 'folder-remote-symbolic'));
    group.add(this._buildUrlRow(settings, 'linkedin-url', _('LinkedIn'),
      _('Opened by the LinkedIn dock pill.'), 'avatar-default-symbolic'));
    group.add(this._buildUrlRow(settings, 'mail-url', _('Mail'),
      _('Opened by the Mail dock pill.'), 'mail-read-symbolic'));

    const webInfo = new Adw.ActionRow({
      title: _('Web search'),
      subtitle: _('Uses the default browser\'s search engine. Configure in your browser settings.'),
    });
    webInfo.add_suffix(new Gtk.Image({
      icon_name: 'system-help-symbolic',
      css_classes: ['dim-label'],
      pixel_size: 16,
    }));
    webInfo.set_activatable(false);
    group.add(webInfo);

    return group;
  }

  // ─── Reset ──────────────────────────────────────────────────────────

  _buildResetGroup() {
    const group = new Adw.PreferencesGroup();
    const row = new Adw.ActionRow({
      title: _('Reset to defaults'),
      subtitle: _('Restore every Nexus Launcher setting to its shipped value.'),
    });

    const btn = new Gtk.Button({
      label: _('Reset'),
      css_classes: ['destructive-action', 'flat'],
      valign: Gtk.Align.CENTER,
    });
    btn.connect('clicked', () => this._confirmReset());

    row.add_suffix(btn);
    row.activatable_widget = btn;
    group.add(row);
    return group;
  }

  _confirmReset() {
    const dialog = new Adw.MessageDialog({
      transient_for: this._window,
      heading: _('Reset all settings?'),
      body: _('This will restore every Nexus Launcher preference to its original value. This action cannot be undone.'),
    });
    dialog.add_response('cancel', _('Cancel'));
    dialog.add_response('reset', _('Reset'));
    dialog.set_response_appearance('reset', Adw.ResponseAppearance.DESTRUCTIVE);
    dialog.connect('response', (_d, response) => {
      if (response === 'reset') {
        this._settings.settings_schema.list_keys().forEach(k => this._settings.reset(k));
        this._rebuildGroups();
      }
    });
    dialog.present();
  }

  // ─── About ──────────────────────────────────────────────────────────

  _buildAboutGroup() {
    const group = new Adw.PreferencesGroup({ css_classes: ['boxed-list'] });

    const infoRow = new Adw.ActionRow({ css_classes: ['nexus-about-row'] });
    infoRow.set_activatable(false);

    const box = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 2,
      valign: Gtk.Align.CENTER,
      margin_top: 4,
      margin_bottom: 4,
    });

    const nameLabel = new Gtk.Label({
      label: '<b>Nexus Launcher</b>',
      use_markup: true,
      xalign: 0,
      css_classes: ['heading', 'nexus-about-title'],
    });
    const version = this.metadata.version || '1.0.0';
    const versionLabel = new Gtk.Label({
      label: `<span size="small" alpha="55000">v${version}</span>`,
      use_markup: true,
      xalign: 0,
    });
    const descLabel = new Gtk.Label({
      label: `<span size="small" alpha="50000">Frost-glass keyboard launcher for GNOME Shell</span>`,
      use_markup: true,
      xalign: 0,
      wrap: true,
    });

    box.append(nameLabel);
    box.append(versionLabel);
    box.append(descLabel);
    infoRow.set_child(box);
    group.add(infoRow);

    // ── Links ──
    const linksRow = new Adw.ActionRow({ title: _('Project & support') });
    linksRow.set_activatable(false);
    linksRow.add_suffix(this._makeLinkButton('github-symbolic', _('GitHub'), 'https://github.com/Ne-x-us-vault'));
    group.add(linksRow);

    return group;
  }

  _makeLinkButton(iconName, tooltip, uri) {
    const btn = new Gtk.Button({
      icon_name: iconName,
      tooltip_text: tooltip,
      css_classes: ['flat', 'circular'],
      valign: Gtk.Align.CENTER,
    });
    btn.connect('clicked', () => {
      Gio.AppInfo.launch_default_for_uri(uri, null);
    });
    return btn;
  }

  // ─── Reusable Row Builders ──────────────────────────────────────────

  _buildColorRow(settings, key, title, subtitle) {
    const row = new Adw.ActionRow({ title, subtitle });
    const colorBtn = new Gtk.ColorButton({
      rgba: rgbaFromString(settings.get_string(key)),
      use_alpha: false,
      valign: Gtk.Align.CENTER,
    });
    colorBtn.connect('color-set', () => {
      settings.set_string(key, colorBtn.get_rgba().to_string());
    });
    row.add_suffix(colorBtn);
    return row;
  }

  _buildOpacityRow(settings, key, title, min, max, initial) {
    const row = new Adw.ActionRow({ title });
    const pct = this._formatPercent(initial, min, max);
    const valueLabel = new Gtk.Label({ label: pct, css_classes: ['dim-label', 'monospace'] });
    const scale = new Gtk.Scale({
      orientation: Gtk.Orientation.HORIZONTAL,
      adjustment: new Gtk.Adjustment({
        lower: min, upper: max, step_increment: 0.01,
        value: initial,
      }),
      digits: 0,
      draw_value: false,
      hexpand: true,
      width_request: 200,
    });
    scale.connect('value-changed', () => {
      const v = scale.get_value();
      settings.set_double(key, v);
      valueLabel.set_text(this._formatPercent(v, min, max));
    });
    row.add_suffix(valueLabel);
    row.add_suffix(scale);
    return row;
  }

  _buildUrlRow(settings, key, title, subtitle, iconName) {
    const row = new Adw.ActionRow({ title, subtitle });
    const entry = new Gtk.Entry({
      text: settings.get_string(key),
      halign: Gtk.Align.END,
      valign: Gtk.Align.CENTER,
      width_chars: 32,
      placeholder_text: 'https://',
      primary_icon_name: iconName,
    });
    entry.connect('changed', () => settings.set_string(key, entry.text.trim()));
    row.add_suffix(entry);
    return row;
  }

  // ─── Formatting Helpers ─────────────────────────────────────────────

  _formatPercent(value, min, max) {
    const pct = Math.round(((value - min) / (max - min)) * 100);
    return `${pct}%`;
  }

  _formatMultiplier(value) {
    const pct = Math.round((value - 1.0) * 500);
    if (pct === 0) return 'None';
    return `+${pct}%`;
  }
}
