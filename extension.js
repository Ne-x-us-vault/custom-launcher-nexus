import GObject from 'gi://GObject';
import St from 'gi://St';
import Shell from 'gi://Shell';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const LauncherDialog = GObject.registerClass(
class LauncherDialog extends ModalDialog.ModalDialog {
    _init(extension) {
        super._init({
            styleClass: 'launcher-modal',
            destroyOnClose: false,
        });

        this._extension = extension;
        this._apps = [];

        this._buildUI();
        this._loadApps();
        this._setupEvents();
    }

    _buildUI() {
        this._card = new St.BoxLayout({
            style_class: 'launcher-card',
            vertical: false,
        });

        // ---------------- LEFT COLUMN ----------------
        let leftCol = new St.BoxLayout({
            style_class: 'launcher-left-col',
            vertical: true,
            x_expand: true,
        });

        this._searchEntry = new St.Entry({
            style_class: 'launcher-search-entry',
            hint_text: '➔   Search',
            can_focus: true,
        });
        
        this._searchEntry.clutter_text.connect('text-changed', () => this._onSearchChanged());

        let spacer = new St.Widget({ y_expand: true });

        // Bottom Dock Bar
        let dockBox = new St.BoxLayout({ style_class: 'launcher-dock', vertical: false });
        const dockIcons = ['software-properties', 'folder', 'window-new', 'utilities-terminal'];
        
        dockIcons.forEach(iconName => {
            let btn = new St.Button({ style_class: 'dock-btn', can_focus: true });
            btn.set_child(new St.Icon({ icon_name: iconName, icon_size: 20 }));
            dockBox.add_child(btn);
        });

        leftCol.add_child(this._searchEntry);
        leftCol.add_child(spacer);
        leftCol.add_child(dockBox);

        // ---------------- RIGHT COLUMN ----------------
        let rightCol = new St.BoxLayout({
            style_class: 'launcher-right-panel',
            vertical: true,
            x_expand: true,
        });

        this._scrollView = new St.ScrollView({
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            y_expand: true,
        });

        this._appListContainer = new St.BoxLayout({ vertical: true });
        this._scrollView.set_child(this._appListContainer);
        rightCol.add_child(this._scrollView);

        this._card.add_child(leftCol);
        this._card.add_child(rightCol);

        this.contentLayout.add_child(this._card);
    }

    _setupEvents() {
        // ESC key on search input
        this._searchEntry.clutter_text.connect('key-press-event', (actor, event) => {
            if (event.get_key_symbol() === Clutter.KEY_Escape) {
                this.close();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        // ESC key on modal window
        this.connect('key-press-event', (actor, event) => {
            if (event.get_key_symbol() === Clutter.KEY_Escape) {
                this.close();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        // Click outside popup card to close
        this.connect('button-press-event', (actor, event) => {
            if (this.state !== ModalDialog.State.OPENED)
                return Clutter.EVENT_PROPAGATE;

            let [x, y] = event.get_coords();
            let [cardX, cardY] = this._card.get_transformed_position();
            let [cardW, cardH] = this._card.get_transformed_size();

            // If click coordinates are outside the main launcher card area
            if (x < cardX || x > cardX + cardW || y < cardY || y > cardY + cardH) {
                this.close();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    _loadApps() {
        let appSys = Shell.AppSystem.get_default();
        this._apps = appSys.get_installed().sort((a, b) =>
            a.get_name().localeCompare(b.get_name())
        );
        this._renderApps(this._apps);
    }

    _renderApps(apps) {
        this._appListContainer.destroy_all_children();

        apps.forEach(app => {
            let row = new St.Button({
                style_class: 'app-row',
                x_expand: true,
                x_align: Clutter.ActorAlign.FILL,
                can_focus: true,
            });

            let box = new St.BoxLayout({ vertical: false, y_align: Clutter.ActorAlign.CENTER });
            let icon = new St.Icon({
                gicon: app.get_icon(),
                fallback_icon_name: 'application-x-executable',
                icon_size: 28,
            });

            let label = new St.Label({
                text: app.get_name(),
                style_class: 'app-label',
                y_align: Clutter.ActorAlign.CENTER,
            });

            box.add_child(icon);
            box.add_child(label);
            row.set_child(box);

            row.connect('clicked', () => {
                app.activate();
                this.close();
            });

            this._appListContainer.add_child(row);
        });
    }

    _onSearchChanged() {
        let text = this._searchEntry.get_text().toLowerCase().trim();
        if (text === '') {
            this._renderApps(this._apps);
        } else {
            let filtered = this._apps.filter(app => {
                let nameMatch = app.get_name()?.toLowerCase().includes(text);
                let execMatch = app.get_app_info()?.get_executable()?.toLowerCase().includes(text);
                return nameMatch || execMatch;
            });
            this._renderApps(filtered);
        }
    }

    toggle() {
        if (this.state === ModalDialog.State.OPENED) {
            this.close();
        } else {
            this.open(global.get_current_time());
            this._searchEntry.set_text('');
            this._searchEntry.grab_key_focus();
        }
    }
});

export default class CustomLauncherExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._dialog = new LauncherDialog(this);

        Main.wm.addKeybinding(
            'shortcut-toggle',
            this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.ALL,
            () => this._dialog.toggle()
        );
    }

    disable() {
        Main.wm.removeKeybinding('shortcut-toggle');

        if (this._dialog) {
            this._dialog.destroy();
            this._dialog = null;
        }

        this._settings = null;
    }
}