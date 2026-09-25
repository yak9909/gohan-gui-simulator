"use strict";

(function (root) {
  if (typeof document === "undefined") return;

  const MENU = root.CTRPFUiModel?.MENU;
  const clamp = root.CTRPFUiModel?.clamp;
  const formatValue = root.CTRPFUiModel?.formatValue;
  const isDirty = root.CTRPFUiModel?.isDirty;
  const HOLD_CANCEL_THRESHOLD = root.GohanIssueFixes?.HOLD_CANCEL_THRESHOLD ?? (2 / 5);
  const VALUE_LOCK_MARKER_COLOR = "#5cc8ff";
  const VALUE_LOCK_VALUE_COLOR = "#5cc8ff";
  const FAVORITE_ACTIVE_COLOR = "#d6c98a";
  const HOTKEY_ACTIVE_COLOR = "#78a9ff";
  const MARKER_INACTIVE_COLOR = "#4c5550";
  const ROW_TEXT_X = 27;
  const VALUE_RIGHT_X = 136;
  const FAVORITE_X = 140;
  const HOTKEY_X = 147;
  const LIST_CLIP_TOP = 24;
  const LIST_CLIP_BOTTOM = 212;
  if (!MENU) return;

  function measureBitmapText(font, text) {
    let width = 0;
    for (const character of Array.from(String(text))) {
      const glyph = font.glyphs[String(character.codePointAt(0))];
      width += glyph ? glyph.advance : 4;
    }
    return width;
  }

  function trimBitmapText(font, text, maximumWidth) {
    let result = "";
    for (const character of Array.from(String(text))) {
      if (measureBitmapText(font, result + character) > maximumWidth) {
        while (result && measureBitmapText(font, result + "...") > maximumWidth) result = result.slice(0, -1);
        return result + "...";
      }
      result += character;
    }
    return result;
  }

  function drawBitmapText(context, font, text, x, y, color) {
    let cursor = Math.round(x);
    context.fillStyle = color;
    for (const character of Array.from(String(text))) {
      const glyph = font.glyphs[String(character.codePointAt(0))];
      if (!glyph) { cursor += 4; continue; }
      for (let row = 0; row < glyph.height; row++) {
        const bits = glyph.rows[row];
        for (let column = 0; column < glyph.width; column++) {
          if (bits & (1 << column)) context.fillRect(cursor + glyph.offsetX + column, Math.round(y) + glyph.offsetY + row, 1, 1);
        }
      }
      cursor += glyph.advance;
    }
    return cursor;
  }

  function isNumericEntry(entry) {
    return entry && ["value", "slider", "linked-value"].includes(entry.type);
  }

  function rowColor(entry, selected) {
    if (entry.disabled) return "#525b54";
    if (typeof isDirty === "function" && isDirty(entry)) return "#ffd166";
    return selected ? "#ffffff" : "#aeb9b1";
  }

  function updateDomHelp() {
    const help = document.querySelector(".control-help");
    if (!help) return;
    help.innerHTML = "<b>A</b> 決定　<b>B</b> 戻る／閉じる　<b>X</b> 短押し:選択適用／長押し:全適用　<b>L</b> 短押し:選択戻し／長押し:全戻し　<b>Y</b> ホットキー　<b>R</b> お気に入り切替　<b>START</b> 設定";
  }

  function installDisabledPointerSelection(topCanvas) {
    topCanvas.addEventListener("pointerdown", (event) => {
      const menu = root.__gohanMenuModel;
      if (!menu?.visible || menu.dialog || menu.overlay || menu.inlineList) return;
      const frame = menu.currentFrame();
      if (!frame?.items?.length) return;

      const rectangle = topCanvas.getBoundingClientRect();
      const point = {
        x: (event.clientX - rectangle.left) * topCanvas.width / rectangle.width,
        y: (event.clientY - rectangle.top) * topCanvas.height / rectangle.height
      };
      const now = performance.now();
      const amount = menu.openAmount(now);
      const menuX = Math.round(-MENU.width + MENU.width * amount);
      const start = menu.viewportStart(now);
      const firstIndex = Math.max(0, Math.floor(start));
      const lastIndex = Math.min(frame.items.length - 1, Math.ceil(start) + MENU.visibleRows);

      for (let index = firstIndex; index <= lastIndex; index++) {
        const entry = frame.items[index];
        if (!entry?.disabled) continue;
        const rowY = Math.round(28 + (index - start) * MENU.itemHeight);
        const hit = point.x >= menuX + 4 && point.x <= menuX + MENU.width - 6 && point.y >= rowY - 3 && point.y <= rowY + 13;
        if (!hit) continue;
        frame.selection = index;
        menu.resetSelectionAnimation(now);
        event.preventDefault();
        return;
      }
    }, true);
  }

  function sampleColor(context, x, y) {
    if (typeof context.getImageData !== "function") return null;
    const data = context.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    return `rgba(${data[0]}, ${data[1]}, ${data[2]}, ${data[3] / 255})`;
  }

  function restoreBackgroundBand(context, sampleX, x, y, width, height) {
    if (typeof context.getImageData !== "function") return false;
    for (let row = 0; row < height; row++) {
      const pixelY = Math.round(y) + row;
      if (pixelY < LIST_CLIP_TOP || pixelY >= LIST_CLIP_BOTTOM) continue;
      const color = sampleColor(context, sampleX, pixelY);
      if (!color) continue;
      context.fillStyle = color;
      context.fillRect(Math.round(x), pixelY, Math.round(width), 1);
    }
    return true;
  }

  function eraseLegacyFavoriteMarker(context, font, menuX, y) {
    const glyph = font.glyphs[String("F".codePointAt(0))];
    if (!glyph || typeof context.getImageData !== "function" || typeof context.putImageData !== "function") return;
    const sampleX = Math.round(menuX + 26);
    for (let row = 0; row < glyph.height; row++) {
      const bits = glyph.rows[row];
      const pixelY = Math.round(y) + glyph.offsetY + row;
      if (pixelY < LIST_CLIP_TOP || pixelY >= LIST_CLIP_BOTTOM) continue;
      const sample = context.getImageData(sampleX, pixelY, 1, 1);
      for (let column = 0; column < glyph.width; column++) {
        if (!(bits & (1 << column))) continue;
        context.putImageData(sample, Math.round(menuX + 22) + glyph.offsetX + column, pixelY);
      }
    }
  }

  function drawScrollBar(context, menuX, frame, start) {
    if (frame.items.length <= MENU.visibleRows) return;
    const x = menuX + 154, y = 28, height = 176;
    const thumbHeight = Math.max(10, Math.floor(height * MENU.visibleRows / frame.items.length));
    const maximumScroll = frame.items.length - MENU.visibleRows;
    const thumbY = y + Math.round((height - thumbHeight) * clamp(start / maximumScroll, 0, 1));
    context.fillStyle = "rgba(38, 52, 44, .66)"; context.fillRect(x, y, 2, height);
    context.fillStyle = "rgba(99, 228, 164, .88)"; context.fillRect(x, thumbY, 2, thumbHeight);
  }

  function drawFavoriteHotkeyMarkers(context, font, numericFont, menu, menuX, now) {
    const frame = menu.currentFrame();
    if (!frame?.items?.length || frame.kind === "settings") return;
    const start = menu.viewportStart(now);
    const firstIndex = Math.max(0, Math.floor(start));
    const lastIndex = Math.min(frame.items.length - 1, Math.ceil(start) + MENU.visibleRows);
    const activationOffset = menu.activationBounceOffset(now);

    for (let index = firstIndex; index <= lastIndex; index++) {
      const entry = frame.items[index];
      const y = Math.round(28 + (index - start) * MENU.itemHeight);
      if (y < 25 || y > 204) continue;
      const selected = index === frame.selection;
      const itemOffset = selected ? Math.round(activationOffset) : 0;
      const color = rowColor(entry, selected);
      const favoriteActive = Boolean(entry?.favoriteKey && menu.isFavorite(entry));
      const hotkeyActive = Boolean(entry?.type !== "folder" && entry?.hotkey && entry.hotkey !== "なし");
      const sampleX = menuX + 26;

      if (favoriteActive) eraseLegacyFavoriteMarker(context, font, menuX + itemOffset, y);

      // app.js originally uses the far right for the value and draws H one line below.
      // Rebuild only the text band here: value moves left, then F/H occupy fixed columns.
      // The band is limited to the list viewport so it can never paint over the footer.
      restoreBackgroundBand(context, sampleX, menuX + ROW_TEXT_X, y, 129, 8);
      restoreBackgroundBand(context, sampleX, menuX + 138, y + 8, 18, 7);

      const value = typeof formatValue === "function" ? formatValue(entry, now) : "";
      const valueFont = entry.type === "linked-value" && numericFont ? numericFont : isNumericEntry(entry) && numericFont ? numericFont : font;
      const valueWidth = value ? measureBitmapText(valueFont, value) : 0;
      const valueX = menuX + VALUE_RIGHT_X - valueWidth + itemOffset;
      const labelWidth = Math.max(0, VALUE_RIGHT_X - ROW_TEXT_X - (value ? valueWidth + 3 : 0));
      drawBitmapText(context, font, trimBitmapText(font, entry.label, labelWidth), menuX + ROW_TEXT_X + itemOffset, y, color);
      if (value) {
        const valueColor = menu.isItemFixed?.(entry) ? VALUE_LOCK_VALUE_COLOR : color;
        drawBitmapText(context, valueFont, value, valueX, y, valueColor);
      }

      // F is always the left status column. Folders intentionally have no H column.
      drawBitmapText(context, font, "F", menuX + 140 + itemOffset, y, favoriteActive ? FAVORITE_ACTIVE_COLOR : MARKER_INACTIVE_COLOR);
      if (entry.type !== "folder") {
        drawBitmapText(context, font, "H", menuX + 147 + itemOffset, y, hotkeyActive ? HOTKEY_ACTIVE_COLOR : MARKER_INACTIVE_COLOR);
      }
    }

    // Rebuilding the row text band can touch x=154/155 during the 3px A-bounce.
    // Redraw the scrollbar after the rows so its two-pixel track remains authoritative.
    drawScrollBar(context, menuX, frame, start);
  }

  function drawValueLockMarkers(context, menu, menuX, now) {
    if (typeof menu.isItemFixed !== "function") return;
    const frame = menu.currentFrame();
    if (!frame?.items?.length) return;
    const start = menu.viewportStart(now);
    const firstIndex = Math.max(0, Math.floor(start));
    const lastIndex = Math.min(frame.items.length - 1, Math.ceil(start) + MENU.visibleRows);
    for (let index = firstIndex; index <= lastIndex; index++) {
      const entry = frame.items[index];
      if (!menu.isItemFixed(entry)) continue;
      const y = Math.round(28 + (index - start) * MENU.itemHeight);
      if (y < 25 || y > 204) continue;
      // 「値を固定」は既存の項目色を変えず、行左端の1px縦線だけで示す。
      // 固定中の値色は drawFavoriteHotkeyMarkers 側で VALUE_LOCK_VALUE_COLOR にする。
      context.fillStyle = VALUE_LOCK_MARKER_COLOR;
      context.fillRect(menuX + 4, y - 2, 1, 12);
    }
  }

  function overlayFrame(now) {
    requestAnimationFrame(overlayFrame);
    const menu = root.__gohanMenuModel;
    const topCanvas = document.getElementById("topScreen");
    const font = root.MISAKI_GOTHIC_2ND_8;
    const numericFont = root.PIXEL_MPLUS_10_NUMERIC_8;
    if (!menu || !topCanvas || !font || !menu.visible) return;

    const amount = menu.openAmount(now);
    if (amount <= 0) return;
    const context = topCanvas.getContext("2d");
    const menuX = Math.round(-MENU.width + MENU.width * amount);

    // 長押し進捗は2/5未満なら「進んだ部分すべて」を灰色で上書きする。
    // 2/5到達後は下層の通常描画（黄色）をそのまま見せ、途中で二色に分割しない。
    const hold = menu.holdActionProgress(now);
    if (hold && hold.progress < HOLD_CANCEL_THRESHOLD) {
      const barWidth = MENU.width - 22;
      const progressWidth = Math.round(barWidth * hold.progress);
      if (progressWidth > 0) {
        context.fillStyle = "#747b76";
        context.fillRect(menuX + 10, 211, progressWidth, 2);
      }
      context.strokeStyle = "#747b76";
      context.strokeRect(menuX + 5.5, 201.5, MENU.width - 13, 13);
    }

    context.save();
    context.beginPath();
    context.rect(menuX + 2, LIST_CLIP_TOP, MENU.width - 6, LIST_CLIP_BOTTOM - LIST_CLIP_TOP);
    context.clip();
    drawFavoriteHotkeyMarkers(context, font, numericFont, menu, menuX, now);
    drawValueLockMarkers(context, menu, menuX, now);
    context.restore();

    // app.js の旧 START:FAVORITES を上書きする。
    // 通常のチート説明欄には START:SETTINGS を出さない。START操作はヘルプ側だけで案内する。
    const frame = menu.currentFrame();
    const settingsIndex = typeof menu.settingsFrameIndex === "function" ? menu.settingsFrameIndex() : -1;
    const selected = menu.selectedItem();
    let controlText;
    if (frame?.kind === "settings") controlText = "START:CLOSE  A:SELECT";
    else if (settingsIndex >= 0) controlText = "R:FAV  START:CLOSE";
    else controlText = `${menu.isItemFixed?.(selected) ? "値を固定:ON  " : ""}R:FAV`;

    context.save();
    context.globalAlpha = amount;
    context.fillStyle = "rgba(10, 13, 11, .98)";
    context.fillRect(174, 35, 211, 11);
    drawBitmapText(context, font, controlText, 176, 37, "#8f9a92");
    context.restore();
  }

  function init() {
    updateDomHelp();
    const topCanvas = document.getElementById("topScreen");
    if (topCanvas) installDisabledPointerSelection(topCanvas);
    requestAnimationFrame(overlayFrame);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(typeof globalThis !== "undefined" ? globalThis : this);
