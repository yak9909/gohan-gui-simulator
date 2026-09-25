"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "issue-overlay.js"), "utf8");

test("値を固定 uses cyan value text without adding a side marker", () => {
  assert.match(source, /VALUE_LOCK_VALUE_COLOR = "#5cc8ff"/);
  assert.match(source, /drawValueLockMarkers/);
  assert.match(source, /menu\.isItemFixed\(entry\)/);
  assert.doesNotMatch(source, /VALUE_LOCK_MARKER_COLOR/);
  assert.doesNotMatch(source, /fillRect\(menuX \+ 4, y - 2, 1, 12\)/);
  assert.match(source, /entry\.type === "linked-value" && numericFont/);
  assert.match(source, /VALUE_LOCK_VALUE_COLOR/);
  assert.match(source, /値を固定:ON/);
  assert.match(source, /if \(controlText\) drawBitmapText/);
});
