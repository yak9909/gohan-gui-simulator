"use strict";

(function (root) {
  const core = typeof module !== "undefined" && module.exports ? require("./ui-model.js") : root.CTRPFUiModel;
  if (!core?.CheatMenuModel) return;

  const { easeOutCubic, mix } = core;
  const prototype = core.CheatMenuModel.prototype;
  if (prototype.__stylePreviewPatchApplied) {
    if (typeof module !== "undefined" && module.exports) module.exports = root?.ACNLStylePreviewModel || {};
    return;
  }

  const STYLE_FIELDS = Object.freeze([
    Object.freeze({ key: "hairStyle", label: "かみがた", options: Object.freeze(["1ばん", "2ばん", "3ばん", "4ばん", "5ばん", "6ばん", "7ばん", "8ばん"]) }),
    Object.freeze({ key: "hairColor", label: "かみいろ", options: Object.freeze(["みどり", "ちゃ", "くろ", "きん", "あか", "あお", "もも", "しろ"]) }),
    Object.freeze({ key: "eyeShape", label: "めのかたち", options: Object.freeze(["1ばん", "2ばん", "3ばん", "4ばん", "5ばん", "6ばん", "7ばん", "8ばん"]) }),
    Object.freeze({ key: "eyeColor", label: "めのいろ", options: Object.freeze(["あお", "みどり", "ちゃ", "くろ", "はいいろ", "むらさき"]) }),
    Object.freeze({ key: "gender", label: "せいべつ", options: Object.freeze(["おとこ", "おんな"]) }),
    Object.freeze({ key: "headwear", label: "あたまそうび", options: Object.freeze(["みせる", "かくす"]) })
  ]);

  const DEFAULT_VALUES = Object.freeze([3, 0, 0, 0, 0, 1]);
  const STYLE_UI = Object.freeze({
    panelDuration: 180,
    selectionDuration: 90,
    valueBounceDuration: 100,
    activationDuration: 90
  });
  const CAPTURED_KEYS = new Set(["up", "down", "left", "right", "a", "b", "x", "y", "l", "r", "zl", "zr", "select", "start"]);

  const original = {
    currentFrame: prototype.currentFrame,
    open: prototype.open,
    update: prototype.update,
    handle: prototype.handle,
    gameInputCaptureState: prototype.gameInputCaptureState
  };

  function previewEntry() {
    return {
      id: "style-change-preview",
      type: "checkbox",
      label: "スタイル変更",
      description: "かみがた・かみいろ・目・せいべつ・あたまそうびを上画面で変更します。",
      value: false,
      appliedValue: false,
      hotkey: "なし",
      appliedHotkey: "なし",
      favoriteKey: "スタイル変更",
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
    return previewItem(menu)?.appliedValue === true;
  }

  function createStyleState() {
    return {
      selectedIndex: 0,
      selectionFrom: 0,
      selectionTo: 0,
      selectionStartedAt: 0,
      selectionBoundaryBounceDirection: 0,
      selectionBoundaryBounceStartedAt: Number.NEGATIVE_INFINITY,
      selectionBoundaryBlockedDirection: 0,
      values: [...DEFAULT_VALUES],
      revision: 0,
      valueBounceIndex: -1,
      valueBounceDirection: 0,
      valueBounceStartedAt: Number.NEGATIVE_INFINITY,
      activationBounceStartedAt: Number.NEGATIVE_INFINITY,
      panelFrom: 0,
      panelTarget: 0,
      panelStartedAt: 0
    };
  }

  function ensureStyleState(menu) {
    if (!menu.stylePreviewState) menu.stylePreviewState = createStyleState();
    return menu.stylePreviewState;
  }

  function wrapIndex(index, count) {
    if (!count) return 0;
    return ((Math.round(index) % count) + count) % count;
  }

  function isStyleUiOperable(menu) {
    return Boolean(menu && isPreviewEnabled(menu) && !menu.visible && !menu.dialog && !menu.overlay && !menu.inlineList);
  }

  function panelAmount(menu, now = 0) {
    const state = ensureStyleState(menu);
    if (state.panelFrom === state.panelTarget) return state.panelTarget;
    const duration = STYLE_UI.panelDuration;
    const progress = duration <= 0 ? 1 : easeOutCubic((now - state.panelStartedAt) / duration);
    return mix(state.panelFrom, state.panelTarget, progress);
  }

  function setPanelVisible(menu, visible, now = 0) {
    const state = ensureStyleState(menu);
    const target = visible ? 1 : 0;
    if (state.panelTarget === target) return false;
    state.panelFrom = panelAmount(menu, now);
    state.panelTarget = target;
    state.panelStartedAt = now;
    return true;
  }

  function updateStyleLifecycle(menu, now = 0) {
    ensurePreviewEntry(menu);
    ensureStyleState(menu);
    setPanelVisible(menu, isStyleUiOperable(menu), now);
  }

  function selectionPosition(menu, now = 0) {
    const state = ensureStyleState(menu);
    if (state.selectionFrom === state.selectionTo) return state.selectionTo;
    const progress = easeOutCubic((now - state.selectionStartedAt) / STYLE_UI.selectionDuration);
    return mix(state.selectionFrom, state.selectionTo, progress);
  }

  function moveStyleSelection(menu, direction, now = 0, allowWrap = true) {
    const state = ensureStyleState(menu);
    const previous = state.selectedIndex;
    let next = previous + direction;
    if (!allowWrap && (next < 0 || next >= STYLE_FIELDS.length)) {
      if (state.selectionBoundaryBlockedDirection !== direction) {
        state.selectionBoundaryBounceDirection = direction;
        state.selectionBoundaryBounceStartedAt = now;
        state.selectionBoundaryBlockedDirection = direction;
      }
      return false;
    }
    next = wrapIndex(next, STYLE_FIELDS.length);
    if (next === previous) return false;

    // gohanのメニューと同様に、入力結果は即時確定し、描画位置だけを時刻補間する。
    // CTRPFへ移植する場合も「論理選択」と「見た目の補間位置」を別状態として保持する。
    state.selectionFrom = selectionPosition(menu, now);
    state.selectionTo = next;
    state.selectionStartedAt = now;
    state.selectionBoundaryBlockedDirection = 0;
    state.selectedIndex = next;
    return true;
  }

  function selectionBoundaryBounceOffset(menu, now = 0) {
    const state = ensureStyleState(menu);
    const elapsed = now - state.selectionBoundaryBounceStartedAt;
    if (elapsed < 0 || elapsed >= STYLE_UI.selectionDuration) return 0;
    const progress = elapsed / STYLE_UI.selectionDuration;
    const amount = progress < 0.28
      ? easeOutCubic(progress / 0.28)
      : 1 - easeOutCubic((progress - 0.28) / 0.72);
    return amount === 0 ? 0 : state.selectionBoundaryBounceDirection * 3 * amount;
  }

  function changeStyleValue(menu, direction, now = 0) {
    const state = ensureStyleState(menu);
    const field = STYLE_FIELDS[state.selectedIndex];
    if (!field) return false;
    const previous = wrapIndex(state.values[state.selectedIndex], field.options.length);
    const next = wrapIndex(previous + direction, field.options.length);
    if (next === previous) return false;
    state.values[state.selectedIndex] = next;
    state.revision += 1;
    state.valueBounceIndex = state.selectedIndex;
    state.valueBounceDirection = Math.sign(direction) || 1;
    state.valueBounceStartedAt = now;
    return true;
  }

  function valueBounceOffset(menu, index, now = 0) {
    const state = ensureStyleState(menu);
    if (state.valueBounceIndex !== index) return 0;
    const elapsed = now - state.valueBounceStartedAt;
    if (elapsed < 0 || elapsed >= STYLE_UI.valueBounceDuration) return 0;
    const progress = elapsed / STYLE_UI.valueBounceDuration;
    const amount = progress < 0.28
      ? easeOutCubic(progress / 0.28)
      : 1 - easeOutCubic((progress - 0.28) / 0.72);
    return state.valueBounceDirection * 4 * amount;
  }

  function activationBounceOffset(menu, now = 0) {
    const state = ensureStyleState(menu);
    const elapsed = now - state.activationBounceStartedAt;
    if (elapsed < 0 || elapsed >= STYLE_UI.activationDuration) return 0;
    const progress = elapsed / STYLE_UI.activationDuration;
    const amount = progress < 0.3
      ? easeOutCubic(progress / 0.3)
      : 1 - easeOutCubic((progress - 0.3) / 0.7);
    return 3 * amount;
  }

  function currentStyleValue(menu, index) {
    const state = ensureStyleState(menu);
    const field = STYLE_FIELDS[index];
    if (!field) return "";
    return field.options[wrapIndex(state.values[index], field.options.length)];
  }

  Object.defineProperty(prototype, "__stylePreviewPatchApplied", { value: true });

  prototype.currentFrame = function () {
    ensurePreviewEntry(this);
    ensureStyleState(this);
    return original.currentFrame.call(this);
  };

  prototype.open = function (now) {
    ensurePreviewEntry(this);
    ensureStyleState(this);
    return original.open.call(this, now);
  };

  prototype.update = function (now) {
    // 状態更新は描画関数ではなくmenu.update()に集約する。
    // これによりWebシミュレーターとCTRPF実装で同じ「tick→draw」の責務分離を維持できる。
    const result = original.update.call(this, now);
    updateStyleLifecycle(this, now);
    return result;
  };

  prototype.handle = function (key, now, pressed = true, repeated = false) {
    ensurePreviewEntry(this);
    const state = ensureStyleState(this);

    if (!isStyleUiOperable(this) || !CAPTURED_KEYS.has(key)) {
      return original.handle.call(this, key, now, pressed, repeated);
    }

    // 独自UIでも入力経路は既存menu.handle()へ一本化する。
    // UI表示中のデジタル入力はここで消費し、ゲーム本体へは渡さない契約。
    if (pressed && !repeated) this.heldControls.add(key);
    else if (!pressed) this.heldControls.delete(key);
    this.releaseInactiveHotkeys?.();

    if (!pressed) {
      if (key === "up" || key === "down") state.selectionBoundaryBlockedDirection = 0;
      return true;
    }

    if (key === "up") moveStyleSelection(this, -1, now, !repeated);
    else if (key === "down") moveStyleSelection(this, 1, now, !repeated);
    else if (key === "left") changeStyleValue(this, -1, now);
    else if (key === "right") changeStyleValue(this, 1, now);
    else if (key === "a" && !repeated) {
      state.activationBounceStartedAt = now;
      changeStyleValue(this, 1, now);
    }
    return true;
  };

  prototype.gameInputCaptureState = function () {
    const base = original.gameInputCaptureState.call(this);
    if (!isStyleUiOperable(this)) return base;
    return { ...base, active: true, blockGameButtons: true };
  };

  prototype.stylePreviewValue = function (index) {
    return currentStyleValue(this, index);
  };

  const api = Object.freeze({
    STYLE_FIELDS,
    DEFAULT_VALUES,
    STYLE_UI,
    ensurePreviewEntry,
    previewEntry,
    previewItem,
    isPreviewEnabled,
    createStyleState,
    ensureStyleState,
    isStyleUiOperable,
    panelAmount,
    setPanelVisible,
    updateStyleLifecycle,
    selectionPosition,
    moveStyleSelection,
    selectionBoundaryBounceOffset,
    changeStyleValue,
    valueBounceOffset,
    activationBounceOffset,
    currentStyleValue
  });

  if (root) root.ACNLStylePreviewModel = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
