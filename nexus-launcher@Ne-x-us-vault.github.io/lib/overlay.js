import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Cogl from 'gi://Cogl';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import AppUtils from './appUtils.js';
import SearchBar from './searchBar.js';
import DockBar from './dockBar.js';
import AppList from './appList.js';
import UniversalSearch from './universalSearch.js';

const _blurPropertyNames = Shell.BlurEffect
  ? Shell.BlurEffect.list_properties().map(property => property.name)
  : [];
const _blurUsesRadius = _blurPropertyNames.includes('radius');
const _blurUsesSigma = _blurPropertyNames.includes('sigma');
const _blurSupportsMode = !!(Shell && Shell.BlurMode);

// The hook enum moved from Shell (removed in GNOME 48) to Cogl. Prefer the
// Shell variant when present since it matches the enum type add_glsl_snippet
// expects; fall back to Cogl on GNOME 48+. GLSLEffect itself needs GNOME 46+,
// so when neither enum exists we fall back to the plain blurred-tint surface.
const _glslHook = (Shell && Shell.SnippetHook)
  ? Shell.SnippetHook
  : (Cogl && Cogl.SnippetHook) || null;

// Realistic thick-glass look: the surface magnifies the desktop behind it,
// bends it like a convex lens, adds a hint of chromatic dispersion and only
// then frosts it with the blur effect. The final mask cuts the pane to the
// rounded surface corners.
const _glassDeclarations = `
uniform sampler2D tex;
uniform vec2 uSize;
uniform float uRadius;
uniform float uMag;
uniform float uRefraction;
uniform vec4 uTint;

void nexus_glass_main () {
  vec2 uv = cogl_tex_coord_in[0].st;

  vec2 cc = uv - 0.5;
  float r2 = dot (cc, cc);
  float bend = uRefraction * r2;

  vec2 lensed = 0.5 + (uv - 0.5) * (1.0 / uMag);
  lensed = mix (lensed, uv, bend);

  float dispersion = uRefraction * r2 * 0.06;
  vec2 offset = cc * dispersion;
  vec4 col = vec4 (
    texture2D (tex, lensed + offset).r,
    texture2D (tex, lensed).g,
    texture2D (tex, lensed - offset).b,
    1.0);

  col.rgb = mix (col.rgb, uTint.rgb, uTint.a);

  vec2 halfSize = uSize * 0.5;
  vec2 q = abs (uv * uSize - halfSize) - (halfSize - uRadius);
  float dist = length (max (q, vec2 (0.0))) + min (max (q.x, q.y), 0.0) - uRadius;
  float alpha = 1.0 - smoothstep (-1.0, 1.0, dist);

  float sheen = (1.0 - smoothstep (0.0, 0.35, uv.y)) * 0.06;
  float rim = exp (-abs (dist) * 0.04) * 0.10;
  col.rgb += vec3 (sheen + rim);

  col.a = alpha;
  col.rgb *= col.a;

  cogl_color_out = col;
}
`;

const _glassCode = 'nexus_glass_main();';

// Shell.GLSLEffect renders the actor into an offscreen texture whose sampling
// we control, which is exactly what lets us magnify and refract the backdrop.
const _NexusGlassEffect = Shell.GLSLEffect
  ? GObject.registerClass({
      GTypeName: 'NexusGlassEffect',
    }, class NexusGlassEffect extends Shell.GLSLEffect {
      vfunc_build_pipeline() {
        if (_glslHook) {
          this.add_glsl_snippet(_glslHook.FRAGMENT, _glassDeclarations, _glassCode, false);
        }
      }

      vfunc_paint_target(...args) {
        if (this._nexusUniforms) {
          for (const name of this._nexusUniforms.keys()) {
            const location = this.get_uniform_location(name);
            if (location >= 0) {
              const [components, value] = this._nexusUniforms.get(name);
              this.set_uniform_float(location, components, value);
            }
          }
        }
        return super.vfunc_paint_target(...args);
      }

      setUniform(name, components, value) {
        this._nexusUniforms = this._nexusUniforms || new Map();
        this._nexusUniforms.set(name, [components, value]);
      }
    })
  : null;

export default class NexusOverlay {
  static SURFACE_BASE_WIDTH = 1020;
  static SURFACE_BASE_HEIGHT = 620;

  constructor(settings) {
    this._settings = settings;
    this.visible = false;
    this._actor = null;
    this._backdrop = null;
    this._surface = null;
    this._identityPanel = null;
    this._card = null;
    this._settingsSignals = [];
    this._keyPressId = null;
    this._entryKeyPressId = null;
    this._scrollEventId = null;
    this._universalSearchTimeoutId = 0;
    this._searchGeneration = 0;
    this._keyboardSection = 'apps';
    this._searchBar = null;
    this._appList = null;
    this._dockBar = null;
    this._legacyBlurEffect = null;
    this._desktopClone = null;
    this._backdropView = null;
    this._glassEffect = null;
    this._frostEffect = null;
    this._glassActive = false;
    this._monitorChangedId = null;
    this._universalSearch = new UniversalSearch(this._settings);
  }

  open() {
    if (this.visible) {
      return;
    }

    try {
      this._build();
      // Added directly to the stage, above Main.uiGroup: the glass effect
      // lives on a live clone of uiGroup, so the overlay must not be a
      // child of its own clone source (that would recurse).
      global.stage.add_child(this._actor);

      this.visible = true;

      // Close the overlay when the monitor layout changes (hot-plug,
      // resolution change) so it recenters correctly on next open.
      if (this._monitorChangedId === null) {
        this._monitorChangedId = global.display.connect('workareas-changed', () => {
          this.close();
        });
      }

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
      console.error(`[NexusOverlay] could not open: ${e}`);
      if (e && e.stack) {
        console.error(e.stack);
      }

      // A failed build must not leave a partial actor tree behind; otherwise a
      // later hotkey press may try to reuse stale actors.
      this._disconnectSignals();
      if (this._actor) {
        this._actor.destroy();
        this._actor = null;
      }
    }
  }

  close() {
    if (!this.visible) {
      return;
    }

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
    if (this._monitorChangedId !== null) {
      global.display.disconnect(this._monitorChangedId);
      this._monitorChangedId = null;
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
    // A previous session may have ended while a dock action was selected.
    // Each newly opened launcher should start with application navigation.
    this._keyboardSection = 'apps';
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
      x_align: Clutter.ActorAlign.START,
      y_align: Clutter.ActorAlign.START,
    });
    const scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
    const surfaceWidth = Math.round(NexusOverlay.SURFACE_BASE_WIDTH * scaleFactor);
    const surfaceHeight = Math.round(NexusOverlay.SURFACE_BASE_HEIGHT * scaleFactor);
    this._surface.set_size(surfaceWidth, surfaceHeight);
    // Center on the monitor under the pointer, not on the whole stage,
    // which on multi-monitor Wayland sessions spans every display.
    const surfacePos = this._centeredOnMonitor(surfaceWidth, surfaceHeight);
    this._surface.set_position(surfacePos.x, surfacePos.y);

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

    // Spacer to push the dock bar to the bottom of the left panel.
    this._identityPanel.add_child(new St.Widget({
      style_class: 'nexus-dock-spacer',
      y_expand: true,
    }));
    this._identityPanel.add_child(this._dockBar.actor);

    this._surface.add_child(this._identityPanel);
    this._surface.add_child(this._card);
    this._actor.add_child(this._surface);

    this._applyGlass();
    this._applyOpacity();
    this._connectSettings();
  }

  _connectSettings() {
    if (!this._settings) return;
    this._settingsSignals.push(
      this._settings.connect('changed::opacity', () => this._applyOpacity()),
      this._settings.connect('changed::surface-color', () => this._applyAppearance()),
      this._settings.connect('changed::surface-opacity', () => this._applyAppearance()),
      this._settings.connect('changed::card-color', () => this._applyAppearance()),
      this._settings.connect('changed::card-opacity', () => this._applyAppearance()),
      this._settings.connect('changed::blur-enabled', () => this._applyGlass()),
      this._settings.connect('changed::blur-radius', () => this._applyGlass()),
      this._settings.connect('changed::magnification', () => {
        if (this._glassEffect) {
          this._glassEffect.setUniform('uMag', 1, [this._settings.get_double('magnification')]);
        }
      }),
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

  _applyAppearance() {
    if (!this._settings) return;

    if (this._glassActive) {
      // With the lens pipeline active the surface itself must be clear: the
      // tint now lives inside the glass shader so it sits over the backdrop.
      if (this._surface) {
        this._surface.set_style('background-color: transparent;');
      }
      if (this._glassEffect) {
        this._glassEffect.setUniform('uTint', 4, this._tintRgba());
      }
    } else if (this._surface) {
      this._surface.set_style(`background-color: ${this._colorWithOpacity('surface-color', 'surface-opacity')};`);
    }

    if (this._card) {
      this._card.set_style(`background-color: ${this._colorWithOpacity('card-color', 'card-opacity')};`);
    }
  }

  _tintRgba() {
    const [r, g, b] = this._parseRgb(this._settings.get_string('surface-color'));
    return [r / 255, g / 255, b / 255, this._settings.get_double('surface-opacity')];
  }

  _applyGlass() {
    if (!this._settings || !this._surface) return;

    const blurEnabled = this._settings.get_boolean('blur-enabled');

    if (!blurEnabled || !_NexusGlassEffect || !_glslHook) {
      this._teardownGlass();
      this._applyLegacyBlur(blurEnabled);
      this._applyAppearance();
      return;
    }

    if (!this._glassActive) {
      if (!this._buildGlass()) {
        this._applyLegacyBlur(true);
        this._applyAppearance();
        return;
      }
    } else {
      this._applyBlurRadius(this._frostEffect);
    }

    this._applyAppearance();
  }

  _buildGlass() {
    try {
      const stage = global.stage;
      const surfaceWidth = this._surface.width;
      const surfaceHeight = this._surface.height;
      if (!surfaceWidth || !surfaceHeight) {
        return false;
      }

      // Bound the effect to the monitor the launcher opens on.
      const monitorIndex = global.display.get_current_monitor();
      const monitorGeometry = global.display.get_monitor_geometry(monitorIndex);
      const monitorW = monitorGeometry.width;
      const monitorH = monitorGeometry.height;
      const surfacePos = this._centeredOnMonitor(surfaceWidth, surfaceHeight);
      const surfaceX = surfacePos.x;
      const surfaceY = surfacePos.y;
      this._surface.set_position(surfaceX, surfaceY);

      // Live 1:1 copy of the desktop, positioned so it lines up with the real
      // stage content behind the launcher.
      this._desktopClone = new Clutter.Clone({
        source: Main.uiGroup,
        x: -surfaceX,
        y: -surfaceY,
        width: monitorW,
        height: monitorH,
      });

      // Crops the clone to exactly the area the surface covers.
      this._backdropView = new Clutter.Actor({
        reactive: false,
        clip_to_allocation: true,
        x_align: Clutter.ActorAlign.START,
        y_align: Clutter.ActorAlign.START,
      });
      this._backdropView.set_size(surfaceWidth, surfaceHeight);
      this._backdropView.set_position(surfaceX, surfaceY);
      this._backdropView.add_child(this._desktopClone);

      const scaleFactor = St.ThemeContext.get_for_stage(stage).scale_factor;

      this._glassEffect = new _NexusGlassEffect();
      this._glassEffect.setUniform('tex', 1, [0]);
      this._glassEffect.setUniform('uSize', 2, [surfaceWidth * scaleFactor, surfaceHeight * scaleFactor]);
      this._glassEffect.setUniform('uRadius', 1, [30 * scaleFactor]);
      this._glassEffect.setUniform('uMag', 1, [this._settings.get_double('magnification')]);
      this._glassEffect.setUniform('uRefraction', 1, [0.35]);
      this._backdropView.add_effect(this._glassEffect);

      // Frost the refracted light, matching the configured blur strength.
      this._frostEffect = new Shell.BlurEffect({
        mode: _blurSupportsMode ? Shell.BlurMode.ACTOR : undefined,
        brightness: 1.0,
      });
      this._applyBlurRadius(this._frostEffect);
      this._backdropView.add_effect(this._frostEffect);

      // The pane sits behind the surface so its content shows through the
      // clear surface. Same size + centering => exact same rect.
      this._actor.insert_child_at_index(this._backdropView, 1);
      this._glassActive = true;
      return true;
    } catch (e) {
      console.error(`[NexusLauncher] could not build the glass effect, using fallback: ${e}`);
      this._teardownGlass();
      return false;
    }
  }

  _teardownGlass() {
    if (this._backdropView) {
      this._backdropView.destroy();
      this._backdropView = null;
    }
    this._desktopClone = null;
    this._glassEffect = null;
    this._frostEffect = null;
    this._glassActive = false;
  }

  _applyLegacyBlur(enabled) {
    if (!enabled) {
      if (this._legacyBlurEffect) {
        this._surface?.remove_effect(this._legacyBlurEffect);
        this._legacyBlurEffect = null;
      }
      return;
    }

    if (!this._legacyBlurEffect) {
      try {
        this._legacyBlurEffect = new Shell.BlurEffect({
          mode: _blurSupportsMode ? Shell.BlurMode.BACKGROUND : undefined,
          brightness: 1.0,
        });
        this._surface.add_effect(this._legacyBlurEffect);
      } catch (e) {
        console.error(`[NexusLauncher] could not create the blur effect: ${e}`);
        this._legacyBlurEffect = null;
        return;
      }
    }

    this._applyBlurRadius(this._legacyBlurEffect);
  }

  _applyBlurRadius(effect) {
    const scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
    const radius = Math.max(1, Math.round(this._settings.get_double('blur-radius') * scaleFactor));
    try {
      if (_blurUsesRadius) {
        effect.radius = radius;
      } else if (_blurUsesSigma) {
        effect.sigma = radius;
      }
    } catch (e) {
      console.error(`[NexusLauncher] could not set the blur radius: ${e}`);
    }
  }

  _centeredOnMonitor(width, height) {
    const monitorIndex = global.display.get_current_monitor();
    const monitorGeometry = global.display.get_monitor_geometry(monitorIndex);
    return {
      x: Math.round(monitorGeometry.x + (monitorGeometry.width - width) / 2),
      y: Math.round(monitorGeometry.y + (monitorGeometry.height - height) / 2),
    };
  }

  _applyOpacity() {
    if (!this._settings || !this._actor) return;
    const opacity = this._settings.get_double('opacity');
    // Applied to the whole overlay so the dim backdrop, glass pane and content
    // fade together.
    this._actor.opacity = Math.round(Math.max(0.2, Math.min(1, opacity)) * 255);
  }

  _colorWithOpacity(colorKey, opacityKey) {
    const colorString = this._settings.get_string(colorKey);
    const alpha = this._settings.get_double(opacityKey);
    const [r, g, b] = this._parseRgb(colorString);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  _parseRgb(colorString) {
    const match = colorString.trim().match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (match)
      return [match[1], match[2], match[3]];

    let hex = colorString.trim().replace(/^#/, '');
    if (hex.length === 3)
      hex = hex.split('').map(c => c + c).join('');
    if (hex.length === 6)
      return [
        parseInt(hex.substring(0, 2), 16),
        parseInt(hex.substring(2, 4), 16),
        parseInt(hex.substring(4, 6), 16),
      ];

    return [0, 0, 0];
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
      this._keyboardSection = 'apps';
      if (this._appList) {
        this._appList.moveSelection(-1);
      }
      return Clutter.EVENT_STOP;
    }
    if (key === Clutter.KEY_Down || key === Clutter.KEY_Tab) {
      this._keyboardSection = 'apps';
      if (this._appList) {
        this._appList.moveSelection(1);
      }
      return Clutter.EVENT_STOP;
    }
    if (key === Clutter.KEY_Left || key === Clutter.KEY_Right) {
      // While the caret can still move, keep the arrows for text editing and
      // only fall back to dock navigation once the query is empty (or the
      // search entry is not focused).
      const typing = this._searchBar?.entry?.clutter_text?.has_key_focus()
        && this._searchBar.getText().length > 0;
      if (!typing) {
        this._keyboardSection = 'dock';
        this._dockBar?.moveSelection(key === Clutter.KEY_Left ? -1 : 1);
        return Clutter.EVENT_STOP;
      }
      return Clutter.EVENT_PROPAGATE;
    }
    if (key === Clutter.KEY_Return || key === Clutter.KEY_KP_Enter) {
      if (this._keyboardSection === 'dock') {
        this._dockBar?.activateSelected();
      } else if (this._appList) {
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
    this._legacyBlurEffect = null;
    this._teardownGlass();
  }
}
