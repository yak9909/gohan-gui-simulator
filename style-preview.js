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
  const ANIMATION = Object.freeze({
    introDuration: 180,
    selectionDuration: 140,
    valueDuration: 160
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
    valuePulse: "#ffffff",
    hint: "#91a097"
  });
  const UI_FONT = '9px "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif';
  const UI_FONT_BOLD = 'bold 9px "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif';

  let sourceImage = null;
  let previewWasActive = false;
  let previewActivatedAt = 0;

  function clamp(value, minimum = 0, maximum = 1) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function easeOutCubic(value) {
    const t = clamp(value);
    return 1 - Math.pow(1 - t, 3);
  }

  function mix(from, to, amount) {
    return from + (to - from) * amount;
  }

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

  function drawUiText(context, text, x, centerY, color, align = "left", bold = false) {
    context.font = bold ? UI_FONT_BOLD : UI_FONT;
    context.textAlign = align;
    context.textBaseline = "middle";
    context.fillStyle = color;
    context.fillText(String(text), Math.round(x), Math.round(centerY));
  }

  function selectionPosition(state, now) {
    const target = state.selectedIndex;
    let from = Number.isFinite(state.selectionFromIndex) ? state.selectionFromIndex : target;
    if (Math.abs(target - from) > 1 && state.selectionDirection) from = target - state.selectionDirection;
    const progress = easeOutCubic((now - (state.selectionStartedAt || 0)) / ANIMATION.selectionDuration);
    return mix(from, target, progress);
  }

  function valueAnimation(state, index, now) {
    if (state.lastChangedIndex !== index) return { offset: 0, pulse: 0 };
    const progress = clamp((now - state.lastChangedAt) / ANIMATION.valueDuration);
    if (progress >= 1) return { offset: 0, pulse: 0 };
    const eased = easeOutCubic(progress);
    return {
      offset: (state.lastChangeDirection || 1) * 5 * (1 - eased),
      pulse: 1 - eased
    };
  }

  function drawPanel(context, menu, font, now = 0, intro = 1) {
    const state = model.ensureStyleState(menu);
    const panel = PANEL;
    const introEase = easeOutCubic(intro);
    const rowX = panel.x + 5;
    const rowWidth = panel.width - 10;
    const rowHeight = panel.rowHeight - 2;

    context.save();
    context.globalAlpha *= introEase;
    context.translate(Math.round(-8 * (1 - introEase)), 0);

    context.fillStyle = COLORS.panel;
    context.fillRect(panel.x, panel.y, panel.width, panel.height);
    drawPixelBorder(context, panel.x, panel.y, panel.width, panel.height, COLORS.border);

    drawUiText(context, "スタイル変更", panel.x + 8, panel.y + 11, COLORS.header, "left", true);
    drawUiText(context, "十字+A", panel.x + panel.width - 8, panel.y + 11, COLORS.sub, "right");

    model.STYLE_FIELDS.forEach((field, index) => {
      const y = panel.rowY + index * panel.rowHeight;
      context.fillStyle = COLORS.row;
      context.fillRect(rowX, y, rowWidth, rowHeight);
    });

    context.save();
    context.beginPath();
    context.rect(rowX, panel.rowY, rowWidth, panel.rowHeight * model.STYLE_FIELDS.length - 2);
    context.clip();
    const highlightY = panel.rowY + selectionPosition(state, now) * panel.rowHeight;
    context.fillStyle = COLORS.selected;
    context.fillRect(rowX, Math.round(highlightY), rowWidth, rowHeight);
    drawPixelBorder(context, rowX, highlightY, rowWidth, rowHeight, COLORS.selectedBorder);
    context.restore();

    model.STYLE_FIELDS.forEach((field, index) => {
      const y = panel.rowY + index * panel.rowHeight;
      const centerY = y + rowHeight / 2;
      const selected = index === state.selectedIndex;
      drawUiText(context, field.label, panel.x + 11, centerY, selected ? COLORS.selectedLabel : COLORS.label, "left", selected);

      const value = model.currentStyleValue(menu, index);
      const animation = valueAnimation(state, index, now);
      drawUiText(
        context,
        value,
        panel.x + panel.width - 11 + animation.offset,
        centerY,
        animation.pulse > 0.35 ? COLORS.valuePulse : COLORS.value,
        "right",
        selected
      );
    });

    drawUiText(context, "上下:項目", panel.x + 8, panel.y + panel.height - 10, COLORS.hint, "left");
    drawUiText(context, "左右/A:変更", panel.x + panel.width - 8, panel.y + panel.height - 10, COLORS.hint, "right");
    context.restore();
  }

  function drawAfterMarker(context, font, intro = 1) {
    const x = 259;
    const y = 10;
    const width = 53;
    const height = 14;
    const introEase = easeOutCubic(intro);
    context.save();
    context.globalAlpha *= introEase;
    context.translate(Math.round(6 * (1 - introEase)), 0);
    context.fillStyle = "rgba(7, 9, 8, .66)";
    context.fillRect(x, y, width, height);
    drawPixelBorder(context, x, y, width, height, "rgba(255, 255, 255, .42)");
    drawUiText(context, "変更後", x + width / 2, y + height / 2, "#ffffff", "center", true);
    context.restore();
  }

  function drawPreview(context, image, menu, font, showUi = true, now = 0, intro = 1) {
    if (!context || !image || !menu) return false;
    context.save();
    context.globalAlpha = 1;
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0, data.image.width, data.image.height);
    if (showUi) {
      drawPanel(context, menu, font, now, intro);
      drawAfterMarker(context, font, intro);
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
    const active = model.isPreviewEnabled(menu);
    if (!active) {
      previewWasActive = false;
      return false;
    }
    const image = ensureSourceImage();
    if (!imageReady(image)) return false;
    const now = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : 0;
    if (!previewWasActive) {
      previewWasActive = true;
      previewActivatedAt = now;
    }
    const intro = clamp((now - previewActivatedAt) / ANIMATION.introDuration);
    const showUi = !menu.visible && !menu.dialog && !menu.overlay && !menu.inlineList;
    return drawPreview(context, image, menu, font, showUi, now, intro);
  }

  function getSourceImage() {
    return ensureSourceImage();
  }

  const api = Object.freeze({
    PANEL,
    ANIMATION,
    COLORS,
    data,
    measureBitmapText,
    drawBitmapText,
    drawPixelBorder,
    drawUiText,
    selectionPosition,
    valueAnimation,
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
