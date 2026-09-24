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
    hint: "#91a097",
    markerPanel: "rgba(7, 9, 8, .66)",
    markerBorder: "rgba(255, 255, 255, .42)"
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

  function drawPixelBorder(context, x, y, width, height, color) {
    // CTRPFへ移植しやすいよう、strokeではなく整数座標の1px矩形4本で枠を構成する。
    x = Math.round(x);
    y = Math.round(y);
    width = Math.max(1, Math.round(width));
    height = Math.max(1, Math.round(height));
    context.fillStyle = color;
    context.fillRect(x, y, width, 1);
    if (height > 1) context.fillRect(x, y + height - 1, width, 1);
    if (height > 2) {
      context.fillRect(x, y + 1, 1, height - 2);
      if (width > 1) context.fillRect(x + width - 1, y + 1, 1, height - 2);
    }
  }

  function panelX(amount) {
    return Math.round(-PANEL.width + (PANEL.x + PANEL.width) * amount);
  }

  function drawPanel(context, menu, font, now = 0, amount = 1) {
    if (!context || !menu || amount <= 0) return;
    const state = model.ensureStyleState(menu);
    const x = panelX(amount);
    const activationOffset = model.activationBounceOffset(menu, now);

    context.save();
    context.globalAlpha *= amount;
    context.fillStyle = COLORS.panel;
    context.fillRect(x, PANEL.y, PANEL.width, PANEL.height);
    drawPixelBorder(context, x, PANEL.y, PANEL.width, PANEL.height, COLORS.border);
    context.fillStyle = COLORS.border;
    context.fillRect(x, PANEL.y, 2, PANEL.height);

    drawBitmapText(context, font, "スタイル変更", x + 8, PANEL.y + 7, COLORS.header);
    drawBitmapText(context, font, "十字キー+A", x + 83, PANEL.y + 7, COLORS.sub);

    const selectionY = PANEL.rowY + model.selectionPosition(menu, now) * PANEL.rowHeight + model.selectionBoundaryBounceOffset(menu, now);
    context.fillStyle = COLORS.selected;
    context.fillRect(x + 5 + Math.round(activationOffset), Math.round(selectionY), PANEL.width - 10, PANEL.rowHeight - 2);
    drawPixelBorder(
      context,
      x + 5 + Math.round(activationOffset),
      Math.round(selectionY),
      PANEL.width - 10,
      PANEL.rowHeight - 2,
      COLORS.selectedBorder
    );

    model.STYLE_FIELDS.forEach((field, index) => {
      const y = PANEL.rowY + index * PANEL.rowHeight;
      const selected = index === state.selectedIndex;
      if (!selected) {
        context.fillStyle = COLORS.row;
        context.fillRect(x + 5, y, PANEL.width - 10, PANEL.rowHeight - 2);
      }

      drawBitmapText(context, font, field.label, x + 11, y + 4, selected ? COLORS.selectedLabel : COLORS.label);
      const value = model.currentStyleValue(menu, index);
      const display = `<${value}>`;
      const valueWidth = measureBitmapText(font, display);
      const valueOffset = model.valueBounceOffset(menu, index, now);
      drawBitmapText(context, font, display, x + PANEL.width - 10 - valueWidth + valueOffset, y + 13, COLORS.value);
    });

    drawBitmapText(context, font, "上下:項目", x + 8, PANEL.y + PANEL.height - 16, COLORS.hint);
    drawBitmapText(context, font, "左右/A:変更", x + 78, PANEL.y + PANEL.height - 16, COLORS.hint);
    context.restore();
  }

  function drawAfterMarker(context, font, amount = 1) {
    if (!context || amount <= 0) return;
    const x = 259;
    const y = 10;
    const width = 53;
    const height = 14;
    context.save();
    context.globalAlpha *= amount;
    context.fillStyle = COLORS.markerPanel;
    context.fillRect(x, y, width, height);
    drawPixelBorder(context, x, y, width, height, COLORS.markerBorder);
    drawBitmapText(context, font, "AFTER", x + 16, y + 3, "#ffffff");
    context.restore();
  }

  function drawPreview(context, image, menu, font, showUi = true, now = 0, amount = 1) {
    if (!context || !image || !menu) return false;
    context.save();
    context.globalAlpha = 1;
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0, data.image.width, data.image.height);
    if (showUi) {
      drawPanel(context, menu, font, now, amount);
      drawAfterMarker(context, font, amount);
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

    const now = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : 0;
    const amount = model.panelAmount(menu, now);

    // 描画関数は状態を変更しない。表示/非表示の遷移はmenu.update()側で決定済みの値だけを参照する。
    return drawPreview(context, image, menu, font, amount > 0.001, now, amount);
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
    drawPixelBorder,
    panelX,
    drawPanel,
    drawAfterMarker,
    drawPreviewMarker: drawAfterMarker,
    drawPreview,
    drawIfActive,
    imageReady,
    getSourceImage
  });

  if (root) root.ACNLStylePreview = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (typeof document !== "undefined") ensureSourceImage();
})(typeof globalThis !== "undefined" ? globalThis : this);
