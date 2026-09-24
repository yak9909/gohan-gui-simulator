"use strict";

(function (root) {
  const data = typeof module !== "undefined" && module.exports
    ? require("./chat-kanji-preview-data.js")
    : root.ACNL_CHAT_KANJI_PREVIEW_DATA;
  if (!data) return;

  const CANDIDATE_BAR = Object.freeze({
    x: 8, y: 48, width: 304, height: 17,
    gap: 2, paddingX: 4, textCellY: 47, textScale: 0.72
  });
  const CANDIDATE_COLORS = Object.freeze({
    panel: "#947d63",
    border: "#523010",
    separator: "rgba(82, 48, 16, 0.58)",
    selected: "#c99b5c",
    text: "#fff3d6",
    selectedText: "#3e2412",
    scrollHint: "rgba(82, 48, 16, 0.72)"
  });

  // Additional preview glyphs are extracted from the same supplied Garden_msg_size16.bcfnt.
  // The source texture is A4; the rows below preserve its 4-bit alpha values exactly.
  const EXTRA_GLYPHS = Object.freeze({
    "監":{"left":0,"glyphWidth":16,"charWidth":16,"rows":["00000000000000000","00000000000000000","00000000000000000","00000000000000000","01011110182020000","0fbffff6ff8090000","0af701f00fb9c9905","0ffedef0cee999905","0af11715f6f000000","0df99c9af0d000000","0cfa57f1472776700","0cfa57f35d3ddcd00","0b6bbbb9b00000000","02055555555550300","0f1befecbefeb3f00","0f309fb109f705f00","0f309fb109f705f00","0f51afc31af817f00","0ffffffffffffff08","00000000000000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000"]},
    "か":{"left":0,"glyphWidth":15,"charWidth":16,"rows":["00000000000000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000","000107d0000000000","00060bf0060000000","000a07f00f24e0000","055e59f5730ff0600","0fffedffd2ef56f00","000f80850af90ff00","000fe0300ff00be00","040df0000ff000000","0a07f0000ff000000","0f21f0030df000000","0f90a0060af000000","0ff0200d06f000000","0aff19dfd0d000000","01e60fcbf02000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000"]},
    "ん":{"left":0,"glyphWidth":15,"charWidth":16,"rows":["00000000000000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000","00000840000000000","00000fe0400000000","00060df0000000000","000d06f0000000000","000f40e0000000000","000fa070000000000","010ff000000000000","080afe90c00006700","0e0ffec6f00009e00","0f59f607f00206f00","0fb0c509f00802f00","0ff0440bf00f30b00","0df0010ff78ff0200","07f0000f8ff4e0000","00300004057000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000"]},
    "カ":{"left":1,"glyphWidth":14,"charWidth":16,"rows":["00000000000000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000","00000d60400000000","00000fb0800000000","00000fb0700000000","0ffffffffffaf0000","05555ff5965fe0600","00010ff0200fb0700","00040ff0000fb0700","00080af0000fd0600","000e04f0000fe0500","000f60c0010ff0200","010fe030050ff0000","0c06f0000c0af0000","0fd06f3bdfe2f0000","03c0040eadf040000","00000000000000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000"]},
    "ン":{"left":1,"glyphWidth":14,"charWidth":16,"rows":["00000000000000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000","07c01000000000000","0fd8f010000200000","0b0ff0e0000f10500","000f90f0000f70200","00050030000ce0000","000000000905f0000","000000000f50d0000","000000060ff030000","0000010fa5f000000","00040faff05000000","0daffff2c00000000","0ffff4b0000000000","07604000000000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000"]},
    "ジ":{"left":0,"glyphWidth":15,"charWidth":16,"rows":["00000000000000000","00000000000000000","00000000000000000","00000000000000000","00000000096e00600","060030000e5943e00","0d1ff3a00c01ebe00","000f7ff01301e7600","00010cb0000600c00","04800000000d00b00","0ff9f010000f30600","0a1ff0a0000fc0000","000b50400808f0000","000000000f70d0000","0000000a1ff020000","0000093ff3e000000","0a4fcffbf01000000","0fcffaf0300000000","07236000000000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000","00000000000000000"]}
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
      // Downsample the supplied A4 bitmap by max-pooling source texels. This keeps
      // thin ACNL-font strokes legible without falling back to a browser font.
      const sourceHeight = glyph.rows.length;
      const sourceWidth = glyph.rows[0]?.length || 0;
      const outputWidth = Math.max(1, Math.round(sourceWidth * scale));
      const outputHeight = Math.max(1, Math.round(sourceHeight * scale));
      const left = Math.round(glyph.left * scale);
      for (let oy = 0; oy < outputHeight; oy++) {
        const sy0 = Math.floor(oy / scale);
        const sy1 = Math.min(sourceHeight, Math.ceil((oy + 1) / scale));
        for (let ox = 0; ox < outputWidth; ox++) {
          const sx0 = Math.floor(ox / scale);
          const sx1 = Math.min(sourceWidth, Math.ceil((ox + 1) / scale));
          let alpha = 0;
          for (let sy = sy0; sy < sy1; sy++) {
            for (let sx = sx0; sx < sx1; sx++) alpha = Math.max(alpha, parseInt(glyph.rows[sy][sx], 16));
          }
          if (!alpha) continue;
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
    context.fillRect(bar.x, bar.y, bar.width, bar.height);
    context.strokeStyle = CANDIDATE_COLORS.border;
    context.strokeRect(bar.x + 0.5, bar.y + 0.5, bar.width - 1, bar.height - 1);
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

  function drawPreview(context, sourceImage, stateOrIndex = 0, fontData = DRAW_DATA) {
    if (!context || !sourceImage) return false;
    context.save();
    context.imageSmoothingEnabled = false;
    context.globalAlpha = 1;
    context.drawImage(sourceImage, 0, 0, fontData.image.width, fontData.image.height);
    drawCandidateBar(context, stateOrIndex, fontData);
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
    sourceImage.decoding = "async";
    sourceImage.src = `data:${DRAW_DATA.image.mime};base64,${DRAW_DATA.image.base64}`;

    canvas.addEventListener("pointerdown", (event) => {
      const menu = root.__gohanMenuModel;
      const point = canvasPoint(canvas, event);
      if (!menu || !isPreviewEnabled(menu) || menu.overlay?.screen === "bottom" || !insideCandidateBar(point)) return;
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
      drawPreview(context, sourceImage, candidateState, DRAW_DATA);
    }
    requestAnimationFrame(frame);
  }

  const api = Object.freeze({
    CANDIDATE_BAR,
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
    maximumCandidateScroll,
    clampCandidateScroll,
    ensureCandidateVisible,
    setCandidateIndex,
    scrollCandidates,
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
