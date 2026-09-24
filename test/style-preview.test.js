"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const core = require("../ui-model.js");
const model = require("../style-preview-model.js");
const data = require("../style-preview-data.js");
const preview = require("../style-preview.js");

test("style-change preview cheat is injected and exposes all requested settings in Japanese", () => {
  const menu = new core.CheatMenuModel(() => {});
  menu.currentFrame();

  const entry = menu.rootItems.find((item) => item.previewKind === "style-change");
  assert.ok(entry);
  assert.equal(entry.type, "checkbox");
  assert.deepEqual(model.STYLE_FIELDS.map((field) => field.key), [
    "hairStyle", "hairColor", "eyeShape", "eyeColor", "gender", "headwear"
  ]);
  assert.deepEqual(model.STYLE_FIELDS.map((field) => field.label), [
    "髪型", "髪色", "目の形", "目の色", "性別", "頭衣装"
  ]);
  assert.deepEqual(model.STYLE_FIELDS[4].options, ["男", "女"]);
  assert.deepEqual(model.STYLE_FIELDS[5].options, ["表示", "非表示"]);
  for (const field of model.STYLE_FIELDS) {
    for (const option of field.options) assert.doesNotMatch(option, /[<>]/);
  }
});

test("style preview becomes visible immediately when its checkbox is turned on", () => {
  const menu = new core.CheatMenuModel(() => {});
  const entry = model.previewItem(menu);
  assert.equal(model.isPreviewEnabled(menu), false);

  entry.value = true;
  assert.equal(entry.appliedValue, false);
  assert.equal(model.isPreviewEnabled(menu), true);
});

test("enabled style preview captures D-pad/A and records selection/value animation state", () => {
  const menu = new core.CheatMenuModel(() => {});
  const entry = model.previewItem(menu);
  entry.value = true;
  entry.appliedValue = true;

  assert.equal(model.isPreviewEnabled(menu), true);
  assert.equal(model.isStyleUiOperable(menu), true);

  const state = model.ensureStyleState(menu);
  const firstValue = state.values[0];
  menu.handle("a", 100, true, false);
  assert.equal(state.values[0], (firstValue + 1) % model.STYLE_FIELDS[0].options.length);
  assert.equal(state.lastChangedIndex, 0);
  assert.equal(state.lastChangedAt, 100);
  menu.handle("a", 101, false, false);

  menu.handle("down", 110, true, false);
  assert.equal(state.selectedIndex, 1);
  assert.equal(state.selectionFromIndex, 0);
  assert.equal(state.selectionDirection, 1);
  assert.equal(state.selectionStartedAt, 110);
  assert.ok(preview.selectionPosition(state, 110) < 1);
  assert.equal(preview.selectionPosition(state, 110 + preview.ANIMATION.selectionDuration), 1);
  menu.handle("down", 111, false, false);

  const capture = menu.gameInputCaptureState();
  assert.equal(capture.active, true);
  assert.equal(capture.blockGameButtons, true);
});

test("pixel border uses uniform one-pixel edges", () => {
  const calls = [];
  const context = {
    fillStyle: "",
    fillRect(...args) { calls.push(args); }
  };
  preview.drawPixelBorder(context, 8, 12, 154, 184, "#fff");
  assert.deepEqual(calls, [
    [8, 12, 154, 1],
    [8, 195, 154, 1],
    [8, 13, 1, 182],
    [161, 13, 1, 182]
  ]);
});

test("embedded top-screen image is a valid WebP tied to the supplied 400x240 capture", () => {
  assert.equal(data.image.width, 400);
  assert.equal(data.image.height, 240);
  assert.equal(data.image.mime, "image/webp");
  assert.equal(data.source.imageSha256, "034144e1d016cfe53dbdc9251499a3aacc128b763e45b8b18d12a58b70d95c29");

  const embedded = Buffer.from(data.image.base64, "base64");
  assert.equal(embedded.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(embedded.subarray(8, 12).toString("ascii"), "WEBP");
  assert.equal(crypto.createHash("sha256").update(embedded).digest("hex"), data.image.sha256);
});

test("style preview draws the supplied image as a 400x240 top-screen frame", () => {
  const calls = [];
  const context = {
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    save() {},
    restore() {},
    drawImage(...args) { calls.push(args); }
  };
  const menu = new core.CheatMenuModel(() => {});
  const image = {};

  assert.equal(preview.drawPreview(context, image, menu, { glyphs: {} }, false), true);
  assert.deepEqual(calls, [[image, 0, 0, 400, 240]]);
});
