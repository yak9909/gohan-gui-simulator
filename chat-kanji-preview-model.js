"use strict";

(function (root) {
  const core = typeof module !== "undefined" && module.exports ? require("./ui-model.js") : root.CTRPFUiModel;
  if (!core?.CheatMenuModel) return;

  const prototype = core.CheatMenuModel.prototype;
  if (prototype.__chatKanjiPreviewPatchApplied) {
    if (typeof module !== "undefined" && module.exports) module.exports = root?.ACNLChatKanjiPreviewModel || {};
    return;
  }

  const originalCurrentFrame = prototype.currentFrame;
  const originalOpen = prototype.open;

  function previewEntry() {
    return {
      id: "chat-kanji-preview",
      type: "checkbox",
      label: "漢字変換プレビュー",
      description: "とび森のチャット下画面に漢字変換候補欄をプレビュー表示します。",
      value: false,
      appliedValue: false,
      hotkey: "なし",
      appliedHotkey: "なし",
      favoriteKey: "漢字変換プレビュー",
      previewKind: "chat-kanji"
    };
  }

  function ensurePreviewEntry(menu) {
    if (!menu?.rootItems || menu.rootItems.some((entry) => entry?.previewKind === "chat-kanji")) return false;
    const insertAt = menu.rootItems.findIndex((entry) => entry?.action === "chat-kanji");
    menu.rootItems.splice(insertAt >= 0 ? insertAt : menu.rootItems.length, 0, previewEntry());
    return true;
  }

  Object.defineProperty(prototype, "__chatKanjiPreviewPatchApplied", { value: true });

  prototype.currentFrame = function () {
    ensurePreviewEntry(this);
    return originalCurrentFrame.call(this);
  };

  prototype.open = function (now) {
    ensurePreviewEntry(this);
    return originalOpen.call(this, now);
  };

  const api = Object.freeze({ ensurePreviewEntry, previewEntry });
  if (root) root.ACNLChatKanjiPreviewModel = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
