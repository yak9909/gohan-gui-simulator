"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const core = require("../ui-model.js");
require("../issue-fixes.js");
require("../chat-kanji-preview-model.js");
const data = require("../chat-kanji-preview-data.js");
const preview = require("../chat-kanji-preview.js");

test("chat kanji preview is an applyable checkbox cheat", () => {
  const menu = new core.CheatMenuModel();
  menu.currentFrame();
  const entry = menu.rootItems.find((item) => item.previewKind === "chat-kanji");
  assert.ok(entry);
  assert.equal(entry.type, "checkbox");
  assert.equal(entry.label, "漢字変換プレビュー");
  assert.equal(entry.value, false);
  assert.equal(entry.appliedValue, false);
  assert.equal(preview.isPreviewEnabled(menu), false);

  entry.value = true;
  assert.equal(menu.applyItem(entry, 100), true);
  assert.equal(entry.appliedValue, true);
  assert.equal(preview.isPreviewEnabled(menu), true);
});

test("preview uses the supplied ACNL screenshot and Garden BCFNT subset", () => {
  assert.equal(data.image.width, 320);
  assert.equal(data.image.height, 240);
  assert.equal(data.image.mime, "image/webp");
  assert.equal(data.image.encoding, "lossless");
  assert.equal(data.source.imageName, "2026-09-24_10-25-13.623_bot.bmp");
  assert.equal(data.source.imageSha256, "5e6b8052aaa03b965cd82e09897c982e1d657c13526975fc5f9900ca4ce689a8");
  assert.equal(data.source.fontName, "Garden_msg_size16.bcfnt");
  assert.equal(data.source.fontSha256, "1e24ed83bdf652dde77ab9e0065914518f9997a2916b66ad764bfc5ae57aff78");
  assert.deepEqual(data.source.fontCell, [17, 24]);
  assert.equal(data.source.fontFormat, "A4");
  assert.deepEqual(data.candidates, ["漢字", "感じ", "幹事", "完治"]);
  assert.equal(data.glyphs["事"].rows[5], "1333339f833333200", "BCFNT A4 decoding must use the low nibble first");

  for (const character of new Set(Array.from(preview.PREVIEW_CANDIDATES.join("")))) {
    const glyph = preview.DRAW_DATA.glyphs[character];
    assert.ok(glyph, `missing BCFNT glyph: ${character}`);
    assert.equal(glyph.rows.length, 24);
    assert.ok(glyph.rows.every((row) => /^[0-9a-f]{17}$/.test(row)));
    assert.ok(glyph.charWidth > 0);
  }

  // Extra preview glyphs must skip the 1px separator border around each 17x24 BCFNT cell.
  // These exact source rows catch the previous off-by-one extraction that scrambled kana.
  assert.equal(preview.EXTRA_GLYPHS["監"].rows[4], "00111111028200000");
  assert.equal(preview.EXTRA_GLYPHS["か"].rows[9], "7ffeffddfe25ff600");
  assert.equal(preview.EXTRA_GLYPHS["ん"].rows[17], "6fd0001ff87ff2000");
  assert.equal(preview.EXTRA_GLYPHS["カ"].rows[8], "4fffffffffffa0000");
  assert.equal(preview.EXTRA_GLYPHS["ン"].rows[7], "3dff8100000020000");
  assert.equal(preview.EXTRA_GLYPHS["ジ"].rows[10], "7fff91000003f6000");
});

test("candidate glyphs are compact and stay inside the strip below the input field", () => {
  const pixels = [];
  const context = {
    globalAlpha: 1,
    fillStyle: "",
    fillRect(x, y, width, height) { pixels.push({ x, y, width, height, alpha: this.globalAlpha }); }
  };
  preview.drawBcfntText(
    context,
    "漢字",
    20,
    preview.CANDIDATE_BAR.textCellY,
    "#000",
    preview.DRAW_DATA,
    preview.CANDIDATE_BAR.textScale
  );
  assert.ok(pixels.length > 0);
  assert.ok(preview.CANDIDATE_BAR.textScale < 1);
  assert.ok(pixels.every((pixel) => pixel.y >= preview.CANDIDATE_BAR.y && pixel.y < preview.CANDIDATE_BAR.y + preview.CANDIDATE_BAR.height));
  assert.equal(preview.CANDIDATE_BAR.y, 49);
  assert.equal(preview.CANDIDATE_BAR.textCellY, 48);
  assert.equal(preview.CANDIDATE_BAR.y + preview.CANDIDATE_BAR.height, 66);
  assert.equal(preview.CHAT_LAYOUT.x, 8);
  assert.equal(preview.CHAT_LAYOUT.width, 304);
  assert.equal(preview.CANDIDATE_BAR.width + preview.CLEAR_BUTTON.width, preview.CHAT_LAYOUT.width);
  assert.equal(preview.CLEAR_BUTTON.x + preview.CLEAR_BUTTON.width, preview.CHAT_LAYOUT.x + preview.CHAT_LAYOUT.width);
  assert.ok(pixels.some((pixel) => pixel.alpha > 0 && pixel.alpha < 1), "A4 alpha coverage should survive compact rendering");
});

test("candidate strip uses the ACNL utility-key dark brown and only highlights selection pale green", () => {
  assert.equal(preview.CANDIDATE_COLORS.panel, "#522810");
  assert.equal(preview.CANDIDATE_COLORS.border, "#522810");
  assert.equal(preview.CANDIDATE_COLORS.separator, "#522810");
  assert.equal(preview.CANDIDATE_COLORS.selected, "rgba(239, 255, 214, 0.24)");
  assert.equal(preview.CANDIDATE_COLORS.text, "#fff3d6");
  assert.equal(preview.CANDIDATE_COLORS.selectedText, "#fff3d6");
});

test("candidate list supports horizontal scrolling and selection-following", () => {
  const state = preview.createCandidateState();
  const maximum = preview.maximumCandidateScroll(preview.DRAW_DATA);
  assert.ok(preview.PREVIEW_CANDIDATES.length > data.candidates.length);
  assert.ok(maximum > 0, "preview candidates should overflow the visible strip");

  preview.scrollCandidates(state, 9999, preview.DRAW_DATA);
  assert.equal(state.scrollX, maximum);
  preview.scrollCandidates(state, -9999, preview.DRAW_DATA);
  assert.equal(state.scrollX, 0);

  preview.setCandidateIndex(state, preview.PREVIEW_CANDIDATES.length - 1, preview.DRAW_DATA);
  assert.equal(state.selectedIndex, preview.PREVIEW_CANDIDATES.length - 1);
  assert.ok(state.scrollX > 0, "selection should scroll the last candidate into view");
  preview.setCandidateIndex(state, 0, preview.DRAW_DATA);
  assert.equal(state.scrollX, 0, "selection should scroll back to the first candidate");
});

test("clear and one-character cursor controls share the chat input layout", () => {
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

test("scaled BCFNT uses area-weighted coverage instead of max-pooling", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "chat-kanji-preview.js"), "utf8");
  assert.match(source, /weightedAlpha/);
  assert.match(source, /coveredArea/);
  assert.match(source, /overlapX \* overlapY/);
  assert.doesNotMatch(source, /alpha\s*=\s*Math\.max\(/);
});

test("preview renderer rasterizes BCFNT masks without browser text rendering", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "chat-kanji-preview.js"), "utf8");
  assert.match(source, /alpha\s*\/\s*15/);
  assert.match(source, /fillRect\(/);
  assert.match(source, /drawImage\(sourceImage/);
  assert.doesNotMatch(source, /fillText\s*\(/);
  assert.match(source, /menu\.overlay\?\.screen === "bottom"/);
  assert.match(source, /pointermove/);
  assert.match(source, /wheel/);
  assert.match(source, /ArrowLeft/);
  assert.match(source, /ArrowRight/);
});
