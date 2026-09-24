"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const core = require("../ui-model.js");
const model = require("../style-preview-model.js");
const data = require("../style-preview-data.js");
const preview = require("../style-preview.js");

test("style-change cheat uses Japanese bitmap-safe labels and requested settings", () => {
  const menu = new core.CheatMenuModel(() => {});
  menu.currentFrame();

  const entry = menu.rootItems.find((item) => item.previewKind === "style-change");
  assert.ok(entry);
  assert.equal(entry.type, "checkbox");
  assert.equal(entry.label, "スタイル変更");
  assert.deepEqual(model.STYLE_FIELDS.map((field) => field.key), [
    "hairStyle", "hairColor", "eyeShape", "eyeColor", "gender", "headwear"
  ]);
  assert.deepEqual(model.STYLE_FIELDS.map((field) => field.label), [
    "かみがた", "かみいろ", "めのかたち", "めのいろ", "せいべつ", "あたまそうび"
  ]);
  assert.deepEqual(model.STYLE_FIELDS[4].options, ["おとこ", "おんな"]);
  assert.deepEqual(model.STYLE_FIELDS[5].options, ["みせる", "かくす"]);
  for (const field of model.STYLE_FIELDS) {
    for (const option of field.options) assert.doesNotMatch(option, /[<>]/);
  }
});

test("style preview follows the normal cheat applied-value contract", () => {
  const menu = new core.CheatMenuModel(() => {});
  const entry = model.previewItem(menu);
  assert.equal(model.isPreviewEnabled(menu), false);

  entry.value = true;
  assert.equal(model.isPreviewEnabled(menu), false);
  entry.appliedValue = true;
  assert.equal(model.isPreviewEnabled(menu), true);
});

test("A opens the same list-style chooser contract instead of cycling values directly", () => {
  const menu = new core.CheatMenuModel(() => {});
  const entry = model.previewItem(menu);
  entry.value = true;
  entry.appliedValue = true;
  const state = model.ensureStyleState(menu);
  const original = state.values[0];

  menu.handle("a", 100, true, false);
  assert.ok(state.inlineList);
  assert.equal(state.inlineList.fieldIndex, 0);
  assert.equal(state.inlineList.index, original);
  assert.equal(state.values[0], original);
  assert.equal(state.inlineList.animationDuration, core.LISTBOX.animationDuration);
  menu.handle("a", 101, false, false);

  menu.handle("down", 290, true, false);
  assert.equal(state.inlineList.index, original + 1);
  menu.handle("down", 291, false, false);
  menu.handle("a", 300, true, false);
  assert.equal(state.values[0], original + 1);
  assert.equal(model.currentStyleValue(menu, 0), "5ばん");
  assert.equal(state.inlineList.closing, true);
});

test("style selection uses the simulator menu timing and input capture rules", () => {
  const menu = new core.CheatMenuModel(() => {});
  const entry = model.previewItem(menu);
  entry.value = true;
  entry.appliedValue = true;
  const state = model.ensureStyleState(menu);

  menu.handle("down", 100, true, false);
  assert.equal(state.selectedIndex, 1);
  assert.equal(model.selectionPosition(menu, 100), 0);
  assert.equal(model.selectionPosition(menu, 100 + core.MENU.selectionMoveDuration), 1);
  menu.handle("down", 101, false, false);

  const capture = menu.gameInputCaptureState();
  assert.equal(capture.active, true);
  assert.equal(capture.blockGameButtons, true);
  assert.equal(preview.PANEL.width, core.MENU.width);
  assert.equal(preview.PANEL.rowHeight, core.MENU.itemHeight);
  assert.equal(preview.ANIMATION.introDuration, core.MENU.enterDuration);
  assert.equal(preview.ANIMATION.selectionDuration, core.MENU.selectionMoveDuration);
});

test("B closes a style chooser without changing the value", () => {
  const menu = new core.CheatMenuModel(() => {});
  const entry = model.previewItem(menu);
  entry.value = true;
  entry.appliedValue = true;
  const state = model.ensureStyleState(menu);
  const original = state.values[0];

  menu.handle("a", 100, true, false);
  menu.handle("a", 101, false, false);
  menu.handle("down", 290, true, false);
  menu.handle("down", 291, false, false);
  menu.handle("b", 300, true, false);
  assert.equal(state.values[0], original);
  assert.equal(state.inlineList.closing, true);
});

test("pixel border uses uniform one-pixel edges", () => {
  const calls = [];
  const context = {
    fillStyle: "",
    fillRect(...args) { calls.push(args); }
  };
  preview.drawPixelBorder(context, 0, 0, 160, 240, "#fff");
  assert.deepEqual(calls, [
    [0, 0, 160, 1],
    [0, 239, 160, 1],
    [0, 1, 1, 238],
    [159, 1, 1, 238]
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
