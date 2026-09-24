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
    Object.freeze({ key: "hairStyle", label: "髪型", options: Object.freeze(["1番", "2番", "3番", "4番", "5番", "6番", "7番", "8番"]) }),
    Object.freeze({ key: "hairColor", label: "髪色", options: Object.freeze(["緑", "茶", "黒", "金", "赤", "青", "桃", "白"]) }),
    Object.freeze({ key: "eyeShape", label: "目の形", options: Object.freeze(["1番", "2番", "3番", "4番", "5番", "6番", "7番", "8番"]) }),
    Object.freeze({ key: "eyeColor", label: "目の色", options: Object.freeze(["青", "緑", "茶", "黒", "灰", "紫"]) }),
    Object.freeze({ key: "gender", label: "性別", options: Object.freeze(["男", "女"]) }),
    Object.freeze({ key: "headwear", label: "頭衣装", options: Object.freeze(["表示", "非表示"]) })
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
      description: "髪型・髪色・目・性別・頭衣装を上画面でプレビューします。",
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

        // CTRPF移植時も「現在選択中の項目」と「アニメーション開始位置」を分けて持つ。
        // selectedIndexを入力直後に更新しつつ、描画側はselectionFromIndexから補間することで、
        // 入力判定を遅延させずに選択枠だけを滑らかに移動できる。
        selectionFromIndex: 0,
        selectionDirection: 0,
        selectionStartedAt: 0,

        values: [...DEFAULT_VALUES],
        revision: 0,

        // 値変更アニメーション用の最小状態。
        // CTRPFではフレームごとに現在時刻を取得し、lastChangedAtとの差から表示オフセットを計算する。
        // ブラウザ固有のanimation APIには依存させない設計にしている。
        lastChangedIndex: -1,
        lastChangeDirection: 0,
        lastChangedAt: 0
      };
    }
    return menu.stylePreviewState;
  }

  function wrapIndex(index, count) {
    if (!count) return 0;
    return ((Math.round(index) % count) + count) % count;
  }

  function moveStyleSelection(menu, direction, now = 0) {
    const state = ensureStyleState(menu);
    const previous = state.selectedIndex;
    const next = wrapIndex(previous + direction, STYLE_FIELDS.length);

    // 入力時点の選択位置と時刻を記録するだけにし、補間そのものは描画側で行う。
    // この分離によりCTRPFへ移植する際も、入力処理と描画処理を独立させられる。
    state.selectionFromIndex = previous;
    state.selectionDirection = Math.sign(direction) || 0;
    state.selectionStartedAt = now;
    state.selectedIndex = next;
    return state.selectedIndex;
  }

  function changeStyleValue(menu, direction, now = 0) {
    const state = ensureStyleState(menu);
    const field = STYLE_FIELDS[state.selectedIndex];
    if (!field) return false;
    const previous = state.values[state.selectedIndex] || 0;
    state.values[state.selectedIndex] = wrapIndex(previous + direction, field.options.length);
    state.revision += 1;

    // 表示値自体は即時更新し、どの項目をどちら向きに変更したかだけを描画用に残す。
    // CTRPF側でも同じ3値を保持すれば、Web側と同じ値スライド演出を再現できる。
    state.lastChangedIndex = state.selectedIndex;
    state.lastChangeDirection = Math.sign(direction) || 1;
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
      if (key === "up") moveStyleSelection(this, -1, now);
      else if (key === "down") moveStyleSelection(this, 1, now);
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
