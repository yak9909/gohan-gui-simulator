"use strict";

(function (root) {
  const data = typeof module !== "undefined" && module.exports
    ? require("./style-preview-data.js")
    : root.ACNL_STYLE_PREVIEW_DATA;
  const model = typeof module !== "undefined" && module.exports
    ? require("./style-preview-model.js")
    : root.ACNLStylePreviewModel;
  if (!data || !model) return;

  const PANEL = Object.freeze({
    x: 8,
    y: 12,
    width: 154,
    height: 184,
    rowY: 38,
    rowHeight: 23
  });
  const COLORS = Object.freeze({
    panel: "rgba(7, 9, 8, .80)",
    border: "rgba(99, 228, 164, .90)",
    header: "#ffffff",
    sub: "#9bb4a4",
    row: "rgba(14, 19, 16, .58)",
    selected: "rgba(41, 69, 55, .82)",
    selectedBorder: "#63e4a4",
    label: "#c4cec7",
    selectedLabel: "#ffffff",
    value: "#8ff0b7",
    hint: "#91a097"
  });

  let sourceImage = null;

  function measureBitmapText(font, text) {
    let width = 0;
    for (const character of Array.from(String(text))) {
      const glyph = font?.glyphs?.[String(character.codePointAt(0))];
      width += glyph ? glyph.advance : 4;
    }
    return width;
  }

  function drawBitmapText(context, font, text, x, y, color) {
    let cursor = Math.round(x);
    context.fillStyle = color;
    for (const character of Array.from(String(text))) {
      const glyph = font?.glyphs?.[String(character.codePointAt(0))];
      if (!glyph) {
        cursor += 4;
        continue;
      }
      for (let row = 0; row < glyph.height; row++) {
        const bits = glyph.rows[row];
        for (let column = 0; column < glyph.width; column++) {
          if (bits & (1 << column)) {
            context.fillRect(cursor + glyph.offsetX + column, Math.round(y) + glyph.offsetY + row, 1, 1);
          }
        }
      }
      cursor += glyph.advance;
    }
    return cursor;
  }

  function drawPanel(context, menu, font) {
    const state = model.ensureStyleState(menu);
    const panel = PANEL;

    context.save();
    context.fillStyle = COLORS.panel;
    context.fillRect(panel.x, panel.y, panel.width, panel.height);
    context.strokeStyle = COLORS.border;
    context.lineWidth = 1;
    context.strokeRect(panel.x + 0.5, panel.y + 0.5, panel.width - 1, panel.height - 1);
    context.fillStyle = COLORS.border;
    context.fillRect(panel.x, panel.y, 2, panel.height);

    drawBitmapText(context, font, "STYLE CHANGE", panel.x + 8, panel.y + 7, COLORS.header);
    drawBitmapText(context, font, "D-PAD + A", panel.x + 91, panel.y + 7, COLORS.sub);

    model.STYLE_FIELDS.forEach((field, index) => {
      const y = panel.rowY + index * panel.rowHeight;
      const selected = index === state.selectedIndex;
      context.fillStyle = selected ? COLORS.selected : COLORS.row;
      context.fillRect(panel.x + 5, y, panel.width - 10, panel.rowHeight - 2);
      if (selected) {
        context.strokeStyle = COLORS.selectedBorder;
        context.strokeRect(panel.x + 5.5, y + 0.5, panel.width - 11, panel.rowHeight - 3);
      }

      drawBitmapText(context, font, field.label, panel.x + 11, y + 4, selected ? COLORS.selectedLabel : COLORS.label);
      const value = model.currentStyleValue(menu, index);
      const display = `<${value}>`;
      const valueWidth = measureBitmapText(font, display);
      drawBitmapText(context, font, display, panel.x + panel.width - 10 - valueWidth, y + 13, COLORS.value);
    });

    drawBitmapText(context, font, "UP/DN ITEM", panel.x + 8, panel.y + panel.height - 16, COLORS.hint);
    drawBitmapText(context, font, "LR/A VALUE", panel.x + 83, panel.y + panel.height - 16, COLORS.hint);
    context.restore();
  }

  function drawAfterMarker(context, font) {
    const x = 259;
    const y = 10;
    context.save();
    context.fillStyle = "rgba(7, 9, 8, .66)";
    context.fillRect(x, y, 53, 14);
    context.strokeStyle = "rgba(255, 255, 255, .42)";
    context.strokeRect(x + 0.5, y + 0.5, 52, 13);
    drawBitmapText(context, font, "AFTER", x + 16, y + 3, "#ffffff");
    context.restore();
  }

  function drawPreview(context, image, menu, font, showUi = true) {
    if (!context || !image || !menu) return false;
    context.save();
    context.globalAlpha = 1;
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0, data.image.width, data.image.height);
    if (showUi) {
      drawPanel(context, menu, font);
      drawAfterMarker(context, font);
    }
    context.restore();
    return true;
  }

  function ensureSourceImage() {
    if (sourceImage || typeof Image === "undefined") return sourceImage;
    sourceImage = new Image();
    sourceImage.decoding = "async";
    sourceImage.src = `data:${data.image.mime};base64,${data.image.base64}`;
    return sourceImage;
  }

  function imageReady(image = sourceImage) {
    return Boolean(image && image.complete && image.naturalWidth === data.image.width && image.naturalHeight === data.image.height);
  }

  function drawIfActive(context, menu, font) {
    if (!model.isPreviewEnabled(menu)) return false;
    const image = ensureSourceImage();
    if (!imageReady(image)) return false;
    const showUi = !menu.visible && !menu.dialog && !menu.overlay && !menu.inlineList;
    return drawPreview(context, image, menu, font, showUi);
  }

  function getSourceImage() {
    return ensureSourceImage();
  }

  const api = Object.freeze({
    PANEL,
    COLORS,
    data,
    measureBitmapText,
    drawBitmapText,
    drawPanel,
    drawAfterMarker,
    drawPreview,
    drawIfActive,
    imageReady,
    getSourceImage
  });

  if (root) root.ACNLStylePreview = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (typeof document !== "undefined") ensureSourceImage();
})(typeof globalThis !== "undefined" ? globalThis : this);
