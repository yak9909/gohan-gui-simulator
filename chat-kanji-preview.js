"use strict";

(function (root) {
  const data = typeof module !== "undefined" && module.exports
    ? require("./chat-kanji-preview-data.js")
    : root.ACNL_CHAT_KANJI_PREVIEW_DATA;
  if (!data) return;

  const CANDIDATE_BAR = Object.freeze({ x: 10, y: 47, width: 300, height: 18, gap: 2, paddingX: 5, textCellY: 44 });
  const CANDIDATE_COLORS = Object.freeze({
    panel: "rgba(255, 247, 214, 0.97)",
    border: "#80532d",
    separator: "rgba(128, 83, 45, 0.42)",
    selected: "rgba(198, 227, 181, 0.96)",
    text: "#513313",
    selectedText: "#234d23"
  });

  function previewItem(menu) {
    return menu?.rootItems?.find((entry) => entry?.previewKind === "chat-kanji") || null;
  }

  function isPreviewEnabled(menu) {
    return previewItem(menu)?.appliedValue === true;
  }

  function measureBcfntText(text, fontData = data) {
    let width = 0;
    for (const character of Array.from(String(text))) width += fontData.glyphs[character]?.charWidth ?? fontData.source.fontCell[0];
    return width;
  }

  function drawBcfntGlyph(context, glyph, x, cellY, color) {
    if (!glyph) return 0;
    const baseAlpha = context.globalAlpha;
    context.fillStyle = color;
    for (let row = 0; row < glyph.rows.length; row++) {
      const pixels = glyph.rows[row];
      for (let column = 0; column < pixels.length; column++) {
        const alpha = parseInt(pixels[column], 16);
        if (!alpha) continue;
        context.globalAlpha = baseAlpha * alpha / 15;
        context.fillRect(Math.round(x) + glyph.left + column, Math.round(cellY) + row, 1, 1);
      }
    }
    context.globalAlpha = baseAlpha;
    return glyph.charWidth;
  }

  function drawBcfntText(context, text, x, cellY, color, fontData = data) {
    let cursor = Math.round(x);
    for (const character of Array.from(String(text))) {
      const glyph = fontData.glyphs[character];
      cursor += glyph ? drawBcfntGlyph(context, glyph, cursor, cellY, color) : fontData.source.fontCell[0];
    }
    return cursor;
  }

  function drawCandidateBar(context, selectedIndex = 0, fontData = data) {
    const candidates = fontData.candidates;
    const bar = CANDIDATE_BAR;
    const cellWidth = (bar.width - bar.gap * (candidates.length - 1)) / candidates.length;

    context.save();
    context.fillStyle = CANDIDATE_COLORS.panel;
    context.fillRect(bar.x, bar.y, bar.width, bar.height);
    context.strokeStyle = CANDIDATE_COLORS.border;
    context.strokeRect(bar.x + 0.5, bar.y + 0.5, bar.width - 1, bar.height - 1);

    candidates.forEach((candidate, index) => {
      const x = bar.x + index * (cellWidth + bar.gap);
      if (index === selectedIndex) {
        context.fillStyle = CANDIDATE_COLORS.selected;
        context.fillRect(Math.round(x + 1), bar.y + 1, Math.round(cellWidth - 2), bar.height - 2);
      }
      if (index > 0) {
        context.fillStyle = CANDIDATE_COLORS.separator;
        context.fillRect(Math.round(x - bar.gap / 2), bar.y + 3, 1, bar.height - 6);
      }
      const textWidth = measureBcfntText(candidate, fontData);
      const textX = x + Math.max(bar.paddingX, (cellWidth - textWidth) / 2);
      drawBcfntText(
        context,
        candidate,
        textX,
        bar.textCellY,
        index === selectedIndex ? CANDIDATE_COLORS.selectedText : CANDIDATE_COLORS.text,
        fontData
      );
    });
    context.restore();
  }

  function drawPreview(context, sourceImage, selectedIndex = 0, fontData = data) {
    if (!context || !sourceImage) return false;
    context.save();
    context.imageSmoothingEnabled = false;
    context.globalAlpha = 1;
    context.drawImage(sourceImage, 0, 0, fontData.image.width, fontData.image.height);
    drawCandidateBar(context, selectedIndex, fontData);
    context.restore();
    return true;
  }

  function install() {
    if (typeof document === "undefined" || typeof Image === "undefined") return;
    const canvas = document.getElementById("bottomScreen");
    if (!canvas) return;
    const context = canvas.getContext("2d");
    const sourceImage = new Image();
    sourceImage.decoding = "async";
    sourceImage.src = `data:${data.image.mime};base64,${data.image.base64}`;

    function frame() {
      requestAnimationFrame(frame);
      const menu = root.__gohanMenuModel;
      if (!menu || !isPreviewEnabled(menu) || !sourceImage.complete || sourceImage.naturalWidth !== data.image.width) return;
      // Existing operable bottom-screen UI takes priority over the passive preview.
      if (menu.overlay?.screen === "bottom") return;
      drawPreview(context, sourceImage, 0, data);
    }
    requestAnimationFrame(frame);
  }

  const api = Object.freeze({
    CANDIDATE_BAR,
    CANDIDATE_COLORS,
    previewItem,
    isPreviewEnabled,
    measureBcfntText,
    drawBcfntGlyph,
    drawBcfntText,
    drawCandidateBar,
    drawPreview,
    install
  });
  if (root) root.ACNLChatKanjiPreview = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
    else install();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
