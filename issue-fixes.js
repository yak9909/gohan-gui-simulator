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
  const NOTICE_LINE_HEIGHT = 10;
  const STORAGE_KEYS = Object.freeze({
    favorites: "gohan-menu-favorites-v1",
    settings: "gohan-menu-persistence-settings-v1",
    enabledItems: "gohan-menu-retained-state-v1",
    enabledFavorites: "gohan-menu-retained-favorite-state-v1"
  });
  const DEFAULT_PERSISTENCE_SETTINGS = Object.freeze({
    keepFavorites: true,
    keepEnabledItems: false,
    keepEnabledFavorites: false
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
      // did not include the three kanji now used by the settings labels.
      20445: { character: "保", codepoint: 20445, width: 7, height: 7, offsetX: 0, offsetY: 0, advance: 8, rows: [60, 42, 59, 18, 126, 58, 86], source: "BDF-8px" },
      22266: { character: "固", codepoint: 22266, width: 7, height: 7, offsetX: 0, offsetY: 0, advance: 8, rows: [127, 73, 93, 73, 85, 93, 127], source: "BDF-8px" },
      27671: { character: "気", codepoint: 27671, width: 7, height: 7, offsetX: 0, offsetY: 0, advance: 8, rows: [2, 126, 29, 62, 42, 36, 75], source: "BDF-8px" }
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

  function settingsAction(label, description, action, disabled = false) {
    return {
      id: `settings-${action}`,
      type: "action",
      label,
      description,
      action: null,
      settingsAction: action,
      hotkey: "なし",
      appliedHotkey: "なし",
      disabled: Boolean(disabled)
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
      keepEnabledItems: stored?.keepEnabledItems !== undefined ? Boolean(stored.keepEnabledItems) : DEFAULT_PERSISTENCE_SETTINGS.keepEnabledItems,
      keepEnabledFavorites: stored?.keepEnabledFavorites !== undefined ? Boolean(stored.keepEnabledFavorites) : DEFAULT_PERSISTENCE_SETTINGS.keepEnabledFavorites
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

  function snapshotEntry(entry) {
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
    walkItems(this.rootItems, (entry) => {
      if (!entry.fixed || !LINKED_TYPES.has(entry.type) || entry.disabled || entry.linkedAvailable === false) return;
      entry.linkedValue = entry.fixedValue;
      entry.value = entry.fixedValue;
      entry.appliedValue = entry.fixedValue;
    });
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

  prototype.restoreRetainedStateSnapshot = function (snapshot) {
    const restored = applyRetainedSnapshot(this, snapshot);
    this.refreshDisabledItems();
    this.updateFixedLinkedItems();
    return restored;
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
    const favorites = settingsAction(
      "FAVORITES",
      "お気に入り項目を表示します。",
      "favorites",
      this.favoriteItems().length === 0
    );
    const linked = this.isLinkedEntry(target);
    const fixed = this.isItemFixed(target);
    const lockDisabled = !linked || (Boolean(target?.disabled) && !fixed);
    const lock = settingsToggle(
      "値を固定",
      "選択中の連動型の値を固定します。",
      "value-lock",
      fixed,
      target,
      lockDisabled
    );
    const keepFavorites = settingsToggle(
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
    return [favorites, lock, keepFavorites, keepEnabledItems, keepEnabledFavorites];
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
    if (frame?.kind === "settings" && entry?.settingsAction) {
      if (entry.disabled) return false;
      this.activationBounceStartedAt = now;
      if (entry.settingsAction === "favorites") return this.openFavorites(now);
      if (entry.settingsAction === "value-lock") {
        const target = entry.settingsTarget;
        const next = !this.isItemFixed(target);
        if (!this.setItemFixed(target, next, now)) return false;
        entry.value = this.isItemFixed(target);
        entry.appliedValue = entry.value;
        entry.disabled = !this.isLinkedEntry(target) || (Boolean(target?.disabled) && !entry.value);
        return true;
      }
      const settingKey = ({
        "keep-favorites": "keepFavorites",
        "keep-enabled-items": "keepEnabledItems",
        "keep-enabled-favorites": "keepEnabledFavorites"
      })[entry.settingsAction];
      if (settingKey) {
        const persistence = ensurePersistenceSettings(this);
        persistence[settingKey] = !persistence[settingKey];
        entry.value = persistence[settingKey];
        entry.appliedValue = entry.value;
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
    HOLD_CANCEL_THRESHOLD, LINKED_TYPES, RETAINABLE_TYPES, NOTICE_LINE_HEIGHT,
    STORAGE_KEYS, DEFAULT_PERSISTENCE_SETTINGS
  });
  if (root) root.GohanIssueFixes = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);