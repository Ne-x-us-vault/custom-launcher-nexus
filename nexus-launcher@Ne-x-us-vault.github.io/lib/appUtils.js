import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

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
      // Bring an already-running instance to the foreground so the result
      // is visible instead of being lost behind other windows.
      AppUtils.focusAppAfterLaunch(appInfo.get_id());
    } catch (e) {
      log(`NexusLauncher: failed to launch ${appInfo.get_id()}: ${e}`);
    }
  }

  // Raises and focuses the first window of the given desktop app. Useful
  // after launching a URI or app whose window may already exist in the
  // background (e.g. opening a web search in a browser that is behind
  // other windows).
  static focusAppAfterLaunch(targetId) {
    if (!targetId) {
      return;
    }
    const needle = targetId.toLowerCase();
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
      try {
        const windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null);
        for (const win of windows) {
          const app = Shell.WindowTracker.get_default().get_window_app(win);
          if (!app) {
            continue;
          }
          const appId = (app.get_id() || '').toLowerCase();
          if (appId === needle || appId.endsWith(needle) || needle.endsWith(appId)) {
            Main.activateWindow(win, global.get_current_time());
            break;
          }
        }
      } catch (error) {
        log(`NexusLauncher: could not focus ${targetId}: ${error}`);
      }
      return GLib.SOURCE_REMOVE;
    });
  }

  static normalize(query, caseSensitive) {
    if (!query) {
      return '';
    }
    return caseSensitive ? query : query.toLowerCase();
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
