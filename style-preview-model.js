"use strict";

(function (root) {
  const core = typeof module !== "undefined" && module.exports ? require("./ui-model.js") : root.CTRPFUiModel;
  if (!core?.CheatMenuModel) return;

  const { MENU, LISTBOX, clamp, easeOutCubic, mix, listboxAmount, listboxScrollPosition } = core;
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
  const CAPTURED_KEYS = new Set(["up", "down", "left", "right", "a", "b", "x", "y", "l", "r", "zl", "zr", "select", "start"]);

  const originalCurrentFrame = prototype.currentFrame;
  const originalOpen = prototype.open;
  const originalHandle = prototype.handle;
  const originalGameInputCaptureState = prototype.gameInputCaptureState;

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

  function ensureStyleState(menu) {
    if (!menu.stylePreviewState) {
      menu.stylePreviewState = {
        selectedIndex: 0,
        selectionFrom: 0,
        selectionTo: 0,
        selectionStartedAt: 0,
        selectionBoundaryBounceDirection: 0,
        selectionBoundaryBounceStartedAt: Number.NEGATIVE_INFINITY,
        selectionBoundaryBlockedDirection: 0,
        activationBounceStartedAt: Number.NEGATIVE_INFINITY,
        values: [...DEFAULT_VALUES],
        revision: 0,
        inlineList: null,
        panelFrom: 0,
        panelTarget: 0,
        panelStartedAt: 0
      };
    }
    return menu.stylePreviewState;
  }

  function wrapIndex(index, count) {
    if (!count) return 0;
    return ((Math.round(index) % count) + count) % count;
  }

  function selectionPosition(menu, now = 0) {
    const state = ensureStyleState(menu);
    const progress = easeOutCubic((now - state.selectionStartedAt) / MENU.selectionMoveDuration);
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

    // CTRPF移植時も入力値は即時更新し、描画位置だけを「現在の補間位置→次の行」で100ms補間する。
    // 連打中に前アニメーションが完了していなくても不連続に飛ばないための状態分離。
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
    if (elapsed < 0 || elapsed >= MENU.selectionMoveDuration) return 0;
    const progress = elapsed / MENU.selectionMoveDuration;
    const amount = progress < 0.28
      ? easeOutCubic(progress / 0.28)
      : 1 - easeOutCubic((progress - 0.28) / 0.72);
    return amount === 0 ? 0 : state.selectionBoundaryBounceDirection * 4 * amount;
  }

  function activationBounceOffset(menu, now = 0) {
    const state = ensureStyleState(menu);
    const elapsed = now - state.activationBounceStartedAt;
    if (elapsed < 0 || elapsed >= MENU.activationBounceDuration) return 0;
    const progress = elapsed / MENU.activationBounceDuration;
    const amount = progress < 0.3
      ? easeOutCubic(progress / 0.3)
      : 1 - easeOutCubic((progress - 0.3) / 0.7);
    return 3 * amount;
  }

  function styleListScrollTarget(index, itemCount, visibleRows) {
    return clamp(index - Math.floor(visibleRows / 2), 0, Math.max(0, itemCount - visibleRows));
  }

  function openStyleList(menu, now = 0) {
    const state = ensureStyleState(menu);
    const field = STYLE_FIELDS[state.selectedIndex];
    if (!field || state.inlineList) return false;
    const selected = wrapIndex(state.values[state.selectedIndex], field.options.length);
    const visibleRows = Math.min(LISTBOX.inlineVisibleRows, field.options.length);
    const initialScroll = styleListScrollTarget(selected, field.options.length, visibleRows);
    state.activationBounceStartedAt = now;

    // 通常メニューのinline listと同じ状態構造を使う。
    // CTRPF移植時はanimationFrom/Target/StartedAtを時刻差で補間し、Web固有APIは不要。
    state.inlineList = {
      fieldIndex: state.selectedIndex,
      index: selected,
      visibleRows,
      animationFrom: 0,
      animationTarget: 1,
      animationStartedAt: now,
      animationDuration: LISTBOX.animationDuration,
      closing: false,
      scrollFrom: initialScroll,
      scrollTarget: initialScroll,
      scrollStartedAt: now
    };
    return true;
  }

  function closeStyleList(menu, now = 0) {
    const state = ensureStyleState(menu);
    const list = state.inlineList;
    if (!list || list.closing) return false;
    const current = listboxAmount(list, now);
    list.animationFrom = current;
    list.animationTarget = 0;
    list.animationStartedAt = now;
    list.animationDuration = LISTBOX.animationDuration * current;
    list.closing = true;
    return true;
  }

  function updateStyleState(menu, now = 0) {
    const state = ensureStyleState(menu);
    const list = state.inlineList;
    if (list?.closing && now - list.animationStartedAt >= list.animationDuration) state.inlineList = null;
    return state;
  }

  function moveStyleListSelection(menu, direction, now = 0, allowWrap = true) {
    const state = ensureStyleState(menu);
    const list = state.inlineList;
    if (!list || list.closing) return false;
    const field = STYLE_FIELDS[list.fieldIndex];
    if (!field) return false;
    const next = list.index + direction;
    if (!allowWrap && (next < 0 || next >= field.options.length)) return false;
    list.scrollFrom = listboxScrollPosition(list, now);
    list.index = wrapIndex(next, field.options.length);
    list.scrollTarget = styleListScrollTarget(list.index, field.options.length, list.visibleRows);
    list.scrollStartedAt = now;
    return true;
  }

  function confirmStyleList(menu, now = 0) {
    const state = ensureStyleState(menu);
    const list = state.inlineList;
    if (!list || list.closing) return false;
    const previous = state.values[list.fieldIndex];
    state.values[list.fieldIndex] = list.index;
    if (previous !== list.index) state.revision += 1;
    closeStyleList(menu, now);
    return true;
  }

  function currentStyleValue(menu, index) {
    const state = ensureStyleState(menu);
    const field = STYLE_FIELDS[index];
    if (!field) return "";
    return field.options[wrapIndex(state.values[index], field.options.length)];
  }

  function panelAmount(menu, now = 0) {
    const state = ensureStyleState(menu);
    const progress = easeOutCubic((now - state.panelStartedAt) / MENU.enterDuration);
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
    const state = ensureStyleState(this);
    state.inlineList = null;
    state.selectionBoundaryBlockedDirection = 0;
    return originalOpen.call(this, now);
  };

  prototype.handle = function (key, now, pressed = true, repeated = false) {
    ensurePreviewEntry(this);
    const state = ensureStyleState(this);
    updateStyleState(this, now);

    if (!isStyleUiOperable(this) || !CAPTURED_KEYS.has(key)) {
      return originalHandle.call(this, key, now, pressed, repeated);
    }

    // スタイルUI表示中は通常メニューと同様にゲームボタンをUIが占有する。
    // CTRPF側でもこの分岐に入ったボタンはゲーム本体へ渡さない。
    if (pressed && !repeated) this.heldControls.add(key);
    else if (!pressed) this.heldControls.delete(key);
    this.releaseInactiveHotkeys?.();

    if (!pressed) {
      if (key === "up" || key === "down") state.selectionBoundaryBlockedDirection = 0;
      return true;
    }

    if (state.inlineList) {
      if (state.inlineList.closing) return true;
      if (key === "up") moveStyleListSelection(this, -1, now, !repeated);
      else if (key === "down") moveStyleListSelection(this, 1, now, !repeated);
      else if (key === "a" && !repeated) confirmStyleList(this, now);
      else if (key === "b" && !repeated) closeStyleList(this, now);
      return true;
    }

    if (key === "up") moveStyleSelection(this, -1, now, !repeated);
    else if (key === "down") moveStyleSelection(this, 1, now, !repeated);
    else if (key === "a" && !repeated) openStyleList(this, now);
    return true;
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
    selectionPosition,
    moveStyleSelection,
    selectionBoundaryBounceOffset,
    activationBounceOffset,
    openStyleList,
    closeStyleList,
    updateStyleState,
    moveStyleListSelection,
    confirmStyleList,
    currentStyleValue,
    panelAmount,
    setPanelVisible,
    isStyleUiOperable
  });

  if (root) root.ACNLStylePreviewModel = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
