"use strict";

(function (root) {
  if (typeof document === "undefined") return;

  const MENU = root.CTRPFUiModel?.MENU;
  const formatValue = root.CTRPFUiModel?.formatValue;
  const HOLD_CANCEL_THRESHOLD = root.GohanIssueFixes?.HOLD_CANCEL_THRESHOLD ?? (2 / 5);
  const VALUE_LOCK_MARKER_COLOR = "#5cc8ff";
  const VALUE_LOCK_VALUE_COLOR = "#5cc8ff";
  const FAVORITE_ACTIVE_COLOR = "#d6c98a";
  const HOTKEY_ACTIVE_COLOR = "#78a9ff";
  const MARKER_INACTIVE_COLOR = "#4c5550";
  if (!MENU) return;

  function measureBitmapText(font, text) {
    let width = 0;
    for (const character of Array.from(String(text))) {
      const glyph = font.glyphs[String(character.codePointAt(0))];
      width += glyph ? glyph.advance : 4;
    }
    return width;
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

  function eraseLegacyFavoriteMarker(context, font, menuX, y) {
    const glyph = font.glyphs[String("F".codePointAt(0))];
    if (!glyph || typeof context.getImageData !== "function" || typeof context.putImageData !== "function") return;
    const sampleX = Math.round(menuX + 26);
    for (let row = 0; row < glyph.height; row++) {
      const bits = glyph.rows[row];
      const pixelY = Math.round(y) + glyph.offsetY + row;
      const sample = context.getImageData(sampleX, pixelY, 1, 1);
      for (let column = 0; column < glyph.width; column++) {
        if (!(bits & (1 << column))) continue;
        context.putImageData(sample, Math.round(menuX + 22) + glyph.offsetX + column, pixelY);
      }
    }
  }

  function drawFavoriteHotkeyMarkers(context, font, menu, menuX, now) {
    const frame = menu.currentFrame();
    if (!frame?.items?.length) return;
    const start = menu.viewportStart(now);
    const firstIndex = Math.max(0, Math.floor(start));
    const lastIndex = Math.min(frame.items.length - 1, Math.ceil(start) + MENU.visibleRows);
    const activationOffset = menu.activationBounceOffset(now);

    for (let index = firstIndex; index <= lastIndex; index++) {
      const entry = frame.items[index];
      const y = Math.round(28 + (index - start) * MENU.itemHeight);
      const itemOffset = index === frame.selection ? Math.round(activationOffset) : 0;
      const favoriteActive = Boolean(entry?.favoriteKey && menu.isFavorite(entry));
      const hotkeyActive = Boolean(entry?.type !== "folder" && entry?.hotkey && entry.hotkey !== "なし");

      // app.js の旧Fはラベル左に描かれるため、その3x7pxだけ同じ行の空き画素から復元する。
      // これにより背景・選択枠・パルス色を壊さず、F/Hを右下の同一領域へ集約できる。
      if (favoriteActive) eraseLegacyFavoriteMarker(context, font, menuX + itemOffset, y);

      // 右下マーカーは常時表示する。左から F, H。無効時は灰色にして状態を自明にする。
      drawBitmapText(context, font, "F", menuX + 140 + itemOffset, y + 8, favoriteActive ? FAVORITE_ACTIVE_COLOR : MARKER_INACTIVE_COLOR);
      drawBitmapText(context, font, "H", menuX + 147 + itemOffset, y + 8, hotkeyActive ? HOTKEY_ACTIVE_COLOR : MARKER_INACTIVE_COLOR);
    }
  }

  function drawValueLockMarkers(context, font, numericFont, menu, menuX, now) {
    if (typeof menu.isItemFixed !== "function") return;
    const frame = menu.currentFrame();
    if (!frame?.items?.length) return;
    const start = menu.viewportStart(now);
    const firstIndex = Math.max(0, Math.floor(start));
    const lastIndex = Math.min(frame.items.length - 1, Math.ceil(start) + MENU.visibleRows);
    const activationOffset = menu.activationBounceOffset(now);
    for (let index = firstIndex; index <= lastIndex; index++) {
      const entry = frame.items[index];
      if (!menu.isItemFixed(entry)) continue;
      const y = Math.round(28 + (index - start) * MENU.itemHeight);
      // 「値を固定」は既存の項目色を変えず、行左端の1px縦線だけで示す。
      context.fillStyle = VALUE_LOCK_MARKER_COLOR;
      context.fillRect(menuX + 4, y - 2, 1, 12);

      // 固定中の「値」だけはSYNC色の水色で上書きし、項目名やSアイコンの色は変えない。
      const value = typeof formatValue === "function" ? formatValue(entry, now) : "";
      if (value) {
        const valueFont = entry.type === "linked-value" && numericFont ? numericFont : font;
        const valueWidth = measureBitmapText(valueFont, value);
        const itemOffset = index === frame.selection ? Math.round(activationOffset) : 0;
        drawBitmapText(
          context,
          valueFont,
          value,
          menuX + MENU.width - 8 - valueWidth + itemOffset,
          y,
          VALUE_LOCK_VALUE_COLOR
        );
      }
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

    drawFavoriteHotkeyMarkers(context, font, menu, menuX, now);
    drawValueLockMarkers(context, font, numericFont, menu, menuX, now);

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