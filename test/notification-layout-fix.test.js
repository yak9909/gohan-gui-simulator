"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const core = require("../ui-model.js");
require("../issue-fixes.js");
const layout = require("../notification-layout-fix.js");
const { NotificationTimeline, NOTICE } = core;
const source = fs.readFileSync(path.join(__dirname, "../notification-layout-fix.js"), "utf8");

test("notification count alone does not trigger a forced overflow exit", () => {
  const timeline = new NotificationTimeline();
  for (let index = 0; index < NOTICE.maximum + 1; index++) timeline.add(index * NOTICE.spawnInterval);

  const now = NOTICE.maximum * NOTICE.spawnInterval;
  const items = timeline.sample(now);
  assert.equal(items.length, NOTICE.maximum + 1);
  assert.equal(items[0].overflowExit, undefined);
  assert.ok(items[0].y + NOTICE.height > 0, "oldest short notice remains while any part is still visible");
  assert.doesNotMatch(source, /active\.length\s*>=\s*NOTICE\.maximum/);
  assert.doesNotMatch(source, /NOTICE\.maximum/);
});

test("notices are removed only when stacking places their lower edge outside the screen", () => {
  const timeline = new NotificationTimeline();
  for (let index = 0; index < NOTICE.maximum + 2; index++) timeline.add(index * NOTICE.spawnInterval);

  const lastSpawn = (NOTICE.maximum + 1) * NOTICE.spawnInterval;
  const duringMove = timeline.sample(lastSpawn);
  assert.equal(duringMove[0].id, 1, "movement itself does not delete the oldest notice immediately");

  const settled = timeline.sample(lastSpawn + NOTICE.enterDuration);
  assert.ok(settled.every((item) => item.y + (item.noticeHeight || NOTICE.height) > 0));
  assert.ok(!settled.some((item) => item.id === 1), "oldest notice is removed once its lower edge is fully above y=0");
  assert.match(source, /this\.getY\(item, now\) \+ \(item\.noticeHeight \|\| NOTICE\.height\) <= 0/);
});

test("multi-line height participates in geometric stacking", () => {
  const timeline = new NotificationTimeline();
  const tall = timeline.add(0, "TITLE", "one\ntwo\nthree\nfour");
  assert.equal(tall.noticeHeight, NOTICE.height + layout.NOTICE_LINE_HEIGHT * 3);

  const next = timeline.add(NOTICE.spawnInterval, "NEXT", "short");
  assert.equal(tall.targetY, 240 - NOTICE.margin - tall.noticeHeight - next.noticeHeight - NOTICE.gap);
  assert.ok(tall.targetY < next.targetY);
});
