import St from 'gi://St';
import Clutter from 'gi://Clutter';

export default class SearchBar {
  constructor(settings, onSearchChanged) {
    this._settings = settings;
    this._onSearchChanged = onSearchChanged;
    this._settingsSignal = null;
    this._build();
    this._connectSettings();
  }

  _build() {
    this.actor = new St.BoxLayout({ style_class: 'nexus-search-widget', vertical: false, x_expand: true, y_expand: false });
    this._searchIcon = new St.Icon({
      icon_name: 'edit-find-symbolic',
      icon_size: 18,
      y_align: Clutter.ActorAlign.CENTER,
      style_class: 'nexus-search-icon',
    });
    this._entry = new St.Entry({ style_class: 'nexus-search-entry', x_expand: true, hint_text: this._settings.get_string('search-hint') });
    this.entry = this._entry;

    this.actor.add_child(this._searchIcon);
    this.actor.add_child(this._entry);

    this._entry.clutter_text.connect('text-changed', () => {
      this._onSearchChanged(this.getText());
    });
  }

  _connectSettings() {
    this._settingsSignal = this._settings.connect('changed::search-hint', () => {
      this._entry.hint_text = this._settings.get_string('search-hint');
    });
  }
  getText() {
    return this._entry.text || '';
  }

  setText(text) {
    this._entry.text = text || '';
  }

  clear() {
    this.setText('');
    this._onSearchChanged('');
  }

  focus() {
    this._entry.grab_key_focus();
  }

  destroy() {
    if (this._settingsSignal) {
      this._settings.disconnect(this._settingsSignal);
      this._settingsSignal = null;
    }
    this.actor.destroy();
  }
}
