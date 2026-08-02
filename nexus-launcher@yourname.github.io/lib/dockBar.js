import St from 'gi://St';
import Gio from 'gi://Gio';
import AppUtils from './appUtils.js';

export default class DockBar {
  constructor(settings, onLaunch) {
    this._settings = settings;
    this._onLaunch = onLaunch;
    this._container = this._build();
    this._settingsSignal = this._settings.connect('changed::dock-apps', () => this.refresh());
    this.refresh();
  }

  _build() {
    return new St.BoxLayout({ style_class: 'nexus-dock-strip', vertical: false, x_expand: true, y_expand: false, reactive: false });
  }

  refresh() {
    this._container.remove_all_children();
    const pinnedApps = this._settings.get_strv('dock-apps');

    pinnedApps.forEach(desktopId => {
      const appInfo = AppUtils.getAppInfoForDesktopId(desktopId);
      if (!appInfo) {
        return;
      }

      const icon = appInfo.get_icon() || new Gio.ThemedIcon({ name: 'application-x-executable' });
      const button = new St.Button({ style_class: 'nexus-dock-btn', reactive: true, can_focus: true });
      button.set_child(new St.Icon({ gicon: icon, icon_size: 24 }));
      button.connect('clicked', () => this._onLaunch(appInfo));
      this._container.add_child(button);
    });
  }

  get actor() {
    return this._container;
  }

  destroy() {
    if (this._settingsSignal) {
      this._settings.disconnect(this._settingsSignal);
      this._settingsSignal = null;
    }
    this._container.destroy();
  }
}
