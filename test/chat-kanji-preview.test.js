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

  for (const character of new Set(Array.from(data.candidates.join("")))) {
    const glyph = data.glyphs[character];
    assert.ok(glyph, `missing BCFNT glyph: ${character}`);
    assert.equal(glyph.rows.length, 24);
    assert.ok(glyph.rows.every((row) => /^[0-9a-f]{17}$/.test(row)));
    assert.ok(glyph.charWidth > 0);
  }
});

test("candidate glyph pixels stay inside the empty strip below the input field", () => {
  const pixels = [];
  const context = {
    globalAlpha: 1,
    fillStyle: "",
    fillRect(x, y, width, height) { pixels.push({ x, y, width, height }); }
  };
  preview.drawBcfntText(context, "漢字", 20, preview.CANDIDATE_BAR.textCellY, "#000", data);
  assert.ok(pixels.length > 0);
  assert.ok(pixels.every((pixel) => pixel.y >= preview.CANDIDATE_BAR.y && pixel.y < 66));
  assert.equal(preview.CANDIDATE_BAR.y, 47);
  assert.equal(preview.CANDIDATE_BAR.y + preview.CANDIDATE_BAR.height, 65);
});

test("preview renderer rasterizes BCFNT masks without browser text rendering", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "chat-kanji-preview.js"), "utf8");
  assert.match(source, /alpha\s*\/\s*15/);
  assert.match(source, /fillRect\(/);
  assert.match(source, /drawImage\(sourceImage/);
  assert.doesNotMatch(source, /fillText\s*\(/);
  assert.match(source, /menu\.overlay\?\.screen === "bottom"/);
});
