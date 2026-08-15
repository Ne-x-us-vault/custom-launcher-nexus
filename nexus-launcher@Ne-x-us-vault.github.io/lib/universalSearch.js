import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import AppUtils from './appUtils.js';

const PROVIDER_DIR = '/usr/share/gnome-shell/search-providers';
const PROVIDER_INTERFACE = 'org.gnome.Shell.SearchProvider2';
const PROVIDER_SCHEMA = 'org.gnome.desktop.search-providers';
const FALLBACK_WEB_SEARCH_URL = 'https://duckduckgo.com/?q=%s';

// A D-Bus name must have at least two dot-separated elements, each starting
// with a letter or underscore (per the D-Bus specification).
const DBUS_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)+$/;

// Common search engines, matched by the name the browser reports.
const ENGINE_ALIASES = [
  [/google/, 'https://www.google.com/search?q=%s'],
  [/duckduckgo/, 'https://duckduckgo.com/?q=%s'],
  [/bing/, 'https://www.bing.com/search?q=%s'],
  [/brave/, 'https://search.brave.com/search?q=%s'],
  [/ecosia/, 'https://www.ecosia.org/search?q=%s'],
  [/yahoo/, 'https://search.yahoo.com/search?p=%s'],
  [/startpage/, 'https://www.startpage.com/sp/search?query=%s'],
  [/qwant/, 'https://www.qwant.com/?q=%s'],
  [/wikipedia/, 'https://en.wikipedia.org/w/index.php?search=%s'],
];

function readTextFile(path) {
  const file = Gio.File.new_for_path(path);
  if (!file.query_exists(null))
    return null;
  try {
    const [, content] = file.load_contents(null);
    return new TextDecoder().decode(content);
  } catch (e) {
    return null;
  }
}

function engineUrlForName(name) {
  const n = name.toLowerCase();
  for (const [re, url] of ENGINE_ALIASES) {
    if (re.test(n))
      return url;
  }
  return null;
}

function call(proxy, method, parameters) {
  return new Promise((resolve, reject) => {
    // Do not launch every installed Shell search provider while the user is
    // typing. Providers that are already available contribute results; the
    // built-in web result is always available and app search remains instant.
    proxy.call(method, parameters, Gio.DBusCallFlags.NO_AUTO_START, 1500, null, (source, result) => {
      try {
        resolve(source.call_finish(result));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function unpack(value) {
  return value instanceof GLib.Variant ? value.deep_unpack() : value;
}

export default class UniversalSearch {
  constructor(settings) {
    this._settings = settings;
    this._providers = this._loadProviders();
    this._proxyPromises = new Map();
    this._cachedEngineUrl = null;
  }

  _loadProviders() {
    const providers = [];
    let directory;
    try {
      directory = Gio.File.new_for_path(PROVIDER_DIR);
      const enumerator = directory.enumerate_children(
        'standard::name', Gio.FileQueryInfoFlags.NONE, null
      );
      let info;
      while ((info = enumerator.next_file(null))) {
        if (!info.get_name().endsWith('.ini'))
          continue;
        // A single malformed provider must never take the whole list down.
        try {
          const keyFile = new GLib.KeyFile();
          keyFile.load_from_file(`${PROVIDER_DIR}/${info.get_name()}`, GLib.KeyFileFlags.NONE);
          const group = 'Shell Search Provider';
          if (!keyFile.has_group(group))
            continue;

          const busName = keyFile.get_string(group, 'BusName');
          const objectPath = keyFile.get_string(group, 'ObjectPath');
          // Reject malformed D-Bus coordinates so a tampered or broken
          // provider file can never funnel queries at an arbitrary service.
          if (!busName || !objectPath)
            continue;
          if (!DBUS_NAME_RE.test(busName) || !objectPath.startsWith('/'))
            continue;

          // The DesktopId key (falling back to the file name) is what GNOME
          // itself matches against the user's enabled-search-providers list.
          const groupKeys = keyFile.get_keys(group)[0] ?? [];
          const desktopId = groupKeys.includes('DesktopId')
            ? keyFile.get_string(group, 'DesktopId')
            : info.get_name().replace(/\.ini$/, '');

          // Respect the user's provider preferences instead of querying
          // every installed provider. Mirrors GNOME Shell's own logic: an
          // explicitly enabled provider wins, otherwise only explicitly
          // disabled providers are skipped when the enabled list is empty.
          if (!this._providerEnabled(desktopId))
            continue;

          providers.push({ busName, objectPath });
        } catch (error) {
          console.log(`[NexusLauncher] skipping bad search provider ${info.get_name()}: ${error}`);
        }
      }
      enumerator.close(null);
    } catch (error) {
      console.error(`[NexusLauncher] could not load native search providers: ${error}`);
    }
    return providers;
  }

  _providerEnabled(desktopId) {
    try {
      const settings = new Gio.Settings({ schema_id: PROVIDER_SCHEMA });
      const enabledIds = settings.get_strv('enabled');
      const disabledIds = settings.get_strv('disabled');
      if (enabledIds.includes(desktopId))
        return true;
      if (enabledIds.length === 0 && !disabledIds.includes(desktopId))
        return true;
      return false;
    } catch (error) {
      // If the schema is unavailable, fall back to querying all providers
      // rather than silently disabling the feature.
      console.log(`[NexusLauncher] could not read provider preferences: ${error}`);
      return true;
    }
  }

  async search(query) {
    const terms = query.trim().split(/\s+/).filter(Boolean);
    if (!terms.length)
      return [];

    const results = [this._createWebResult(query)];
    const providerResults = await Promise.all(this._providers.map(provider =>
      this._searchProvider(provider, terms).catch(() => [])
    ));
    return [...providerResults.flat(), ...results];
  }

  async _searchProvider(provider, terms) {
    const proxy = await this._getProxy(provider);
    const resultSet = await call(proxy, 'GetInitialResultSet', new GLib.Variant('(as)', [terms]));
    const [ids] = resultSet.deep_unpack();
    if (!ids.length)
      return [];

    const metaReply = await call(proxy, 'GetResultMetas', new GLib.Variant('(as)', [ids.slice(0, 6)]));
    const [metas] = metaReply.deep_unpack();
    return metas.map((meta, index) => {
      const id = unpack(meta.id) || ids[index];
      const name = unpack(meta.name) || id;
      const description = unpack(meta.description) || '';
      return {
      type: 'provider',
      id: `${provider.busName}:${id}`,
      name,
      description,
      iconName: 'system-search-symbolic',
      activate: () => call(proxy, 'ActivateResult', new GLib.Variant(
        '(sasu)', [id, terms, global.get_current_time()]
      )),
      };
    });
  }

  _getProxy(provider) {
    const key = `${provider.busName}:${provider.objectPath}`;
    if (this._proxyPromises.has(key))
      return this._proxyPromises.get(key);

    const promise = new Promise((resolve, reject) => {
      Gio.DBusProxy.new_for_bus(
        Gio.BusType.SESSION,
        Gio.DBusProxyFlags.DO_NOT_AUTO_START_AT_CONSTRUCTION,
        null,
        provider.busName,
        provider.objectPath,
        PROVIDER_INTERFACE,
        null,
        (source, result) => {
          try {
            resolve(Gio.DBusProxy.new_for_bus_finish(result));
          } catch (error) {
            this._proxyPromises.delete(key);
            reject(error);
          }
        }
      );
    });
    this._proxyPromises.set(key, promise);
    return promise;
  }

  _createWebResult(query) {
    const q = encodeURIComponent(query);
    const url = this._detectedEngineUrl().replace(/%s/g, q);
    return {
      type: 'provider',
      id: `web:${query}`,
      name: `Search the web for “${query}”`,
      description: 'Open results in your default browser',
      iconName: 'system-search-symbolic',
      activate: () => {
        Gio.AppInfo.launch_default_for_uri(url, null);
        // Raise the browser window so the result is visible even if the
        // browser was running in the background.
        try {
          const browser = Gio.AppInfo.get_default_for_uri_scheme('https');
          AppUtils.focusAppAfterLaunch(browser?.get_id());
        } catch (e) {
          log(`[NexusLauncher] could not focus browser: ${e}`);
        }
      },
    };
  }

  _detectedEngineUrl() {
    if (!this._cachedEngineUrl)
      this._cachedEngineUrl = this._detectEngineFromDefaultBrowser();
    return this._cachedEngineUrl;
  }

  // Resolve the search engine of the desktop's default web browser, so the
  // web result honours what the user already chose on this machine.
  _detectEngineFromDefaultBrowser() {
    try {
      const app = Gio.AppInfo.get_default_for_uri_scheme('https');
      const browserId = (app?.get_id?.() || '').toLowerCase();

      if (browserId.includes('firefox'))
        return this._firefoxEngineUrl() || FALLBACK_WEB_SEARCH_URL;
      if (/(chrom|edge|brave|vivaldi|opera)/.test(browserId))
        // Chromium-based browsers fall back to Google when unmodified.
        return this._chromiumEngineUrl() || 'https://www.google.com/search?q=%s';
      if (browserId.includes('epiphany') || browserId.includes('web.desktop'))
        return this._epiphanyEngineUrl() || FALLBACK_WEB_SEARCH_URL;

      return this._firefoxEngineUrl()
        || this._chromiumEngineUrl()
        || this._epiphanyEngineUrl()
        || FALLBACK_WEB_SEARCH_URL;
    } catch (e) {
      return FALLBACK_WEB_SEARCH_URL;
    }
  }

  _firefoxEngineUrl() {
    const profilesDir = `${GLib.get_home_dir()}/.mozilla/firefox`;
    const dir = Gio.File.new_for_path(profilesDir);
    if (!dir.query_exists(null))
      return null;
    try {
      const names = dir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
      let info;
      while ((info = names.next_file(null))) {
        const name = info.get_name();
        if (!name.includes('-default') && !name.includes('.default'))
          continue;
        const text = readTextFile(`${profilesDir}/${name}/prefs.js`);
        if (!text)
          continue;
        const match = text.match(/user_pref\(\s*"browser\.search\.defaultenginename"\s*,\s*"([^"]+)"\s*\)/);
        if (match && match[1]) {
          const url = engineUrlForName(match[1]);
          if (url)
            return url;
        }
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  _chromiumEngineUrl() {
    const dirs = [
      'google-chrome', 'google-chrome-headless', 'chromium',
      'microsoft-edge', 'BraveSoftware/Brave-Browser',
      'org.chromium.Chromium', 'vivaldi', 'opera',
    ];
    for (const dir of dirs) {
      const text = readTextFile(`${GLib.get_home_dir()}/.config/${dir}/Local State`);
      if (!text)
        continue;
      try {
        const state = JSON.parse(text);
        const url = state?.default_search_provider_data?.template_url_data?.url;
        if (typeof url === 'string' && url.includes('{searchTerms}'))
          return url.replace('{searchTerms}', '%s');
        // Local State exists but the provider was never customised, so the
        // browser is using its built-in default.
        return 'https://www.google.com/search?q=%s';
      } catch (e) {
        continue;
      }
    }
    return null;
  }

  _epiphanyEngineUrl() {
    try {
      const settings = new Gio.Settings({ schema_id: 'org.gnome.Epiphany.Web' });
      const engine = settings.get_string('default-search-engine');
      if (engine)
        return engineUrlForName(engine);
    } catch (e) {
      // GNOME Web is not installed.
    }
    return null;
  }
}
