"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const core = require("../ui-model.js");
const model = require("../style-preview-model.js");
const data = require("../style-preview-data.js");
const preview = require("../style-preview.js");

test("style-change cheat exposes the requested settings through its own UI", () => {
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
});

test("style preview follows the same applied-value contract as normal cheats", () => {
  const menu = new core.CheatMenuModel(() => {});
  const entry = model.previewItem(menu);
  assert.equal(model.isPreviewEnabled(menu), false);

  entry.value = true;
  assert.equal(model.isPreviewEnabled(menu), false);
  entry.appliedValue = true;
  assert.equal(model.isPreviewEnabled(menu), true);
});

test("custom style UI keeps direct D-pad and A value editing", () => {
  const menu = new core.CheatMenuModel(() => {});
  const entry = model.previewItem(menu);
  entry.value = true;
  entry.appliedValue = true;
  const state = model.ensureStyleState(menu);
  const original = state.values[0];

  menu.handle("right", 100, true, false);
  assert.equal(state.values[0], (original + 1) % model.STYLE_FIELDS[0].options.length);
  assert.equal(state.valueBounceIndex, 0);
  assert.equal(state.valueBounceDirection, 1);
  menu.handle("right", 101, false, false);

  menu.handle("a", 120, true, false);
  assert.equal(state.values[0], (original + 2) % model.STYLE_FIELDS[0].options.length);
  assert.equal(state.activationBounceStartedAt, 120);
  menu.handle("a", 121, false, false);

  menu.handle("down", 140, true, false);
  assert.equal(state.selectedIndex, 1);
  menu.handle("down", 141, false, false);
  menu.handle("left", 160, true, false);
  assert.equal(state.values[1], model.STYLE_FIELDS[1].options.length - 1);
  menu.handle("left", 161, false, false);

  assert.equal(state.inlineList, undefined, "custom style UI must not be converted into the normal menu list UI");
});

test("style state is advanced by menu.update rather than by drawing", () => {
  const menu = new core.CheatMenuModel(() => {});
  const entry = model.previewItem(menu);
  entry.value = true;
  entry.appliedValue = true;
  const state = model.ensureStyleState(menu);

  assert.equal(state.panelTarget, 0);
  menu.update(100);
  assert.equal(state.panelTarget, 1);
  assert.equal(model.panelAmount(menu, 100), 0);
  assert.equal(model.panelAmount(menu, 100 + model.STYLE_UI.panelDuration), 1);

  menu.open(400);
  menu.update(400);
  assert.equal(state.panelTarget, 0);
});

test("style UI uses its own layout and timing while sharing menu input lifecycle", () => {
  const menu = new core.CheatMenuModel(() => {});
  const entry = model.previewItem(menu);
  entry.value = true;
  entry.appliedValue = true;
  const state = model.ensureStyleState(menu);

  menu.handle("down", 100, true, false);
  assert.equal(state.selectedIndex, 1);
  assert.equal(model.selectionPosition(menu, 100), 0);
  assert.equal(model.selectionPosition(menu, 100 + model.STYLE_UI.selectionDuration), 1);
  menu.handle("down", 101, false, false);

  const capture = menu.gameInputCaptureState();
  assert.equal(capture.active, true);
  assert.equal(capture.blockGameButtons, true);

  assert.equal(preview.PANEL.width, 154);
  assert.equal(preview.PANEL.rowHeight, 23);
  assert.notEqual(preview.PANEL.width, core.MENU.width);
  assert.notEqual(preview.PANEL.rowHeight, core.MENU.itemHeight);
  assert.notEqual(model.STYLE_UI.panelDuration, core.MENU.enterDuration);
  assert.notEqual(model.STYLE_UI.selectionDuration, core.MENU.selectionMoveDuration);
});

test("drawing the custom panel does not mutate model state", () => {
  const menu = new core.CheatMenuModel(() => {});
  const entry = model.previewItem(menu);
  entry.value = true;
  entry.appliedValue = true;
  menu.update(100);
  const state = model.ensureStyleState(menu);
  const before = JSON.stringify(state);
  const context = {
    globalAlpha: 1,
    fillStyle: "",
    save() {},
    restore() {},
    fillRect() {}
  };

  preview.drawPanel(context, menu, { glyphs: {} }, 190, 1);
  assert.equal(JSON.stringify(state), before);
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
