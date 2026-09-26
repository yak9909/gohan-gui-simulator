"use strict";

(function (root) {
  const core = typeof module !== "undefined" && module.exports ? require("./ui-model.js") : root.CTRPFUiModel;
  if (!core?.CheatMenuModel) return;

  const {
    CheatMenuModel, NotificationTimeline, NOTICE, SCREEN, MENU, clamp, easeOutCubic, mix, walkItems
  } = core;
  const prototype = CheatMenuModel.prototype;
  if (prototype.__issueResolutionPatchApplied) {
    if (typeof module !== "undefined" && module.exports) module.exports = root?.GohanIssueFixes || {};
    return;
  }

  const HOLD_CANCEL_THRESHOLD = 2 / 5;
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
    keepAllToggleStates: false,
    blockAbxyUntilRelease: false
  });

  const original = {
    currentFrame: prototype.currentFrame,
    handle: prototype.handle,
    activateSelected: prototype.activateSelected,
    moveSelection: prototype.moveSelection,
    normalizeSelection: prototype.normalizeSelection,
    syncLinkedItems: prototype.syncLinkedItems,
    open: prototype.open,
    update: prototype.update,
    holdActionProgress: prototype.holdActionProgress,
    finishHoldAction: prototype.finishHoldAction,
    commitItem: prototype.commitItem,
    commitHotkeyValue: prototype.commitHotkeyValue,
    restoreFavorites: prototype.restoreFavorites,
    favoriteKeysArray: prototype.favoriteKeysArray,
    toggleFavorite: prototype.toggleFavorite
  };

  function installSupplementalGlyphs() {
    const font = root?.MISAKI_GOTHIC_2ND_8;
    if (!font?.glyphs) return;
    const glyphs = {
      // These are the original Misaki Gothic 2nd BDF 8px bitmaps. The base subset
      // did not include these kanji now used by settings/footer labels.
      20445: { character: "保", codepoint: 20445, width: 7, height: 7, offsetX: 0, offsetY: 0, advance: 8, rows: [60, 42, 59, 18, 126, 58, 86], source: "BDF-8px" },
      22266: { character: "固", codepoint: 22266, width: 7, height: 7, offsetX: 0, offsetY: 0, advance: 8, rows: [127, 73, 93, 73, 85, 93, 127], source: "BDF-8px" },
      27671: { character: "気", codepoint: 27671, width: 7, height: 7, offsetX: 0, offsetY: 0, advance: 8, rows: [2, 126, 29, 62, 42, 36, 75], source: "BDF-8px" },
      26143: { character: "星", codepoint: 26143, width: 7, height: 7, offsetX: 0, offsetY: 0, advance: 8, rows: [62, 34, 63, 40, 94, 8, 127], source: "BDF-8px" }
    };
    for (const [codepoint, glyph] of Object.entries(glyphs)) {
      if (!font.glyphs[codepoint]) font.glyphs[codepoint] = glyph;
    }
  }

  function expose(menu) {
    if (root && typeof document !== "undefined") root.__gohanMenuModel = menu;
  }

  function browserStorage() {
    try { return root && typeof root.localStorage !== "undefined" ? root.localStorage : null; }
    catch { return null; }
  }

  function readJson(storage, key, fallback) {
    if (!storage) return fallback;
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(storage, key, value) {
    if (!storage) return false;
    try { storage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  }

  function removeStored(storage, key) {
    if (!storage) return;
    try { storage.removeItem(key); }
    catch { /* localStorage unavailable: retain state only for this session. */ }
  }

  function scrollTarget(index, itemCount, visibleRows) {
    return clamp(index - Math.floor(visibleRows / 2), 0, Math.max(0, itemCount - visibleRows));
  }

  function settingsFolder(label, description, children, options = {}) {
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

  function settingsToggle(label, description, action, value, target = null, disabled = false) {
    return {
      id: `settings-${action}`,
      type: "checkbox",
      label,
      description,
      settingsAction: action,
      settingsTarget: target,
      value: Boolean(value),
      appliedValue: Boolean(value),
      hotkey: "なし",
      appliedHotkey: "なし",
      disabled: Boolean(disabled)
    };
  }

  function ensurePersistenceSettings(menu) {
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
        : (stored?.keepEnabledItems !== undefined ? Boolean(stored.keepEnabledItems) : DEFAULT_PERSISTENCE_SETTINGS.keepAllToggleStates),
      blockAbxyUntilRelease: stored?.blockAbxyUntilRelease !== undefined
        ? Boolean(stored.blockAbxyUntilRelease)
        : DEFAULT_PERSISTENCE_SETTINGS.blockAbxyUntilRelease
    };
    return menu.persistenceSettings;
  }

  function normalizeRetainedValue(entry, value) {
    if (entry.type === "checkbox") return Boolean(value);
    if (["list", "linked-list"].includes(entry.type)) {
      const maximum = Math.max(0, (entry.options?.length || 1) - 1);
      return clamp(Math.round(Number(value) || 0), 0, maximum);
    }
    if (["value", "slider", "linked-value"].includes(entry.type)) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return entry.appliedValue;
      return clamp(numeric, Number(entry.minimum), Number(entry.maximum));
    }
    return value;
  }

  function retentionKey(entry) {
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

  function makeRetainedItemSelection(menu) {
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

  function measureBitmapText(font, text) {
    let width = 0;
    for (const character of Array.from(String(text))) {
      const glyph = font?.glyphs?.[String(character.codePointAt(0))];
      width += glyph ? glyph.advance : 4;
    }
    return width;
  }

  function wrapNoticeLine(font, text, maximumWidth) {
    const lines = [];
    for (const paragraph of String(text ?? "").split("\n")) {
      if (!paragraph) { lines.push(""); continue; }
      let line = "";
      for (const character of Array.from(paragraph)) {
        if (line && measureBitmapText(font, line + character) > maximumWidth) {
          lines.push(line);
          line = character;
        } else line += character;
      }
      lines.push(line);
    }
    return lines;
  }

  function noticeRows(title, message) {
    const font = root?.MISAKI_GOTHIC_2ND_8;
    if (!font) return [String(title ?? ""), ...String(message ?? "").split("\n")];
    return [
      ...wrapNoticeLine(font, title, NOTICE.width - 20),
      ...wrapNoticeLine(font, message, NOTICE.width - 14)
    ];
  }

  function noticeHeight(title, message) {
    const rows = Math.max(2, noticeRows(title, message).length);
    return NOTICE.height + (rows - 2) * NOTICE_LINE_HEIGHT;
  }

  function drawBitmapText(context, font, text, x, y, color) {
    let cursor = Math.round(x);
    context.fillStyle = color;
    for (const character of Array.from(String(text))) {
      const glyph = font.glyphs[String(character.codePointAt(0))];
      if (!glyph) { cursor += 4; continue; }
      for (let row = 0; row < glyph.height; row++) {
        const bits = glyph.rows[row];
        for (let column = 0; column < glyph.width; column++) {
          if (bits & (1 << column)) context.fillRect(cursor + glyph.offsetX + column, Math.round(y) + glyph.offsetY + row, 1, 1);
        }
      }
      cursor += glyph.advance;
    }
    return cursor;
  }

  function drawBrowserNotices(items) {
    if (!root || typeof document === "undefined") return;
    const canvas = document.getElementById("topScreen");
    const font = root.MISAKI_GOTHIC_2ND_8;
    if (!canvas || !font) return;
    const context = canvas.getContext("2d");
    for (const item of items) {
      const x = Math.round(item.x), y = Math.round(item.y);
      const height = item.noticeHeight || NOTICE.height;
      const disabled = item.title.indexOf("CHEAT DISABLED") === 0;
      const accent = disabled ? "#e5484d" : "#63e4a4";
      const edge = disabled ? "#6c4f5b" : "#4f6c5b";
      context.fillStyle = "rgba(10, 13, 11, .78)"; context.fillRect(x, y, NOTICE.width, height);
      context.fillStyle = accent; context.fillRect(x, y, 2, height);
      context.strokeStyle = edge; context.lineWidth = 1; context.strokeRect(x + .5, y + .5, NOTICE.width - 1, height - 1);
      const title = item.title === "CHEAT ENABLED" ? `${item.title} ${item.id}` : item.title;
      const titleLines = wrapNoticeLine(font, title, NOTICE.width - 20);
      const messageLines = wrapNoticeLine(font, item.message, NOTICE.width - 14);
      let row = 0;
      for (const line of titleLines) drawBitmapText(context, font, line, x + 7, y + 4 + row++ * NOTICE_LINE_HEIGHT, "#ffffff");
      for (const line of messageLines) drawBitmapText(context, font, line, x + 7, y + 4 + row++ * NOTICE_LINE_HEIGHT, "#c4cec7");
    }
  }

  function installNotificationPatch() {
    const noticePrototype = NotificationTimeline?.prototype;
    if (!noticePrototype || noticePrototype.__multiLineNoticePatchApplied) return;
    Object.defineProperty(noticePrototype, "__multiLineNoticePatchApplied", { value: true });

    noticePrototype.add = function (now, title = "CHEAT ENABLED", message = "歩行速度アップを有効にしました") {
      this.prune(now);
      const scheduledAt = Math.max(now, this.lastScheduledAt + NOTICE.spawnInterval);
      this.lastScheduledAt = scheduledAt;
      const height = noticeHeight(title, message);
      let active = this.items.filter((entry) => !entry.overflowExit);

      if (active.length >= NOTICE.maximum) {
        const oldest = active.shift();
        oldest.moveFromY = this.getY(oldest, scheduledAt);
        oldest.targetY = -(oldest.noticeHeight || NOTICE.height);
        oldest.moveStartedAt = scheduledAt;
        oldest.overflowExit = true;
      }

      for (const entry of active) {
        entry.moveFromY = this.getY(entry, scheduledAt);
        entry.targetY -= height + NOTICE.gap;
        entry.moveStartedAt = scheduledAt;
      }

      // Variable-height notifications may fill the screen before the numeric item cap.
      // Any oldest row whose destination crosses the top margin is sent through the
      // same vertical exit instead of being dropped immediately.
      for (const entry of active) {
        if (entry.overflowExit || entry.targetY >= NOTICE.margin) continue;
        entry.moveFromY = this.getY(entry, scheduledAt);
        entry.targetY = -(entry.noticeHeight || NOTICE.height);
        entry.moveStartedAt = scheduledAt;
        entry.overflowExit = true;
      }

      const bottomY = SCREEN.height - NOTICE.margin - height;
      const item = {
        id: this.nextId++, title, message, createdAt: scheduledAt,
        moveStartedAt: scheduledAt, moveFromY: bottomY, targetY: bottomY,
        noticeHeight: height, overflowExit: false
      };
      this.items.push(item);
      return item;
    };

    noticePrototype.getY = function (item, now) {
      return mix(item.moveFromY, item.targetY, easeOutCubic((now - item.moveStartedAt) / NOTICE.enterDuration));
    };

    noticePrototype.getX = function (item, now) {
      const targetX = SCREEN.width - NOTICE.margin - NOTICE.width;
      const age = now - item.createdAt;
      if (age < NOTICE.enterDuration) return mix(SCREEN.width, targetX, easeOutCubic(age / NOTICE.enterDuration));
      if (item.overflowExit) return targetX;
      const exitStartedAt = NOTICE.enterDuration + NOTICE.holdDuration;
      if (age < exitStartedAt) return targetX;
      return mix(targetX, SCREEN.width, easeOutCubic((age - exitStartedAt) / NOTICE.exitDuration));
    };

    noticePrototype.isAlive = function (item, now) {
      if (item.overflowExit) return this.getY(item, now) + (item.noticeHeight || NOTICE.height) > 0;
      return now - item.createdAt < NOTICE.enterDuration + NOTICE.holdDuration + NOTICE.exitDuration;
    };

    noticePrototype.prune = function (now) {
      this.items = this.items.filter((item) => this.isAlive(item, now));
    };

    noticePrototype.sample = function (now) {
      this.prune(now);
      const sampled = this.items
        .filter((item) => item.createdAt <= now)
        .map((item) => {
          const result = { id: item.id, title: item.title, message: item.message, x: this.getX(item, now), y: this.getY(item, now) };
          if ((item.noticeHeight || NOTICE.height) !== NOTICE.height) result.noticeHeight = item.noticeHeight;
          if (item.overflowExit) result.overflowExit = true;
          return result;
        });

      // app.js draws the original fixed two-line notification. In the browser this
      // patch draws the variable-height version at the same point in the frame, then
      // returns off-screen copies so the legacy renderer does not double-paint it.
      if (root && typeof document !== "undefined") {
        drawBrowserNotices(sampled);
        return sampled.map((item) => ({ ...item, x: SCREEN.width + NOTICE.width + 8 }));
      }
      return sampled;
    };
  }

  installSupplementalGlyphs();
  installNotificationPatch();
  Object.defineProperty(prototype, "__issueResolutionPatchApplied", { value: true });

  prototype.currentFrame = function () {
    expose(this);
    return original.currentFrame.call(this);
  };

  // Disabled entries remain cursor-selectable. The disabled state blocks
  // activation/edit/apply/hotkey actions, not navigation or description inspection.
  prototype.normalizeSelection = function () {
    const frame = original.currentFrame.call(this);
    if (!frame?.items?.length) {
      if (frame) frame.selection = 0;
      return;
    }
    frame.selection = clamp(Math.round(frame.selection), 0, frame.items.length - 1);
  };

  prototype.moveSelection = function (direction, now, allowWrap = true) {
    const frame = original.currentFrame.call(this);
    if (!frame?.items?.length) return false;
    const previous = frame.selection;
    let next = previous + direction;
    if (!allowWrap && (next < 0 || next >= frame.items.length)) {
      if (this.selectionBoundaryBlockedDirection !== direction) {
        this.selectionBoundaryBounceDirection = direction;
        this.selectionBoundaryBounceStartedAt = now;
        this.selectionBoundaryBlockedDirection = direction;
      }
      return false;
    }
    next = (next + frame.items.length) % frame.items.length;
    if (next === previous) return false;
    this.selectionBoundaryBlockedDirection = 0;
    this.viewportFrom = this.viewportStart(now);
    this.viewportTarget = scrollTarget(next, frame.items.length, MENU.visibleRows);
    this.viewportStartedAt = now;
    this.selectionFrom = this.selectionPosition(now);
    this.selectionTo = next;
    this.selectionStartedAt = now;
    frame.selection = next;
    return true;
  };

  prototype.setItemDisabled = function (entry, disabled) {
    if (!entry) return false;
    entry.manualDisabled = Boolean(disabled);
    entry.disabled = entry.manualDisabled;
    return true;
  };

  prototype.setDisabledPredicate = function (entry, predicate) {
    if (!entry) return false;
    entry.disabledWhen = typeof predicate === "function" ? predicate : null;
    this.refreshDisabledItems();
    return true;
  };

  prototype.refreshDisabledItems = function () {
    walkItems(this.rootItems, (entry) => {
      let hasRule = false;
      let disabled = false;
      if (Object.hasOwn(entry, "manualDisabled")) {
        hasRule = true;
        disabled ||= Boolean(entry.manualDisabled);
      }
      if (typeof entry.disabledWhen === "function") {
        hasRule = true;
        disabled ||= Boolean(entry.disabledWhen(entry, this));
      }
      if (LINKED_TYPES.has(entry.type) && (entry.linkedAvailable === false || !Number.isFinite(Number(entry.linkedValue)))) {
        hasRule = true;
        disabled = true;
      }
      if (hasRule) entry.disabled = disabled;
    });
  };

  prototype.commitItem = function (entry, now = 0) {
    if (!entry || entry.disabled) return false;
    const changed = original.commitItem.call(this, entry, now);
    if (changed && entry.fixed && LINKED_TYPES.has(entry.type)) {
      entry.fixedValue = entry.appliedValue;
      entry.linkedValue = entry.fixedValue;
    }
    if (changed) persistBrowserState(this);
    return changed;
  };

  prototype.commitHotkeyValue = function (entry, value, now = 0) {
    if (!entry || entry.disabled) return false;
    const changed = original.commitHotkeyValue.call(this, entry, value, now);
    if (changed && entry.fixed && LINKED_TYPES.has(entry.type)) {
      entry.fixedValue = entry.appliedValue;
      entry.linkedValue = entry.fixedValue;
    }
    if (changed) persistBrowserState(this);
    return changed;
  };

  prototype.isLinkedEntry = function (entry) {
    return Boolean(entry && LINKED_TYPES.has(entry.type));
  };

  prototype.isItemFixed = function (entry) {
    return Boolean(this.isLinkedEntry(entry) && entry.fixed === true);
  };

  prototype.setItemFixed = function (entry, fixed, now = 0) {
    if (!this.isLinkedEntry(entry)) return false;
    const next = Boolean(fixed);
    if (next) {
      if (entry.disabled || entry.linkedAvailable === false || !Number.isFinite(Number(entry.value))) return false;
      entry.fixed = true;
      entry.fixedValue = entry.value;
      entry.appliedValue = entry.value;
      entry.linkedValue = entry.value;
      this.execute(entry, now);
      this.emit("値を固定", `${entry.label}: ON`);
      persistBrowserState(this);
      return true;
    }
    if (!entry.fixed) return false;
    entry.fixed = false;
    this.emit("値を固定", `${entry.label}: OFF`);
    persistBrowserState(this);
    return true;
  };

  prototype.updateFixedLinkedItems = function () {
    let fixedValueChanged = false;
    walkItems(this.rootItems, (entry) => {
      if (!entry.fixed || !LINKED_TYPES.has(entry.type) || entry.disabled || entry.linkedAvailable === false) return;

      // 固定中でもメニュー上のユーザー編集は許可する。value と appliedValue が違う時だけ
      // ユーザーが左右キー・数値入力・リスト選択で変更したとみなし、その値を新しい固定値にする。
      // CTRPF移植時は「ゲーム側から読んだ値」と「UIが編集した値」を同様に分離し、
      // 外部変動だけを固定値へ戻して、UI入力は固定値そのものを更新する。
      if (entry.value !== entry.appliedValue) {
        entry.fixedValue = entry.value;
        entry.linkedValue = entry.value;
        entry.appliedValue = entry.value;
        fixedValueChanged = true;
        return;
      }

      entry.linkedValue = entry.fixedValue;
      entry.value = entry.fixedValue;
      entry.appliedValue = entry.fixedValue;
    });
    if (fixedValueChanged) persistBrowserState(this);
  };

  prototype.syncLinkedItems = function () {
    original.syncLinkedItems.call(this);
    this.refreshDisabledItems();
    this.updateFixedLinkedItems();
  };

  prototype.open = function (now) {
    this.refreshDisabledItems();
    const result = original.open.call(this, now);
    this.refreshDisabledItems();
    this.updateFixedLinkedItems();
    return result;
  };

  prototype.update = function (now) {
    this.refreshDisabledItems();
    this.updateFixedLinkedItems();
    return original.update.call(this, now);
  };

  prototype.holdActionProgress = function (now) {
    const hold = original.holdActionProgress.call(this, now);
    if (!hold) return null;
    return {
      ...hold,
      cancelThreshold: HOLD_CANCEL_THRESHOLD,
      muted: hold.progress < HOLD_CANCEL_THRESHOLD,
      releaseCancels: hold.progress >= HOLD_CANCEL_THRESHOLD && hold.progress < 1
    };
  };

  prototype.finishHoldAction = function (key, now) {
    if (!this.holdAction || this.holdAction.key !== key) return false;
    const elapsed = now - this.holdAction.startedAt;
    if (elapsed >= MENU.holdDuration) return original.finishHoldAction.call(this, key, now);
    if (elapsed >= MENU.holdDuration * HOLD_CANCEL_THRESHOLD) {
      this.holdAction = null;
      this.emit("HOLD", key === "x" ? "全適用をキャンセルしました" : "全戻しをキャンセルしました");
      return true;
    }
    return original.finishHoldAction.call(this, key, now);
  };

  prototype.persistenceSettingsSnapshot = function () {
    return { ...ensurePersistenceSettings(this) };
  };

  prototype.retainedStateSnapshot = function (favoritesOnly = false) {
    return makeRetainedSnapshot(this, Boolean(favoritesOnly));
  };

  prototype.specificRetainedStateSnapshot = function () {
    return makeSpecificRetainedSnapshot(this);
  };

  prototype.valueLockStateSnapshot = function () {
    return makeValueLockSnapshot(this);
  };

  prototype.toggleStateSnapshot = function () {
    return makeToggleStateSnapshot(this);
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
  };

  prototype.restoreFavorites = function (keys = [], now = 0) {
    const settings = ensurePersistenceSettings(this);
    const result = original.restoreFavorites.call(this, settings.keepFavorites ? keys : [], now);
    restoreBrowserRetainedState(this);
    return result;
  };

  prototype.favoriteKeysArray = function () {
    const settings = ensurePersistenceSettings(this);
    return settings.keepFavorites ? original.favoriteKeysArray.call(this) : [];
  };

  prototype.toggleFavorite = function (entry = this.selectedItem(), now = 0) {
    const result = original.toggleFavorite.call(this, entry, now);
    if (result) persistBrowserState(this);
    return result;
  };

  prototype.settingsFrameIndex = function () {
    return this.frames.findIndex((frame) => frame.kind === "settings");
  };

  prototype.buildSettingsItems = function (target) {
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
    // CTRPF移植専用設定。シミュレーターの入力処理には接続しない。
    // CTRPF側では A/B/X/Y の押下中はゲーム側へ入力を渡さず、ボタンを離した瞬間に
    // 初めて単発のゲーム入力として渡す。押し続けている間のゲーム側反応やリピートは発生させない。
    const blockAbxyUntilRelease = settingsToggle(
      "押し切るまでABXYボタンの遮断",
      "ABXYは押下中にゲームへ渡さず、離した時に入力します。",
      "block-abxy-until-release",
      persistence.blockAbxyUntilRelease
    );

    // SETTINGSだけは操作頻度を優先し、フォルダを先頭へ寄せず指定順を維持する。
    return [keepThisItem, lock, favorites, retentionSettings, keepFavorites, blockAbxyUntilRelease];
  };

  prototype.openSettings = function (now = 0) {
    if (this.settingsFrameIndex() >= 0) return true;
    const target = this.selectedItem();
    this.settingsTarget = target;
    this.frames.push({ title: "SETTINGS", items: this.buildSettingsItems(target), selection: 0, kind: "settings" });
    this.resetSelectionAnimation(now);
    return true;
  };

  prototype.closeSettings = function (now = 0) {
    const index = this.settingsFrameIndex();
    if (index < 0) return false;
    this.frames.splice(index);
    this.settingsTarget = null;
    this.resetSelectionAnimation(now);
    return true;
  };

  prototype.toggleSettings = function (now = 0) {
    if (this.settingsFrameIndex() >= 0) return this.closeSettings(now);
    return this.openSettings(now);
  };

  prototype.activateSelected = function (now) {
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
        "keep-all-toggle-states": "keepAllToggleStates",
        "block-abxy-until-release": "blockAbxyUntilRelease"
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
  };

  prototype.handle = function (key, now, pressed = true, repeated = false) {
    expose(this);
    const modal = Boolean(this.dialog || this.overlay || this.inlineList);
    if (key === "start" && pressed && !repeated && this.visible && !modal) {
      this.heldControls.add(key);
      this.releaseInactiveHotkeys();
      const result = this.toggleSettings(now);
      persistBrowserState(this);
      return result;
    }

    const frame = original.currentFrame.call(this);
    if (frame?.kind === "settings" && pressed && !repeated && !modal && key === "a") {
      this.heldControls.add(key);
      this.releaseInactiveHotkeys();
      const result = this.activateSelected(now);
      persistBrowserState(this);
      return result;
    }
    if (frame?.kind === "settings" && pressed && !repeated && !modal && ["x", "y", "l", "r", "select", "left", "right"].includes(key)) {
      this.heldControls.add(key);
      this.releaseInactiveHotkeys();
      return;
    }
    const result = original.handle.call(this, key, now, pressed, repeated);
    if (pressed || !repeated) persistBrowserState(this);
    return result;
  };

  const api = Object.freeze({
    HOLD_CANCEL_THRESHOLD, LINKED_TYPES, RETAINABLE_TYPES, TOGGLE_RETAINABLE_TYPES, NOTICE_LINE_HEIGHT,
    STORAGE_KEYS, DEFAULT_PERSISTENCE_SETTINGS
  });
  if (root) root.GohanIssueFixes = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);