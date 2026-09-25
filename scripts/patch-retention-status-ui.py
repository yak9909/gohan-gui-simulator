from pathlib import Path
import re

def read(path):
    return Path(path).read_text(encoding="utf-8")

def write(path, text):
    Path(path).write_text(text, encoding="utf-8")

def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"{label}: source block not found")
    return text.replace(old, new, 1)

# ---------------- issue-fixes.js ----------------
path = "issue-fixes.js"
text = read(path)

text = replace_once(text, '''  const STORAGE_KEYS = Object.freeze({
    favorites: "gohan-menu-favorites-v1",
    settings: "gohan-menu-persistence-settings-v1",
    enabledItems: "gohan-menu-retained-state-v1",
    enabledFavorites: "gohan-menu-retained-favorite-state-v1"
  });
  const DEFAULT_PERSISTENCE_SETTINGS = Object.freeze({
    keepFavorites: true,
    keepEnabledItems: false,
    keepEnabledFavorites: false
  });''', '''  const STORAGE_KEYS = Object.freeze({
    favorites: "gohan-menu-favorites-v1",
    settings: "gohan-menu-persistence-settings-v1",
    enabledItems: "gohan-menu-retained-state-v1",
    enabledFavorites: "gohan-menu-retained-favorite-state-v1",
    retainedItems: "gohan-menu-retained-selected-items-v1",
    valueLocks: "gohan-menu-retained-value-locks-v1"
  });
  const DEFAULT_PERSISTENCE_SETTINGS = Object.freeze({
    keepFavorites: true,
    keepEnabledItems: false,
    keepEnabledFavorites: false,
    keepValueLocks: false
  });''', "storage/default settings")

text = replace_once(text, '''    menu.persistenceSettings = {
      keepFavorites: stored?.keepFavorites !== undefined ? Boolean(stored.keepFavorites) : DEFAULT_PERSISTENCE_SETTINGS.keepFavorites,
      keepEnabledItems: stored?.keepEnabledItems !== undefined ? Boolean(stored.keepEnabledItems) : DEFAULT_PERSISTENCE_SETTINGS.keepEnabledItems,
      keepEnabledFavorites: stored?.keepEnabledFavorites !== undefined ? Boolean(stored.keepEnabledFavorites) : DEFAULT_PERSISTENCE_SETTINGS.keepEnabledFavorites
    };''', '''    menu.persistenceSettings = {
      keepFavorites: stored?.keepFavorites !== undefined ? Boolean(stored.keepFavorites) : DEFAULT_PERSISTENCE_SETTINGS.keepFavorites,
      keepEnabledItems: stored?.keepEnabledItems !== undefined ? Boolean(stored.keepEnabledItems) : DEFAULT_PERSISTENCE_SETTINGS.keepEnabledItems,
      keepEnabledFavorites: stored?.keepEnabledFavorites !== undefined ? Boolean(stored.keepEnabledFavorites) : DEFAULT_PERSISTENCE_SETTINGS.keepEnabledFavorites,
      keepValueLocks: stored?.keepValueLocks !== undefined ? Boolean(stored.keepValueLocks) : DEFAULT_PERSISTENCE_SETTINGS.keepValueLocks
    };''', "ensurePersistenceSettings")

old = '''  function snapshotEntry(entry) {
    if (!entry?.favoriteKey || !RETAINABLE_TYPES.has(entry.type) || !Object.hasOwn(entry, "appliedValue")) return null;
    const state = { type: entry.type, value: entry.appliedValue };
    if (LINKED_TYPES.has(entry.type) && entry.fixed === true) {
      state.fixed = true;
      state.fixedValue = entry.fixedValue;
    }
    return state;
  }

  function makeRetainedSnapshot(menu, favoritesOnly = false) {
    const snapshot = {};
    walkItems(menu.rootItems, (entry) => {
      if (favoritesOnly && !menu.isFavorite(entry)) return;
      const state = snapshotEntry(entry);
      if (state) snapshot[entry.favoriteKey] = state;
    });
    return snapshot;
  }

  function applyRetainedSnapshot(menu, snapshot) {
    if (!snapshot || typeof snapshot !== "object") return 0;
    let restored = 0;
    walkItems(menu.rootItems, (entry) => {
      const state = snapshot[entry.favoriteKey];
      if (!state || state.type !== entry.type || !RETAINABLE_TYPES.has(entry.type) || !Object.hasOwn(entry, "appliedValue")) return;
      const value = normalizeRetainedValue(entry, state.value);
      entry.value = value;
      entry.appliedValue = value;
      if (LINKED_TYPES.has(entry.type)) {
        entry.linkedValue = value;
        entry.fixed = Boolean(state.fixed);
        if (entry.fixed) {
          const fixedValue = normalizeRetainedValue(entry, state.fixedValue ?? value);
          entry.fixedValue = fixedValue;
          entry.value = fixedValue;
          entry.appliedValue = fixedValue;
          entry.linkedValue = fixedValue;
        }
      }
      if (entry.type === "checkbox" && entry.effectKind) entry.effectActive = Boolean(value);
      restored++;
    });
    return restored;
  }

  function restoreBrowserRetainedState(menu) {
    if (menu.__retainedStateRestored) return;
    menu.__retainedStateRestored = true;
    const settings = ensurePersistenceSettings(menu);
    const storage = browserStorage();
    if (settings.keepEnabledItems) {
      applyRetainedSnapshot(menu, readJson(storage, STORAGE_KEYS.enabledItems, {}));
      return;
    }
    if (settings.keepEnabledFavorites) {
      applyRetainedSnapshot(menu, readJson(storage, STORAGE_KEYS.enabledFavorites, {}));
    }
  }

  function persistBrowserState(menu) {
    const storage = browserStorage();
    if (!storage) return;
    const settings = ensurePersistenceSettings(menu);
    writeJson(storage, STORAGE_KEYS.settings, settings);
    if (settings.keepFavorites) writeJson(storage, STORAGE_KEYS.favorites, original.favoriteKeysArray.call(menu));
    else writeJson(storage, STORAGE_KEYS.favorites, []);

    // 「オンにした項目を保持」はON/OFFチェックだけを指さない。
    // CTRPF移植時も、値固定、list/listbox、linked-list、value、slider、linked-value の
    // 適用済み状態を同じ保存対象として扱い、未適用の編集中値は保存しない。
    if (settings.keepEnabledItems) writeJson(storage, STORAGE_KEYS.enabledItems, makeRetainedSnapshot(menu, false));
    else removeStored(storage, STORAGE_KEYS.enabledItems);
    if (settings.keepEnabledFavorites) writeJson(storage, STORAGE_KEYS.enabledFavorites, makeRetainedSnapshot(menu, true));
    else removeStored(storage, STORAGE_KEYS.enabledFavorites);
  }'''
new = '''  function retentionKey(entry) {
    return entry?.favoriteKey || entry?.id || null;
  }

  function ensureRetainedItemKeys(menu) {
    if (menu.retainedItemKeys instanceof Set) return menu.retainedItemKeys;
    const stored = readJson(browserStorage(), STORAGE_KEYS.retainedItems, {});
    menu.retainedItemKeys = new Set(stored && typeof stored === "object" ? Object.keys(stored) : []);
    return menu.retainedItemKeys;
  }

  function snapshotEntry(entry) {
    if (!retentionKey(entry) || !RETAINABLE_TYPES.has(entry.type) || !Object.hasOwn(entry, "appliedValue")) return null;
    return { type: entry.type, value: entry.appliedValue };
  }

  function makeRetainedSnapshot(menu, favoritesOnly = false) {
    const snapshot = {};
    walkItems(menu.rootItems, (entry) => {
      if (favoritesOnly && !menu.isFavorite(entry)) return;
      const state = snapshotEntry(entry);
      const key = retentionKey(entry);
      if (state && key) snapshot[key] = state;
    });
    return snapshot;
  }

  function makeSpecificRetainedSnapshot(menu) {
    const keys = ensureRetainedItemKeys(menu);
    const snapshot = {};
    walkItems(menu.rootItems, (entry) => {
      const key = retentionKey(entry);
      if (!key || !keys.has(key)) return;
      const state = snapshotEntry(entry);
      if (state) snapshot[key] = state;
    });
    return snapshot;
  }

  function applyRetainedSnapshot(menu, snapshot) {
    if (!snapshot || typeof snapshot !== "object") return 0;
    let restored = 0;
    walkItems(menu.rootItems, (entry) => {
      const key = retentionKey(entry);
      const state = key ? snapshot[key] : null;
      if (!state || state.type !== entry.type || !RETAINABLE_TYPES.has(entry.type) || !Object.hasOwn(entry, "appliedValue")) return;
      const value = normalizeRetainedValue(entry, state.value);
      entry.value = value;
      entry.appliedValue = value;
      if (LINKED_TYPES.has(entry.type)) entry.linkedValue = value;
      if (entry.type === "checkbox" && entry.effectKind) entry.effectActive = Boolean(value);
      restored++;
    });
    return restored;
  }

  function makeValueLockSnapshot(menu) {
    const snapshot = {};
    walkItems(menu.rootItems, (entry) => {
      if (!LINKED_TYPES.has(entry.type) || entry.fixed !== true) return;
      const key = retentionKey(entry);
      if (!key) return;
      snapshot[key] = { type: entry.type, fixedValue: entry.fixedValue };
    });
    return snapshot;
  }

  function applyValueLockSnapshot(menu, snapshot) {
    if (!snapshot || typeof snapshot !== "object") return 0;
    let restored = 0;
    walkItems(menu.rootItems, (entry) => {
      const key = retentionKey(entry);
      const state = key ? snapshot[key] : null;
      if (!state || state.type !== entry.type || !LINKED_TYPES.has(entry.type)) return;
      const fixedValue = normalizeRetainedValue(entry, state.fixedValue ?? entry.appliedValue);
      if (!Number.isFinite(Number(fixedValue))) return;
      entry.fixed = true;
      entry.fixedValue = fixedValue;
      entry.value = fixedValue;
      entry.appliedValue = fixedValue;
      entry.linkedValue = fixedValue;
      restored++;
    });
    return restored;
  }

  function restoreBrowserRetainedState(menu) {
    if (menu.__retainedStateRestored) return;
    menu.__retainedStateRestored = true;
    const settings = ensurePersistenceSettings(menu);
    const storage = browserStorage();
    const specific = readJson(storage, STORAGE_KEYS.retainedItems, {});
    menu.retainedItemKeys = new Set(specific && typeof specific === "object" ? Object.keys(specific) : []);

    if (settings.keepEnabledItems) applyRetainedSnapshot(menu, readJson(storage, STORAGE_KEYS.enabledItems, {}));
    else if (settings.keepEnabledFavorites) applyRetainedSnapshot(menu, readJson(storage, STORAGE_KEYS.enabledFavorites, {}));

    // 「この項目を保持」は全体設定とは独立した個別指定。最後に適用して、
    // 全体保持がOFFでも指定項目の適用済み状態だけは復元する。
    applyRetainedSnapshot(menu, specific);

    // 値固定は適用値の保持とは別契約。明示的にONの場合だけ復元する。
    if (settings.keepValueLocks) applyValueLockSnapshot(menu, readJson(storage, STORAGE_KEYS.valueLocks, {}));
  }

  function persistBrowserState(menu) {
    const storage = browserStorage();
    if (!storage) return;
    const settings = ensurePersistenceSettings(menu);
    writeJson(storage, STORAGE_KEYS.settings, settings);
    if (settings.keepFavorites) writeJson(storage, STORAGE_KEYS.favorites, original.favoriteKeysArray.call(menu));
    else writeJson(storage, STORAGE_KEYS.favorites, []);

    // 「オンにした項目を保持」はON/OFFチェックだけを指さない。
    // CTRPF移植時も、list/listbox、linked-list、value、slider、linked-value の
    // 適用済み状態を同じ保存対象として扱い、未適用の編集中値は保存しない。
    // 値の固定状態そのものは「値の固定を保持」で別途管理する。
    if (settings.keepEnabledItems) writeJson(storage, STORAGE_KEYS.enabledItems, makeRetainedSnapshot(menu, false));
    else removeStored(storage, STORAGE_KEYS.enabledItems);
    if (settings.keepEnabledFavorites) writeJson(storage, STORAGE_KEYS.enabledFavorites, makeRetainedSnapshot(menu, true));
    else removeStored(storage, STORAGE_KEYS.enabledFavorites);

    writeJson(storage, STORAGE_KEYS.retainedItems, makeSpecificRetainedSnapshot(menu));
    if (settings.keepValueLocks) writeJson(storage, STORAGE_KEYS.valueLocks, makeValueLockSnapshot(menu));
    else removeStored(storage, STORAGE_KEYS.valueLocks);
  }'''
text = replace_once(text, old, new, "retention snapshot block")

text = replace_once(text, '''  prototype.retainedStateSnapshot = function (favoritesOnly = false) {
    return makeRetainedSnapshot(this, Boolean(favoritesOnly));
  };

  prototype.restoreRetainedStateSnapshot = function (snapshot) {
    const restored = applyRetainedSnapshot(this, snapshot);
    this.refreshDisabledItems();
    this.updateFixedLinkedItems();
    return restored;
  };''', '''  prototype.retainedStateSnapshot = function (favoritesOnly = false) {
    return makeRetainedSnapshot(this, Boolean(favoritesOnly));
  };

  prototype.specificRetainedStateSnapshot = function () {
    return makeSpecificRetainedSnapshot(this);
  };

  prototype.valueLockStateSnapshot = function () {
    return makeValueLockSnapshot(this);
  };

  prototype.restoreRetainedStateSnapshot = function (snapshot) {
    const restored = applyRetainedSnapshot(this, snapshot);
    this.refreshDisabledItems();
    this.updateFixedLinkedItems();
    return restored;
  };

  prototype.restoreValueLockStateSnapshot = function (snapshot) {
    const restored = applyValueLockSnapshot(this, snapshot);
    this.refreshDisabledItems();
    this.updateFixedLinkedItems();
    return restored;
  };

  prototype.isItemRetainable = function (entry) {
    return Boolean(retentionKey(entry) && RETAINABLE_TYPES.has(entry?.type) && Object.hasOwn(entry, "appliedValue"));
  };

  prototype.isItemRetained = function (entry) {
    const key = retentionKey(entry);
    return Boolean(key && ensureRetainedItemKeys(this).has(key));
  };

  prototype.setItemRetained = function (entry, retained) {
    if (!this.isItemRetainable(entry)) return false;
    const key = retentionKey(entry);
    const keys = ensureRetainedItemKeys(this);
    const next = Boolean(retained);
    const changed = next ? !keys.has(key) : keys.has(key);
    if (!changed) return false;
    if (next) keys.add(key);
    else keys.delete(key);
    persistBrowserState(this);
    return true;
  };

  prototype.toggleItemRetained = function (entry = this.selectedItem()) {
    return this.setItemRetained(entry, !this.isItemRetained(entry));
  };''', "prototype retention helpers")

old = '''    const keepFavorites = settingsToggle(
      "お気に入りを保持",
      "お気に入り登録を次回も保持します。",
      "keep-favorites",
      persistence.keepFavorites
    );
    const keepEnabledItems = settingsToggle(
      "オンにした項目を保持",
      "適用済みの項目設定を次回も保持します。",
      "keep-enabled-items",
      persistence.keepEnabledItems
    );
    const keepEnabledFavorites = settingsToggle(
      "オンにしたお気に入りを保持",
      "お気に入り項目の適用済み設定を次回も保持します。",
      "keep-enabled-favorites",
      persistence.keepEnabledFavorites
    );
    return [favorites, lock, keepFavorites, keepEnabledItems, keepEnabledFavorites];'''
new = '''    const keepThisItem = settingsToggle(
      "この項目を保持",
      "選択中の項目の適用済み状態だけを次回も保持します。",
      "keep-this-item",
      this.isItemRetained(target),
      target,
      !this.isItemRetainable(target)
    );
    const keepValueLocks = settingsToggle(
      "値の固定を保持",
      "値を固定した状態を次回も保持します。",
      "keep-value-locks",
      persistence.keepValueLocks
    );
    const keepFavorites = settingsToggle(
      "お気に入りを保持",
      "お気に入り登録を次回も保持します。",
      "keep-favorites",
      persistence.keepFavorites
    );
    const keepEnabledItems = settingsToggle(
      "オンにした項目を保持",
      "適用済みの項目設定を次回も保持します。値・リストボックス等も含みます。",
      "keep-enabled-items",
      persistence.keepEnabledItems
    );
    const keepEnabledFavorites = settingsToggle(
      "オンにしたお気に入りを保持",
      "お気に入り項目の適用済み設定を次回も保持します。",
      "keep-enabled-favorites",
      persistence.keepEnabledFavorites
    );
    return [favorites, lock, keepThisItem, keepValueLocks, keepFavorites, keepEnabledItems, keepEnabledFavorites];'''
text = replace_once(text, old, new, "buildSettingsItems")

text = replace_once(text, '''      const settingKey = ({
        "keep-favorites": "keepFavorites",
        "keep-enabled-items": "keepEnabledItems",
        "keep-enabled-favorites": "keepEnabledFavorites"
      })[entry.settingsAction];''', '''      if (entry.settingsAction === "keep-this-item") {
        const target = entry.settingsTarget;
        if (!this.toggleItemRetained(target)) return false;
        entry.value = this.isItemRetained(target);
        entry.appliedValue = entry.value;
        return true;
      }
      const settingKey = ({
        "keep-value-locks": "keepValueLocks",
        "keep-favorites": "keepFavorites",
        "keep-enabled-items": "keepEnabledItems",
        "keep-enabled-favorites": "keepEnabledFavorites"
      })[entry.settingsAction];''', "settings activation mapping")

write(path, text)

# ---------------- app.js ----------------
path = "app.js"
text = read(path)

old = '''      const color = entry.disabled ? "#525b54" : isDirty(entry) ? "#ffd166" : selected ? "#ffffff" : "#aeb9b1";
      drawItemIcon(entry, menuX + 8 + itemOffset, y, color);
      if (menu.isFavorite(entry)) drawBitmapText(top, font, "F", menuX + 22 + itemOffset, y, "#d6c98a");
      const value = formatValue(entry, now);
      const valueFont = isNumericEntry(entry) ? numericFont : font;
      const valueWidth = value ? measureBitmapText(valueFont, value) : 0;
      const labelWidth = MENU.width - 33 - valueWidth;
      drawBitmapText(top, font, trimBitmapText(font, entry.label, labelWidth), menuX + 27 + itemOffset, y, color);
      if (value) drawBitmapText(top, valueFont, value, menuX + MENU.width - 8 - valueWidth + itemOffset, y, color);
      if (entry.type !== "folder" && entry.hotkey !== "なし") drawBitmapText(top, font, "H", menuX + 147 + itemOffset, y + 8, "#78a9ff");
      if (!entry.disabled && y >= 25 && y <= 204) topHitRegions.push({ x: menuX + 4, y: y - 3, width: MENU.width - 10, height: 16, itemIndex: index });'''
new = '''      const color = entry.disabled ? "#525b54" : isDirty(entry) ? "#ffd166" : selected ? "#ffffff" : "#aeb9b1";

      // Compact status indicators use 1px vertical lines beside the row. The first
      // active state stays closest to the item and subsequent states stack leftward.
      // 値を固定 is intentionally not represented here; its value color is sufficient.
      const statusColors = [];
      if (menu.isItemRetained?.(entry)) statusColors.push("#63e4a4");
      if (menu.isFavorite(entry)) statusColors.push("#d6c98a");
      if (entry.type !== "folder" && entry.hotkey !== "なし") statusColors.push("#78a9ff");
      statusColors.forEach((statusColor, statusIndex) => {
        top.fillStyle = statusColor;
        top.fillRect(menuX + 6 - statusIndex + itemOffset, y - 2, 1, 12);
      });

      drawItemIcon(entry, menuX + 8 + itemOffset, y, color);
      const value = formatValue(entry, now);
      const valueFont = isNumericEntry(entry) ? numericFont : font;
      const valueWidth = value ? measureBitmapText(valueFont, value) : 0;
      const labelWidth = MENU.width - 33 - valueWidth;
      drawBitmapText(top, font, trimBitmapText(font, entry.label, labelWidth), menuX + 27 + itemOffset, y, color);
      if (value) drawBitmapText(top, valueFont, value, menuX + MENU.width - 8 - valueWidth + itemOffset, y, color);
      if (!entry.disabled && y >= 25 && y <= 204) topHitRegions.push({ x: menuX + 4, y: y - 3, width: MENU.width - 10, height: 16, itemIndex: index });'''
text = replace_once(text, old, new, "app row markers")

old = '''    const changed = menu.dirtyCount();
    top.fillStyle = "rgba(21, 27, 23, .76)"; top.fillRect(menuX, 216, MENU.width - 2, 24);
    drawBitmapText(top, font, "A決定 X適用 Y HOTKEY", menuX + 6, 220, "#829087");
    drawBitmapText(top, font, `${changed}変更`, menuX + 6, 230, changed ? "#ffd166" : "#58635b");
    drawBitmapText(top, font, "B戻る L戻し R FAV", menuX + 59, 230, "#829087");
    drawHoldProgress(menuX, now);'''
new = '''    const changed = menu.dirtyCount();
    top.fillStyle = "rgba(21, 27, 23, .76)"; top.fillRect(menuX, 216, MENU.width - 2, 24);

    // Keep each help token independently positioned. In particular, a two-digit
    // dirty count must never push the second-row controls sideways.
    const footerAX = menuX + 6;
    const footerXX = menuX + 30;
    const footerYX = menuX + 54;
    const footerStartX = menuX + 102;
    const footerSpace = measureBitmapText(font, " ");
    drawBitmapText(top, font, "A決定", footerAX, 220, "#829087");
    drawBitmapText(top, font, "X適用", footerXX, 220, "#829087");
    drawBitmapText(top, font, "Yホットキー", footerYX, 220, "#829087");
    drawBitmapText(top, font, "START設定", footerStartX, 220, "#829087");

    drawBitmapText(top, font, `${changed}変更`, menuX + 6, 230, changed ? "#ffd166" : "#58635b");
    drawBitmapText(top, font, "B戻る", footerYX, 230, "#829087");
    drawBitmapText(top, font, "L戻し", footerStartX, 230, "#829087");
    drawBitmapText(
      top,
      font,
      "R星",
      footerStartX + measureBitmapText(font, "START設定") + footerSpace,
      230,
      "#829087"
    );
    drawHoldProgress(menuX, now);'''
text = replace_once(text, old, new, "footer help")

old = '''    drawBitmapText(top, font, menu.isFavorite(entry) ? "FAVORITE  R:REMOVE" : "R:ADD FAVORITE", x + 8, y + 29, menu.isFavorite(entry) ? "#ffd166" : "#8f9a92");
    drawBitmapText(top, font, "START:FAVORITES", x + 116, y + 29, "#8f9a92");
    lines.forEach((line, index) => drawBitmapText(top, font, line, x + 8, y + 42 + index * 11, entry.disabled ? "#626b64" : "#c4cec7"));'''
new = '''    // Per-item control hints live in the menu footer. Keep this row free for the
    // fixed-value status overlay and always keep disabled-item descriptions readable.
    lines.forEach((line, index) => drawBitmapText(top, font, line, x + 8, y + 42 + index * 11, "#c4cec7"));'''
text = replace_once(text, old, new, "description hints")

write(path, text)

# ---------------- issue-overlay.js ----------------
path = "issue-overlay.js"
text = read(path)

text = text.replace('  const FAVORITE_ACTIVE_COLOR = "#d6c98a";\n', '')

text, count = re.subn(
    r'\n  function eraseLegacyFavoriteMarker\(.*?\n  function drawValueLockMarkers',
    '\n  function drawValueLockMarkers',
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit("favorite marker functions: source block not found")

old = '''      // 「値を固定」は既存の項目色を変えず、行左端の1px縦線だけで示す。
      context.fillStyle = VALUE_LOCK_MARKER_COLOR;
      context.fillRect(menuX + 4, y - 2, 1, 12);

      // 値の位置は app.js 本来の右寄せ位置を変えない。固定中だけ同じ1bit画素を
      // 水色で上書きするため、背景の読み戻しや行全体の再描画は不要。'''
new = '''      // 「値を固定」は他の状態線へ混ぜない。固定中は値の色だけを水色で
      // 上書きし、項目左側の1px状態線は保持/お気に入り/ホットキー専用にする。'''
text = replace_once(text, old, new, "remove value-lock line")

text = text.replace('    drawFavoriteMarkers(context, font, menu, menuX, now);\n', '')

text = replace_once(text, '''    // Match app.js exactly: items (including the historical H at y + 8) are clipped
    // by this rectangle. F uses the same baseline and is naturally clipped with H on
    // the partially visible eleventh row; neither glyph receives a special Y offset.''', '''    // Match app.js exactly: row overlays use the same list clip as the item renderer.''', "overlay clip comment")

old = '''    // app.js の旧 START:FAVORITES を上書きする。
    // 通常のチート説明欄には START:SETTINGS を出さない。START操作はヘルプ側だけで案内する。
    const frame = menu.currentFrame();
    const settingsIndex = typeof menu.settingsFrameIndex === "function" ? menu.settingsFrameIndex() : -1;
    const selected = menu.selectedItem();
    let controlText;
    if (frame?.kind === "settings") controlText = "START:CLOSE  A:SELECT";
    else if (settingsIndex >= 0) controlText = "R:FAV  START:CLOSE";
    else controlText = `${menu.isItemFixed?.(selected) ? "値を固定:ON  " : ""}R:FAV`;

    context.save();
    context.globalAlpha = amount;
    context.fillStyle = "rgba(10, 13, 11, .98)";
    context.fillRect(174, 35, 211, 11);
    drawBitmapText(context, font, controlText, 176, 37, "#8f9a92");
    context.restore();'''
new = '''    // Description-panel key hints were removed. Only the current value-lock state
    // remains here; SETTINGS intentionally has no START:CLOSE / A:SELECT hint.
    const frame = menu.currentFrame();
    const selected = menu.selectedItem();
    const controlText = frame?.kind === "settings"
      ? ""
      : (menu.isItemFixed?.(selected) ? "値を固定:ON" : "");

    context.save();
    context.globalAlpha = amount;
    context.fillStyle = "rgba(10, 13, 11, .98)";
    context.fillRect(174, 35, 211, 11);
    if (controlText) drawBitmapText(context, font, controlText, 176, 37, "#8f9a92");
    context.restore();'''
text = replace_once(text, old, new, "description overlay controls")

text = replace_once(text,
    '    help.innerHTML = "<b>A</b> 決定　<b>B</b> 戻る／閉じる　<b>X</b> 短押し:選択適用／長押し:全適用　<b>L</b> 短押し:選択戻し／長押し:全戻し　<b>Y</b> ホットキー　<b>R</b> お気に入り切替　<b>START</b> 設定";',
    '    help.innerHTML = "<b>A</b> 決定　<b>B</b> 戻る／閉じる　<b>X</b> 短押し:選択適用／長押し:全適用　<b>L</b> 短押し:選択戻し／長押し:全戻し　<b>Y</b> ホットキー　<b>R</b> 星　<b>START</b> 設定";',
    "DOM help")

text = text.replace('  const VALUE_LOCK_MARKER_COLOR = "#5cc8ff";\n', '')

write(path, text)

# ---------------- chat-kanji-preview.js ----------------
path = "chat-kanji-preview.js"
text = read(path)

text = text.replace("  const CLEAR_BUTTON = Object.freeze({", "  const SELECT_ALL_BUTTON = Object.freeze({", 1)
text = text.replace("CLEAR_BUTTON", "SELECT_ALL_BUTTON")

marker = '    "ク":{"left":1,"glyphWidth":13,"charWidth":16,'
if marker not in text:
    raise SystemExit("Garden extra glyph insertion point not found")
extras = '''    "全":{"left":0,"glyphWidth":16,"charWidth":16,"rows":["00000000000000000","00000000000000000","00000000000000000","00000000000000000","0000004b800000000","000003fffc0000000","00001efd4fd200000","0001dfd104ff81000","003efb10004fff910","08ffc6555558fff90","9f9cffffffffd7d40","1100001ff00000000","0000001ff00000000","0035557ff55552000","00affffffffffa000","0000001ff00000000","0000001ff00000000","1777778ff77777700","4ffffffffffffff20","00000000000000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000"]},
    "選":{"left":0,"glyphWidth":16,"charWidth":16,"rows":["00000000000000000","00000000000000000","00000000000000000","00000000000000000","00001333013331000","4e505bcf97bbef100","0df5056fb055cf100","03fe6f8777fa76700","00547f98f9fa7bc00","000019bc519dba300","0000006f206f40000","9ff72bdfcbdfdb500","14fb039f639f83100","00fb57bf97bfa7600","00fb79ada9bc99700","00fb02bf509fe9000","06ffafb50002ae100","9fd4ffcbbbbddff20","af302adfffffffc00","02000000000000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000"]},
    "択":{"left":0,"glyphWidth":16,"charWidth":16,"rows":["00000000000000000","00000000000000000","00000000000000000","00000000000000000","00291000111110000","007f503ffffffe100","007f507f60008f500","47bfa79f50007f500","69cfc99f50007f500","007f507f50007f500","007f507f71119f500","007fabbffffffd100","27dff98f504f00000","dfff608f502f50000","479f50af300fa0000","007f50cf000bf2000","007f51fb0006fc000","008f57f30000efa00","9dff5f9000007ff10","28b83a00000008700","00000000000000000","00000000000000000","00000000000000000","00000000000000000"]},
'''
text = text.replace(marker, extras + marker, 1)

pattern = r'''  function roundedRectPath\(context, x, y, width, height, radius\) \{.*?\n  function drawPreviewControls'''
replacement = '''  function drawAcNlControlKey(context, rectangle, label, pressed, fontData = DRAW_DATA, scale = 1) {
    context.fillStyle = CANDIDATE_COLORS.panel;
    context.fillRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
    context.strokeStyle = CANDIDATE_COLORS.border;
    context.strokeRect(rectangle.x + 0.5, rectangle.y + 0.5, rectangle.width - 1, rectangle.height - 1);
    if (pressed) {
      context.fillStyle = CANDIDATE_COLORS.selected;
      context.fillRect(rectangle.x + 1, rectangle.y + 1, rectangle.width - 2, rectangle.height - 2);
    }

    const textWidth = measureBcfntText(label, fontData, scale);
    const textX = rectangle.x + Math.floor((rectangle.width - textWidth) / 2);
    const textCellY = scale < 0.999 ? CANDIDATE_BAR.textCellY : rectangle.y - 1;
    drawBcfntText(context, label, textX, textCellY, CANDIDATE_COLORS.text, fontData, scale);
  }

  function drawPreviewControls'''
text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
if count != 1:
    raise SystemExit("control key renderer block not found")

old = '''    // The split is exactly the x=279 separator above the source image's 消去 key.
    context.fillRect(SELECT_ALL_BUTTON.x, SELECT_ALL_BUTTON.y, 1, SELECT_ALL_BUTTON.height);
    if (state.pressed === "clear") {
      context.fillStyle = CONTROL_COLORS.pressedFill;
      context.fillRect(SELECT_ALL_BUTTON.x + 1, SELECT_ALL_BUTTON.y + 1, SELECT_ALL_BUTTON.width - 2, SELECT_ALL_BUTTON.height - 2);
    }

    const clearLabel = "クリア";
    const clearWidth = measureBcfntText(clearLabel, fontData, bar.textScale);
    drawBcfntText(
      context,
      clearLabel,
      SELECT_ALL_BUTTON.x + Math.floor((SELECT_ALL_BUTTON.width - clearWidth) / 2),
      bar.textCellY,
      state.pressed === "clear" ? CONTROL_COLORS.pressedText : CANDIDATE_COLORS.text,
      fontData,
      bar.textScale
    );

    drawGohanControlButton(context, CURSOR_BUTTONS.left, "←", state.pressed === "left", fontData);
    drawGohanControlButton(context, CURSOR_BUTTONS.right, "→", state.pressed === "right", fontData);'''
new = '''    // The split is exactly the x=279 separator above the source image's 消去 key.
    // 全選択 and the two cursor keys all use one ACNL keyboard-key renderer.
    drawAcNlControlKey(
      context,
      SELECT_ALL_BUTTON,
      "全選択",
      state.pressed === "select-all",
      fontData,
      bar.textScale
    );
    drawAcNlControlKey(context, CURSOR_BUTTONS.left, "←", state.pressed === "left", fontData, 1);
    drawAcNlControlKey(context, CURSOR_BUTTONS.right, "→", state.pressed === "right", fontData, 1);'''
text = replace_once(text, old, new, "preview control drawing")

text = replace_once(text, '''      if (pointInside(point, SELECT_ALL_BUTTON)) {
        controlState.pressed = "clear";''', '''      if (pointInside(point, SELECT_ALL_BUTTON)) {
        controlState.pressed = "select-all";''', "select all press state")

text = text.replace("    drawGohanControlButton,\n", "    drawAcNlControlKey,\n")

write(path, text)

# ---------------- docs/chat-kanji-layout.md ----------------
path = "docs/chat-kanji-layout.md"
text = read(path)
text = text.replace('- 「クリア」: 「消去」と同じ右端列 X=279..318。候補表示はその分だけ短くする',
                    '- 「全選択」: 「消去」と同じ右端列 X=279..318。候補表示はその分だけ短くする')
text = text.replace('候補文字だけでなく「クリア」と `←` / `→` も同BCFNTから抽出したA4グリフで描画し',
                    '候補文字だけでなく「全選択」と `←` / `→` も同BCFNTから抽出したA4グリフで描画し')
text = text.replace('左右ボタンの外観・押下色はGohan Menuのキーボードキー表現に合わせる。',
                    '「全選択」と左右ボタンは同じACNLキーボードキー表現に統一する。')
write(path, text)

# ---------------- test/value-lock-visual.test.js ----------------
path = "test/value-lock-visual.test.js"
write(path, '''"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "issue-overlay.js"), "utf8");

test("値を固定 uses cyan value text without adding a side marker", () => {
  assert.match(source, /VALUE_LOCK_VALUE_COLOR = "#5cc8ff"/);
  assert.match(source, /drawValueLockMarkers/);
  assert.match(source, /menu\\.isItemFixed\\(entry\\)/);
  assert.doesNotMatch(source, /VALUE_LOCK_MARKER_COLOR/);
  assert.doesNotMatch(source, /fillRect\\(menuX \\+ 4, y - 2, 1, 12\\)/);
  assert.match(source, /entry\\.type === "linked-value" && numericFont/);
  assert.match(source, /VALUE_LOCK_VALUE_COLOR/);
  assert.match(source, /値を固定:ON/);
  assert.match(source, /if \\(controlText\\) drawBitmapText/);
});
''')

# ---------------- test/issues.test.js ----------------
path = "test/issues.test.js"
text = read(path)

text = replace_once(text, '''  assert.deepEqual(menu.currentFrame().items.map((entry) => entry.label), [
    "FAVORITES",
    "値を固定",
    "お気に入りを保持",
    "オンにした項目を保持",
    "オンにしたお気に入りを保持"
  ]);''', '''  assert.deepEqual(menu.currentFrame().items.map((entry) => entry.label), [
    "FAVORITES",
    "値を固定",
    "この項目を保持",
    "値の固定を保持",
    "お気に入りを保持",
    "オンにした項目を保持",
    "オンにしたお気に入りを保持"
  ]);''', "settings labels test")

text = text.replace('  assert.match(overlaySource, /通常のチート説明欄には/);\n  assert.match(overlaySource, /else controlText = `\\$\\{menu\\.isItemFixed/);\n',
                    '  assert.doesNotMatch(overlaySource, /R:FAV|START:CLOSE|A:SELECT/);\n  assert.match(overlaySource, /menu\\.isItemFixed\\?\\.\\(selected\\) \\? "値を固定:ON" : ""/);\n')

old = '''  assert.deepEqual(all[linked.favoriteKey], { type: "linked-value", value: 1777, fixed: true, fixedValue: 1777 });
  assert.deepEqual(Object.keys(favorites), [weather.favoriteKey]);

  const restored = new CheatMenuModel();
  const count = restored.restoreRetainedStateSnapshot(all);
  assert.ok(count >= 4);
  assert.equal(findItem(restored, "歩行速度アップ").appliedValue, true);
  assert.equal(findItem(restored, "天候").appliedValue, 2);
  assert.equal(findItem(restored, "所持ベル").appliedValue, 4200);
  const restoredLinked = findItem(restored, "連動型数値");
  assert.equal(restoredLinked.fixed, true);
  assert.equal(restoredLinked.fixedValue, 1777);
  assert.match(fixesSource, /値固定、list\\/listbox、linked-list、value、slider、linked-value/);
  assert.match(fixesSource, /未適用の編集中値は保存しない/);'''
new = '''  assert.deepEqual(all[linked.favoriteKey], { type: "linked-value", value: 1777 });
  assert.deepEqual(Object.keys(favorites), [weather.favoriteKey]);
  assert.deepEqual(menu.valueLockStateSnapshot()[linked.favoriteKey], { type: "linked-value", fixedValue: 1777 });

  const restored = new CheatMenuModel();
  const count = restored.restoreRetainedStateSnapshot(all);
  assert.ok(count >= 4);
  assert.equal(findItem(restored, "歩行速度アップ").appliedValue, true);
  assert.equal(findItem(restored, "天候").appliedValue, 2);
  assert.equal(findItem(restored, "所持ベル").appliedValue, 4200);
  const restoredLinked = findItem(restored, "連動型数値");
  assert.equal(restoredLinked.fixed, false, "applied-state retention does not implicitly retain value locks");
  restored.restoreValueLockStateSnapshot(menu.valueLockStateSnapshot());
  assert.equal(restoredLinked.fixed, true);
  assert.equal(restoredLinked.fixedValue, 1777);
  assert.match(fixesSource, /list\\/listbox、linked-list、value、slider、linked-value/);
  assert.match(fixesSource, /値の固定状態そのものは「値の固定を保持」で別途管理/);
  assert.match(fixesSource, /未適用の編集中値は保存しない/);'''
text = replace_once(text, old, new, "retained state test")

old = '''  frame.selection = 2;
  assert.equal(menu.selectedItem().value, true);
  menu.handle("a", 120, true, false);
  assert.equal(menu.persistenceSettingsSnapshot().keepFavorites, false);

  frame.selection = 3;
  menu.handle("a", 140, true, false);
  assert.equal(menu.persistenceSettingsSnapshot().keepEnabledItems, true);

  frame.selection = 4;
  menu.handle("a", 160, true, false);
  assert.equal(menu.persistenceSettingsSnapshot().keepEnabledFavorites, true);'''
new = '''  frame.selection = 2;
  assert.equal(menu.selectedItem().label, "この項目を保持");
  menu.handle("a", 110, true, false);
  assert.equal(menu.isItemRetained(menu.settingsTarget), true);

  frame.selection = 3;
  menu.handle("a", 120, true, false);
  assert.equal(menu.persistenceSettingsSnapshot().keepValueLocks, true);

  frame.selection = 4;
  assert.equal(menu.selectedItem().value, true);
  menu.handle("a", 130, true, false);
  assert.equal(menu.persistenceSettingsSnapshot().keepFavorites, false);

  frame.selection = 5;
  menu.handle("a", 140, true, false);
  assert.equal(menu.persistenceSettingsSnapshot().keepEnabledItems, true);

  frame.selection = 6;
  menu.handle("a", 160, true, false);
  assert.equal(menu.persistenceSettingsSnapshot().keepEnabledFavorites, true);'''
text = replace_once(text, old, new, "retention settings test")

text, count = re.subn(
    r'test\\("menu row status markers use the historical lower H baseline without duplicate H", \\(\\) => \\{.*?\\n\\}\\);',
    '''test("menu row status uses stacked 1px lines and no F/H glyph markers", () => {
  assert.match(appSource, /if \\(menu\\.isItemRetained\\?\\.\\(entry\\)\\) statusColors\\.push\\("#63e4a4"\\)/);
  assert.match(appSource, /if \\(menu\\.isFavorite\\(entry\\)\\) statusColors\\.push\\("#d6c98a"\\)/);
  assert.match(appSource, /entry\\.hotkey !== "なし"\\) statusColors\\.push\\("#78a9ff"\\)/);
  assert.match(appSource, /fillRect\\(menuX \\+ 6 - statusIndex \\+ itemOffset, y - 2, 1, 12\\)/);
  assert.doesNotMatch(appSource, /drawBitmapText\\(top, font, "F"/);
  assert.doesNotMatch(appSource, /drawBitmapText\\(top, font, "H"/);
  assert.doesNotMatch(overlaySource, /eraseLegacyFavoriteMarker|drawFavoriteMarkers/);
  assert.doesNotMatch(overlaySource, /VALUE_LOCK_MARKER_COLOR/);
});

test("description and footer hints follow the compact Japanese key layout", () => {
  assert.doesNotMatch(appSource, /R:ADD FAVORITE|R:REMOVE|START:FAVORITES/);
  assert.match(appSource, /"Yホットキー"/);
  assert.match(appSource, /"START設定"/);
  assert.match(appSource, /"R星"/);
  assert.match(appSource, /drawBitmapText\\(top, font, "B戻る", footerYX/);
  assert.match(appSource, /drawBitmapText\\(top, font, "L戻し", footerStartX/);
  assert.match(appSource, /footerStartX \\+ measureBitmapText\\(font, "START設定"\\) \\+ footerSpace/);
  assert.match(appSource, /drawBitmapText\\(top, font, line, x \\+ 8, y \\+ 42 \\+ index \\* 11, "#c4cec7"\\)/);
  assert.doesNotMatch(appSource, /entry\\.disabled \\? "#626b64"/);
  assert.doesNotMatch(overlaySource, /R:FAV|START:CLOSE|A:SELECT/);
});''',
    text,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit("marker test block not found")

write(path, text)

# ---------------- test/chat-kanji-preview.test.js ----------------
path = "test/chat-kanji-preview.test.js"
text = read(path)
text = text.replace("preview.CLEAR_BUTTON", "preview.SELECT_ALL_BUTTON")
text = text.replace('"clear key begins on the same vertical separator as 消去"', '"select-all key begins on the same vertical separator as 消去"')
text = text.replace('"clear key uses the full 消去 column width"', '"select-all key uses the full 消去 column width"')
text = text.replace('test("clear and cursor controls follow measured source-image geometry without replacing the input field"', 'test("select-all and cursor controls follow measured source-image geometry without replacing the input field"')
text = replace_once(text, '''  assert.match(source, /CLEAR_BUTTON\\.x, CLEAR_BUTTON\\.y, 1, CLEAR_BUTTON\\.height/);
  assert.match(source, /CHAT_LAYOUT\\.candidateY \\+ CHAT_LAYOUT\\.candidateHeight - 1/);
  assert.match(source, /const clearLabel = "クリア"/);
  assert.match(source, /drawBcfntText\\([\\s\\S]*clearLabel/);
  assert.match(source, /drawGohanControlButton\\(context, CURSOR_BUTTONS\\.left, "←"/);
  assert.match(source, /drawGohanControlButton\\(context, CURSOR_BUTTONS\\.right, "→"/);
  assert.match(source, /pointInside\\(point, CLEAR_BUTTON\\)/);''', '''  assert.match(source, /SELECT_ALL_BUTTON/);
  assert.match(source, /CHAT_LAYOUT\\.candidateY \\+ CHAT_LAYOUT\\.candidateHeight - 1/);
  assert.match(source, /"全選択"/);
  assert.match(source, /drawAcNlControlKey\\(context, CURSOR_BUTTONS\\.left, "←"/);
  assert.match(source, /drawAcNlControlKey\\(context, CURSOR_BUTTONS\\.right, "→"/);
  assert.match(source, /pointInside\\(point, SELECT_ALL_BUTTON\\)/);''', "chat control source tests")
insert = '''  for (const character of "全選択") {
    const glyph = preview.DRAW_DATA.glyphs[character];
    assert.ok(glyph, `missing Garden key glyph: ${character}`);
    assert.equal(glyph.rows.length, 24);
  }
'''
anchor = '  assert.ok(pixels.some((pixel) => pixel.alpha > 0 && pixel.alpha < 1), "A4 alpha coverage should survive compact rendering");\n'
if insert not in text:
    text = text.replace(anchor, insert + anchor, 1)
write(path, text)
