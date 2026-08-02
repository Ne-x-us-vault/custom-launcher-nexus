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
    return AppUtils.getMatchScore(appInfo, query, searchFields, caseSensitive) !== null;
  }

  static getMatchScore(appInfo, query, searchFields, caseSensitive) {
    if (!query) {
      return 0;
    }

    const text = AppUtils.normalize(query, caseSensitive);
    const fields = [];

    if (searchFields.includes('name')) {
      fields.push([appInfo.get_name(), 0]);
    }
    if (searchFields.includes('description')) {
      fields.push([appInfo.get_description() || '', 20]);
    }
    if (searchFields.includes('exec')) {
      fields.push([appInfo.get_executable() || '', 30]);
    }
    // Desktop-entry keywords are what make short native-launcher searches
    // feel natural (for example, "code" or "browser").
    fields.push(...(appInfo.get_keywords?.() || []).map(keyword => [keyword, 15]));

    let bestScore = null;
    for (const [value, fieldWeight] of fields) {
      if (!value) {
        continue;
      }
      const fieldText = AppUtils.normalize(value, caseSensitive);
      const position = fieldText.indexOf(text);
      if (position >= 0) {
        const score = fieldWeight + position + (fieldText.length - text.length) / 100;
        bestScore = bestScore === null ? score : Math.min(bestScore, score);
      }
    }
    return bestScore;
  }
}
