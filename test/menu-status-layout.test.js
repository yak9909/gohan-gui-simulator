"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../issue-overlay.js"), "utf8");

test("row values reserve right-side F/H columns", () => {
  assert.match(source, /VALUE_RIGHT_X = 136/);
  assert.match(source, /FAVORITE_X = 140/);
  assert.match(source, /HOTKEY_X = 147/);
  assert.match(source, /const valueX = menuX \+ VALUE_RIGHT_X - valueWidth \+ itemOffset/);
  assert.match(source, /VALUE_RIGHT_X - ROW_TEXT_X - \(value \? valueWidth \+ 3 : 0\)/);
});

test("folders draw only F while normal entries draw F then H", () => {
  assert.match(source, /drawBitmapText\(context, font, "F", menuX \+ FAVORITE_X/);
  assert.match(source, /if \(entry\.type !== "folder"\) \{\s*drawBitmapText\(context, font, "H", menuX \+ HOTKEY_X/s);
  assert.match(source, /favoriteActive \? FAVORITE_ACTIVE_COLOR : MARKER_INACTIVE_COLOR/);
  assert.match(source, /hotkeyActive \? HOTKEY_ACTIVE_COLOR : MARKER_INACTIVE_COLOR/);
});

test("status overlay is clipped above the footer", () => {
  assert.match(source, /LIST_CLIP_BOTTOM = 212/);
  assert.match(source, /context\.rect\(menuX \+ 2, LIST_CLIP_TOP, MENU\.width - 6, LIST_CLIP_BOTTOM - LIST_CLIP_TOP\)/);
  assert.match(source, /if \(y < 25 \|\| y > 204\) continue/);
  assert.match(source, /pixelY >= LIST_CLIP_BOTTOM/);
});
