import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import Pango from 'gi://Pango';
import AppUtils from './appUtils.js';

const CARD_SIZES = {
  small: { width: 420, height: 400 },
  medium: { width: 446, height: 480 },
  large: { width: 500, height: 520 },
};

export default class AppList {
  constructor(settings, onLaunch) {
    this._settings = settings;
    this._onLaunch = onLaunch;
    this._apps = [];
    this._filteredApps = [];
    this._selectedIndex = -1;

    this.actor = this._build();
    this._settingsSignal = this._settings.connect('changed::card-size', () => this._updateSize());
    this._updateSize();
    this._loadApps();
  }

  _build() {
    this._root = new St.BoxLayout({ style_class: 'nexus-list-card', vertical: true, x_expand: false, y_expand: false });
    this._scrollView = new St.ScrollView({ style_class: 'nexus-app-list-scrollview', overlay_scrollbars: true, x_expand: true, y_expand: true });
    this._list = new St.BoxLayout({ style_class: 'nexus-app-list', vertical: true, x_expand: true, y_expand: true });
    this._scrollView.set_child(this._list);
    this._root.add_child(this._scrollView);
    return this._root;
  }

  _loadApps() {
    this._apps = AppUtils.getInstalledApps();
    this.filter('');
  }

  _updateSize() {
    const sizeKey = this._settings.get_string('card-size');
    const size = CARD_SIZES[sizeKey] || CARD_SIZES.medium;
    this.actor.set_width(size.width);
    this.actor.set_height(size.height);
  }

  filter(query) {
    const searchFields = this._settings.get_strv('search-fields');
    const caseSensitive = this._settings.get_boolean('case-sensitive');
    this._filteredApps = this._apps.filter(app => AppUtils.matchesApp(app, query, searchFields, caseSensitive));
    this._renderRows();
  }

  _renderRows() {
    this._list.destroy_all_children();
    this._selectedIndex = -1;

    this._filteredApps.forEach((appInfo, index) => {
      const row = new St.Button({ style_class: 'nexus-app-row', x_expand: true, reactive: true, can_focus: true });
      const gicon = appInfo.get_icon() || new Gio.ThemedIcon({ name: 'application-x-executable' });

      const content = new St.BoxLayout({ style_class: 'nexus-app-row-content', vertical: false, x_expand: true, y_expand: true });
      content.add_child(new St.Icon({ gicon, icon_size: 38, style_class: 'nexus-app-icon' }));

      // St.Label does not expose an "ellipsize" construct property on recent
      // GNOME Shell versions.  The property belongs to its ClutterText child.
      const label = new St.Label({
        text: appInfo.get_name(),
        style_class: 'nexus-app-label',
        x_expand: true,
      });
      label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
      content.add_child(label);
      row.set_child(content);

      row.connect('clicked', () => this._onItemActivate(index));
      row.connect('enter-event', () => {
        row.add_style_pseudo_class('hover');
        return Clutter.EVENT_STOP;
      });
      row.connect('leave-event', () => {
        row.remove_style_pseudo_class('hover');
        return Clutter.EVENT_STOP;
      });

      this._list.add_child(row);
    });

    if (this._filteredApps.length > 0) {
      this._selectIndex(0);
    }
  }

  _onItemActivate(index) {
    const appInfo = this._filteredApps[index];
    if (!appInfo) {
      return;
    }
    this._onLaunch(appInfo);
  }

  moveSelection(delta) {
    if (!this._filteredApps.length) {
      return;
    }
    const nextIndex = Math.max(0, Math.min(this._filteredApps.length - 1, this._selectedIndex + delta));
    this._selectIndex(nextIndex);
  }

  _selectIndex(index) {
    if (index < 0 || index >= this._filteredApps.length) {
      return;
    }
    const children = this._list.get_children();
    if (this._selectedIndex >= 0 && children[this._selectedIndex]) {
      children[this._selectedIndex].remove_style_pseudo_class('selected');
    }
    this._selectedIndex = index;
    if (children[this._selectedIndex]) {
      children[this._selectedIndex].add_style_pseudo_class('selected');
      // GNOME Shell 50 exposes the vertical adjustment directly.  Retain the
      // older access paths for the Shell versions this extension supports.
      const adjustment = this._scrollView.get_vadjustment?.()
        ?? this._scrollView.vadjustment
        ?? this._scrollView.vscroll?.adjustment;
      if (adjustment) {
        adjustment.set_value(this._selectedIndex * 72);
      }
    }
  }

  activateSelected() {
    if (this._selectedIndex >= 0) {
      this._onItemActivate(this._selectedIndex);
    }
  }

  destroy() {
    if (this._settingsSignal) {
      this._settings.disconnect(this._settingsSignal);
      this._settingsSignal = null;
    }
    this._root.destroy();
  }
}
