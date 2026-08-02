import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const PROVIDER_DIR = '/usr/share/gnome-shell/search-providers';
const PROVIDER_INTERFACE = 'org.gnome.Shell.SearchProvider2';

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
  constructor() {
    this._providers = this._loadProviders();
    this._proxyPromises = new Map();
  }

  _loadProviders() {
    const providers = [];
    try {
      const directory = Gio.File.new_for_path(PROVIDER_DIR);
      const enumerator = directory.enumerate_children(
        'standard::name', Gio.FileQueryInfoFlags.NONE, null
      );
      let info;
      while ((info = enumerator.next_file(null))) {
        if (!info.get_name().endsWith('.ini'))
          continue;
        const keyFile = new GLib.KeyFile();
        keyFile.load_from_file(`${PROVIDER_DIR}/${info.get_name()}`, GLib.KeyFileFlags.NONE);
        const group = 'Shell Search Provider';
        if (!keyFile.has_group(group))
          continue;
        providers.push({
          busName: keyFile.get_string(group, 'BusName'),
          objectPath: keyFile.get_string(group, 'ObjectPath'),
        });
      }
      enumerator.close(null);
    } catch (error) {
      console.error(`[NexusLauncher] could not load native search providers: ${error}`);
    }
    return providers;
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
    return {
      type: 'provider',
      id: `web:${query}`,
      name: `Search the web for “${query}”`,
      description: 'Open results in your default browser',
      iconName: 'system-search-symbolic',
      activate: () => Gio.AppInfo.launch_default_for_uri(
        `https://www.google.com/search?q=${encodeURIComponent(query)}`, null
      ),
    };
  }
}
