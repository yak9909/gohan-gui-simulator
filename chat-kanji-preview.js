"use strict";

(function (root) {
  const data = typeof module !== "undefined" && module.exports
    ? require("./chat-kanji-preview-data.js")
    : root.ACNL_CHAT_KANJI_PREVIEW_DATA;
  if (!data) return;

  // The conversion row and the kana keyboard share one 304px-wide body.
  // The new clear key occupies the same right-side utility-key column as 消去;
  // the candidate viewport gives up exactly that width instead of overlapping it.
  const CHAT_LAYOUT = Object.freeze({
    x: 8, width: 304,
    candidateY: 49, candidateHeight: 17,
    clearWidth: 44,
    cursorButtonSize: 17, cursorButtonGap: 2, cursorButtonY: 10
  });
  const CLEAR_BUTTON = Object.freeze({
    x: CHAT_LAYOUT.x + CHAT_LAYOUT.width - CHAT_LAYOUT.clearWidth,
    y: CHAT_LAYOUT.candidateY,
    width: CHAT_LAYOUT.clearWidth,
    height: CHAT_LAYOUT.candidateHeight
  });
  const CANDIDATE_BAR = Object.freeze({
    x: CHAT_LAYOUT.x, y: CHAT_LAYOUT.candidateY,
    width: CHAT_LAYOUT.width - CHAT_LAYOUT.clearWidth, height: CHAT_LAYOUT.candidateHeight,
    gap: 2, paddingX: 4, textCellY: 48, textScale: 0.72
  });
  const CURSOR_BUTTONS = Object.freeze({
    left: Object.freeze({
      x: CHAT_LAYOUT.x + CHAT_LAYOUT.width - CHAT_LAYOUT.cursorButtonSize * 2 - CHAT_LAYOUT.cursorButtonGap,
      y: CHAT_LAYOUT.cursorButtonY,
      width: CHAT_LAYOUT.cursorButtonSize,
      height: CHAT_LAYOUT.cursorButtonSize
    }),
    right: Object.freeze({
      x: CHAT_LAYOUT.x + CHAT_LAYOUT.width - CHAT_LAYOUT.cursorButtonSize,
      y: CHAT_LAYOUT.cursorButtonY,
      width: CHAT_LAYOUT.cursorButtonSize,
      height: CHAT_LAYOUT.cursorButtonSize
    })
  });
  const INPUT_TEXT_AREA = Object.freeze({ x: 14, y: 10, width: 254, height: 31, textX: 18, caretY: 16, caretHeight: 18, advance: 16 });
  const INPUT_PREVIEW_TEXT = "かんじ";
  const CANDIDATE_COLORS = Object.freeze({
  // The supplied ACNL screenshot uses this dark brown on utility keys such as delete/space.
  panel: "#522810",
  border: "#522810",
  separator: "#522810",
  selected: "rgba(239, 255, 214, 0.24)",
  text: "#fff3d6",
  selectedText: "#fff3d6",
  scrollHint: "rgba(255, 243, 214, 0.62)"
});

  // Additional preview glyphs are extracted from the same supplied Garden_msg_size16.bcfnt.
  // The source texture is A4; the rows below preserve its 4-bit alpha values exactly.
  const EXTRA_GLYPHS = Object.freeze({
    "監":{"left":0,"glyphWidth":16,"charWidth":16,"rows":["00000000000000000","00000000000000000","00000000000000000","00000000000000000","00111111028200000","0bffffff68f900000","0fa07f100bfc99950","0ffdefec0ee999950","0fa1117f5f6000000","0fd999cfad0000000","0fc5af74127777600","0fc5af7533ddddc00","06bbbbbb900000000","00255555555553000","01febefbcfebef300","03f90bf01f907f500","03f90bf01f907f500","05fa1cf13fa18f700","7ffffffffffffff80","00000000000000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000"]},
    "か":{"left":0,"glyphWidth":15,"charWidth":16,"rows":["00000000000000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000","00001d70000000000","00006fb0006000000","0000af7002fe40000","2555ef97503ff6000","7ffeffddfe25ff600","0008f8005fa09ff00","000ef3000ff00eb00","004fd0000ff000000","00af70000ff000000","02ff10003fd000000","09fa00006fa000000","2ff20000df6000000","afa1fd9dfd0000000","be106cffb20000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000"]},
    "ん":{"left":0,"glyphWidth":15,"charWidth":16,"rows":["00000000000000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000","00000480000000000","00000ef4000000000","00006fd0000000000","0000df60000000000","0004fe00000000000","000af700000000000","001ff000000000000","008fa9ec000007600","00effcef60000e900","05ff906f70002f600","0bfc005f90008f200","1ff4004fb003fb000","6fd0001ff87ff2000","9f700008fffe40000","03000000475000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000"]},
    "カ":{"left":1,"glyphWidth":14,"charWidth":16,"rows":["00000000000000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000","000006d4000000000","00000bf8000000000","00000bf7000000000","4fffffffffffa0000","05555ff9556ef6000","00001ff2000bf7000","00004ff0000bf7000","00008fa0000df6000","0000ef40000ef5000","0006fc00001ff2000","001ef300005ff0000","00cf600000cfa0000","2df603fdbeff20000","ec30004aefd400000","10000000000000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000"]},
    "ン":{"left":1,"glyphWidth":14,"charWidth":16,"rows":["00000000000000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000","8c710000000000000","3dff8100000020000","00bffe000001f5000","0009ff000007f2000","00005300000ec0000","00000000009f50000","0000000005fd00000","000000006ff300000","0000001aff5000000","00004afff50000000","1adffffc200000000","5ffffb40000000000","06740000000000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000"]},
    "ジ":{"left":0,"glyphWidth":15,"charWidth":16,"rows":["00000000000000000","00000000000000000","00000000000000000","00000000000000000","000000000690e6000","0063000005e49e300","01dffa3000ce1eb00","0007fff1003e16700","00001bc000006c000","584000000000db000","7fff91000003f6000","01affa00000cf0000","0005b400008f80000","0000000007fd00000","00000001aff200000","0000039ffe3000000","04acffffb10000000","0cffffa3000000000","02763000000000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000"]}
  });

  const PREVIEW_CANDIDATES = Object.freeze([
    "漢字", "感じ", "幹事", "完治", "監事", "かんじ", "カンジ",
    "漢", "感", "幹", "完", "監", "字", "事", "治"
  ]);
  const DRAW_DATA = Object.freeze({
    ...data,
    glyphs: Object.freeze({ ...data.glyphs, ...EXTRA_GLYPHS }),
    candidates: PREVIEW_CANDIDATES
  });

  function previewItem(menu) {
    return menu?.rootItems?.find((entry) => entry?.previewKind === "chat-kanji") || null;
  }

  function isPreviewEnabled(menu) {
    return previewItem(menu)?.appliedValue === true;
  }

  function glyphAdvance(glyph, scale = 1) {
    return Math.max(1, Math.round((glyph?.charWidth ?? DRAW_DATA.source.fontCell[0]) * scale));
  }

  function measureBcfntText(text, fontData = DRAW_DATA, scale = 1) {
    let width = 0;
    for (const character of Array.from(String(text))) width += glyphAdvance(fontData.glyphs[character], scale);
    return width;
  }

  function drawBcfntGlyph(context, glyph, x, cellY, color, scale = 1) {
    if (!glyph) return 0;
    const baseAlpha = context.globalAlpha;
    context.fillStyle = color;

    if (scale >= 0.999) {
      for (let row = 0; row < glyph.rows.length; row++) {
        const pixels = glyph.rows[row];
        for (let column = 0; column < pixels.length; column++) {
          const alpha = parseInt(pixels[column], 16);
          if (!alpha) continue;
          context.globalAlpha = baseAlpha * alpha / 15;
          context.fillRect(Math.round(x) + glyph.left + column, Math.round(cellY) + row, 1, 1);
        }
      }
    } else {
  // Area-weighted downsampling preserves the supplied A4 coverage instead of
  // max-pooling it. Max-pooling made neighboring strokes merge and visibly
  // corrupted dense kanji at the reduced preview size.
  const sourceHeight = glyph.rows.length;
  const sourceWidth = glyph.rows[0]?.length || 0;
  const outputWidth = Math.max(1, Math.round(sourceWidth * scale));
  const outputHeight = Math.max(1, Math.round(sourceHeight * scale));
  const left = Math.round(glyph.left * scale);
  for (let oy = 0; oy < outputHeight; oy++) {
    const sy0 = oy / scale;
    const sy1 = Math.min(sourceHeight, (oy + 1) / scale);
    for (let ox = 0; ox < outputWidth; ox++) {
      const sx0 = ox / scale;
      const sx1 = Math.min(sourceWidth, (ox + 1) / scale);
      let weightedAlpha = 0;
      let coveredArea = 0;
      const firstSy = Math.floor(sy0);
      const lastSy = Math.min(sourceHeight - 1, Math.ceil(sy1) - 1);
      const firstSx = Math.floor(sx0);
      const lastSx = Math.min(sourceWidth - 1, Math.ceil(sx1) - 1);
      for (let sy = firstSy; sy <= lastSy; sy++) {
        const overlapY = Math.max(0, Math.min(sy + 1, sy1) - Math.max(sy, sy0));
        if (!overlapY) continue;
        for (let sx = firstSx; sx <= lastSx; sx++) {
          const overlapX = Math.max(0, Math.min(sx + 1, sx1) - Math.max(sx, sx0));
          const area = overlapX * overlapY;
          if (!area) continue;
          weightedAlpha += parseInt(glyph.rows[sy][sx], 16) * area;
          coveredArea += area;
        }
      }
      const alpha = coveredArea ? weightedAlpha / coveredArea : 0;
      if (alpha <= 0.01) continue;
      context.globalAlpha = baseAlpha * alpha / 15;
      context.fillRect(Math.round(x) + left + ox, Math.round(cellY) + oy, 1, 1);
    }
  }
}

context.globalAlpha = baseAlpha;
    return glyphAdvance(glyph, scale);
  }

  function drawBcfntText(context, text, x, cellY, color, fontData = DRAW_DATA, scale = 1) {
    let cursor = Math.round(x);
    for (const character of Array.from(String(text))) {
      const glyph = fontData.glyphs[character];
      cursor += glyph ? drawBcfntGlyph(context, glyph, cursor, cellY, color, scale) : glyphAdvance(null, scale);
    }
    return cursor;
  }

  function candidateLayout(fontData = DRAW_DATA) {
    const bar = CANDIDATE_BAR;
    let cursor = 0;
    const items = fontData.candidates.map((candidate, index) => {
      const textWidth = measureBcfntText(candidate, fontData, bar.textScale);
      const width = textWidth + bar.paddingX * 2;
      const item = { candidate, index, x: cursor, width, textWidth };
      cursor += width + bar.gap;
      return item;
    });
    const contentWidth = Math.max(0, cursor - bar.gap);
    return { items, contentWidth };
  }

  function createCandidateState() {
    return { selectedIndex: 0, scrollX: 0, dragging: false, dragStartX: 0, dragStartScrollX: 0, dragMoved: false };
  }

  function createInputState(value = INPUT_PREVIEW_TEXT) {
    const normalized = Array.from(String(value)).join("");
    return { value: normalized, cursorIndex: Array.from(normalized).length, cleared: false };
  }

  function moveInputCursor(state, delta) {
    const length = Array.from(String(state?.value ?? "")).length;
    const current = Math.max(0, Math.min(length, Number(state?.cursorIndex) || 0));
    state.cursorIndex = Math.max(0, Math.min(length, current + Math.sign(Number(delta) || 0)));
    return state.cursorIndex;
  }

  function clearInput(state) {
    state.value = "";
    state.cursorIndex = 0;
    state.cleared = true;
    return state.value;
  }

  function maximumCandidateScroll(fontData = DRAW_DATA) {
    return Math.max(0, candidateLayout(fontData).contentWidth - (CANDIDATE_BAR.width - 2));
  }

  function clampCandidateScroll(state, fontData = DRAW_DATA) {
    state.scrollX = Math.max(0, Math.min(maximumCandidateScroll(fontData), Number(state.scrollX) || 0));
    return state.scrollX;
  }

  function ensureCandidateVisible(state, index = state.selectedIndex, fontData = DRAW_DATA) {
    const layout = candidateLayout(fontData);
    const item = layout.items[index];
    if (!item) return clampCandidateScroll(state, fontData);
    const viewportWidth = CANDIDATE_BAR.width - 2;
    if (item.x < state.scrollX) state.scrollX = item.x;
    else if (item.x + item.width > state.scrollX + viewportWidth) state.scrollX = item.x + item.width - viewportWidth;
    return clampCandidateScroll(state, fontData);
  }

  function setCandidateIndex(state, index, fontData = DRAW_DATA) {
    const count = fontData.candidates.length;
    if (!count) return -1;
    state.selectedIndex = (Math.round(index) + count) % count;
    ensureCandidateVisible(state, state.selectedIndex, fontData);
    return state.selectedIndex;
  }

  function scrollCandidates(state, delta, fontData = DRAW_DATA) {
    state.scrollX += Number(delta) || 0;
    return clampCandidateScroll(state, fontData);
  }

  function drawCandidateBar(context, stateOrIndex = 0, fontData = DRAW_DATA) {
    const state = typeof stateOrIndex === "number"
      ? { selectedIndex: stateOrIndex, scrollX: 0 }
      : (stateOrIndex || createCandidateState());
    clampCandidateScroll(state, fontData);
    const bar = CANDIDATE_BAR;
    const layout = candidateLayout(fontData);

    context.save();
    context.fillStyle = CANDIDATE_COLORS.panel;
    // Paint the complete conversion row once. Candidate viewport + clear key
    // therefore read as one keyboard-width component rather than two panels.
    context.fillRect(CHAT_LAYOUT.x, bar.y, CHAT_LAYOUT.width, bar.height);
    context.beginPath();
    context.rect(bar.x + 1, bar.y + 1, bar.width - 2, bar.height - 2);
    context.clip();

    layout.items.forEach((item) => {
      const x = bar.x + 1 + item.x - state.scrollX;
      if (x + item.width < bar.x || x > bar.x + bar.width) return;
      if (item.index === state.selectedIndex) {
        context.fillStyle = CANDIDATE_COLORS.selected;
        context.fillRect(Math.round(x), bar.y + 1, Math.round(item.width), bar.height - 2);
      }
      if (item.index > 0) {
        context.fillStyle = CANDIDATE_COLORS.separator;
        context.fillRect(Math.round(x - bar.gap / 2), bar.y + 3, 1, bar.height - 6);
      }
      const textX = x + Math.max(bar.paddingX, (item.width - item.textWidth) / 2);
      drawBcfntText(
        context,
        item.candidate,
        textX,
        bar.textCellY,
        item.index === state.selectedIndex ? CANDIDATE_COLORS.selectedText : CANDIDATE_COLORS.text,
        fontData,
        bar.textScale
      );
    });
    context.restore();

    const maximum = maximumCandidateScroll(fontData);
    if (maximum > 0) {
      context.fillStyle = CANDIDATE_COLORS.scrollHint;
      if (state.scrollX > 0) context.fillRect(bar.x + 2, bar.y + 3, 2, bar.height - 6);
      if (state.scrollX < maximum) context.fillRect(bar.x + bar.width - 4, bar.y + 3, 2, bar.height - 6);
    }
  }

  function measureUiText(font, text) {
    let width = 0;
    for (const character of Array.from(String(text))) {
      const glyph = font?.glyphs?.[String(character.codePointAt(0))];
      width += glyph ? glyph.advance : 4;
    }
    return width;
  }

  function drawUiText(context, font, text, x, y, color) {
    if (!font?.glyphs) return x;
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

  function pointInside(point, rectangle) {
    return point.x >= rectangle.x && point.x < rectangle.x + rectangle.width && point.y >= rectangle.y && point.y < rectangle.y + rectangle.height;
  }

  function drawArrowIcon(context, rectangle, direction, active) {
    const cy = Math.round(rectangle.y + rectangle.height / 2);
    const cx = Math.round(rectangle.x + rectangle.width / 2);
    context.fillStyle = active ? CANDIDATE_COLORS.text : "rgba(255, 243, 214, 0.30)";
    if (direction < 0) {
      context.fillRect(cx - 4, cy, 8, 1);
      context.fillRect(cx - 4, cy - 1, 1, 3);
      context.fillRect(cx - 3, cy - 2, 1, 5);
    } else {
      context.fillRect(cx - 3, cy, 8, 1);
      context.fillRect(cx + 4, cy - 1, 1, 3);
      context.fillRect(cx + 3, cy - 2, 1, 5);
    }
  }

  function drawControlButton(context, rectangle, active = true) {
    context.fillStyle = CANDIDATE_COLORS.panel;
    context.fillRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
    context.strokeStyle = active ? "rgba(255, 243, 214, 0.38)" : "rgba(255, 243, 214, 0.18)";
    context.strokeRect(rectangle.x + 0.5, rectangle.y + 0.5, rectangle.width - 1, rectangle.height - 1);
  }

  function drawPreviewControls(context, inputState, uiFont = root.MISAKI_GOTHIC_2ND_8) {
    const state = inputState || createInputState();
    const length = Array.from(String(state.value ?? "")).length;
    state.cursorIndex = Math.max(0, Math.min(length, Number(state.cursorIndex) || 0));

    // One outer edge joins the candidates and clear key into the keyboard width.
    context.strokeStyle = CANDIDATE_COLORS.border;
    context.strokeRect(CHAT_LAYOUT.x + 0.5, CHAT_LAYOUT.candidateY + 0.5, CHAT_LAYOUT.width - 1, CHAT_LAYOUT.candidateHeight - 1);
    context.fillStyle = CANDIDATE_COLORS.scrollHint;
    context.fillRect(CLEAR_BUTTON.x, CLEAR_BUTTON.y + 2, 1, CLEAR_BUTTON.height - 4);

    context.fillStyle = CANDIDATE_COLORS.panel;
    context.fillRect(CLEAR_BUTTON.x + 1, CLEAR_BUTTON.y + 1, CLEAR_BUTTON.width - 2, CLEAR_BUTTON.height - 2);
    const clearLabel = "クリア";
    const clearWidth = measureUiText(uiFont, clearLabel);
    drawUiText(context, uiFont, clearLabel, CLEAR_BUTTON.x + Math.floor((CLEAR_BUTTON.width - clearWidth) / 2), CLEAR_BUTTON.y + 5, CANDIDATE_COLORS.text);

    const leftActive = state.cursorIndex > 0;
    const rightActive = state.cursorIndex < length;
    drawControlButton(context, CURSOR_BUTTONS.left, leftActive);
    drawControlButton(context, CURSOR_BUTTONS.right, rightActive);
    drawArrowIcon(context, CURSOR_BUTTONS.left, -1, leftActive);
    drawArrowIcon(context, CURSOR_BUTTONS.right, 1, rightActive);

    // The source capture contains the sample input. A clear action masks that
    // sample, while the caret is kept as a small overlay so one-character cursor
    // movement is visible without replacing the supplied ACNL keyboard artwork.
    if (state.cleared) {
      context.fillStyle = "rgba(255, 247, 214, 0.98)";
      context.fillRect(INPUT_TEXT_AREA.x, INPUT_TEXT_AREA.y, INPUT_TEXT_AREA.width, INPUT_TEXT_AREA.height);
    }
    const caretX = Math.min(
      INPUT_TEXT_AREA.x + INPUT_TEXT_AREA.width - 1,
      INPUT_TEXT_AREA.textX + state.cursorIndex * INPUT_TEXT_AREA.advance
    );
    context.fillStyle = CANDIDATE_COLORS.border;
    context.fillRect(caretX, INPUT_TEXT_AREA.caretY, 1, INPUT_TEXT_AREA.caretHeight);
  }

  function drawPreview(context, sourceImage, stateOrIndex = 0, fontData = DRAW_DATA, inputState = null) {
    if (!context || !sourceImage) return false;
    context.save();
    context.imageSmoothingEnabled = false;
    context.globalAlpha = 1;
    context.drawImage(sourceImage, 0, 0, fontData.image.width, fontData.image.height);
    drawCandidateBar(context, stateOrIndex, fontData);
    drawPreviewControls(context, inputState, root.MISAKI_GOTHIC_2ND_8);
    context.restore();
    return true;
  }

  function canvasPoint(canvas, event) {
    const rectangle = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rectangle.left) * canvas.width / rectangle.width,
      y: (event.clientY - rectangle.top) * canvas.height / rectangle.height
    };
  }

  function candidateAtX(x, state, fontData = DRAW_DATA) {
    const contentX = x - CANDIDATE_BAR.x - 1 + state.scrollX;
    return candidateLayout(fontData).items.find((item) => contentX >= item.x && contentX < item.x + item.width)?.index ?? -1;
  }

  function insideCandidateBar(point) {
    const bar = CANDIDATE_BAR;
    return point.x >= bar.x && point.x < bar.x + bar.width && point.y >= bar.y && point.y < bar.y + bar.height;
  }

  function install() {
    if (typeof document === "undefined" || typeof Image === "undefined") return;
    const canvas = document.getElementById("bottomScreen");
    if (!canvas) return;
    const context = canvas.getContext("2d");
    const sourceImage = new Image();
    const candidateState = createCandidateState();
    const inputState = createInputState();
    sourceImage.decoding = "async";
    sourceImage.src = `data:${DRAW_DATA.image.mime};base64,${DRAW_DATA.image.base64}`;

    canvas.addEventListener("pointerdown", (event) => {
      const menu = root.__gohanMenuModel;
      const point = canvasPoint(canvas, event);
      if (!menu || !isPreviewEnabled(menu) || menu.overlay?.screen === "bottom") return;

      if (pointInside(point, CLEAR_BUTTON)) {
        clearInput(inputState);
        candidateState.selectedIndex = 0;
        candidateState.scrollX = 0;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (pointInside(point, CURSOR_BUTTONS.left)) {
        moveInputCursor(inputState, -1);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (pointInside(point, CURSOR_BUTTONS.right)) {
        moveInputCursor(inputState, 1);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (!insideCandidateBar(point)) return;

      candidateState.dragging = true;
      candidateState.dragMoved = false;
      candidateState.dragStartX = point.x;
      candidateState.dragStartScrollX = candidateState.scrollX;
      const index = candidateAtX(point.x, candidateState, DRAW_DATA);
      if (index >= 0) setCandidateIndex(candidateState, index, DRAW_DATA);
      canvas.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    }, true);

    canvas.addEventListener("pointermove", (event) => {
      if (!candidateState.dragging) return;
      const point = canvasPoint(canvas, event);
      const delta = point.x - candidateState.dragStartX;
      if (Math.abs(delta) >= 2) candidateState.dragMoved = true;
      candidateState.scrollX = candidateState.dragStartScrollX - delta;
      clampCandidateScroll(candidateState, DRAW_DATA);
      event.preventDefault();
      event.stopPropagation();
    }, true);

    const finishPointer = (event) => {
      if (!candidateState.dragging) return;
      candidateState.dragging = false;
      canvas.releasePointerCapture?.(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    };
    canvas.addEventListener("pointerup", finishPointer, true);
    canvas.addEventListener("pointercancel", finishPointer, true);

    canvas.addEventListener("wheel", (event) => {
      const menu = root.__gohanMenuModel;
      const point = canvasPoint(canvas, event);
      if (!menu || !isPreviewEnabled(menu) || menu.overlay?.screen === "bottom" || !insideCandidateBar(point)) return;
      scrollCandidates(candidateState, Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY, DRAW_DATA);
      event.preventDefault();
      event.stopPropagation();
    }, { capture: true, passive: false });

    window.addEventListener("keydown", (event) => {
      const menu = root.__gohanMenuModel;
      if (!menu || menu.visible || menu.overlay?.screen === "bottom" || !isPreviewEnabled(menu)) return;
      if (event.key === "ArrowLeft") setCandidateIndex(candidateState, candidateState.selectedIndex - 1, DRAW_DATA);
      else if (event.key === "ArrowRight") setCandidateIndex(candidateState, candidateState.selectedIndex + 1, DRAW_DATA);
      else return;
      event.preventDefault();
    }, true);

    function frame() {
      requestAnimationFrame(frame);
      const menu = root.__gohanMenuModel;
      if (!menu || !isPreviewEnabled(menu) || !sourceImage.complete || sourceImage.naturalWidth !== DRAW_DATA.image.width) return;
      // Existing operable bottom-screen UI takes priority over the passive preview.
      if (menu.overlay?.screen === "bottom") return;
      drawPreview(context, sourceImage, candidateState, DRAW_DATA, inputState);
    }
    requestAnimationFrame(frame);
  }

  const api = Object.freeze({
    CHAT_LAYOUT,
    CLEAR_BUTTON,
    CANDIDATE_BAR,
    CURSOR_BUTTONS,
    INPUT_TEXT_AREA,
    CANDIDATE_COLORS,
    EXTRA_GLYPHS,
    PREVIEW_CANDIDATES,
    DRAW_DATA,
    previewItem,
    isPreviewEnabled,
    measureBcfntText,
    drawBcfntGlyph,
    drawBcfntText,
    candidateLayout,
    createCandidateState,
    createInputState,
    moveInputCursor,
    clearInput,
    maximumCandidateScroll,
    clampCandidateScroll,
    ensureCandidateVisible,
    setCandidateIndex,
    scrollCandidates,
    drawCandidateBar,
    drawPreviewControls,
    drawPreview,
    pointInside,
    install
  });
  if (root) root.ACNLChatKanjiPreview = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
    else install();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
