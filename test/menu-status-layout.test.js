"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const overlaySource = fs.readFileSync(path.join(__dirname, "../issue-overlay.js"), "utf8");
const appSource = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");

test("row values keep the original right-aligned position", () => {
  assert.doesNotMatch(overlaySource, /VALUE_RIGHT_X/);
  assert.doesNotMatch(overlaySource, /restoreBackgroundBand/);
  assert.match(overlaySource, /menuX \+ MENU\.width - 8 - valueWidth \+ itemOffset/);
});

test("F H status group is right-aligned on the historical lower H baseline", () => {
  assert.match(overlaySource, /const hotkeyActive = Boolean\(entry\?\.type !== "folder" && entry\?\.hotkey && entry\.hotkey !== "なし"\)/);
  assert.match(overlaySource, /const favoriteX = hotkeyActive \? 140 : 147/);
  assert.match(overlaySource, /drawBitmapText\(context, font, "F", menuX \+ favoriteX \+ itemOffset, y \+ 8, FAVORITE_ACTIVE_COLOR\)/);
  assert.match(appSource, /entry\.type !== "folder" && entry\.hotkey !== "なし"[\s\S]*drawBitmapText\(top, font, "H", menuX \+ 147 \+ itemOffset, y \+ 8, "#78a9ff"\)/);
  assert.doesNotMatch(overlaySource, /drawBitmapText\(context, font, "H"/);
  assert.match(overlaySource, /if \(!favoriteActive\) continue/);
});

test("partially visible eleventh row clips F and H at their natural y + 8 position", () => {
  assert.match(overlaySource, /LIST_CLIP_TOP = 24/);
  assert.match(overlaySource, /LIST_CLIP_BOTTOM = 212/);
  assert.doesNotMatch(overlaySource, /Math\.min\(y \+ 8/);
  assert.match(overlaySource, /context\.rect\(menuX \+ 2, LIST_CLIP_TOP, MENU\.width - 6, LIST_CLIP_BOTTOM - LIST_CLIP_TOP\)/);
  assert.match(appSource, /top\.rect\(menuX \+ 2, 24, MENU\.width - 6, 188\); top\.clip\(\)/);
});

test("overlay follows the same 30Hz frame contract as the base menu", () => {
  assert.match(overlaySource, /const FRAME = root\.CTRPFUiModel\?\.FRAME/);
  assert.match(overlaySource, /if \(now < nextOverlayFrameAt\) return/);
  assert.match(overlaySource, /nextOverlayFrameAt = now \+ FRAME\.interval/);
});
