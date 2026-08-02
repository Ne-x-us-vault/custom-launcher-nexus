import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import AppUtils from './appUtils.js';
import SearchBar from './searchBar.js';
import DockBar from './dockBar.js';
import AppList from './appList.js';
import UniversalSearch from './universalSearch.js';

export default class NexusOverlay {
  constructor(settings) {
    this._settings = settings;
    this.visible = false;
    this._actor = null;
    this._backdrop = null;
    this._surface = null;
    this._identityPanel = null;
    this._card = null;
    this._grab = null;
    this._settingsSignals = [];
    this._keyPressId = null;
    this._entryKeyPressId = null;
    this._scrollEventId = null;
    this._universalSearchTimeoutId = 0;
    this._searchGeneration = 0;
    this._searchBar = null;
    this._appList = null;
    this._dockBar = null;
    this._universalSearch = new UniversalSearch();
  }

  open() {
    console.log('[NexusOverlay] open() called');
    if (this.visible) {
      console.log('[NexusOverlay] overlay already visible');
      return;
    }

    try {
      this._build();
      console.log('[NexusOverlay] overlay built');
      Main.uiGroup.add_child(this._actor);

      this.visible = true;

      // Do not use Main.pushModal(): its keyboard grab prevents our global
      // keybinding from firing a second time to close the launcher. The actor
      // still fills the stage and owns focus, giving us overlay behaviour.
      if (this._keyPressId === null) {
        this._keyPressId = this._actor.connect(
          'key-press-event',
          (_, event) => this._onKeyPress(event)
        );
      }
      if (this._entryKeyPressId === null && this._searchBar?.entry?.clutter_text) {
        this._entryKeyPressId = this._searchBar.entry.clutter_text.connect(
          'key-press-event',
          (_, event) => this._onKeyPress(event)
        );
      }
      if (this._scrollEventId === null) {
        this._scrollEventId = this._actor.connect(
          'scroll-event',
          (_, event) => this._onScroll(event)
        );
      }

      if (this._searchBar) {
        this._searchBar.focus();
      }
    } catch (e) {
      console.log(`[NexusOverlay] open error: ${e}`);
      if (e && e.stack) {
        console.log(e.stack);
      }

      // A failed build must not leave a partial actor tree behind; otherwise a
      // later hotkey press may try to reuse stale actors.
      this._disconnectSignals();
      if (this._actor) {
        this._actor.destroy();
        this._actor = null;
      }
      this._grab = null;
    }
  }

  close() {
    if (!this.visible) {
      return;
    }

    console.log('[NexusOverlay] close() called');
    this.visible = false;
    if (this._universalSearchTimeoutId) {
      GLib.source_remove(this._universalSearchTimeoutId);
      this._universalSearchTimeoutId = 0;
    }

    if (this._keyPressId !== null && this._actor) {
      this._actor.disconnect(this._keyPressId);
      this._keyPressId = null;
    }
    if (this._entryKeyPressId !== null && this._searchBar?.entry?.clutter_text) {
      this._searchBar.entry.clutter_text.disconnect(this._entryKeyPressId);
      this._entryKeyPressId = null;
    }
    if (this._scrollEventId !== null && this._actor) {
      this._actor.disconnect(this._scrollEventId);
      this._scrollEventId = null;
    }

    this._disconnectSignals();

    if (this._actor) {
      this._actor.destroy();
      this._actor = null;
    }
  }

  destroy() {
    if (this.visible) {
      this.close();
    }
    this._settings = null;
  }

  _build() {
    this._actor = new St.Widget({
      reactive: true,
      can_focus: true,
      layout_manager: new Clutter.BinLayout(),
    });
    this._actor.set_size(global.stage.width, global.stage.height);
    this._actor.set_position(0, 0);

    // Keep the dimmed area as its own actor. This avoids relying on the event
    // source of the BinLayout container, which differs across Shell releases.
    this._backdrop = new St.Widget({
      reactive: true,
      style_class: 'nexus-overlay',
      x_expand: true,
      y_expand: true,
      x_align: Clutter.ActorAlign.FILL,
      y_align: Clutter.ActorAlign.FILL,
    });
    this._backdrop.connect('button-press-event', () => {
      this.close();
      return Clutter.EVENT_STOP;
    });
    this._actor.add_child(this._backdrop);

    // Visual shell: the identity panel mirrors the reference layout, while
    // the existing app card keeps all search and launch behaviour unchanged.
    this._surface = new St.BoxLayout({
      style_class: 'nexus-launcher-surface',
      vertical: false,
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._surface.set_size(1008, 600);

    this._identityPanel = new St.BoxLayout({
      style_class: 'nexus-left-card',
      vertical: true,
      x_expand: true,
      y_expand: true,
    });

    this._searchBar = new SearchBar(this._settings, (query) => this._onSearchChanged(query));
    this._identityPanel.add_child(this._searchBar.actor);
    this._identityPanel.add_child(new St.Label({ text: 'N', style_class: 'nexus-mark' }));
    this._identityPanel.add_child(new St.Label({ text: 'NEXUS', style_class: 'nexus-brand' }));
    this._identityPanel.add_child(new St.Label({
      text: 'DEVELOPED BY NE-X-US-VAULT',
      style_class: 'nexus-brand-subtitle',
    }));
    this._identityPanel.add_child(new St.Widget({
      style_class: 'nexus-divider',
      x_expand: true,
    }));
    this._identityPanel.add_child(new St.Label({
      text: 'Instant search\nKeyboard-first\nPinned workspace',
      style_class: 'nexus-status-copy',
    }));
    this._identityPanel.add_child(new St.Widget({ x_expand: true, y_expand: true }));

    // Application card
    this._card = new St.BoxLayout({
      style_class: 'nexus-right-card',
      vertical: true,
      reactive: true,
      y_expand: true,
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
    });

    this._appList = new AppList(this._settings, (appInfo) => this._launchAndClose(appInfo));
    this._dockBar = new DockBar(
      this._settings,
      appInfo => this._launchAndClose(appInfo)
    );

    this._card.add_child(this._appList.actor);
    this._identityPanel.add_child(this._dockBar.actor);

    this._surface.add_child(this._identityPanel);
    this._surface.add_child(this._card);
    this._actor.add_child(this._surface);

    this._applyOpacity();
    this._connectSettings();
  }

  _connectSettings() {
    if (!this._settings) return;
    this._settingsSignals.push(
      this._settings.connect('changed::opacity', () => this._applyOpacity()),
      this._settings.connect('changed::search-fields', () => {
        if (this._searchBar && this._appList) {
          this._appList.filter(this._searchBar.getText());
        }
      }),
      this._settings.connect('changed::case-sensitive', () => {
        if (this._searchBar && this._appList) {
          this._appList.filter(this._searchBar.getText());
        }
      })
    );
  }

  _applyOpacity() {
    if (!this._settings || !this._card) return;
    const opacity = this._settings.get_double('opacity');
    this._card.set_style(`background-color: rgba(10, 15, 20, ${Math.min(opacity, 0.70)});`);
  }

  _onSearchChanged(query) {
    if (this._appList) {
      this._appList.filter(query);
      if (this._universalSearchTimeoutId) {
        GLib.source_remove(this._universalSearchTimeoutId);
        this._universalSearchTimeoutId = 0;
      }
      const generation = ++this._searchGeneration;
      if (query.trim().length >= 2) {
        this._universalSearchTimeoutId = GLib.timeout_add(
          GLib.PRIORITY_DEFAULT,
          220,
          () => {
            this._universalSearchTimeoutId = 0;
            this._universalSearch.search(query).then(results => {
              if (this.visible && generation === this._searchGeneration)
                this._appList?.setUniversalResults(query, results);
            }).catch(error => console.log(`[NexusLauncher] universal search error: ${error}`));
            return GLib.SOURCE_REMOVE;
          }
        );
      }
    }
  }

  _launchAndClose(appInfo) {
    if (appInfo)
      AppUtils.launchApp(appInfo);
    this.close();
  }

  _onKeyPress(event) {
    if (!this.visible) {
      return Clutter.EVENT_PROPAGATE;
    }

    const key = event.get_key_symbol();
    if (key === Clutter.KEY_Escape) {
      this.close();
      return Clutter.EVENT_STOP;
    }

    if (key === Clutter.KEY_Up) {
      if (this._appList) {
        this._appList.moveSelection(-1);
      }
      return Clutter.EVENT_STOP;
    }
    if (key === Clutter.KEY_Down || key === Clutter.KEY_Tab) {
      if (this._appList) {
        this._appList.moveSelection(1);
      }
      return Clutter.EVENT_STOP;
    }
    if (key === Clutter.KEY_Return || key === Clutter.KEY_KP_Enter) {
      if (this._appList) {
        this._appList.activateSelected();
      }
      return Clutter.EVENT_STOP;
    }
    return Clutter.EVENT_PROPAGATE;
  }

  _onScroll(event) {
    if (!this.visible || !this._appList) {
      return Clutter.EVENT_PROPAGATE;
    }

    const direction = event.get_scroll_direction();
    let delta = 0;
    if (direction === Clutter.ScrollDirection.UP) {
      delta = -76;
    } else if (direction === Clutter.ScrollDirection.DOWN) {
      delta = 76;
    } else if (direction === Clutter.ScrollDirection.SMOOTH) {
      const [, deltaY] = event.get_scroll_delta();
      delta = deltaY * 96;
    }

    if (delta !== 0) {
      this._appList.scrollBy(delta);
      return Clutter.EVENT_STOP;
    }
    return Clutter.EVENT_PROPAGATE;
  }

  _disconnectSignals() {
    for (const id of this._settingsSignals) {
      if (this._settings) {
        this._settings.disconnect(id);
      }
    }
    this._settingsSignals = [];

    if (this._searchBar) {
      this._searchBar.destroy();
      this._searchBar = null;
    }
    if (this._dockBar) {
      this._dockBar.destroy();
      this._dockBar = null;
    }
    if (this._appList) {
      this._appList.destroy();
      this._appList = null;
    }
    this._card = null;
    this._backdrop = null;
    this._surface = null;
    this._identityPanel = null;
  }
}
