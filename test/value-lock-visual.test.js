"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "issue-overlay.js"), "utf8");

test("VALUE LOCK uses only a 1px side marker and cyan value text", () => {
  assert.match(source, /VALUE_LOCK_MARKER_COLOR = "#5cc8ff"/);
  assert.match(source, /VALUE_LOCK_VALUE_COLOR = "#5cc8ff"/);
  assert.match(source, /drawValueLockMarkers/);
  assert.match(source, /menu\.isItemFixed\(entry\)/);
  assert.match(source, /fillRect\(menuX \+ 4, y - 2, 1, 12\)/);
  assert.doesNotMatch(source, /drawBitmapText\(context, font, "S", menuX \+ 8, y, VALUE_LOCK/);
  assert.match(source, /entry\.type === "linked-value" && numericFont/);
  assert.match(source, /VALUE_LOCK_VALUE_COLOR/);
  assert.match(source, /VALUE LOCK:ON/);
  assert.match(source, /drawBitmapText\(context, font, controlText, 176, 37, "#8f9a92"\)/);
});
