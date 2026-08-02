import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import Pango from 'gi://Pango';
import AppUtils from './appUtils.js';

const CARD_SIZES = {
  small: { width: 420, height: 400 },
  medium: { width: 446, height: 480 },
  large: { width: 500, height: 520 },
};

const ROW_SCROLL_STEP = 76;

export default class AppList {
  constructor(settings, onLaunch) {
    this._settings = settings;
    this._onLaunch = onLaunch;
    this._apps = [];
    this._filteredApps = [];
    this._appResults = [];
    this._query = '';
    this._selectedIndex = -1;

    this.actor = this._build();
    this._settingsSignal = this._settings.connect('changed::card-size', () => this._updateSize());
    this._updateSize();
    this._loadApps();
  }

  _build() {
    this._root = new St.BoxLayout({ style_class: 'nexus-list-card', vertical: true, x_expand: false, y_expand: false });
    this._scrollView = new St.ScrollView({ style_class: 'nexus-app-list-scrollview', overlay_scrollbars: false, x_expand: true, y_expand: true });
    this._root.set_clip_to_allocation(true);
    this._scrollView.set_clip_to_allocation(true);
    // The list must keep its natural height. If it expands vertically, one
    // search result stretches into a full-height selection panel.
    this._list = new St.BoxLayout({ style_class: 'nexus-app-list', vertical: true, x_expand: true, y_expand: false });
    this._scrollView.set_child(this._list);
    this._root.add_child(this._scrollView);
    return this._root;
  }

  _loadApps() {
    this._apps = AppUtils.getInstalledApps();
    this.filter('');
  }

  _updateSize() {
    const sizeKey = this._settings.get_string('card-size');
    const size = CARD_SIZES[sizeKey] || CARD_SIZES.medium;
    this.actor.set_width(size.width);
    this.actor.set_height(size.height);
  }

  filter(query) {
    const searchFields = this._settings.get_strv('search-fields');
    const caseSensitive = this._settings.get_boolean('case-sensitive');
    this._query = query;
    this._appResults = this._apps
      .map(app => ({
        appInfo: app,
        id: `app:${app.get_id() || app.get_name()}`,
        score: AppUtils.getMatchScore(app, query, searchFields, caseSensitive),
      }))
      .filter(({score}) => score !== null)
      .sort((a, b) => a.score - b.score || a.appInfo.get_name().localeCompare(b.appInfo.get_name()));
    this._filteredApps = this._appResults;
    this._renderRows();
  }

  setUniversalResults(query, results) {
    if (query !== this._query)
      return;
    this._filteredApps = [...this._appResults, ...results];
    this._renderRows();
  }

  _renderRows() {
    this._list.destroy_all_children();
    this._selectedIndex = -1;
    this._getVerticalAdjustment()?.set_value(0);

    this._filteredApps.forEach((result, index) => {
      const row = new St.Button({ style_class: 'nexus-app-row', x_expand: true, y_expand: false, reactive: true, can_focus: true });
      const appInfo = result.appInfo;
      const gicon = appInfo?.get_icon() || new Gio.ThemedIcon({
        name: result.iconName || 'application-x-executable',
      });

      const content = new St.BoxLayout({ style_class: 'nexus-app-row-content', vertical: false, x_expand: true, y_expand: false });
      content.add_child(new St.Icon({ gicon, icon_size: 38, style_class: 'nexus-app-icon' }));

      // St.Label does not expose an "ellipsize" construct property on recent
      // GNOME Shell versions.  The property belongs to its ClutterText child.
      const label = new St.Label({
        text: appInfo?.get_name() || result.name,
        style_class: 'nexus-app-label',
        x_expand: true,
      });
      label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
      content.add_child(label);
      row.set_child(content);

      row.connect('clicked', () => this._onItemActivate(index));
      row.connect('enter-event', () => {
        row.add_style_pseudo_class('hover');
        // Hover styling must not consume the pointer event. Consuming it
        // produces Clutter runtime warnings and can interfere with scrolling.
        return Clutter.EVENT_PROPAGATE;
      });
      row.connect('leave-event', () => {
        row.remove_style_pseudo_class('hover');
        return Clutter.EVENT_PROPAGATE;
      });

      this._list.add_child(row);
    });

    if (this._filteredApps.length > 0) {
      this._selectIndex(0);
    }
  }

  _onItemActivate(index) {
    const result = this._filteredApps[index];
    if (!result) {
      return;
    }
    if (result.appInfo)
      this._onLaunch(result.appInfo);
    else
      Promise.resolve(result.activate()).then(() => this._onLaunch(null));
  }

  moveSelection(delta) {
    if (!this._filteredApps.length) {
      return;
    }
    const nextIndex = Math.max(0, Math.min(this._filteredApps.length - 1, this._selectedIndex + delta));
    this._selectIndex(nextIndex);
  }

  _selectIndex(index) {
    if (index < 0 || index >= this._filteredApps.length) {
      return;
    }
    const children = this._list.get_children();
    if (this._selectedIndex >= 0 && children[this._selectedIndex]) {
      children[this._selectedIndex].remove_style_pseudo_class('selected');
    }
    this._selectedIndex = index;
    if (children[this._selectedIndex]) {
      children[this._selectedIndex].add_style_pseudo_class('selected');
      this._scrollSelectedIntoView();
    }
  }

  _scrollSelectedIntoView() {
    const adjustment = this._getVerticalAdjustment();
    const selectedActor = this._list.get_children()[this._selectedIndex];
    if (!adjustment || !selectedActor) {
      return;
    }

    const current = adjustment.value ?? adjustment.get_value?.() ?? 0;
    const pageSize = adjustment.pageSize
      ?? adjustment.page_size
      ?? adjustment.get_page_size?.()
      ?? 0;
    const upper = adjustment.upper ?? adjustment.get_upper?.() ?? 0;
    if (pageSize <= 0) {
      return;
    }

    const maximum = Math.max(0, upper - pageSize);
    // Reserve a complete row below the keyboard selection. Besides giving the
    // highlight room to breathe, this prevents the following label from being
    // cut off at the viewport edge.
    const breathingRoom = ROW_SCROLL_STEP + 12;
    const box = selectedActor.get_allocation_box();
    let rowTop = box.y1;
    let rowBottom = box.y2;
    let parent = selectedActor.get_parent();

    // Convert the selected row's allocation to the scroll view's coordinate
    // system. This works regardless of CSS row padding, margins, or scale.
    while (parent && parent !== this._scrollView) {
      const parentBox = parent.get_allocation_box();
      rowTop += parentBox.y1;
      rowBottom += parentBox.y1;
      parent = parent.get_parent();
    }
    if (parent !== this._scrollView) {
      return;
    }

    if (rowTop < current + breathingRoom) {
      adjustment.set_value(Math.max(0, rowTop - breathingRoom));
    } else if (rowBottom > current + pageSize - breathingRoom) {
      adjustment.set_value(Math.min(maximum, rowBottom + breathingRoom - pageSize));
    }
  }

  _getVerticalAdjustment() {
    // GNOME Shell 50 exposes the vertical adjustment directly. Retain the
    // older access paths for the Shell versions this extension supports.
    return this._scrollView.get_vadjustment?.()
      ?? this._scrollView.vadjustment
      ?? this._scrollView.vscroll?.adjustment;
  }

  scrollBy(delta) {
    const adjustment = this._getVerticalAdjustment();
    if (!adjustment || !Number.isFinite(delta) || delta === 0) {
      return;
    }

    const current = adjustment.value ?? adjustment.get_value?.() ?? 0;
    const upper = adjustment.upper ?? adjustment.get_upper?.() ?? 0;
    const pageSize = adjustment.pageSize
      ?? adjustment.page_size
      ?? adjustment.get_page_size?.()
      ?? 0;
    const maximum = Math.max(0, upper - pageSize);
    adjustment.set_value(Math.max(0, Math.min(maximum, current + delta)));
  }

  activateSelected() {
    if (this._selectedIndex >= 0) {
      this._onItemActivate(this._selectedIndex);
    }
  }

  destroy() {
    if (this._settingsSignal) {
      this._settings.disconnect(this._settingsSignal);
      this._settingsSignal = null;
    }
    this._root.destroy();
  }
}
