"use strict";

(function (root) {
  const core = typeof module !== "undefined" && module.exports ? require("./ui-model.js") : root.CTRPFUiModel;
  if (!core?.CheatMenuModel) return;

  const prototype = core.CheatMenuModel.prototype;
  if (prototype.__stylePreviewPatchApplied) {
    if (typeof module !== "undefined" && module.exports) module.exports = root?.ACNLStylePreviewModel || {};
    return;
  }

  const STYLE_FIELDS = Object.freeze([
    Object.freeze({ key: "hairStyle", label: "HAIR STYLE", options: Object.freeze(["01", "02", "03", "04", "05", "06", "07", "08"]) }),
    Object.freeze({ key: "hairColor", label: "HAIR COLOR", options: Object.freeze(["GREEN", "BROWN", "BLACK", "BLONDE", "RED", "BLUE", "PINK", "WHITE"]) }),
    Object.freeze({ key: "eyeShape", label: "EYE SHAPE", options: Object.freeze(["01", "02", "03", "04", "05", "06", "07", "08"]) }),
    Object.freeze({ key: "eyeColor", label: "EYE COLOR", options: Object.freeze(["BLUE", "GREEN", "BROWN", "BLACK", "GRAY", "VIOLET"]) }),
    Object.freeze({ key: "gender", label: "GENDER", options: Object.freeze(["MALE", "FEMALE"]) }),
    Object.freeze({ key: "headwear", label: "HEADWEAR", options: Object.freeze(["SHOW", "HIDE"]) })
  ]);

  const DEFAULT_VALUES = Object.freeze([3, 0, 0, 0, 0, 1]);
  const originalCurrentFrame = prototype.currentFrame;
  const originalOpen = prototype.open;
  const originalHandle = prototype.handle;
  const originalGameInputCaptureState = prototype.gameInputCaptureState;

  function previewEntry() {
    return {
      id: "style-change-preview",
      type: "checkbox",
      label: "STYLE CHANGE PREVIEW",
      description: "Preview the ACNL style-change screen and operate its settings.",
      value: false,
      appliedValue: false,
      hotkey: "なし",
      appliedHotkey: "なし",
      favoriteKey: "STYLE CHANGE PREVIEW",
      previewKind: "style-change"
    };
  }

  function ensurePreviewEntry(menu) {
    if (!menu?.rootItems || menu.rootItems.some((entry) => entry?.previewKind === "style-change")) return false;
    const chatPreviewIndex = menu.rootItems.findIndex((entry) => entry?.previewKind === "chat-kanji");
    const chatActionIndex = menu.rootItems.findIndex((entry) => entry?.action === "chat-kanji");
    const insertAt = chatPreviewIndex >= 0 ? chatPreviewIndex + 1 : chatActionIndex >= 0 ? chatActionIndex : menu.rootItems.length;
    menu.rootItems.splice(insertAt, 0, previewEntry());
    return true;
  }

  function previewItem(menu) {
    ensurePreviewEntry(menu);
    return menu?.rootItems?.find((entry) => entry?.previewKind === "style-change") || null;
  }

  function isPreviewEnabled(menu) {
    const entry = previewItem(menu);
    return Boolean(entry && (entry.value === true || entry.appliedValue === true));
  }

  function ensureStyleState(menu) {
    if (!menu.stylePreviewState) {
      menu.stylePreviewState = {
        selectedIndex: 0,
        values: [...DEFAULT_VALUES],
        revision: 0,
        lastChangedAt: 0
      };
    }
    return menu.stylePreviewState;
  }

  function wrapIndex(index, count) {
    if (!count) return 0;
    return ((Math.round(index) % count) + count) % count;
  }

  function moveStyleSelection(menu, direction) {
    const state = ensureStyleState(menu);
    state.selectedIndex = wrapIndex(state.selectedIndex + direction, STYLE_FIELDS.length);
    return state.selectedIndex;
  }

  function changeStyleValue(menu, direction, now = 0) {
    const state = ensureStyleState(menu);
    const field = STYLE_FIELDS[state.selectedIndex];
    if (!field) return false;
    const previous = state.values[state.selectedIndex] || 0;
    state.values[state.selectedIndex] = wrapIndex(previous + direction, field.options.length);
    state.revision += 1;
    state.lastChangedAt = now;
    return true;
  }

  function currentStyleValue(menu, index) {
    const state = ensureStyleState(menu);
    const field = STYLE_FIELDS[index];
    if (!field) return "";
    return field.options[wrapIndex(state.values[index] || 0, field.options.length)];
  }

  function isStyleUiOperable(menu) {
    return Boolean(menu && isPreviewEnabled(menu) && !menu.visible && !menu.dialog && !menu.overlay && !menu.inlineList);
  }

  Object.defineProperty(prototype, "__stylePreviewPatchApplied", { value: true });

  prototype.currentFrame = function () {
    ensurePreviewEntry(this);
    ensureStyleState(this);
    return originalCurrentFrame.call(this);
  };

  prototype.open = function (now) {
    ensurePreviewEntry(this);
    ensureStyleState(this);
    return originalOpen.call(this, now);
  };

  prototype.handle = function (key, now, pressed = true, repeated = false) {
    ensurePreviewEntry(this);
    ensureStyleState(this);

    if (isStyleUiOperable(this) && ["up", "down", "left", "right", "a"].includes(key)) {
      if (pressed && !repeated) this.heldControls.add(key);
      else if (!pressed) this.heldControls.delete(key);
      if (!pressed) {
        this.releaseInactiveHotkeys?.();
        return true;
      }
      if (key === "up") moveStyleSelection(this, -1);
      else if (key === "down") moveStyleSelection(this, 1);
      else if (key === "left") changeStyleValue(this, -1, now);
      else if (key === "right") changeStyleValue(this, 1, now);
      else if (key === "a" && !repeated) changeStyleValue(this, 1, now);
      this.releaseInactiveHotkeys?.();
      return true;
    }

    return originalHandle.call(this, key, now, pressed, repeated);
  };

  prototype.gameInputCaptureState = function () {
    const base = originalGameInputCaptureState.call(this);
    if (!isStyleUiOperable(this)) return base;
    return { ...base, active: true, blockGameButtons: true };
  };

  prototype.stylePreviewValue = function (index) {
    return currentStyleValue(this, index);
  };

  const api = Object.freeze({
    STYLE_FIELDS,
    DEFAULT_VALUES,
    ensurePreviewEntry,
    previewEntry,
    previewItem,
    isPreviewEnabled,
    ensureStyleState,
    moveStyleSelection,
    changeStyleValue,
    currentStyleValue,
    isStyleUiOperable
  });

  if (root) root.ACNLStylePreviewModel = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
