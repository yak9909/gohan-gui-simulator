from pathlib import Path
import re

def sub_once(path, pattern, replacement, flags=re.S):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    new_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}")
    p.write_text(new_text, encoding="utf-8")

def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}")
    p.write_text(text.replace(old, new), encoding="utf-8")

sub_once(
    "issue-fixes.js",
    r'''  const HOLD_CANCEL_THRESHOLD = 2 / 5;
  const LINKED_TYPES = new Set\(\["linked-value", "linked-list"\]\);
  const RETAINABLE_TYPES = new Set\(\["checkbox", "value", "slider", "list", "linked-value", "linked-list"\]\);
  const NOTICE_LINE_HEIGHT = 10;
  const STORAGE_KEYS = Object\.freeze\(\{
    favorites: "gohan-menu-favorites-v1",
    settings: "gohan-menu-persistence-settings-v1",
    enabledItems: "gohan-menu-retained-state-v1",
    enabledFavorites: "gohan-menu-retained-favorite-state-v1",
    retainedItems: "gohan-menu-retained-selected-items-v1",
    valueLocks: "gohan-menu-retained-value-locks-v1"
  \}\);
  const DEFAULT_PERSISTENCE_SETTINGS = Object\.freeze\(\{
    keepFavorites: true,
    keepEnabledItems: false,
    keepEnabledFavorites: false,
    keepValueLocks: false
  \}\);''',
    '''  const HOLD_CANCEL_THRESHOLD = 2 / 5;
  const LINKED_TYPES = new Set(["linked-value", "linked-list"]);
  const RETAINABLE_TYPES = new Set(["checkbox", "value", "slider", "list", "linked-value", "linked-list"]);
  const TOGGLE_RETAINABLE_TYPES = new Set(["checkbox"]);
  const NOTICE_LINE_HEIGHT = 10;
  const STORAGE_KEYS = Object.freeze({
    favorites: "gohan-menu-favorites-v1",
    settings: "gohan-menu-persistence-settings-v1",
    retainedItems: "gohan-menu-retained-selected-items-v1",
    retainedState: "gohan-menu-retained-selected-state-v2",
    toggleStates: "gohan-menu-retained-toggle-state-v2",
    valueLocks: "gohan-menu-retained-value-locks-v1"
  });
  const LEGACY_STORAGE_KEYS = Object.freeze({
    enabledItems: "gohan-menu-retained-state-v1",
    enabledFavorites: "gohan-menu-retained-favorite-state-v1"
  });
  const DEFAULT_PERSISTENCE_SETTINGS = Object.freeze({
    keepFavorites: true,
    keepRetainedValueLocks: true,
    keepFavoriteValueLocks: false,
    keepAllValueLocks: false,
    keepRetainedToggleStates: true,
    keepFavoriteToggleStates: true,
    keepAllToggleStates: false
  });'''
)

sub_once(
    "issue-fixes.js",
    r'''  function settingsAction\(label, description, action, disabled = false\) \{
    return \{
      id: `settings-\$\{action\}`,
      type: "action",
      label,
      description,
      action: null,
      settingsAction: action,
      hotkey: "なし",
      appliedHotkey: "なし",
      disabled: Boolean\(disabled\)
    \};
  \}

  function settingsToggle''',
    '''  function settingsFolder(label, description, children, options = {}) {
    return {
      id: `settings-folder-${options.id || label}`,
      type: "folder",
      label,
      description,
      children,
      hotkey: "なし",
      appliedHotkey: "なし",
      disabled: Boolean(options.disabled),
      settingsFolder: Boolean(options.settingsFolder),
      settingsFavoritesFolder: Boolean(options.settingsFavoritesFolder)
    };
  }

  function settingsToggle'''
)

sub_once(
    "issue-fixes.js",
    r'''  function ensurePersistenceSettings\(menu\) \{
    if \(menu\.persistenceSettings\) return menu\.persistenceSettings;
    const stored = readJson\(browserStorage\(\), STORAGE_KEYS\.settings, \{\}\);
    menu\.persistenceSettings = \{
      keepFavorites: stored\?\.keepFavorites !== undefined \? Boolean\(stored\.keepFavorites\) : DEFAULT_PERSISTENCE_SETTINGS\.keepFavorites,
      keepEnabledItems: stored\?\.keepEnabledItems !== undefined \? Boolean\(stored\.keepEnabledItems\) : DEFAULT_PERSISTENCE_SETTINGS\.keepEnabledItems,
      keepEnabledFavorites: stored\?\.keepEnabledFavorites !== undefined \? Boolean\(stored\.keepEnabledFavorites\) : DEFAULT_PERSISTENCE_SETTINGS\.keepEnabledFavorites,
      keepValueLocks: stored\?\.keepValueLocks !== undefined \? Boolean\(stored\.keepValueLocks\) : DEFAULT_PERSISTENCE_SETTINGS\.keepValueLocks
    \};
    return menu\.persistenceSettings;
  \}''',
    '''  function ensurePersistenceSettings(menu) {
    if (menu.persistenceSettings) return menu.persistenceSettings;
    const stored = readJson(browserStorage(), STORAGE_KEYS.settings, {});
    menu.persistenceSettings = {
      keepFavorites: stored?.keepFavorites !== undefined ? Boolean(stored.keepFavorites) : DEFAULT_PERSISTENCE_SETTINGS.keepFavorites,
      keepRetainedValueLocks: stored?.keepRetainedValueLocks !== undefined
        ? Boolean(stored.keepRetainedValueLocks)
        : DEFAULT_PERSISTENCE_SETTINGS.keepRetainedValueLocks,
      keepFavoriteValueLocks: stored?.keepFavoriteValueLocks !== undefined
        ? Boolean(stored.keepFavoriteValueLocks)
        : DEFAULT_PERSISTENCE_SETTINGS.keepFavoriteValueLocks,
      keepAllValueLocks: stored?.keepAllValueLocks !== undefined
        ? Boolean(stored.keepAllValueLocks)
        : (stored?.keepValueLocks !== undefined ? Boolean(stored.keepValueLocks) : DEFAULT_PERSISTENCE_SETTINGS.keepAllValueLocks),
      keepRetainedToggleStates: stored?.keepRetainedToggleStates !== undefined
        ? Boolean(stored.keepRetainedToggleStates)
        : DEFAULT_PERSISTENCE_SETTINGS.keepRetainedToggleStates,
      keepFavoriteToggleStates: stored?.keepFavoriteToggleStates !== undefined
        ? Boolean(stored.keepFavoriteToggleStates)
        : (stored?.keepEnabledFavorites !== undefined ? Boolean(stored.keepEnabledFavorites) : DEFAULT_PERSISTENCE_SETTINGS.keepFavoriteToggleStates),
      keepAllToggleStates: stored?.keepAllToggleStates !== undefined
        ? Boolean(stored.keepAllToggleStates)
        : (stored?.keepEnabledItems !== undefined ? Boolean(stored.keepEnabledItems) : DEFAULT_PERSISTENCE_SETTINGS.keepAllToggleStates)
    };
    return menu.persistenceSettings;
  }'''
)

sub_once(
    "issue-fixes.js",
    r'''  function makeSpecificRetainedSnapshot\(menu\) \{.*?  function persistBrowserState\(menu\) \{.*?  \}

  function measureBitmapText''',
    '''  function makeRetainedItemSelection(menu) {
    const snapshot = {};
    for (const key of ensureRetainedItemKeys(menu)) snapshot[key] = true;
    return snapshot;
  }

  function makeSpecificRetainedSnapshot(menu) {
    const keys = ensureRetainedItemKeys(menu);
    const snapshot = {};
    walkItems(menu.rootItems, (entry) => {
      const key = retentionKey(entry);
      if (!key || !keys.has(key) || entry.type === "checkbox") return;
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

  function stateScopeMatches(menu, entry, settings, retainedKey, favoriteKey, allKey) {
    if (settings[allKey]) return true;
    const key = retentionKey(entry);
    if (settings[retainedKey] && key && ensureRetainedItemKeys(menu).has(key)) return true;
    return Boolean(settings[favoriteKey] && menu.isFavorite(entry));
  }

  function makeToggleStateSnapshot(menu, settings = {
    keepRetainedToggleStates: false,
    keepFavoriteToggleStates: false,
    keepAllToggleStates: true
  }) {
    const snapshot = {};
    walkItems(menu.rootItems, (entry) => {
      if (!TOGGLE_RETAINABLE_TYPES.has(entry.type) || !Object.hasOwn(entry, "appliedValue")) return;
      if (!stateScopeMatches(menu, entry, settings, "keepRetainedToggleStates", "keepFavoriteToggleStates", "keepAllToggleStates")) return;
      const key = retentionKey(entry);
      if (key) snapshot[key] = { type: entry.type, value: Boolean(entry.appliedValue) };
    });
    return snapshot;
  }

  function applyToggleStateSnapshot(menu, snapshot) {
    if (!snapshot || typeof snapshot !== "object") return 0;
    let restored = 0;
    walkItems(menu.rootItems, (entry) => {
      if (!TOGGLE_RETAINABLE_TYPES.has(entry.type)) return;
      const key = retentionKey(entry);
      const state = key ? snapshot[key] : null;
      if (!state || state.type !== entry.type) return;
      const value = Boolean(state.value);
      entry.value = value;
      entry.appliedValue = value;
      if (entry.effectKind) entry.effectActive = value;
      restored++;
    });
    return restored;
  }

  function makeValueLockSnapshot(menu, settings = {
    keepRetainedValueLocks: false,
    keepFavoriteValueLocks: false,
    keepAllValueLocks: true
  }) {
    const snapshot = {};
    walkItems(menu.rootItems, (entry) => {
      if (!LINKED_TYPES.has(entry.type) || entry.fixed !== true) return;
      if (!stateScopeMatches(menu, entry, settings, "keepRetainedValueLocks", "keepFavoriteValueLocks", "keepAllValueLocks")) return;
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
    const selected = readJson(storage, STORAGE_KEYS.retainedItems, {});
    menu.retainedItemKeys = new Set(selected && typeof selected === "object" ? Object.keys(selected) : []);

    // 「この項目を保持」の選択自体と、選択項目の通常値は分離して保存する。
    // v1では同じオブジェクトへ保存していたため、新形式が無い場合だけv1内容を移行元として読む。
    const specificState = readJson(storage, STORAGE_KEYS.retainedState, null);
    applyRetainedSnapshot(menu, specificState ?? selected);

    let toggleState = readJson(storage, STORAGE_KEYS.toggleStates, null);
    if (!toggleState) {
      if (settings.keepAllToggleStates) toggleState = readJson(storage, LEGACY_STORAGE_KEYS.enabledItems, {});
      else if (settings.keepFavoriteToggleStates) toggleState = readJson(storage, LEGACY_STORAGE_KEYS.enabledFavorites, {});
    }
    applyToggleStateSnapshot(menu, toggleState || {});

    applyValueLockSnapshot(menu, readJson(storage, STORAGE_KEYS.valueLocks, {}));
  }

  function persistBrowserState(menu) {
    const storage = browserStorage();
    if (!storage) return;
    const settings = ensurePersistenceSettings(menu);
    writeJson(storage, STORAGE_KEYS.settings, settings);
    if (settings.keepFavorites) writeJson(storage, STORAGE_KEYS.favorites, original.favoriteKeysArray.call(menu));
    else writeJson(storage, STORAGE_KEYS.favorites, []);

    writeJson(storage, STORAGE_KEYS.retainedItems, makeRetainedItemSelection(menu));
    writeJson(storage, STORAGE_KEYS.retainedState, makeSpecificRetainedSnapshot(menu));

    // CTRPF移植時も「値の固定」と「トグル状態」は別契約として保存する。
    // 全項目がONなら保持済み/お気に入りの範囲指定はUI上無効化し、保存判定でも全項目を優先する。
    if (settings.keepRetainedToggleStates || settings.keepFavoriteToggleStates || settings.keepAllToggleStates) {
      writeJson(storage, STORAGE_KEYS.toggleStates, makeToggleStateSnapshot(menu, settings));
    } else removeStored(storage, STORAGE_KEYS.toggleStates);

    if (settings.keepRetainedValueLocks || settings.keepFavoriteValueLocks || settings.keepAllValueLocks) {
      writeJson(storage, STORAGE_KEYS.valueLocks, makeValueLockSnapshot(menu, settings));
    } else removeStored(storage, STORAGE_KEYS.valueLocks);

    removeStored(storage, LEGACY_STORAGE_KEYS.enabledItems);
    removeStored(storage, LEGACY_STORAGE_KEYS.enabledFavorites);
  }

  function measureBitmapText'''
)

sub_once(
    "issue-fixes.js",
    r'''  prototype\.buildSettingsItems = function \(target\) \{.*?    return \[favorites, lock, keepThisItem, keepValueLocks, keepFavorites, keepEnabledItems, keepEnabledFavorites\];
  \};''',
    '''  prototype.buildSettingsItems = function (target) {
    const persistence = ensurePersistenceSettings(this);
    const linked = this.isLinkedEntry(target);
    const fixed = this.isItemFixed(target);
    const lockDisabled = !linked || (Boolean(target?.disabled) && !fixed);

    const keepThisItem = settingsToggle(
      "この項目を保持",
      "選択中の項目の状態を次回も保持します。",
      "keep-this-item",
      this.isItemRetained(target),
      target,
      !this.isItemRetainable(target)
    );
    const lock = settingsToggle(
      "値を固定",
      "選択中の連動型の値を固定します。",
      "value-lock",
      fixed,
      target,
      lockDisabled
    );
    const favorites = settingsFolder(
      "お気に入り",
      "お気に入り項目を表示します。",
      this.favoriteItems(),
      { id: "favorites", settingsFavoritesFolder: true, disabled: this.favoriteItems().length === 0 }
    );

    const valueLockAll = persistence.keepAllValueLocks;
    const valueLockFolder = settingsFolder(
      "値の固定",
      "値の固定状態を次回も保持する範囲を設定します。",
      [
        settingsToggle(
          "保持された項目",
          "「この項目を保持」がオンの項目の値の固定を次回も保持します。",
          "keep-retained-value-locks",
          persistence.keepRetainedValueLocks,
          null,
          valueLockAll
        ),
        settingsToggle(
          "お気に入り",
          "お気に入りの値の固定を次回も保持します。",
          "keep-favorite-value-locks",
          persistence.keepFavoriteValueLocks,
          null,
          valueLockAll
        ),
        settingsToggle(
          "全項目",
          "全項目の値の固定を次回も保持します。",
          "keep-all-value-locks",
          persistence.keepAllValueLocks
        )
      ],
      { id: "value-lock-retention", settingsFolder: true }
    );

    const toggleAll = persistence.keepAllToggleStates;
    const toggleFolder = settingsFolder(
      "トグル状態",
      "項目のトグル状態を次回も保持する範囲を設定します。",
      [
        settingsToggle(
          "保持された項目",
          "「この項目を保持」がオンの項目のトグル状態を次回も保持します。",
          "keep-retained-toggle-states",
          persistence.keepRetainedToggleStates,
          null,
          toggleAll
        ),
        settingsToggle(
          "お気に入り",
          "お気に入り項目のトグル状態を次回も保持します。",
          "keep-favorite-toggle-states",
          persistence.keepFavoriteToggleStates,
          null,
          toggleAll
        ),
        settingsToggle(
          "全項目",
          "全項目のトグル状態を次回も保持します。",
          "keep-all-toggle-states",
          persistence.keepAllToggleStates
        )
      ],
      { id: "toggle-retention", settingsFolder: true }
    );

    const retentionSettings = settingsFolder(
      "項目の保持設定",
      "値の固定と項目のトグル状態の保持範囲を設定します。",
      [valueLockFolder, toggleFolder],
      { id: "retention", settingsFolder: true }
    );
    const keepFavorites = settingsToggle(
      "お気に入りを保持",
      "お気に入り登録を次回も保持します。",
      "keep-favorites",
      persistence.keepFavorites
    );

    // SETTINGSだけは操作頻度を優先し、フォルダを先頭へ寄せず指定順を維持する。
    return [keepThisItem, lock, favorites, retentionSettings, keepFavorites];
  };'''
)

sub_once(
    "issue-fixes.js",
    r'''  prototype\.activateSelected = function \(now\) \{
    const frame = original\.currentFrame\.call\(this\);
    const entry = frame\?\.items\?\.\[frame\.selection\];
    if \(frame\?\.kind === "settings" && entry\?\.settingsAction\) \{
      if \(entry\.disabled\) return false;
      this\.activationBounceStartedAt = now;
      if \(entry\.settingsAction === "favorites"\) return this\.openFavorites\(now\);
      if \(entry\.settingsAction === "value-lock"\) \{.*?      return false;
    \}
    return original\.activateSelected\.call\(this, now\);
  \};''',
    '''  prototype.activateSelected = function (now) {
    const frame = original.currentFrame.call(this);
    const entry = frame?.items?.[frame.selection];
    if (frame?.kind === "settings" && entry?.settingsFavoritesFolder) {
      if (entry.disabled) return false;
      this.activationBounceStartedAt = now;
      this.frames.push({ title: entry.label, items: this.favoriteItems(), selection: 0, kind: "favorites" });
      this.resetSelectionAnimation(now);
      return true;
    }
    if (frame?.kind === "settings" && entry?.settingsFolder) {
      if (entry.disabled) return false;
      this.activationBounceStartedAt = now;
      this.frames.push({ title: entry.label, items: entry.children, selection: 0, kind: "settings" });
      this.resetSelectionAnimation(now);
      return true;
    }
    if (frame?.kind === "settings" && entry?.settingsAction) {
      if (entry.disabled) return false;
      this.activationBounceStartedAt = now;
      if (entry.settingsAction === "value-lock") {
        const target = entry.settingsTarget;
        const next = !this.isItemFixed(target);
        if (!this.setItemFixed(target, next, now)) return false;
        entry.value = this.isItemFixed(target);
        entry.appliedValue = entry.value;
        entry.disabled = !this.isLinkedEntry(target) || (Boolean(target?.disabled) && !entry.value);
        return true;
      }
      if (entry.settingsAction === "keep-this-item") {
        const target = entry.settingsTarget;
        if (!this.toggleItemRetained(target)) return false;
        entry.value = this.isItemRetained(target);
        entry.appliedValue = entry.value;
        return true;
      }
      const settingKey = ({
        "keep-favorites": "keepFavorites",
        "keep-retained-value-locks": "keepRetainedValueLocks",
        "keep-favorite-value-locks": "keepFavoriteValueLocks",
        "keep-all-value-locks": "keepAllValueLocks",
        "keep-retained-toggle-states": "keepRetainedToggleStates",
        "keep-favorite-toggle-states": "keepFavoriteToggleStates",
        "keep-all-toggle-states": "keepAllToggleStates"
      })[entry.settingsAction];
      if (settingKey) {
        const persistence = ensurePersistenceSettings(this);
        persistence[settingKey] = !persistence[settingKey];
        entry.value = persistence[settingKey];
        entry.appliedValue = entry.value;

        if (entry.settingsAction === "keep-all-value-locks") {
          for (const sibling of frame.items) {
            if (["keep-retained-value-locks", "keep-favorite-value-locks"].includes(sibling.settingsAction)) {
              sibling.disabled = entry.value;
            }
          }
        }
        if (entry.settingsAction === "keep-all-toggle-states") {
          for (const sibling of frame.items) {
            if (["keep-retained-toggle-states", "keep-favorite-toggle-states"].includes(sibling.settingsAction)) {
              sibling.disabled = entry.value;
            }
          }
        }

        persistBrowserState(this);
        return true;
      }
      return false;
    }
    return original.activateSelected.call(this, now);
  };'''
)

replace_once(
    "issue-fixes.js",
    '''  prototype.valueLockStateSnapshot = function () {
    return makeValueLockSnapshot(this);
  };
''',
    '''  prototype.valueLockStateSnapshot = function () {
    return makeValueLockSnapshot(this);
  };

  prototype.toggleStateSnapshot = function () {
    return makeToggleStateSnapshot(this);
  };
'''
)

replace_once(
    "issue-fixes.js",
    '''    HOLD_CANCEL_THRESHOLD, LINKED_TYPES, RETAINABLE_TYPES, NOTICE_LINE_HEIGHT,
    STORAGE_KEYS, DEFAULT_PERSISTENCE_SETTINGS
''',
    '''    HOLD_CANCEL_THRESHOLD, LINKED_TYPES, RETAINABLE_TYPES, TOGGLE_RETAINABLE_TYPES, NOTICE_LINE_HEIGHT,
    STORAGE_KEYS, DEFAULT_PERSISTENCE_SETTINGS
'''
)

replace_once(
    "issue-overlay.js",
    '''    context.save();
    context.globalAlpha = amount;
    context.fillStyle = "rgba(10, 13, 11, .98)";
    context.fillRect(174, 35, 211, 11);
    if (controlText) drawBitmapText(context, font, controlText, 176, 37, "#8f9a92");
    context.restore();
''',
    '''    context.save();
    context.globalAlpha = amount;
    if (controlText) drawBitmapText(context, font, controlText, 176, 37, "#8f9a92");
    context.restore();
'''
)

Path("docs/menu-state-indicators.md").write_text(
'''# Menu state indicators

This file records the current Gohan Menu state-indicator, SETTINGS, and footer contracts so later CTRPF work does not regress.

## Row state indicators

State markers use one 1px-wide, 12px-tall vertical line at `menuX + 4`, matching the historical `値を固定` side-marker position. The entire marker is drawn at 60% opacity. When multiple states are active, that single line is split vertically into equal-height segments.

Segments are ordered from top to bottom as follows:

1. お気に入り: yellow `#d6c98a`
2. `この項目を保持`: red `#e5484d`
3. ホットキー: blue `#78a9ff`

For example, お気に入り + ホットキー uses yellow/blue at 1:1, and お気に入り + `この項目を保持` + ホットキー uses yellow/red/blue at 1:1:1. ホットキーは複数状態の中で常に一番下へ配置する。Inactive states draw nothing. `値を固定` does not add a vertical line; a fixed value is indicated by its cyan value text only.

## SETTINGS order

SETTINGS is intentionally not folder-first. The root order is:

1. `この項目を保持`
2. `値を固定`
3. `お気に入り` (folder)
4. `項目の保持設定` (folder)
5. `お気に入りを保持`

`この項目を保持` uses the description `選択中の項目の状態を次回も保持します。`.

`お気に入り` is a folder-style entry, not an action-style SETTINGS command. Opening it uses the normal favorites frame so favorite items remain live references to the original menu entries.

## 項目の保持設定

`項目の保持設定` contains two folders:

- `値の固定`
  - `保持された項目`: default ON. Retains value-lock state for items marked by `この項目を保持`.
  - `お気に入り`: default OFF. Retains value-lock state for favorite items.
  - `全項目`: default OFF. Retains value-lock state for every linked item. While ON, the two scope controls above are disabled.
- `トグル状態`
  - `保持された項目`: default ON. Retains toggle state for items marked by `この項目を保持`.
  - `お気に入り`: default ON. Retains toggle state for favorite items.
  - `全項目`: default OFF. Retains toggle state for every item. While ON, the two scope controls above are disabled.

The old root settings `値の固定を保持`, `オンにした項目を保持`, and `オンにしたお気に入りを保持` no longer exist. Toggle persistence is unified under `項目の保持設定/トグル状態`.

The per-item retention selector is stored independently from retained state. Non-checkbox applied values for specifically retained items continue to use the per-item retained-state snapshot; checkbox toggle state and linked-item value-lock state use their respective scoped settings above.

## Description and footer

The description panel does not paint a separate opaque black status strip. `値を固定:ON` may still be drawn as text, but it is rendered directly on the existing description panel background.

The item description panel does not show `R:FAV`, `START:CLOSE`, or `A:SELECT`. Disabled-item description text remains readable instead of being gray-disabled.

The menu footer uses independently positioned tokens so the dirty-count width cannot shift controls:

- first row: `A決定`, `X適用`, `Yホットキー`, `START設定`
- second row: `<n>変更`, `B戻る`, `L戻し`, `R星`

`B戻る` aligns with `Yホットキー`. `L戻し` aligns with `START設定`. `R星` begins one space after the end of `START設定`.

## ACNL kanji preview keys

The conversion-row utility key is `全選択`. `全選択`, `←`, and `→` use the same brown ACNL keyboard-key visual treatment and Garden_msg_size16.bcfnt glyph rendering. The existing ACNL input field remains untouched.
''',
encoding="utf-8"
)

sub_once(
    "test/issues.test.js",
    r'''test\("START opens settings with retention controls and FAVORITES remains the first action", \(\) => \{.*?\n\}\);

test\("値を固定 pins only editable linked list/value items"''',
    '''test("START opens settings with the requested mixed item/folder order", () => {
  const { menu, item } = rootCheckboxMenu();
  menu.toggleFavorite(item, 10);

  menu.handle("start", 100, true, false);
  assert.equal(menu.currentFrame().kind, "settings");
  assert.equal(menu.currentFrame().title, "SETTINGS");
  assert.deepEqual(menu.currentFrame().items.map((entry) => entry.label), [
    "この項目を保持",
    "値を固定",
    "お気に入り",
    "項目の保持設定",
    "お気に入りを保持"
  ]);
  assert.equal(menu.currentFrame().items[0].description, "選択中の項目の状態を次回も保持します。");
  assert.equal(menu.currentFrame().items[2].type, "folder");
  assert.equal(menu.currentFrame().items[3].type, "folder");
  assert.deepEqual(menu.persistenceSettingsSnapshot(), DEFAULT_PERSISTENCE_SETTINGS);

  menu.currentFrame().selection = 2;
  menu.handle("a", 120, true, false);
  assert.equal(menu.currentFrame().kind, "favorites", "A on お気に入り opens the folder as a favorites frame");
  assert.equal(menu.currentFrame().items[0], item, "favorites still reference the original item");

  menu.handle("b", 140, true, false);
  assert.equal(menu.currentFrame().kind, "settings", "B returns from favorites to settings");
  menu.currentFrame().selection = 2;
  menu.handle("a", 160, true, false);
  assert.equal(menu.currentFrame().kind, "favorites");
  menu.handle("start", 180, true, false);
  assert.equal(menu.currentFrame().title, "ROOT", "START closes the whole settings subtree");

  const empty = rootCheckboxMenu().menu;
  empty.handle("start", 200, true, false);
  assert.equal(empty.currentFrame().kind, "settings");
  assert.equal(empty.currentFrame().items[2].disabled, true, "お気に入り folder is disabled when there are no favorites");
  empty.currentFrame().selection = 2;
  assert.equal(empty.activateSelected(220), false);

  assert.match(html, /issue-fixes\\.js/);
  assert.match(html, /issue-overlay\\.js/);
  assert.ok(html.indexOf("issue-fixes.js") < html.indexOf("app.js"));
  assert.ok(html.indexOf("app.js") < html.indexOf("issue-overlay.js"));
  assert.doesNotMatch(overlaySource, /R:FAV|START:CLOSE|A:SELECT/);
  assert.match(overlaySource, /menu\\.isItemFixed\\?\\.\\(selected\\) \\? "値を固定:ON" : ""/);
  assert.doesNotMatch(overlaySource, /fillRect\\(174, 35, 211, 11\\)/);
});

test("値を固定 pins only editable linked list/value items"'''
)

sub_once(
    "test/issues.test.js",
    r'''test\("retained state and value-lock state are persisted independently", \(\) => \{.*?\n\}\);

test\("retention settings toggle independently inside SETTINGS", \(\) => \{.*?\n\}\);''',
    '''test("retained value, toggle-state, and value-lock snapshots are independent", () => {
  const menu = new CheatMenuModel();
  const walking = findItem(menu, "歩行速度アップ");
  const weather = findItem(menu, "天候");
  const bells = selectNestedItem(menu, "数値設定", "所持ベル");
  menu.frames = [{ title: "ROOT", items: menu.rootItems, selection: 0 }];
  const linked = selectNestedItem(menu, "UIテスト", "連動型数値");

  walking.value = true;
  walking.appliedValue = true;
  weather.value = 2;
  weather.appliedValue = 2;
  bells.value = 4200;
  bells.appliedValue = 4200;
  linked.value = 1777;
  linked.appliedValue = 1777;
  linked.linkedValue = 1777;
  linked.fixed = true;
  linked.fixedValue = 1777;
  menu.toggleFavorite(weather, 10);

  const all = menu.retainedStateSnapshot(false);
  const favorites = menu.retainedStateSnapshot(true);
  assert.equal(all[walking.favoriteKey].value, true);
  assert.equal(all[weather.favoriteKey].value, 2);
  assert.equal(all[bells.favoriteKey].value, 4200);
  assert.deepEqual(all[linked.favoriteKey], { type: "linked-value", value: 1777 });
  assert.deepEqual(Object.keys(favorites), [weather.favoriteKey]);
  assert.deepEqual(menu.valueLockStateSnapshot()[linked.favoriteKey], { type: "linked-value", fixedValue: 1777 });
  assert.deepEqual(menu.toggleStateSnapshot()[walking.favoriteKey], { type: "checkbox", value: true });

  const restored = new CheatMenuModel();
  const count = restored.restoreRetainedStateSnapshot(all);
  assert.ok(count >= 4);
  assert.equal(findItem(restored, "歩行速度アップ").appliedValue, true);
  assert.equal(findItem(restored, "天候").appliedValue, 2);
  assert.equal(findItem(restored, "所持ベル").appliedValue, 4200);
  const restoredLinked = findItem(restored, "連動型数値");
  assert.equal(Boolean(restoredLinked.fixed), false, "applied-state retention does not implicitly retain value locks");
  restored.restoreValueLockStateSnapshot(menu.valueLockStateSnapshot());
  assert.equal(restoredLinked.fixed, true);
  assert.equal(restoredLinked.fixedValue, 1777);
  assert.match(fixesSource, /「値の固定」と「トグル状態」は別契約/);
  assert.match(fixesSource, /全項目がONなら保持済み\\/お気に入りの範囲指定はUI上無効化/);
});

test("項目の保持設定 has scoped value-lock and toggle-state folders", () => {
  const menu = new CheatMenuModel();
  menu.open(0);
  menu.currentFrame().selection = 1;
  menu.handle("start", 100, true, false);
  const rootSettings = menu.currentFrame();

  rootSettings.selection = 0;
  assert.equal(menu.selectedItem().label, "この項目を保持");
  menu.handle("a", 110, true, false);
  assert.equal(menu.selectedItem().value, true);
  assert.equal(menu.isItemRetained(menu.selectedItem().settingsTarget), true);

  rootSettings.selection = 3;
  menu.handle("a", 120, true, false);
  assert.equal(menu.currentFrame().title, "項目の保持設定");
  assert.deepEqual(menu.currentFrame().items.map((entry) => entry.label), ["値の固定", "トグル状態"]);

  menu.currentFrame().selection = 0;
  menu.handle("a", 130, true, false);
  assert.equal(menu.currentFrame().title, "値の固定");
  assert.deepEqual(menu.currentFrame().items.map((entry) => entry.label), ["保持された項目", "お気に入り", "全項目"]);
  assert.deepEqual(menu.currentFrame().items.map((entry) => entry.value), [true, false, false]);
  menu.currentFrame().selection = 2;
  menu.handle("a", 140, true, false);
  assert.equal(menu.persistenceSettingsSnapshot().keepAllValueLocks, true);
  assert.equal(menu.currentFrame().items[0].disabled, true);
  assert.equal(menu.currentFrame().items[1].disabled, true);

  menu.handle("b", 150, true, false);
  menu.currentFrame().selection = 1;
  menu.handle("a", 160, true, false);
  assert.equal(menu.currentFrame().title, "トグル状態");
  assert.deepEqual(menu.currentFrame().items.map((entry) => entry.label), ["保持された項目", "お気に入り", "全項目"]);
  assert.deepEqual(menu.currentFrame().items.map((entry) => entry.value), [true, true, false]);
  menu.currentFrame().selection = 2;
  menu.handle("a", 170, true, false);
  assert.equal(menu.persistenceSettingsSnapshot().keepAllToggleStates, true);
  assert.equal(menu.currentFrame().items[0].disabled, true);
  assert.equal(menu.currentFrame().items[1].disabled, true);

  assert.doesNotMatch(fixesSource, /"値の固定を保持"/);
  assert.doesNotMatch(fixesSource, /"オンにした項目を保持"/);
  assert.doesNotMatch(fixesSource, /"オンにしたお気に入りを保持"/);
  assert.match(fixesSource, /項目のトグル状態を次回も保持/);
});'''
)

replace_once(
    "test/value-lock-visual.test.js",
    '''  assert.match(source, /if \\(controlText\\) drawBitmapText/);
''',
    '''  assert.match(source, /if \\(controlText\\) drawBitmapText/);
  assert.doesNotMatch(source, /fillRect\\(174, 35, 211, 11\\)/);
'''
)

print("retention settings patch applied")
