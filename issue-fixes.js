"use strict";

(function (root) {
  const core = typeof module !== "undefined" && module.exports ? require("./ui-model.js") : root.CTRPFUiModel;
  if (!core?.CheatMenuModel) return;

  const { CheatMenuModel, MENU, clamp, walkItems } = core;
  const prototype = CheatMenuModel.prototype;
  if (prototype.__issueResolutionPatchApplied) {
    if (typeof module !== "undefined" && module.exports) module.exports = root?.GohanIssueFixes || {};
    return;
  }

  const HOLD_CANCEL_THRESHOLD = 2 / 5;
  const LINKED_TYPES = new Set(["linked-value", "linked-list"]);
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
    commitHotkeyValue: prototype.commitHotkeyValue
  };

  function expose(menu) {
    if (root && typeof document !== "undefined") root.__gohanMenuModel = menu;
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

  function settingsToggle(label, description, action, value, target, disabled = false) {
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

  Object.defineProperty(prototype, "__issueResolutionPatchApplied", { value: true });

  prototype.currentFrame = function () {
    expose(this);
    return original.currentFrame.call(this);
  };

  // Issue #3: disabled entries remain cursor-selectable. The disabled state blocks
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
    return changed;
  };

  prototype.commitHotkeyValue = function (entry, value, now = 0) {
    if (!entry || entry.disabled) return false;
    const changed = original.commitHotkeyValue.call(this, entry, value, now);
    if (changed && entry.fixed && LINKED_TYPES.has(entry.type)) {
      entry.fixedValue = entry.appliedValue;
      entry.linkedValue = entry.fixedValue;
    }
    return changed;
  };

  // Issue #5: linked values can be pinned to the currently selected value.
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
      this.emit("VALUE LOCK", `${entry.label}: ON`);
      return true;
    }
    if (!entry.fixed) return false;
    entry.fixed = false;
    this.emit("VALUE LOCK", `${entry.label}: OFF`);
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

  // Issue #2: releasing after 2/5 progress cancels the hold entirely instead
  // of falling back to the selected-item short action.
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

  // Issue #4: START owns a settings frame. FAVORITES is opened from settings.
  prototype.settingsFrameIndex = function () {
    return this.frames.findIndex((frame) => frame.kind === "settings");
  };

  prototype.buildSettingsItems = function (target) {
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
      "VALUE LOCK",
      "選択中の連動型の値を固定します。",
      "value-lock",
      fixed,
      target,
      lockDisabled
    );
    return [favorites, lock];
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
      return this.toggleSettings(now);
    }

    const frame = original.currentFrame.call(this);
    if (frame?.kind === "settings" && pressed && !repeated && !modal && ["x", "y", "l", "r", "select", "left", "right"].includes(key)) {
      this.heldControls.add(key);
      this.releaseInactiveHotkeys();
      return;
    }
    return original.handle.call(this, key, now, pressed, repeated);
  };

  const api = Object.freeze({ HOLD_CANCEL_THRESHOLD, LINKED_TYPES });
  if (root) root.GohanIssueFixes = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
