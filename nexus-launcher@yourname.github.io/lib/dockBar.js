import St from 'gi://St';
import Gio from 'gi://Gio';
import AppUtils from './appUtils.js';

export default class DockBar {
  constructor(settings, onLaunch, onPowerOff) {
    this._settings = settings;
    this._onLaunch = onLaunch;
    this._onPowerOff = onPowerOff;
    this._container = this._build();
    this._settingsSignal = this._settings.connect('changed::dock-apps', () => this.refresh());
    this.refresh();
  }

  _build() {
    return new St.BoxLayout({ style_class: 'nexus-dock-strip', vertical: false, x_expand: true, y_expand: false, reactive: false });
  }

  refresh() {
    this._container.remove_all_children();
    this._addActionButton('utilities-terminal-symbolic', 'Open Terminal', () => {
      this._launchFirstAvailable([
        'org.gnome.Terminal.desktop',
        'org.gnome.Console.desktop',
        'kgx.desktop',
        'kitty.desktop',
      ]);
    });
    this._addActionButton('folder-symbolic', 'Open Files', () => {
      this._launchFirstAvailable(['org.gnome.Nautilus.desktop', 'nautilus.desktop']);
    });
    this._addActionButton('system-shutdown-symbolic', 'Power off', () => this._onPowerOff());

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

  _addActionButton(iconName, tooltip, callback) {
    const button = new St.Button({
      style_class: 'nexus-dock-btn nexus-quick-action',
      reactive: true,
      can_focus: true,
    });
    button.set_child(new St.Icon({ icon_name: iconName, icon_size: 20 }));
    button.connect('clicked', callback);
    this._container.add_child(button);
  }

  _launchFirstAvailable(desktopIds) {
    for (const desktopId of desktopIds) {
      const appInfo = AppUtils.getAppInfoForDesktopId(desktopId);
      if (appInfo) {
        this._onLaunch(appInfo);
        return;
      }
    }
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
