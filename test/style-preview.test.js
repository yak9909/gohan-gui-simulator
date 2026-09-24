"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const core = require("../ui-model.js");
const model = require("../style-preview-model.js");
const data = require("../style-preview-data.js");
const preview = require("../style-preview.js");

test("style-change preview cheat is injected and exposes all requested settings", () => {
  const menu = new core.CheatMenuModel(() => {});
  menu.currentFrame();

  const entry = menu.rootItems.find((item) => item.previewKind === "style-change");
  assert.ok(entry);
  assert.equal(entry.type, "checkbox");
  assert.deepEqual(model.STYLE_FIELDS.map((field) => field.key), [
    "hairStyle", "hairColor", "eyeShape", "eyeColor", "gender", "headwear"
  ]);
});

test("enabled style preview captures D-pad/A and changes the selected style value", () => {
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
  menu.handle("a", 101, false, false);

  menu.handle("down", 110, true, false);
  assert.equal(state.selectedIndex, 1);
  menu.handle("down", 111, false, false);

  const capture = menu.gameInputCaptureState();
  assert.equal(capture.active, true);
  assert.equal(capture.blockGameButtons, true);
});

test("embedded top-screen image matches the supplied capture metadata", () => {
  assert.equal(data.image.width, 400);
  assert.equal(data.image.height, 240);
  assert.equal(data.source.imageSha256, "034144e1d016cfe53dbdc9251499a3aacc128b763e45b8b18d12a58b70d95c29");
  const embedded = Buffer.from(data.image.base64, "base64");
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
