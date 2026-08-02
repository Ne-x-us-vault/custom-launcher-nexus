import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import Meta from 'gi://Meta';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Overlay from './lib/overlay.js';

export default class NexusLauncherExtension extends Extension {
  constructor(metadata) {
    super(metadata);
    this._settings = null;
    this._overlay = null;
    this._keybinding = 'hotkey';
    this._keybindingRegistered = false;
  }

  enable() {
    console.log('[NexusLauncher] enable()');
    this._settings = this.getSettings();
    this._overlay = new Overlay(this._settings);
    this._registerKeybinding();
  }

  disable() {
    console.log('[NexusLauncher] disable()');
    this._unregisterKeybinding();
    if (this._overlay) {
      this._overlay.destroy();
      this._overlay = null;
    }
    this._settings = null;
  }

  _registerKeybinding() {
    if (!Main.wm || !Main.wm.addKeybinding || !this._settings) {
      return;
    }

    try {
      Main.wm.addKeybinding(
        this._keybinding,
        this._settings,
        Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
        // ALL intentionally excludes POPUP. Include it so the same shortcut
        // is delivered while our modal overlay owns the keyboard grab.
        Shell.ActionMode.ALL | Shell.ActionMode.POPUP,
        () => this._toggleOverlay()
      );

      this._keybindingRegistered = true;
      console.log('[NexusLauncher] addKeybinding succeeded');
    } catch (e) {
      console.log(`[NexusLauncher] addKeybinding failed: ${e}`);
    }
  }

  _unregisterKeybinding() {
    if (!Main.wm || !Main.wm.removeKeybinding || !this._keybindingRegistered) {
      return;
    }

    Main.wm.removeKeybinding(this._keybinding);
    this._keybindingRegistered = false;
  }

  _toggleOverlay() {
    console.log('[NexusLauncher] _toggleOverlay() called');
    if (!this._overlay) {
      return;
    }

    if (this._overlay.visible) {
      this._overlay.close();
    } else {
      this._overlay.open();
    }
  }
}
