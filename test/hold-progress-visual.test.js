"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "issue-overlay.js"), "utf8");

test("hold progress bar switches color as a whole at the 2/5 threshold", () => {
  assert.match(source, /hold && hold\.progress < HOLD_CANCEL_THRESHOLD/);
  assert.match(source, /progressWidth = Math\.round\(barWidth \* hold\.progress\)/);
  assert.match(source, /fillRect\(menuX \+ 10, 211, progressWidth, 2\)/);
  assert.doesNotMatch(source, /Math\.min\(hold\.progress, HOLD_CANCEL_THRESHOLD\)/);
  assert.doesNotMatch(source, /grayWidth/);
});
