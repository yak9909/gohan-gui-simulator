from pathlib import Path

path = Path("chat-kanji-preview.js")
text = path.read_text(encoding="utf-8")

old = '''  const CANDIDATE_BAR = Object.freeze({
    x: 8, y: 49, width: 304, height: 17,
    gap: 2, paddingX: 4, textCellY: 48, textScale: 0.72
  });'''
new = '''  // The conversion row and the kana keyboard share one 304px-wide body.
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
  const INPUT_PREVIEW_TEXT = "かんじ";'''
assert old in text, "candidate geometry block not found"
text = text.replace(old, new, 1)

old = '''  function createCandidateState() {
    return { selectedIndex: 0, scrollX: 0, dragging: false, dragStartX: 0, dragStartScrollX: 0, dragMoved: false };
  }
'''
new = '''  function createCandidateState() {
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
'''
assert old in text, "candidate state block not found"
text = text.replace(old, new, 1)

old = '''    context.save();
    context.fillStyle = CANDIDATE_COLORS.panel;
    context.fillRect(bar.x, bar.y, bar.width, bar.height);
    context.strokeStyle = CANDIDATE_COLORS.border;
    context.strokeRect(bar.x + 0.5, bar.y + 0.5, bar.width - 1, bar.height - 1);
    context.beginPath();
    context.rect(bar.x + 1, bar.y + 1, bar.width - 2, bar.height - 2);
    context.clip();'''
new = '''    context.save();
    context.fillStyle = CANDIDATE_COLORS.panel;
    // Paint the complete conversion row once. Candidate viewport + clear key
    // therefore read as one keyboard-width component rather than two panels.
    context.fillRect(CHAT_LAYOUT.x, bar.y, CHAT_LAYOUT.width, bar.height);
    context.beginPath();
    context.rect(bar.x + 1, bar.y + 1, bar.width - 2, bar.height - 2);
    context.clip();'''
assert old in text, "candidate panel block not found"
text = text.replace(old, new, 1)

marker = '  function drawPreview(context, sourceImage, stateOrIndex = 0, fontData = DRAW_DATA) {'
assert marker in text, "drawPreview marker not found"
helpers = '''  function measureUiText(font, text) {
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

'''
text = text.replace(marker, helpers + marker, 1)

old = '''  function drawPreview(context, sourceImage, stateOrIndex = 0, fontData = DRAW_DATA) {
    if (!context || !sourceImage) return false;
    context.save();
    context.imageSmoothingEnabled = false;
    context.globalAlpha = 1;
    context.drawImage(sourceImage, 0, 0, fontData.image.width, fontData.image.height);
    drawCandidateBar(context, stateOrIndex, fontData);
    context.restore();
    return true;
  }'''
new = '''  function drawPreview(context, sourceImage, stateOrIndex = 0, fontData = DRAW_DATA, inputState = null) {
    if (!context || !sourceImage) return false;
    context.save();
    context.imageSmoothingEnabled = false;
    context.globalAlpha = 1;
    context.drawImage(sourceImage, 0, 0, fontData.image.width, fontData.image.height);
    drawCandidateBar(context, stateOrIndex, fontData);
    drawPreviewControls(context, inputState, root.MISAKI_GOTHIC_2ND_8);
    context.restore();
    return true;
  }'''
assert old in text, "drawPreview block not found"
text = text.replace(old, new, 1)

old = '''    const sourceImage = new Image();
    const candidateState = createCandidateState();
    sourceImage.decoding = "async";'''
new = '''    const sourceImage = new Image();
    const candidateState = createCandidateState();
    const inputState = createInputState();
    sourceImage.decoding = "async";'''
assert old in text, "install state block not found"
text = text.replace(old, new, 1)

old = '''      if (!menu || !isPreviewEnabled(menu) || menu.overlay?.screen === "bottom" || !insideCandidateBar(point)) return;
      candidateState.dragging = true;'''
new = '''      if (!menu || !isPreviewEnabled(menu) || menu.overlay?.screen === "bottom") return;

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

      candidateState.dragging = true;'''
assert old in text, "pointerdown guard not found"
text = text.replace(old, new, 1)

old = '      drawPreview(context, sourceImage, candidateState, DRAW_DATA);'
new = '      drawPreview(context, sourceImage, candidateState, DRAW_DATA, inputState);'
assert old in text, "frame drawPreview call not found"
text = text.replace(old, new, 1)

old = '''    CANDIDATE_BAR,
    CANDIDATE_COLORS,
    EXTRA_GLYPHS,'''
new = '''    CHAT_LAYOUT,
    CLEAR_BUTTON,
    CANDIDATE_BAR,
    CURSOR_BUTTONS,
    INPUT_TEXT_AREA,
    CANDIDATE_COLORS,
    EXTRA_GLYPHS,'''
assert old in text, "api constants block not found"
text = text.replace(old, new, 1)

old = '''    candidateLayout,
    createCandidateState,
    maximumCandidateScroll,'''
new = '''    candidateLayout,
    createCandidateState,
    createInputState,
    moveInputCursor,
    clearInput,
    maximumCandidateScroll,'''
assert old in text, "api state block not found"
text = text.replace(old, new, 1)

old = '''    scrollCandidates,
    drawCandidateBar,
    drawPreview,
    install'''
new = '''    scrollCandidates,
    drawCandidateBar,
    drawPreviewControls,
    drawPreview,
    pointInside,
    install'''
assert old in text, "api draw block not found"
text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")

# Update regression coverage for the integrated row and input controls.
test_path = Path("test/chat-kanji-preview.test.js")
tests = test_path.read_text(encoding="utf-8")
old = '''  assert.equal(preview.CANDIDATE_BAR.y, 49);
  assert.equal(preview.CANDIDATE_BAR.textCellY, 48);
  assert.equal(preview.CANDIDATE_BAR.y + preview.CANDIDATE_BAR.height, 66);'''
new = '''  assert.equal(preview.CANDIDATE_BAR.y, 49);
  assert.equal(preview.CANDIDATE_BAR.textCellY, 48);
  assert.equal(preview.CANDIDATE_BAR.y + preview.CANDIDATE_BAR.height, 66);
  assert.equal(preview.CHAT_LAYOUT.x, 8);
  assert.equal(preview.CHAT_LAYOUT.width, 304);
  assert.equal(preview.CANDIDATE_BAR.width + preview.CLEAR_BUTTON.width, preview.CHAT_LAYOUT.width);
  assert.equal(preview.CLEAR_BUTTON.x + preview.CLEAR_BUTTON.width, preview.CHAT_LAYOUT.x + preview.CHAT_LAYOUT.width);'''
assert old in tests, "candidate geometry test block not found"
tests = tests.replace(old, new, 1)

marker = 'test("scaled BCFNT uses area-weighted coverage instead of max-pooling", () => {'
assert marker in tests, "test insertion marker not found"
extra = '''test("clear and one-character cursor controls share the chat input layout", () => {
  assert.equal(preview.CURSOR_BUTTONS.left.width, preview.CHAT_LAYOUT.cursorButtonSize);
  assert.equal(preview.CURSOR_BUTTONS.left.height, preview.CHAT_LAYOUT.cursorButtonSize);
  assert.equal(preview.CURSOR_BUTTONS.right.width, preview.CHAT_LAYOUT.cursorButtonSize);
  assert.ok(preview.CURSOR_BUTTONS.right.x > preview.CURSOR_BUTTONS.left.x);

  const input = preview.createInputState("かんじ");
  assert.equal(input.cursorIndex, 3);
  preview.moveInputCursor(input, -1);
  assert.equal(input.cursorIndex, 2, "left button moves exactly one character");
  preview.moveInputCursor(input, 1);
  assert.equal(input.cursorIndex, 3, "right button moves exactly one character");
  preview.moveInputCursor(input, 99);
  assert.equal(input.cursorIndex, 3, "cursor is clamped at the end");
  preview.clearInput(input);
  assert.equal(input.value, "");
  assert.equal(input.cursorIndex, 0);
  assert.equal(input.cleared, true);
});

test("conversion row is keyboard-width and reserves the right utility column for clear", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "chat-kanji-preview.js"), "utf8");
  assert.match(source, /fillRect\(CHAT_LAYOUT\.x, bar\.y, CHAT_LAYOUT\.width, bar\.height\)/);
  assert.match(source, /strokeRect\(CHAT_LAYOUT\.x \+ 0\.5, CHAT_LAYOUT\.candidateY \+ 0\.5, CHAT_LAYOUT\.width - 1/);
  assert.match(source, /const clearLabel = "クリア"/);
  assert.match(source, /pointInside\(point, CLEAR_BUTTON\)/);
  assert.match(source, /pointInside\(point, CURSOR_BUTTONS\.left\)/);
  assert.match(source, /pointInside\(point, CURSOR_BUTTONS\.right\)/);
});

'''
tests = tests.replace(marker, extra + marker, 1)
test_path.write_text(tests, encoding="utf-8")
