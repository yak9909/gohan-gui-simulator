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

test("row states use the historical 1px value-lock position and split vertically", () => {
  assert.match(appSource, /menu\.isFavorite\(entry\).*statusColors\.push\("#d6c98a"\)/s);
  assert.match(appSource, /entry\.type !== "folder" && entry\.hotkey !== "なし".*statusColors\.push\("#78a9ff"\)/s);
  assert.match(appSource, /menu\.isItemRetained\?\.\(entry\).*statusColors\.push\("#e5484d"\)/s);
  assert.match(appSource, /const statusHeight = 12/);
  assert.match(appSource, /segmentTop = Math\.floor\(statusHeight \* statusIndex \/ statusColors\.length\)/);
  assert.match(appSource, /segmentBottom = Math\.floor\(statusHeight \* \(statusIndex \+ 1\) \/ statusColors\.length\)/);
  assert.match(appSource, /fillRect\(menuX \+ 4 \+ itemOffset, y - 2 \+ segmentTop, 1, segmentBottom - segmentTop\)/);
  assert.doesNotMatch(appSource, /menuX \+ 6 - statusIndex/);
  assert.doesNotMatch(appSource, /drawBitmapText\(top, font, "F"/);
  assert.doesNotMatch(appSource, /drawBitmapText\(top, font, "H"/);
  assert.doesNotMatch(overlaySource, /FAVORITE_ACTIVE_COLOR|eraseLegacyFavoriteMarker|drawFavoriteMarkers/);
});

test("partially visible eleventh row clips status lines with the normal menu item clip", () => {
  assert.match(appSource, /top\.rect\(menuX \+ 2, 24, MENU\.width - 6, 188\); top\.clip\(\)/);
  assert.match(appSource, /fillRect\(menuX \+ 4 \+ itemOffset, y - 2 \+ segmentTop, 1, segmentBottom - segmentTop\)/);
  assert.doesNotMatch(appSource, /Math\.min\(y/);
});

test("value lock adds no status line and overlay follows the base 30Hz frame contract", () => {
  assert.doesNotMatch(overlaySource, /VALUE_LOCK_MARKER_COLOR/);
  assert.match(overlaySource, /const FRAME = root\.CTRPFUiModel\?\.FRAME/);
  assert.match(overlaySource, /if \(now < nextOverlayFrameAt\) return/);
  assert.match(overlaySource, /nextOverlayFrameAt = now \+ FRAME\.interval/);
});
