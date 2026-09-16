"use strict";

(function () {

const {
  SCREEN, NOTICE, MENU, FRAME, BOTTOM_OVERLAY, TEXT_KEYBOARD, clamp, mix, NotificationTimeline, CheatMenuModel, ControlRepeater,
  isDirty, formatValue, numericKeys, numericKeyEnabled, selectionPulse, selectionOutlinePulse, listboxAmount, listboxScrollPosition,
  bottomOverlayAmount, textKeyboardAmount, dialogAmount, textKeys, textKeyLayout, textKeyEnabled, toKatakana, textCursor, formatHotkeyButtons
} = typeof module !== "undefined" && module.exports ? require("./ui-model.js") : window.CTRPFUiModel;

function measureBitmapText(font, text) {
  let width = 0;
  for (const character of Array.from(String(text))) {
    const glyph = font.glyphs[String(character.codePointAt(0))];
    width += glyph ? glyph.advance : 4;
  }
  return width;
}

function bitmapTextCursorAt(font, text, x) {
  const target = Math.max(0, x);
  let width = 0;
  let nearestCursor = 0;
  let nearestDistance = target;
  Array.from(String(text)).forEach((character, index) => {
    width += measureBitmapText(font, character);
    const distance = Math.abs(target - width);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestCursor = index + 1;
    }
  });
  return nearestCursor;
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

function wrapBitmapText(font, text, maximumWidth) {
  const lines = [];
  let line = "";
  for (const character of Array.from(String(text))) {
    if (line && measureBitmapText(font, line + character) > maximumWidth) { lines.push(line); line = character; }
    else line += character;
  }
  if (line) lines.push(line);
  return lines;
}

function listboxVerticalPosition(optionCount, visibleRows) {
  const rows = Math.min(visibleRows, optionCount);
  return Math.round((SCREEN.height - (25 + rows * 20)) / 2);
}

function textKeyboardGeometry(compact) {
  return compact ? {
    titleX: 39, titleY: 23, inputX: 39, inputY: 37, inputWidth: 242, inputHeight: 21, inputRadius: 6,
    textX: 45, textY: 44, countX: 253, countY: 44, caretY: 42, caretHeight: 11
  } : {
    titleX: 8, titleY: 8, inputX: 23, inputY: 25, inputWidth: 274, inputHeight: 25, inputRadius: 8,
    textX: 31, textY: 34, countX: 269, countY: 34, caretY: 32, caretHeight: 12
  };
}

function topOverlayHorizontalPosition(menuAmount, width, openX) {
  return Math.round(mix((SCREEN.width - width) / 2, openX, menuAmount));
}

function dialogHorizontalPosition(dialog, dialogAmountValue, menuAmountValue) {
  const width = 224;
  const centeredX = (SCREEN.width - width) / 2;
  const menuOpenX = 168;
  const targetX = dialog?.type === "toggle-action-hotkey"
    ? mix(centeredX, menuOpenX, menuAmountValue)
    : menuOpenX;
  return Math.round(mix(targetX + 24, targetX, dialogAmountValue));
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y); context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r); context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function keyDisplay(key) {
  return ({ BS: "消", SIGN: "符号", OK: "決定", CANCEL: "取消", SPACE: "空白", KANA: "かな" })[key] || key;
}

function textKeyDisplay(key, overlay) {
  if (/^[a-z]$/.test(key)) return overlay.caps || overlay.shift ? key.toUpperCase() : key;
  if (overlay.mode === "kana" && overlay.script === "katakana" && Array.from(key).length === 1) return toKatakana(key);
  return ({
    DAKUTEN: "濁点", HANDAKUTEN: "半濁点", SMALL: "小字", HIRAGANA: "かな", KATAKANA: "カナ",
    BS: "消去", ENTER: "改行", LONG: "ー", SPACE: "空白", CONFIRM: "けってい", BLANK: "",
    CAPS: "Caps", SHIFT: "Shift", ABC: "ABC", AIU: "あいう", SYMBOL: "記号", PHONE: "ケータイ", CANCEL: "とじる"
  })[key] ?? key;
}

function isNumericEntry(entry) {
  return entry && ["value", "slider", "linked-value"].includes(entry.type);
}

function isNumericKeyLabel(label) {
  return label === "." || /^[0-9]+$/.test(label) || /^[A-F]$/.test(label);
}

function boot() {
  const font = window.MISAKI_GOTHIC_2ND_8;
  if (!font) throw new Error("Misaki Gothic 2nd bitmap data could not be loaded");
  const numericFont = window.PIXEL_MPLUS_10_NUMERIC_8;
  if (!numericFont) throw new Error("PixelMplus10 numeric bitmap data could not be loaded");
  const topCanvas = document.getElementById("topScreen");
  const bottomCanvas = document.getElementById("bottomScreen");
  const top = topCanvas.getContext("2d");
  const bottom = bottomCanvas.getContext("2d");
  top.imageSmoothingEnabled = false;
  bottom.imageSmoothingEnabled = false;
  const timeline = new NotificationTimeline();
  const menu = new CheatMenuModel((title, message) => timeline.add(performance.now(), title, message));
  const controls = new ControlRepeater((key, now, pressed, repeated) => menu.handle(key, now, pressed, repeated));
  const activeCount = document.getElementById("activeCount");
  const dirtyCount = document.getElementById("dirtyCount");
  const openMenuButton = document.getElementById("openMenuButton");
  const scaleButton = document.getElementById("scaleButton");
  const topScaleLabel = document.getElementById("topScaleLabel");
  const bottomScaleLabel = document.getElementById("bottomScaleLabel");
  const topBackgroundColor = document.getElementById("topBackgroundColor");
  const bottomBackgroundColor = document.getElementById("bottomBackgroundColor");
  const topBackgroundValue = document.getElementById("topBackgroundValue");
  const bottomBackgroundValue = document.getElementById("bottomBackgroundValue");
  const previewArea = document.querySelector(".preview-area");
  let doubled = false;
  let bottomHitRegions = [];
  let topHitRegions = [];
  let touchedTextKey = null;

  function addNotice() { timeline.add(performance.now()); }

  function drawNotice(item) {
    const x = Math.round(item.x), y = Math.round(item.y);
    const accent = item.title.indexOf("CHEAT DISABLED") === 0 ? "#e5484d" : "#63e4a4";
    const edge = item.title.indexOf("CHEAT DISABLED") === 0 ? "#6c4f5b" : "#4f6c5b";
    top.fillStyle = "rgba(10, 13, 11, .78)"; top.fillRect(x, y, NOTICE.width, NOTICE.height);
    top.fillStyle = accent; top.fillRect(x, y, 2, NOTICE.height);
    top.strokeStyle = edge; top.lineWidth = 1; top.strokeRect(x + .5, y + .5, NOTICE.width - 1, NOTICE.height - 1);
    const title = item.title === "CHEAT ENABLED" ? `${item.title} ${item.id}` : item.title;
    drawBitmapText(top, font, trimBitmapText(font, title, NOTICE.width - 20), x + 7, y + 4, "#ffffff");
    drawBitmapText(top, font, trimBitmapText(font, item.message, NOTICE.width - 14), x + 7, y + 14, "#c4cec7");
  }

  function itemIcon(entry) {
    if (entry.type === "folder") return ">";
    if (entry.type === "checkbox") return entry.value ? "[X]" : "[ ]";
    if (entry.type === "toggle-action" || entry.type === "action") return "A";
    if (entry.type === "linked-list" || entry.type === "linked-value") return "S";
    if (entry.type === "list") return "L";
    return "V";
  }

  function itemIconColor(entry, fallback) {
    if (entry.type === "folder") return "#63e4a4";
    if (entry.type === "linked-list" || entry.type === "linked-value") return "#5cc8ff";
    return fallback;
  }

  function itemTypeBadge(entry) {
    if (entry.type === "linked-list" || entry.type === "linked-value") return { text: "SYNC", color: "#5cc8ff" };
    return null;
  }

  function drawItemIcon(entry, x, y, color) {
    if (entry.type === "checkbox" && entry.value) {
      // CTRPF側でも [X] を一括描画せず、Xだけ別色で描くと同じ見た目を再現できる。
      let cursor = drawBitmapText(top, font, "[", x, y, color);
      cursor = drawBitmapText(top, font, "X", cursor, y, "#ff6b6b");
      drawBitmapText(top, font, "]", cursor, y, color);
      return;
    }
    drawBitmapText(top, font, itemIcon(entry), x, y, itemIconColor(entry, color));
  }

  function drawScrollBar(context, x, y, height, visibleRows, itemCount, scrollPosition) {
    if (itemCount <= visibleRows) return;
    const thumbHeight = Math.max(10, Math.floor(height * visibleRows / itemCount));
    const maximumScroll = itemCount - visibleRows;
    const thumbY = y + Math.round((height - thumbHeight) * clamp(scrollPosition / maximumScroll, 0, 1));
    context.fillStyle = "rgba(38, 52, 44, .66)"; context.fillRect(x, y, 2, height);
    context.fillStyle = "rgba(99, 228, 164, .88)"; context.fillRect(x, thumbY, 2, thumbHeight);
  }

  function drawMenu(now) {
    menu.update(now);
    if (!menu.visible) {
      topHitRegions = [];
      if (menu.overlay && menu.overlay.type === "listbox" && menu.overlay.screen === "top") {
        drawListbox(top, topOverlayHorizontalPosition(0, 204, 178), 204, menu.overlay, now, SCREEN.width);
      }
      if (menu.dialog) drawDialog(now);
      return;
    }
    const amount = menu.openAmount(now);
    const menuX = Math.round(-MENU.width + MENU.width * amount);
    const frame = menu.currentFrame();
    const selection = frame.selection;
    const start = menu.viewportStart(now);
    const activationOffset = menu.activationBounceOffset(now);

    top.fillStyle = "rgba(12, 16, 13, .78)"; top.fillRect(menuX, 0, MENU.width, 240);
    top.fillStyle = "rgba(99, 228, 164, .9)"; top.fillRect(menuX + MENU.width - 2, 0, 2, 240);
    top.fillStyle = "rgba(28, 43, 34, .74)"; top.fillRect(menuX, 0, MENU.width - 2, 23);
    drawBitmapText(top, font, "CHEAT MENU", menuX + 7, 7, "#ffffff");
    drawBitmapText(top, font, trimBitmapText(font, frame.title, 62), menuX + 91, 7, "#79d9a7");

    top.save();
    top.beginPath(); top.rect(menuX + 2, 24, MENU.width - 6, 188); top.clip();
    const animatedRow = clamp(menu.selectionPosition(now) - start, 0, MENU.visibleRows - 1);
    const highlightY = Math.round(28 + animatedRow * MENU.itemHeight + menu.selectionBoundaryBounceOffset(now));
    const highlightX = menuX + 4 + Math.round(menu.selectionBounceOffset(now) + activationOffset);
    const highlightWidth = MENU.width - 10;
    const highlightHeight = 15;
    top.fillStyle = `rgba(41, 69, 55, ${selectionPulse(now).toFixed(3)})`;
    top.fillRect(highlightX, highlightY - 3, highlightWidth, highlightHeight);
    top.strokeStyle = `rgba(99, 228, 164, ${selectionOutlinePulse(now).toFixed(3)})`;
    top.lineWidth = 1;
    top.strokeRect(highlightX + .5, highlightY - 2.5, highlightWidth - 1, highlightHeight - 1);

    topHitRegions = [];
    const firstIndex = Math.max(0, Math.floor(start));
    const lastIndex = Math.min(frame.items.length - 1, Math.ceil(start) + MENU.visibleRows);
    for (let index = firstIndex; index <= lastIndex; index++) {
      const entry = frame.items[index];
      const y = Math.round(28 + (index - start) * MENU.itemHeight);
      const selected = index === selection;
      const itemOffset = selected ? Math.round(activationOffset) : 0;
      const color = entry.disabled ? "#525b54" : isDirty(entry) ? "#ffd166" : selected ? "#ffffff" : "#aeb9b1";
      drawItemIcon(entry, menuX + 8 + itemOffset, y, color);
      const value = formatValue(entry, now);
      const valueFont = isNumericEntry(entry) ? numericFont : font;
      const valueWidth = value ? measureBitmapText(valueFont, value) : 0;
      const labelWidth = MENU.width - 33 - valueWidth;
      drawBitmapText(top, font, trimBitmapText(font, entry.label, labelWidth), menuX + 27 + itemOffset, y, color);
      if (value) drawBitmapText(top, valueFont, value, menuX + MENU.width - 8 - valueWidth + itemOffset, y, color);
      if (entry.type !== "folder" && entry.hotkey !== "なし") drawBitmapText(top, font, "H", menuX + 147 + itemOffset, y + 8, "#78a9ff");
      if (!entry.disabled && y >= 25 && y <= 204) topHitRegions.push({ x: menuX + 4, y: y - 3, width: MENU.width - 10, height: 16, itemIndex: index });
    }
    top.restore();
    drawScrollBar(top, menuX + 154, 28, 176, MENU.visibleRows, frame.items.length, start);

    const changed = menu.dirtyCount();
    top.fillStyle = "rgba(21, 27, 23, .76)"; top.fillRect(menuX, 216, MENU.width - 2, 24);
    drawBitmapText(top, font, "A決定 X適用 Y HOTKEY", menuX + 6, 220, "#829087");
    drawBitmapText(top, font, `${changed}変更`, menuX + 6, 230, changed ? "#ffd166" : "#58635b");
    drawBitmapText(top, font, "B戻る L変更戻し", menuX + 72, 230, "#829087");
    drawHoldProgress(menuX, now);

    if (menu.inlineList) drawInlineList(menuX, start, now);
    drawDescriptionPanel(amount);
    if (menu.overlay && menu.overlay.type === "listbox" && menu.overlay.screen === "top") {
      drawListbox(top, topOverlayHorizontalPosition(amount, 204, 178), 204, menu.overlay, now, SCREEN.width);
    }
    if (menu.dialog) drawDialog(now);
  }

  function drawInlineList(menuX, start, now) {
    const frame = menu.currentFrame();
    const row = frame.selection - start;
    const list = menu.inlineList;
    const amount = listboxAmount(list, now);
    if (amount <= 0) return;
    const visibleRows = Math.min(list.visibleRows, list.item.options.length);
    const height = visibleRows * 14 + 6;
    const y = Math.min(28 + row * MENU.itemHeight + 14, 212 - height);
    const x = Math.round(mix(menuX + MENU.width, menuX + 21, amount));
    const scrollPosition = listboxScrollPosition(list, now);
    top.globalAlpha = amount;
    top.fillStyle = "rgba(10, 13, 11, .82)"; top.fillRect(x, y, 132, height);
    top.strokeStyle = "#63e4a4"; top.strokeRect(x + .5, y + .5, 131, height - 1);
    top.save();
    top.beginPath(); top.rect(x + 2, y + 2, 125, height - 4); top.clip();
    const firstIndex = Math.max(0, Math.floor(scrollPosition));
    const lastIndex = Math.min(list.item.options.length - 1, Math.ceil(scrollPosition) + visibleRows);
    for (let index = firstIndex; index <= lastIndex; index++) {
      const rowY = Math.round(y + 3 + (index - scrollPosition) * 14);
      if (index === list.index) { top.fillStyle = "rgba(41, 69, 55, .64)"; top.fillRect(x + 3, rowY, 122, 12); }
      drawBitmapText(top, font, list.item.options[index], x + 8, rowY + 2, index === list.index ? "#ffffff" : "#aeb9b1");
    }
    top.restore();
    drawScrollBar(top, x + 128, y + 3, height - 6, visibleRows, list.item.options.length, scrollPosition);
    top.globalAlpha = 1;
  }

  function drawDescriptionPanel(amount) {
    const entry = menu.selectedItem();
    const x = 168, y = 8, width = 224;
    const lines = wrapBitmapText(font, entry.description, width - 16).slice(0, 6);
    const height = 35 + lines.length * 11;
    top.save();
    top.globalAlpha = amount;
    top.fillStyle = "rgba(10, 13, 11, .82)"; top.fillRect(x, y, width, height);
    top.strokeStyle = "#4f6c5b"; top.strokeRect(x + .5, y + .5, width - 1, height - 1);
    drawBitmapText(top, font, trimBitmapText(font, entry.label, width - 16), x + 8, y + 7, "#63e4a4");
    drawBitmapText(top, font, `HOTKEY:${entry.type === "folder" ? "--" : entry.hotkey}`, x + 8, y + 18, "#78a9ff");
    const badge = itemTypeBadge(entry);
    if (badge) {
      const badgeWidth = measureBitmapText(font, badge.text);
      drawBitmapText(top, font, badge.text, x + width - 8 - badgeWidth, y + 18, badge.color);
    }
    lines.forEach((line, index) => drawBitmapText(top, font, line, x + 8, y + 31 + index * 11, entry.disabled ? "#626b64" : "#c4cec7"));
    top.restore();
  }

  function drawHoldProgress(menuX, now) {
    const hold = menu.holdActionProgress(now);
    if (!hold) return;
    const x = menuX + 5, y = 201, width = MENU.width - 12;
    top.fillStyle = "rgba(7, 9, 8, .94)"; top.fillRect(x, y, width, 14);
    top.strokeStyle = "#ffd166"; top.strokeRect(x + .5, y + .5, width - 1, 13);
    drawBitmapText(top, font, hold.label, x + 5, y + 2, "#ffffff");
    top.fillStyle = "rgba(85, 72, 34, .85)"; top.fillRect(x + 5, y + 10, width - 10, 2);
    top.fillStyle = "#ffd166"; top.fillRect(x + 5, y + 10, Math.round((width - 10) * hold.progress), 2);
  }

  function drawHotkeyCapture(overlay) {
    const width = 224, height = 86;
    const x = Math.round((bottomCanvas.width - width) / 2);
    const y = Math.round((bottomCanvas.height - height) / 2);
    bottom.fillStyle = "rgba(10, 13, 11, .82)"; bottom.fillRect(x, y, width, height);
    bottom.strokeStyle = "#63e4a4"; bottom.strokeRect(x + .5, y + .5, width - 1, height - 1);
    drawBitmapText(bottom, font, "HOTKEY INPUT", x + 8, y + 8, "#63e4a4");
    const status = overlay.phase === "arming" ? "ボタンを全て離す" : overlay.phase === "waiting" ? "ボタン入力待ち" : "入力中";
    drawBitmapText(bottom, font, status, x + 8, y + 24, "#ffffff");
    drawBitmapText(bottom, font, overlay.capturedButtons.length ? formatHotkeyButtons(overlay.capturedButtons) : "--", x + 8, y + 37, "#78a9ff");
    drawBitmapText(bottom, font, "全て離すと決定", x + 96, y + 37, "#8f9a92");
    drawKeyboardKey(bottom, "DISABLE", x + 8, y + 56, 100, 21, false, false, false, false, "無効");
    drawKeyboardKey(bottom, "CANCEL_CAPTURE", x + 116, y + 56, 100, 21, false, false, false, false, "取消");
    bottomHitRegions.push({ x: x + 8, y: y + 56, width: 100, height: 21, captureAction: "disable" });
    bottomHitRegions.push({ x: x + 116, y: y + 56, width: 100, height: 21, captureAction: "cancel" });
  }

  function drawDialog(now) {
    const dialog = menu.dialog;
    const amount = dialogAmount(dialog, now);
    if (amount <= 0) return;
    const width = 224, height = 90;
    const x = dialogHorizontalPosition(dialog, amount, menu.openAmount(now)), y = 75;
    top.save();
    top.globalAlpha = amount;
    top.fillStyle = "rgba(7, 9, 8, .9)"; top.fillRect(x, y, width, height);
    top.strokeStyle = "#ffd166"; top.strokeRect(x + .5, y + .5, width - 1, height - 1);
    drawBitmapText(top, font, dialog.title, x + 10, y + 10, "#ffffff");
    dialog.options.forEach((option, index) => {
      const rowY = y + 33 + index * 23;
      if (index === dialog.index) {
        top.fillStyle = "rgba(91, 73, 31, .72)"; top.fillRect(x + 8, rowY - 5, width - 16, 19);
        top.strokeStyle = "#ffd166"; top.strokeRect(x + 8.5, rowY - 4.5, width - 17, 18);
      }
      drawBitmapText(top, font, option, x + 18, rowY, index === dialog.index ? "#ffffff" : "#aeb9b1");
    });
    top.restore();
  }

  function drawListbox(context, x, width, overlay, now, offscreenX) {
    const amount = listboxAmount(overlay, now);
    if (amount <= 0) return;
    x = Math.round(mix(offscreenX, x, amount));
    const visibleRows = Math.min(overlay.visibleRows, overlay.options.length);
    const height = 25 + visibleRows * 20;
    const y = listboxVerticalPosition(overlay.options.length, overlay.visibleRows);
    const scrollPosition = listboxScrollPosition(overlay, now);
    context.globalAlpha = amount;
    context.fillStyle = "rgba(10, 13, 11, .82)"; context.fillRect(x, y, width, height);
    context.strokeStyle = "#63e4a4"; context.strokeRect(x + .5, y + .5, width - 1, height - 1);
    drawBitmapText(context, font, overlay.title, x + 8, y + 7, "#63e4a4");
    context.save();
    context.beginPath(); context.rect(x + 2, y + 20, width - 10, height - 22); context.clip();
    const firstIndex = Math.max(0, Math.floor(scrollPosition));
    const lastIndex = Math.min(overlay.options.length - 1, Math.ceil(scrollPosition) + visibleRows);
    for (let index = firstIndex; index <= lastIndex; index++) {
      const rowY = Math.round(y + 23 + (index - scrollPosition) * 20);
      if (index === overlay.index) { context.fillStyle = "rgba(41, 69, 55, .64)"; context.fillRect(x + 5, rowY - 4, width - 14, 16); }
      drawBitmapText(context, font, overlay.options[index], x + 12, rowY, index === overlay.index ? "#ffffff" : "#aeb9b1");
    }
    context.restore();
    drawScrollBar(context, x + width - 6, y + 24, height - 29, visibleRows, overlay.options.length, scrollPosition);
    context.globalAlpha = 1;
  }

  function drawKeyboardKey(context, label, x, y, width, height, selected, numeric = false, disabled = false, latched = false, displayOverride = null) {
    const activeSelection = selected && !disabled;
    context.fillStyle = disabled ? "rgba(18, 21, 18, .68)" : activeSelection ? "rgba(49, 88, 68, .82)" : latched ? "rgba(35, 75, 54, .8)" : "rgba(28, 35, 30, .76)";
    roundedRect(context, x, y, width, height, 3); context.fill();
    context.strokeStyle = disabled ? (selected ? "#59615b" : "#272d29") : activeSelection || latched ? "#63e4a4" : "#3a453d"; context.stroke();
    const display = displayOverride ?? keyDisplay(label);
    const keyFont = numeric ? numericFont : font;
    const textWidth = measureBitmapText(keyFont, display);
    const textColor = disabled ? "#515852" : activeSelection ? "#ffffff" : latched ? "#8ff0b7" : "#b7c1b9";
    drawBitmapText(context, keyFont, display, x + Math.round((width - textWidth) / 2), y + Math.round((height - 8) / 2), textColor);
  }

  function drawNumericKeyboard(overlay) {
    const keys = numericKeys(overlay.mode, overlay.item.format === "float");
    drawBitmapText(bottom, font, `数値入力 ${overlay.mode === "hex" ? "HEX" : "DEC"}`, 12, 10, "#63e4a4");
    bottom.fillStyle = "rgba(8, 10, 9, .75)"; bottom.fillRect(12, 25, 296, 30);
    bottom.strokeStyle = "#3f5147"; bottom.strokeRect(12.5, 25.5, 295, 29);
    drawBitmapText(bottom, numericFont, overlay.mode === "hex" ? `0x${overlay.buffer}` : overlay.buffer, 20, 36, "#ffffff");
    let boundsX = drawBitmapText(bottom, font, "MIN:", 12, 61, "#7d8981");
    boundsX = drawBitmapText(bottom, numericFont, formatBound(overlay.item.minimum, overlay.item.format), boundsX, 61, "#7d8981");
    boundsX = drawBitmapText(bottom, font, "  MAX:", boundsX, 61, "#7d8981");
    drawBitmapText(bottom, numericFont, formatBound(overlay.item.maximum, overlay.item.format), boundsX, 61, "#7d8981");
    bottomHitRegions = [];
    const gridWidth = 296, keyHeight = 21, gap = 3, startX = 12, startY = 74;
    keys.forEach((row, rowIndex) => row.forEach((key, columnIndex) => {
      const keyWidth = Math.floor((gridWidth - gap * (row.length - 1)) / row.length);
      const rowWidth = keyWidth * row.length + gap * (row.length - 1);
      const rowX = startX + Math.floor((gridWidth - rowWidth) / 2);
      const x = rowX + columnIndex * (keyWidth + gap), y = startY + rowIndex * (keyHeight + gap);
      const disabled = !numericKeyEnabled(overlay, key);
      drawKeyboardKey(bottom, key, x, y, keyWidth, keyHeight, rowIndex === overlay.row && columnIndex === overlay.column, isNumericKeyLabel(key), disabled);
      bottomHitRegions.push({ x, y, width: keyWidth, height: keyHeight, row: rowIndex, column: columnIndex, disabled });
    }));
  }

  function formatBound(value, format) {
    if (format === "hex") return `0x${Math.round(value).toString(16).toUpperCase()}`;
    return format === "float" ? Number(value).toFixed(1) : String(value);
  }

  function drawSlider(overlay) {
    const entry = overlay.item;
    drawBitmapText(bottom, font, "数値スライダー", 12, 12, "#63e4a4");
    drawBitmapText(bottom, font, entry.label, 12, 30, "#ffffff");
    const display = formatBound(overlay.value, entry.format);
    drawBitmapText(bottom, numericFont, display, 308 - measureBitmapText(numericFont, display), 30, "#ffd166");
    const x = 20, y = 103, width = 280;
    bottom.fillStyle = "rgba(39, 48, 42, .72)"; bottom.fillRect(x, y, width, 4);
    const progress = (overlay.value - entry.minimum) / (entry.maximum - entry.minimum);
    bottom.fillStyle = "rgba(99, 228, 164, .88)"; bottom.fillRect(x, y, Math.round(width * progress), 4);
    bottom.fillStyle = "rgba(255, 255, 255, .9)"; bottom.fillRect(Math.round(x + width * progress) - 3, y - 5, 7, 14);
    drawBitmapText(bottom, numericFont, formatBound(entry.minimum, entry.format), x, 122, "#7d8981");
    const maxText = formatBound(entry.maximum, entry.format);
    drawBitmapText(bottom, numericFont, maxText, x + width - measureBitmapText(numericFont, maxText), 122, "#7d8981");
    const stepX = drawBitmapText(bottom, font, "STEP:", 127, 122, "#7d8981");
    drawBitmapText(bottom, numericFont, String(entry.step), stepX, 122, "#7d8981");
    drawBitmapText(bottom, font, "左右:変更  A:決定  B:取消", 72, 196, "#aeb9b1");
    bottomHitRegions = [{ x, y: y - 12, width, height: 30, slider: true }];
  }

  function drawTextKeyboard(overlay, now) {
    const layout = textKeyLayout(overlay.mode, overlay.compact);
    const geometry = textKeyboardGeometry(overlay.compact);
    const inputMode = overlay.mode === "kana" ? (overlay.script === "katakana" ? "カナ" : "かな") : "QWERTY";
    drawBitmapText(bottom, font, `${overlay.compact ? "小型" : ""}文字入力 ${inputMode}`, geometry.titleX, geometry.titleY, "#63e4a4");
    bottom.fillStyle = "rgba(8, 10, 9, .75)";
    roundedRect(bottom, geometry.inputX, geometry.inputY, geometry.inputWidth, geometry.inputHeight, geometry.inputRadius); bottom.fill();
    bottom.strokeStyle = "#3f5147"; bottom.stroke();
    drawBitmapText(bottom, font, overlay.value, geometry.textX, geometry.textY, "#ffffff");
    if (Math.floor(now / 500) % 2 === 0) {
      const caretX = geometry.textX + measureBitmapText(font, Array.from(overlay.value).slice(0, textCursor(overlay)).join(""));
      bottom.fillStyle = "#63e4a4";
      bottom.fillRect(caretX, geometry.caretY, 1, geometry.caretHeight);
    }
    drawBitmapText(bottom, font, `${Array.from(overlay.value).length}/8`, geometry.countX, geometry.countY, "#7d8981");
    bottomHitRegions = [{
      x: geometry.inputX, y: geometry.inputY, width: geometry.inputWidth, height: geometry.inputHeight,
      textCursor: true, textX: geometry.textX
    }];
    layout.forEach(({ key, row, column, x, y, width, height }) => {
      const disabled = !textKeyEnabled(overlay, key);
      const selected = touchedTextKey !== null && key === touchedTextKey;
      const latched = (overlay.mode === "kana" && ((key === "HIRAGANA" && overlay.script !== "katakana") ||
        (key === "KATAKANA" && overlay.script === "katakana") || (key === "AIU" && overlay.script !== "katakana"))) ||
        (overlay.mode === "abc" && (key === "ABC" || (key === "CAPS" && overlay.caps) || (key === "SHIFT" && overlay.shift)));
      drawKeyboardKey(bottom, key, x, y, width, height, selected, false, disabled, latched, textKeyDisplay(key, overlay));
      bottomHitRegions.push({ x, y, width, height, row, column, key, disabled });
    });
  }

  function drawBottomOverlay(now) {
    bottomHitRegions = [];
    const overlay = menu.overlay;
    if (!overlay || overlay.screen !== "bottom") return;
    if (overlay.type === "text") {
      const amount = textKeyboardAmount(overlay, now);
      if (amount <= 0) return;
      bottom.fillStyle = `rgba(0, 0, 0, ${(TEXT_KEYBOARD.backdropAlpha * amount).toFixed(3)})`;
      bottom.fillRect(0, 0, bottomCanvas.width, bottomCanvas.height);
      bottom.save();
      bottom.globalAlpha = amount;
      drawTextKeyboard(overlay, now);
      bottom.restore();
      if (overlay.closing) bottomHitRegions = [];
      return;
    }
    const amount = overlay.type === "listbox" ? listboxAmount(overlay, now) : bottomOverlayAmount(overlay, now);
    if (amount <= 0) return;
    bottom.fillStyle = `rgba(16, 20, 17, ${(BOTTOM_OVERLAY.backdropAlpha * amount).toFixed(3)})`;
    bottom.fillRect(0, 0, bottomCanvas.width, bottomCanvas.height);
    if (overlay.type === "listbox") {
      drawListbox(bottom, 52, 216, overlay, now, bottomCanvas.width);
    } else {
      bottom.save();
      bottom.globalAlpha = amount;
      if (overlay.type === "numeric") drawNumericKeyboard(overlay);
      else if (overlay.type === "slider") drawSlider(overlay);
      else if (overlay.type === "hotkey-capture") drawHotkeyCapture(overlay);
      bottom.restore();
    }
    if (overlay.closing) bottomHitRegions = [];
  }

  let nextFrameAt = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (now < nextFrameAt) return;
    // CTRPF移植時も描画・入力更新を30Hzの同一tickへ寄せる。
    // ブラウザ側は高リフレッシュレートでも余分なrAFを描画せず、30FPSへ固定する。
    nextFrameAt = now + FRAME.interval;
    controls.update(now);
    top.fillStyle = topBackgroundColor.value; top.fillRect(0, 0, topCanvas.width, topCanvas.height);
    bottom.fillStyle = bottomBackgroundColor.value; bottom.fillRect(0, 0, bottomCanvas.width, bottomCanvas.height);
    const notices = timeline.sample(now);
    for (const notice of notices) drawNotice(notice);
    drawMenu(now);
    drawBottomOverlay(now);
    activeCount.textContent = String(notices.length);
    dirtyCount.textContent = String(menu.dirtyCount());
    openMenuButton.textContent = menu.openTarget ? "チートメニューを閉じる" : "チートメニューを開く";
  }

  function pressControl(key, pressed = true) {
    const now = performance.now();
    if (pressed) controls.press(key, now);
    else controls.release(key, now);
  }

  document.getElementById("addButton").addEventListener("click", addNotice);
  document.getElementById("burstButton").addEventListener("click", () => {
    addNotice();
    setTimeout(addNotice, NOTICE.spawnInterval);
    setTimeout(addNotice, NOTICE.spawnInterval * 2);
  });
  document.getElementById("clearButton").addEventListener("click", () => timeline.clear());
  openMenuButton.addEventListener("click", () => menu.openTarget ? menu.close(performance.now()) : menu.open(performance.now()));
  for (const [picker, output] of [[topBackgroundColor, topBackgroundValue], [bottomBackgroundColor, bottomBackgroundValue]]) {
    picker.addEventListener("input", () => { output.value = picker.value.toUpperCase(); });
  }
  scaleButton.addEventListener("click", () => {
    doubled = !doubled;
    previewArea.classList.toggle("double-size", doubled);
    scaleButton.classList.toggle("active", doubled);
    scaleButton.setAttribute("aria-pressed", String(doubled));
    scaleButton.textContent = doubled ? "ピクセル等倍に戻す" : "画面サイズを2倍";
    topScaleLabel.textContent = doubled ? "800 × 480 px · PIXEL 2:1" : "400 × 240 px · PIXEL 1:1";
    bottomScaleLabel.textContent = doubled ? "640 × 480 px · PIXEL 2:1" : "320 × 240 px · PIXEL 1:1";
  });

  document.querySelectorAll("[data-control]").forEach((button) => {
    const key = button.dataset.control;
    button.addEventListener("pointerdown", (event) => { event.preventDefault(); button.setPointerCapture(event.pointerId); pressControl(key, true); });
    button.addEventListener("pointerup", () => pressControl(key, false));
    button.addEventListener("pointercancel", () => pressControl(key, false));
  });

  const keyboardMap = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    Enter: "a", KeyZ: "a", Escape: "b", KeyX: "b", KeyC: "x", KeyV: "y",
    KeyQ: "l", KeyR: "r", KeyE: "zl", KeyT: "zr", Digit1: "select", Digit2: "start"
  };
  window.addEventListener("keydown", (event) => {
    if (event.code === "Space" && !event.repeat) { event.preventDefault(); addNotice(); return; }
    const key = keyboardMap[event.code];
    if (key && !event.repeat) { event.preventDefault(); pressControl(key, true); }
  });
  window.addEventListener("keyup", (event) => { const key = keyboardMap[event.code]; if (key) pressControl(key, false); });
  window.addEventListener("blur", () => controls.releaseAll(performance.now()));

  function canvasPoint(event, canvas) {
    const rectangle = canvas.getBoundingClientRect();
    return { x: (event.clientX - rectangle.left) * canvas.width / rectangle.width, y: (event.clientY - rectangle.top) * canvas.height / rectangle.height };
  }

  bottomCanvas.addEventListener("pointerdown", (event) => {
    // 下画面の操作可能UIが表示中はタッチをUIが占有する。
    // CTRPF移植時はこのタッチをゲーム本体へ透過させない。UI自身のタッチ操作だけを処理する。
    touchedTextKey = null;
    const point = canvasPoint(event, bottomCanvas);
    const region = bottomHitRegions.find((entry) => point.x >= entry.x && point.x <= entry.x + entry.width && point.y >= entry.y && point.y <= entry.y + entry.height);
    if (!region || !menu.overlay) return;
    if (menu.overlay.type === "hotkey-capture") {
      const now = performance.now();
      if (region.captureAction === "disable") menu.disableHotkeyCapture(now);
      else if (region.captureAction === "cancel") menu.cancelHotkeyCapture(now);
      return;
    }
    if (region.textCursor && menu.overlay.type === "text") {
      menu.setTextCursor(bitmapTextCursorAt(font, menu.overlay.value, point.x - region.textX));
    } else if (region.slider) {
      const entry = menu.overlay.item;
      const raw = entry.minimum + clamp((point.x - region.x) / region.width, 0, 1) * (entry.maximum - entry.minimum);
      menu.overlay.value = Math.round(raw / entry.step) * entry.step;
    } else if (!region.disabled && menu.overlay.type === "text") {
      touchedTextKey = region.key;
      bottomCanvas.setPointerCapture?.(event.pointerId);
      menu.selectOverlayCell(region.row, region.column, false, performance.now());
    } else if (!region.disabled) menu.selectOverlayCell(region.row, region.column, true, performance.now());
  });
  bottomCanvas.addEventListener("pointerup", () => { touchedTextKey = null; });
  bottomCanvas.addEventListener("pointercancel", () => { touchedTextKey = null; });

  topCanvas.addEventListener("pointerdown", (event) => {
    const point = canvasPoint(event, topCanvas);
    const region = topHitRegions.find((entry) => point.x >= entry.x && point.x <= entry.x + entry.width && point.y >= entry.y && point.y <= entry.y + entry.height);
    if (!menu.visible || menu.dialog || menu.overlay || menu.inlineList) return;
    if (!region) return;
    menu.currentFrame().selection = region.itemIndex;
    menu.handle("a", performance.now(), true);
  });

  requestAnimationFrame(frame);
}

const CTRPFPreviewCore = Object.freeze({
  measureBitmapText, bitmapTextCursorAt, drawBitmapText, trimBitmapText, wrapBitmapText,
  listboxVerticalPosition, textKeyboardGeometry, topOverlayHorizontalPosition, dialogHorizontalPosition, isNumericEntry, isNumericKeyLabel
});
if (typeof module !== "undefined" && module.exports) module.exports = { ...require("./ui-model.js"), ...CTRPFPreviewCore };
if (typeof window !== "undefined") window.CTRPFPreviewCore = CTRPFPreviewCore;
if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}
})();
