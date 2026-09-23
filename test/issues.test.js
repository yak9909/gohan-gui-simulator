const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const core = require("../ui-model.js");
const { HOLD_CANCEL_THRESHOLD } = require("../issue-fixes.js");
const { CheatMenuModel, MENU, walkItems } = core;

const overlaySource = fs.readFileSync(path.join(__dirname, "../issue-overlay.js"), "utf8");
const fixesSource = fs.readFileSync(path.join(__dirname, "../issue-fixes.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");

function rootCheckboxMenu() {
  const menu = new CheatMenuModel();
  menu.open(0);
  menu.currentFrame().selection = 1;
  return { menu, item: menu.selectedItem() };
}

function findItem(menu, label) {
  let match = null;
  walkItems(menu.rootItems, (entry) => { if (entry.label === label) match = entry; });
  return match;
}

function selectNestedItem(menu, folderLabel, itemLabel) {
  const folder = menu.rootItems.find((entry) => entry.label === folderLabel);
  const selection = folder.children.findIndex((entry) => entry.label === itemLabel);
  menu.frames.push({ title: folder.label, items: folder.children, selection });
  menu.resetSelectionAnimation(0);
  return folder.children[selection];
}

test("issue #2 cancels X/L holds released from 2/5 progress through completion threshold", () => {
  assert.equal(HOLD_CANCEL_THRESHOLD, 0.4);
  assert.equal(MENU.holdDuration * HOLD_CANCEL_THRESHOLD, 240);

  const short = rootCheckboxMenu();
  short.item.value = true;
  short.menu.beginHoldAction("x", 100);
  const early = short.menu.holdActionProgress(220);
  assert.equal(early.muted, true);
  assert.equal(early.releaseCancels, false);
  short.menu.finishHoldAction("x", 339);
  assert.equal(short.item.appliedValue, true, "release before 2/5 keeps short-press apply");

  const cancelApply = rootCheckboxMenu();
  cancelApply.item.value = true;
  cancelApply.menu.beginHoldAction("x", 100);
  const threshold = cancelApply.menu.holdActionProgress(340);
  assert.equal(threshold.muted, false);
  assert.equal(threshold.releaseCancels, true);
  cancelApply.menu.finishHoldAction("x", 340);
  assert.equal(cancelApply.item.appliedValue, false, "release at 2/5 must not apply the selected item");
  assert.equal(cancelApply.item.value, true, "cancel leaves the pending edit intact");
  assert.equal(cancelApply.menu.dialog, null);

  const cancelRevert = rootCheckboxMenu();
  cancelRevert.item.value = true;
  cancelRevert.menu.applyItem(cancelRevert.item, 10);
  cancelRevert.item.value = false;
  cancelRevert.menu.beginHoldAction("l", 100);
  cancelRevert.menu.finishHoldAction("l", 400);
  assert.equal(cancelRevert.item.value, false, "release after 2/5 must not revert the selected item");
  assert.equal(cancelRevert.item.appliedValue, true);

  const long = rootCheckboxMenu();
  long.item.value = true;
  long.menu.beginHoldAction("x", 100);
  long.menu.update(700);
  assert.equal(long.menu.dialog?.type, "apply-all", "full hold still opens the all-apply confirmation");

  assert.match(overlaySource, /first 2\/5/);
  assert.match(overlaySource, /#747b76/);
});

test("issue #3 disabled items stay cursor-selectable but reject mutation and activation", () => {
  const { menu, item } = rootCheckboxMenu();
  menu.currentFrame().selection = 0;
  menu.setItemDisabled(item, true);
  assert.equal(item.disabled, true);

  menu.moveSelection(1, 100);
  assert.equal(menu.selectedItem(), item, "DPad navigation may land on a disabled item");
  assert.equal(menu.activateSelected(120), false);
  assert.equal(item.value, false);
  menu.openHotkeyPicker(130);
  assert.equal(menu.overlay, null, "disabled item cannot open hotkey capture");

  item.value = true;
  assert.equal(menu.applyItem(item, 140), false, "disabled item cannot apply a stale edit");
  assert.equal(item.appliedValue, false);

  menu.setItemDisabled(item, false);
  let unavailable = true;
  menu.setDisabledPredicate(item, () => unavailable);
  menu.update(150);
  assert.equal(item.disabled, true);
  unavailable = false;
  menu.update(160);
  assert.equal(item.disabled, false, "disabled predicate is re-evaluated every update");

  assert.match(overlaySource, /installDisabledPointerSelection/);
});

test("issue #4 START opens settings and FAVORITES is reached from that settings frame", () => {
  const { menu, item } = rootCheckboxMenu();
  menu.toggleFavorite(item, 10);

  menu.handle("start", 100, true, false);
  assert.equal(menu.currentFrame().kind, "settings");
  assert.equal(menu.currentFrame().title, "SETTINGS");
  assert.deepEqual(menu.currentFrame().items.map((entry) => entry.label), ["FAVORITES", "VALUE LOCK"]);

  menu.handle("a", 120, true, false);
  assert.equal(menu.currentFrame().kind, "favorites", "A on the settings FAVORITES entry opens favorites");
  assert.equal(menu.currentFrame().items[0], item, "favorites still reference the original item");

  menu.handle("b", 140, true, false);
  assert.equal(menu.currentFrame().kind, "settings", "B returns from favorites to settings");
  menu.handle("a", 160, true, false);
  assert.equal(menu.currentFrame().kind, "favorites");
  menu.handle("start", 180, true, false);
  assert.equal(menu.currentFrame().title, "ROOT", "START closes the whole settings subtree");

  const empty = rootCheckboxMenu().menu;
  empty.handle("start", 200, true, false);
  assert.equal(empty.currentFrame().kind, "settings");
  assert.equal(empty.currentFrame().items[0].disabled, true, "FAVORITES setting is disabled when there are no favorites");
  empty.currentFrame().selection = 1;
  empty.moveSelection(-1, 210);
  assert.equal(empty.currentFrame().selection, 0, "disabled settings entries remain cursor-selectable");
  assert.equal(empty.activateSelected(220), false);

  assert.match(html, /issue-fixes\.js/);
  assert.match(html, /issue-overlay\.js/);
  assert.ok(html.indexOf("issue-fixes.js") < html.indexOf("app.js"));
  assert.ok(html.indexOf("app.js") < html.indexOf("issue-overlay.js"));
  assert.match(overlaySource, /START:SETTINGS/);
});

test("issue #5 VALUE LOCK pins only editable linked list/value items", () => {
  const menu = new CheatMenuModel();
  menu.open(0);
  const linked = selectNestedItem(menu, "UIテスト", "連動型数値");
  assert.equal(linked.type, "linked-value");
  const initial = linked.value;

  menu.handle("start", 100, true, false);
  assert.equal(menu.currentFrame().kind, "settings");
  menu.currentFrame().selection = 1;
  const lockSetting = menu.selectedItem();
  assert.equal(lockSetting.label, "VALUE LOCK");
  assert.equal(lockSetting.disabled, false);
  menu.handle("a", 120, true, false);
  assert.equal(menu.isItemFixed(linked), true);
  assert.equal(linked.fixedValue, initial);
  assert.equal(lockSetting.value, true);

  linked.linkedValue = initial + 500;
  menu.update(140);
  assert.equal(linked.linkedValue, initial, "fixed value overwrites simulated game-side changes");
  assert.equal(linked.value, initial);
  assert.equal(linked.appliedValue, initial);

  menu.handle("a", 160, true, false);
  assert.equal(menu.isItemFixed(linked), false, "VALUE LOCK toggles off immediately");

  menu.handle("start", 180, true, false);
  assert.equal(menu.currentFrame().title, "UIテスト");
  menu.setItemDisabled(linked, true);
  menu.handle("start", 200, true, false);
  menu.currentFrame().selection = 1;
  const disabledLock = menu.selectedItem();
  assert.equal(disabledLock.disabled, true, "disabled linked item cannot be newly fixed");
  assert.equal(menu.activateSelected(220), false);
  assert.equal(menu.isItemFixed(linked), false);

  menu.handle("start", 240, true, false);
  const ordinary = findItem(menu, "歩行速度アップ");
  menu.frames = [{ title: "ROOT", items: menu.rootItems, selection: menu.rootItems.indexOf(ordinary) }];
  menu.handle("start", 260, true, false);
  menu.currentFrame().selection = 1;
  assert.equal(menu.selectedItem().disabled, true, "VALUE LOCK is disabled for non-linked item types");

  assert.match(fixesSource, /linkedAvailable === false/);
  assert.match(overlaySource, /LOCK/);
});
