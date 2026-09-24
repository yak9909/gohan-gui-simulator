"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "issue-overlay.js"), "utf8");

test("VALUE LOCK is visible directly on locked linked items", () => {
  assert.match(source, /VALUE_LOCK_COLOR/);
  assert.match(source, /drawValueLockMarkers/);
  assert.match(source, /menu\.isItemFixed\(entry\)/);
  assert.match(source, /fillRect\(menuX \+ 4, y - 2, 2, 12\)/);
  assert.match(source, /drawBitmapText\(context, font, "S", menuX \+ 8, y, VALUE_LOCK_COLOR\)/);
  assert.match(source, /VALUE LOCK:ON/);
});
