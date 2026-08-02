import Gio from 'gi://Gio';

export default class AppUtils {
  static getInstalledApps() {
    return Gio.AppInfo.get_all().filter(app => app.should_show()).sort((a, b) => {
      return a.get_name().localeCompare(b.get_name(), undefined, { sensitivity: 'base' });
    });
  }

  static getAppInfoForDesktopId(desktopId) {
    try {
      const appInfo = Gio.DesktopAppInfo.new(desktopId);
      return appInfo && appInfo.should_show() ? appInfo : null;
    } catch (e) {
      return null;
    }
  }

  static launchApp(appInfo) {
    try {
      appInfo.launch([], null);
    } catch (e) {
      log(`NexusLauncher: failed to launch ${appInfo.get_id()}: ${e}`);
    }
  }

  static normalize(query, caseSensitive) {
    if (!query) {
      return '';
    }
    return caseSensitive ? query : query.toLowerCase();
  }

  static matchesApp(appInfo, query, searchFields, caseSensitive) {
    if (!query) {
      return true;
    }

    const text = AppUtils.normalize(query, caseSensitive);
    const fields = [];

    if (searchFields.includes('name')) {
      fields.push(appInfo.get_name());
    }
    if (searchFields.includes('description')) {
      fields.push(appInfo.get_description() || '');
    }
    if (searchFields.includes('exec')) {
      fields.push(appInfo.get_executable() || '');
    }

    return fields.some(value => {
      if (!value) {
        return false;
      }
      const fieldText = AppUtils.normalize(value, caseSensitive);
      return fieldText.includes(text);
    });
  }
}