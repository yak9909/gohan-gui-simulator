"use strict";

(function (root) {
  const core = typeof module !== "undefined" && module.exports
    ? require("./ui-model.js")
    : root.CTRPFUiModel;
  const data = typeof module !== "undefined" && module.exports
    ? require("./style-preview-data.js")
    : root.ACNL_STYLE_PREVIEW_DATA;
  const model = typeof module !== "undefined" && module.exports
    ? require("./style-preview-model.js")
    : root.ACNLStylePreviewModel;
  if (!core || !data || !model) return;

  const { MENU, clamp, mix, selectionPulse, selectionOutlinePulse, listboxAmount, listboxScrollPosition } = core;
  const PANEL = Object.freeze({ x: 0, y: 0, width: MENU.width, height: 240, rowY: 28, rowHeight: MENU.itemHeight });
  const ANIMATION = Object.freeze({
    introDuration: MENU.enterDuration,
    selectionDuration: MENU.selectionMoveDuration,
    valueDuration: MENU.valueBounceDuration
  });
  const COLORS = Object.freeze({
    panel: "rgba(12, 16, 13, .78)",
    edge: "rgba(99, 228, 164, .90)",
    header: "rgba(28, 43, 34, .74)",
    footer: "rgba(21, 27, 23, .76)",
    selected: "41, 69, 55",
    selectedBorder: "99, 228, 164",
    text: "#aeb9b1",
    selectedText: "#ffffff",
    value: "#aeb9b1",
    selectedValue: "#ffffff",
    accent: "#63e4a4",
    hint: "#829087",
    listPanel: "rgba(10, 13, 11, .82)",
    listSelected: "rgba(41, 69, 55, .64)",
    listBorder: "#63e4a4",
    markerBorder: "#4f6c5b"
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
    // Canvasのstrokeは半ピクセル補正に依存するため、CTRPFへそのまま移しやすい4本の1px矩形で枠を作る。
    // これならシミュレーターと実機で上下左右の線幅を同じ整数ピクセルに固定できる。
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

  function drawScrollBar(context, x, y, height, visibleRows, itemCount, scrollPosition) {
    if (itemCount <= visibleRows) return;
    const thumbHeight = Math.max(10, Math.floor(height * visibleRows / itemCount));
    const maximumScroll = itemCount - visibleRows;
    const thumbY = y + Math.round((height - thumbHeight) * clamp(scrollPosition / maximumScroll, 0, 1));
    context.fillStyle = "rgba(38, 52, 44, .66)";
    context.fillRect(x, y, 2, height);
    context.fillStyle = "rgba(99, 228, 164, .88)";
    context.fillRect(x, thumbY, 2, thumbHeight);
  }

  function drawPreviewMarker(context, font, amount) {
    if (amount <= 0) return;
    const x = 253;
    const y = 8;
    const width = 72;
    const height = 28;
    context.save();
    context.globalAlpha *= amount;
    context.fillStyle = COLORS.listPanel;
    context.fillRect(x, y, width, height);
    drawPixelBorder(context, x, y, width, height, COLORS.markerBorder);
    drawBitmapText(context, font, "変更モデル", x + 8, y + 6, COLORS.accent);
    drawBitmapText(context, font, "プレビュー", x + 8, y + 17, COLORS.text);
    context.restore();
  }

  function drawInlineList(context, menu, font, menuX, now) {
    const state = model.ensureStyleState(menu);
    const list = state.inlineList;
    if (!list) return;
    const field = model.STYLE_FIELDS[list.fieldIndex];
    if (!field) return;
    const amount = listboxAmount(list, now);
    if (amount <= 0) return;

    const visibleRows = Math.min(list.visibleRows, field.options.length);
    const height = visibleRows * 14 + 6;
    const row = list.fieldIndex;
    const y = Math.min(28 + row * MENU.itemHeight + 14, 212 - height);
    const x = Math.round(mix(menuX + MENU.width, menuX + 21, amount));
    const scrollPosition = listboxScrollPosition(list, now);

    // 通常メニューのinline listと同一の座標・速度・色を使う。
    // CTRPF移植時も「親行の直下から左へスライド」「14px行」という関係を維持する。
    context.save();
    context.globalAlpha *= amount;
    context.fillStyle = COLORS.listPanel;
    context.fillRect(x, y, 132, height);
    drawPixelBorder(context, x, y, 132, height, COLORS.listBorder);
    context.beginPath();
    context.rect(x + 2, y + 2, 125, height - 4);
    context.clip();

    const firstIndex = Math.max(0, Math.floor(scrollPosition));
    const lastIndex = Math.min(field.options.length - 1, Math.ceil(scrollPosition) + visibleRows);
    for (let index = firstIndex; index <= lastIndex; index++) {
      const rowY = Math.round(y + 3 + (index - scrollPosition) * 14);
      if (index === list.index) {
        context.fillStyle = COLORS.listSelected;
        context.fillRect(x + 3, rowY, 122, 12);
      }
      drawBitmapText(context, font, field.options[index], x + 8, rowY + 2, index === list.index ? COLORS.selectedText : COLORS.text);
    }
    context.restore();
    drawScrollBar(context, x + 128, y + 3, height - 6, visibleRows, field.options.length, scrollPosition);
  }

  function drawPanel(context, menu, font, now = 0, amount = 1) {
    const state = model.updateStyleState(menu, now);
    if (amount <= 0) return;
    const menuX = Math.round(-MENU.width + MENU.width * amount);
    const activationOffset = model.activationBounceOffset(menu, now);

    context.save();
    context.fillStyle = COLORS.panel;
    context.fillRect(menuX, 0, MENU.width, 240);
    context.fillStyle = COLORS.edge;
    context.fillRect(menuX + MENU.width - 2, 0, 2, 240);
    context.fillStyle = COLORS.header;
    context.fillRect(menuX, 0, MENU.width - 2, 23);
    drawBitmapText(context, font, "スタイル変更", menuX + 7, 7, "#ffffff");
    const headerValue = "設定";
    drawBitmapText(context, font, headerValue, menuX + MENU.width - 8 - measureBitmapText(font, headerValue), 7, "#79d9a7");

    context.save();
    context.beginPath();
    context.rect(menuX + 2, 24, MENU.width - 6, 188);
    context.clip();

    const animatedRow = clamp(model.selectionPosition(menu, now), 0, model.STYLE_FIELDS.length - 1);
    const highlightY = Math.round(28 + animatedRow * MENU.itemHeight + model.selectionBoundaryBounceOffset(menu, now));
    const highlightX = menuX + 4 + Math.round(activationOffset);
    const highlightWidth = MENU.width - 10;
    const highlightHeight = 15;
    context.fillStyle = `rgba(${COLORS.selected}, ${selectionPulse(now).toFixed(3)})`;
    context.fillRect(highlightX, highlightY - 3, highlightWidth, highlightHeight);
    drawPixelBorder(
      context,
      highlightX,
      highlightY - 3,
      highlightWidth,
      highlightHeight,
      `rgba(${COLORS.selectedBorder}, ${selectionOutlinePulse(now).toFixed(3)})`
    );

    model.STYLE_FIELDS.forEach((field, index) => {
      const y = 28 + index * MENU.itemHeight;
      const selected = index === state.selectedIndex;
      const itemOffset = selected ? Math.round(activationOffset) : 0;
      const color = selected ? COLORS.selectedText : COLORS.text;
      drawBitmapText(context, font, "L", menuX + 8 + itemOffset, y, COLORS.accent);
      drawBitmapText(context, font, field.label, menuX + 27 + itemOffset, y, color);
      const value = model.currentStyleValue(menu, index);
      const valueWidth = measureBitmapText(font, value);
      drawBitmapText(context, font, value, menuX + MENU.width - 8 - valueWidth + itemOffset, y, selected ? COLORS.selectedValue : COLORS.value);
    });
    context.restore();

    context.fillStyle = COLORS.footer;
    context.fillRect(menuX, 216, MENU.width - 2, 24);
    if (state.inlineList) {
      drawBitmapText(context, font, "A決定 B戻る", menuX + 6, 220, COLORS.hint);
      drawBitmapText(context, font, "上下:選択", menuX + 6, 230, COLORS.hint);
    } else {
      drawBitmapText(context, font, "A選択", menuX + 6, 220, COLORS.hint);
      drawBitmapText(context, font, "上下:項目", menuX + 6, 230, COLORS.hint);
    }

    drawInlineList(context, menu, font, menuX, now);
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
      drawPreviewMarker(context, font, amount);
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
    const showUi = !menu.visible && !menu.dialog && !menu.overlay && !menu.inlineList;
    model.setPanelVisible(menu, showUi, now);
    const amount = model.panelAmount(menu, now);

    // 背景画像はチート有効中常時表示し、操作パネルだけを通常メニューと同じ320msで出し入れする。
    // CTRPFでは毎フレーム同じamountからX座標を算出すれば、Canvasのtransform等は不要。
    return drawPreview(context, image, menu, font, amount > 0.001, now, amount);
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
    drawScrollBar,
    drawPreviewMarker,
    drawAfterMarker: drawPreviewMarker,
    drawInlineList,
    drawPanel,
    drawPreview,
    drawIfActive,
    imageReady,
    getSourceImage
  });

  if (root) root.ACNLStylePreview = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (typeof document !== "undefined") ensureSourceImage();
})(typeof globalThis !== "undefined" ? globalThis : this);
