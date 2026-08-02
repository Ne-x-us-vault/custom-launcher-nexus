import St from 'gi://St';
import Gio from 'gi://Gio';
import AppUtils from './appUtils.js';

export default class DockBar {
  constructor(settings, onLaunch) {
    this._settings = settings;
    this._onLaunch = onLaunch;
    this._iconsDirectory = Gio.File.new_for_uri(import.meta.url)
      .get_parent()
      .get_parent()
      .get_child('assets');
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
        // Fedora/GNOME's current terminal is Ptyxis. Keep the older IDs as
        // fallbacks for other distributions.
        'org.gnome.Ptyxis.desktop',
        'org.gnome.Terminal.desktop',
        'org.gnome.Console.desktop',
        'kgx.desktop',
        'kitty.desktop',
      ]);
    });
    this._addActionButton('folder-symbolic', 'Open Files', () => {
      this._launchFirstAvailable(['org.gnome.Nautilus.desktop', 'nautilus.desktop']);
    });
    this._addActionButton(this._brandIcon('github.svg'), 'Open Ne-x-us-vault on GitHub', () => {
      this._launchUri('https://github.com/Ne-x-us-vault');
    });
    this._addActionButton(this._brandIcon('linkedin.svg'), 'Open Jaswa J R on LinkedIn', () => {
      this._launchUri('https://www.linkedin.com/in/jaswa-j-r/');
    });

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

  _addActionButton(icon, tooltip, callback) {
    const button = new St.Button({
      style_class: 'nexus-dock-btn nexus-quick-action',
      reactive: true,
      can_focus: true,
    });
    const iconProperties = typeof icon === 'string'
      ? {icon_name: icon, icon_size: 20}
      : {gicon: icon, icon_size: 20};
    button.set_child(new St.Icon(iconProperties));
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

  _brandIcon(filename) {
    return new Gio.FileIcon({ file: this._iconsDirectory.get_child(filename) });
  }

  _launchUri(uri) {
    try {
      Gio.AppInfo.launch_default_for_uri(uri, null);
      // This mirrors launching an app: open the target, then dismiss Nexus.
      this._onLaunch(null);
    } catch (error) {
      console.log(`[NexusLauncher] could not open ${uri}: ${error}`);
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
