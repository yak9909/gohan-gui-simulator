"use strict";

(function (root) {
  if (typeof document === "undefined") return;

  const MENU = root.CTRPFUiModel?.MENU;
  const HOLD_CANCEL_THRESHOLD = root.GohanIssueFixes?.HOLD_CANCEL_THRESHOLD ?? (2 / 5);
  const VALUE_LOCK_MARKER_COLOR = "#5cc8ff";
  if (!MENU) return;

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
      // VALUE LOCKは既存の項目色を変えず、行左端の1px縦線だけで示す。
      context.fillStyle = VALUE_LOCK_MARKER_COLOR;
      context.fillRect(menuX + 4, y - 2, 1, 12);
    }
  }

  function overlayFrame(now) {
    requestAnimationFrame(overlayFrame);
    const menu = root.__gohanMenuModel;
    const topCanvas = document.getElementById("topScreen");
    const font = root.MISAKI_GOTHIC_2ND_8;
    if (!menu || !topCanvas || !font || !menu.visible) return;

    const amount = menu.openAmount(now);
    if (amount <= 0) return;
    const context = topCanvas.getContext("2d");
    const menuX = Math.round(-MENU.width + MENU.width * amount);

    // Issue #2: the first 2/5 of the long-press bar is deliberately gray.
    const hold = menu.holdActionProgress(now);
    if (hold) {
      const barWidth = MENU.width - 22;
      const grayWidth = Math.round(barWidth * Math.min(hold.progress, HOLD_CANCEL_THRESHOLD));
      if (grayWidth > 0) {
        context.fillStyle = "#747b76";
        context.fillRect(menuX + 10, 211, grayWidth, 2);
      }
      if (hold.progress < HOLD_CANCEL_THRESHOLD) {
        context.strokeStyle = "#747b76";
        context.strokeRect(menuX + 5.5, 201.5, MENU.width - 13, 13);
      }
    }

    drawValueLockMarkers(context, menu, menuX, now);

    // Replace the legacy START:FAVORITES hint with the settings contract.
    const frame = menu.currentFrame();
    const settingsIndex = typeof menu.settingsFrameIndex === "function" ? menu.settingsFrameIndex() : -1;
    const selected = menu.selectedItem();
    let controlText;
    if (frame?.kind === "settings") controlText = "START:CLOSE  A:SELECT";
    else if (settingsIndex >= 0) controlText = "R:FAV  START:CLOSE";
    else controlText = `${menu.isItemFixed?.(selected) ? "VALUE LOCK:ON  " : ""}R:FAV  START:SETTINGS`;

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
