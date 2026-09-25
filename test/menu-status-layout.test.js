"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../issue-overlay.js"), "utf8");

test("row values keep the original right-aligned position", () => {
  assert.doesNotMatch(source, /VALUE_RIGHT_X/);
  assert.doesNotMatch(source, /restoreBackgroundBand/);
  assert.match(source, /menuX \+ MENU\.width - 8 - valueWidth \+ itemOffset/);
});

test("only active F and H markers are drawn in F then H order", () => {
  const favoriteDraw = source.indexOf('drawBitmapText(context, font, "F", menuX + 140');
  const hotkeyDraw = source.indexOf('drawBitmapText(context, font, "H", menuX + 147');
  assert.ok(favoriteDraw >= 0);
  assert.ok(hotkeyDraw > favoriteDraw, "F must be rendered before H");
  assert.match(source, /if \(favoriteActive\) \{[\s\S]*drawBitmapText\(context, font, "F"/);
  assert.match(source, /if \(hotkeyActive\) \{\s*drawBitmapText\(context, font, "H"/);
  assert.match(source, /entry\?\.type !== "folder" && entry\?\.hotkey/);
});

test("partially visible eleventh row keeps markers inside the list viewport", () => {
  assert.match(source, /LIST_CLIP_BOTTOM = 212/);
  assert.match(source, /return Math\.min\(y \+ 8, LIST_CLIP_BOTTOM - markerHeight\)/);
  assert.doesNotMatch(source, /if \(y < 25 \|\| y > 204\) continue/);
  assert.match(source, /context\.rect\(menuX \+ 2, LIST_CLIP_TOP, MENU\.width - 6, LIST_CLIP_BOTTOM - LIST_CLIP_TOP\)/);
});

test("overlay follows the same 30Hz frame contract as the base menu", () => {
  assert.match(source, /const FRAME = root\.CTRPFUiModel\?\.FRAME/);
  assert.match(source, /if \(now < nextOverlayFrameAt\) return/);
  assert.match(source, /nextOverlayFrameAt = now \+ FRAME\.interval/);
});
