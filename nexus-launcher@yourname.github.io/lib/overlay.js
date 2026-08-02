import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import AppUtils from './appUtils.js';
import SearchBar from './searchBar.js';
import DockBar from './dockBar.js';
import AppList from './appList.js';

export default class NexusOverlay {
  constructor(settings) {
    this._settings = settings;
    this.visible = false;
    this._actor = null;
    this._backdrop = null;
    this._card = null;
    this._grab = null;
    this._settingsSignals = [];
    this._keyPressId = null;
    this._searchBar = null;
    this._appList = null;
    this._dockBar = null;
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

      try {
        this._grab = Main.pushModal(this._actor);
      } catch (e) {
        console.log(`[NexusOverlay] Main.pushModal warning: ${e}`);
      }

      this.visible = true;

      // Key events are delivered to the modal actor and bubble from the search
      // entry to this handler. Connecting to global.stage causes warnings on
      // GNOME 50 and makes Escape unreliable while the entry has focus.
      if (this._keyPressId === null) {
        this._keyPressId = this._actor.connect(
          'key-press-event',
          (_, event) => this._onKeyPress(event)
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

    if (this._keyPressId !== null && this._actor) {
      this._actor.disconnect(this._keyPressId);
      this._keyPressId = null;
    }

    if (this._grab) {
      try {
        Main.popModal(this._grab);
      } catch (e) {
        console.log(`[NexusOverlay] Main.popModal warning: ${e}`);
      }
      this._grab = null;
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

    // Central Card
    this._card = new St.BoxLayout({
      style_class: 'nexus-right-card',
      vertical: true,
      reactive: true,
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
    });

    this._searchBar = new SearchBar(this._settings, (query) => this._onSearchChanged(query));
    this._appList = new AppList(this._settings, (appInfo) => this._launchAndClose(appInfo));
    this._dockBar = new DockBar(this._settings, (appInfo) => this._launchAndClose(appInfo));

    this._card.add_child(this._searchBar.actor);
    this._card.add_child(this._appList.actor);
    this._card.add_child(this._dockBar.actor);

    this._actor.add_child(this._card);

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
    this._card.set_style(`background-color: rgba(18, 18, 18, ${opacity});`);
  }

  _onSearchChanged(query) {
    if (this._appList) {
      this._appList.filter(query);
    }
  }

  _launchAndClose(appInfo) {
    AppUtils.launchApp(appInfo);
    this.close();
  }

  _onKeyPress(event) {
    if (!this.visible) {
      return Clutter.EVENT_PROPAGATE;
    }

    const key = event.get_key_symbol();
    const state = event.get_state();
    if ((state & Clutter.ModifierType.SUPER_MASK) &&
        (key === Clutter.KEY_Return || key === Clutter.KEY_KP_Enter)) {
      this.close();
      return Clutter.EVENT_STOP;
    }

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
  }
}
