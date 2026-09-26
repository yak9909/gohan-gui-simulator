const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const core = require("../ui-model.js");
const {
  HOLD_CANCEL_THRESHOLD,
  NOTICE_LINE_HEIGHT,
  DEFAULT_PERSISTENCE_SETTINGS
} = require("../issue-fixes.js");
const { CheatMenuModel, NotificationTimeline, NOTICE, MENU, walkItems } = core;

const overlaySource = fs.readFileSync(path.join(__dirname, "../issue-overlay.js"), "utf8");
const appSource = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
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

  assert.match(overlaySource, /hold && hold\.progress < HOLD_CANCEL_THRESHOLD/);
  assert.match(overlaySource, /progressWidth = Math\.round\(barWidth \* hold\.progress\)/);
  assert.match(overlaySource, /fillRect\(menuX \+ 10, 211, progressWidth, 2\)/);
  assert.doesNotMatch(overlaySource, /Math\.min\(hold\.progress, HOLD_CANCEL_THRESHOLD\)/);
  assert.doesNotMatch(overlaySource, /grayWidth/);
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

test("START opens settings with the requested mixed item/folder order", () => {
  const { menu, item } = rootCheckboxMenu();
  menu.toggleFavorite(item, 10);

  menu.handle("start", 100, true, false);
  assert.equal(menu.currentFrame().kind, "settings");
  assert.equal(menu.currentFrame().title, "SETTINGS");
  assert.deepEqual(menu.currentFrame().items.map((entry) => entry.label), [
    "この項目を保持",
    "値を固定",
    "お気に入り",
    "項目の保持設定",
    "お気に入りを保持",
    "押し切るまでABXYボタンの遮断"
  ]);
  assert.equal(menu.currentFrame().items[0].description, "選択中の項目の状態を次回も保持します。");
  assert.equal(menu.currentFrame().items[2].type, "folder");
  assert.equal(menu.currentFrame().items[3].type, "folder");
  assert.equal(menu.currentFrame().items[5].type, "checkbox");
  assert.equal(menu.currentFrame().items[5].value, false);
  assert.equal(menu.currentFrame().items[5].description, "ABXYは押下中にゲームへ渡さず、離した時に入力します。");
  assert.deepEqual(menu.persistenceSettingsSnapshot(), DEFAULT_PERSISTENCE_SETTINGS);

  menu.currentFrame().selection = 2;
  menu.handle("a", 120, true, false);
  assert.equal(menu.currentFrame().kind, "favorites", "A on お気に入り opens the folder as a favorites frame");
  assert.equal(menu.currentFrame().items[0], item, "favorites still reference the original item");

  menu.handle("b", 140, true, false);
  assert.equal(menu.currentFrame().kind, "settings", "B returns from favorites to settings");
  menu.currentFrame().selection = 2;
  menu.handle("a", 160, true, false);
  assert.equal(menu.currentFrame().kind, "favorites");
  menu.handle("start", 180, true, false);
  assert.equal(menu.currentFrame().title, "ROOT", "START closes the whole settings subtree");

  const empty = rootCheckboxMenu().menu;
  empty.handle("start", 200, true, false);
  assert.equal(empty.currentFrame().kind, "settings");
  assert.equal(empty.currentFrame().items[2].disabled, true, "お気に入り folder is disabled when there are no favorites");
  empty.currentFrame().selection = 2;
  assert.equal(empty.activateSelected(220), false);

  assert.match(html, /issue-fixes\.js/);
  assert.match(html, /issue-overlay\.js/);
  assert.ok(html.indexOf("issue-fixes.js") < html.indexOf("app.js"));
  assert.ok(html.indexOf("app.js") < html.indexOf("issue-overlay.js"));
  assert.doesNotMatch(overlaySource, /R:FAV|START:CLOSE|A:SELECT/);
  assert.match(overlaySource, /menu\.isItemFixed\?\.\(selected\) \? "値を固定:ON" : ""/);
  assert.doesNotMatch(overlaySource, /fillRect\(174, 35, 211, 11\)/);
});

test("ABXY release-block setting is UI/persistence only", () => {
  const menu = new CheatMenuModel();
  menu.open(0);
  menu.handle("start", 100, true, false);
  const frame = menu.currentFrame();
  frame.selection = 5;
  const setting = menu.selectedItem();
  assert.equal(setting.label, "押し切るまでABXYボタンの遮断");
  assert.equal(setting.value, false);

  menu.handle("a", 110, true, false);
  assert.equal(setting.value, true);
  assert.equal(menu.persistenceSettingsSnapshot().blockAbxyUntilRelease, true);

  // This simulator only stores/previews the CTRPF option. It must not alter the
  // simulator's game-input capture contract or synthesize release-time ABXY input.
  assert.match(fixesSource, /CTRPF移植専用設定。シミュレーターの入力処理には接続しない。/);
  assert.match(fixesSource, /ボタンを離した瞬間に/);
  assert.doesNotMatch(fixesSource, /gameInputCaptureState\s*=.*blockAbxyUntilRelease/s);
});

test("値を固定 pins only editable linked list/value items", () => {
  const emitted = [];
  const menu = new CheatMenuModel((title, message) => emitted.push({ title, message }));
  menu.open(0);
  const linked = selectNestedItem(menu, "UIテスト", "連動型数値");
  assert.equal(linked.type, "linked-value");
  const initial = linked.value;

  menu.handle("start", 100, true, false);
  assert.equal(menu.currentFrame().kind, "settings");
  menu.currentFrame().selection = 1;
  const lockSetting = menu.selectedItem();
  assert.equal(lockSetting.label, "値を固定");
  assert.equal(lockSetting.disabled, false);
  menu.handle("a", 120, true, false);
  assert.equal(menu.isItemFixed(linked), true);
  assert.equal(linked.fixedValue, initial);
  assert.equal(lockSetting.value, true);
  assert.equal(emitted.at(-1).title, "値を固定");

  linked.linkedValue = initial + 500;
  menu.update(140);
  assert.equal(linked.linkedValue, initial, "fixed value overwrites simulated game-side changes");
  assert.equal(linked.value, initial);
  assert.equal(linked.appliedValue, initial);

  menu.handle("a", 160, true, false);
  assert.equal(menu.isItemFixed(linked), false, "値を固定 toggles off immediately");

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
  assert.equal(menu.selectedItem().disabled, true, "値を固定 is disabled for non-linked item types");

  assert.match(fixesSource, /linkedAvailable === false/);
  assert.match(overlaySource, /値を固定/);
});

test("fixed linked items accept user edits and list values support left/right", () => {
  const menu = new CheatMenuModel();
  menu.open(0);

  const linkedValue = selectNestedItem(menu, "UIテスト", "連動型数値");
  const initialValue = linkedValue.value;
  assert.equal(menu.setItemFixed(linkedValue, true, 10), true);

  menu.handle("right", 20, true, false);
  menu.handle("right", 21, false, false);
  assert.equal(linkedValue.value, initialValue + linkedValue.step, "fixed linked value still accepts left/right edits");
  menu.update(22);
  assert.equal(linkedValue.fixedValue, initialValue + linkedValue.step, "left/right edit becomes the new fixed value");
  assert.equal(linkedValue.appliedValue, linkedValue.fixedValue);
  assert.equal(linkedValue.linkedValue, linkedValue.fixedValue);

  const typedValue = linkedValue.fixedValue + 350;
  menu.handle("a", 30, true, false);
  assert.equal(menu.overlay?.type, "numeric");
  menu.overlay.buffer = String(typedValue);
  menu.activateNumericKey("OK", 31);
  menu.update(32);
  assert.equal(linkedValue.fixedValue, typedValue, "numeric confirmation updates the fixed target");
  assert.equal(linkedValue.value, typedValue);
  assert.equal(linkedValue.appliedValue, typedValue);

  linkedValue.linkedValue = typedValue + 999;
  menu.update(33);
  assert.equal(linkedValue.linkedValue, typedValue, "external linked-value drift is still overwritten by the fixed value");

  menu.update(300);
  assert.equal(menu.overlay, null, "numeric overlay finishes closing before normal menu input resumes");

  const weather = findItem(menu, "天候");
  menu.frames = [{ title: "ROOT", items: menu.rootItems, selection: menu.rootItems.indexOf(weather) }];
  menu.resetSelectionAnimation(40);
  assert.equal(weather.value, 0);
  menu.handle("right", 41, true, false);
  menu.handle("right", 42, false, false);
  assert.equal(weather.value, 1, "list advances with Right");
  menu.handle("left", 43, true, false);
  menu.handle("left", 44, false, false);
  assert.equal(weather.value, 0, "list moves back with Left");

  const linkedList = selectNestedItem(menu, "UIテスト", "連動型リスト");
  assert.equal(menu.setItemFixed(linkedList, true, 50), true);
  menu.handle("right", 51, true, false);
  menu.handle("right", 52, false, false);
  menu.update(53);
  assert.equal(linkedList.value, 1);
  assert.equal(linkedList.fixedValue, 1, "fixed linked-list left/right edit becomes the new fixed value");
  assert.equal(linkedList.linkedValue, 1);

  assert.match(fixesSource, /value と appliedValue が違う時だけ/);
  assert.match(fs.readFileSync(path.join(__dirname, "../ui-model.js"), "utf8"), /changeListValue/);
});

test("retained value, toggle-state, and value-lock snapshots are independent", () => {
  const menu = new CheatMenuModel();
  const walking = findItem(menu, "歩行速度アップ");
  const weather = findItem(menu, "天候");
  const bells = selectNestedItem(menu, "数値設定", "所持ベル");
  menu.frames = [{ title: "ROOT", items: menu.rootItems, selection: 0 }];
  const linked = selectNestedItem(menu, "UIテスト", "連動型数値");

  walking.value = true;
  walking.appliedValue = true;
  weather.value = 2;
  weather.appliedValue = 2;
  bells.value = 4200;
  bells.appliedValue = 4200;
  linked.value = 1777;
  linked.appliedValue = 1777;
  linked.linkedValue = 1777;
  linked.fixed = true;
  linked.fixedValue = 1777;
  menu.toggleFavorite(weather, 10);

  const all = menu.retainedStateSnapshot(false);
  const favorites = menu.retainedStateSnapshot(true);
  assert.equal(all[walking.favoriteKey].value, true);
  assert.equal(all[weather.favoriteKey].value, 2);
  assert.equal(all[bells.favoriteKey].value, 4200);
  assert.deepEqual(all[linked.favoriteKey], { type: "linked-value", value: 1777 });
  assert.deepEqual(Object.keys(favorites), [weather.favoriteKey]);
  assert.deepEqual(menu.valueLockStateSnapshot()[linked.favoriteKey], { type: "linked-value", fixedValue: 1777 });
  assert.deepEqual(menu.toggleStateSnapshot()[walking.favoriteKey], { type: "checkbox", value: true });

  const restored = new CheatMenuModel();
  const count = restored.restoreRetainedStateSnapshot(all);
  assert.ok(count >= 4);
  assert.equal(findItem(restored, "歩行速度アップ").appliedValue, true);
  assert.equal(findItem(restored, "天候").appliedValue, 2);
  assert.equal(findItem(restored, "所持ベル").appliedValue, 4200);
  const restoredLinked = findItem(restored, "連動型数値");
  assert.equal(Boolean(restoredLinked.fixed), false, "applied-state retention does not implicitly retain value locks");
  restored.restoreValueLockStateSnapshot(menu.valueLockStateSnapshot());
  assert.equal(restoredLinked.fixed, true);
  assert.equal(restoredLinked.fixedValue, 1777);
  assert.match(fixesSource, /「値の固定」と「トグル状態」は別契約/);
  assert.match(fixesSource, /全項目がONなら保持済み\/お気に入りの範囲指定はUI上無効化/);
});

test("項目の保持設定 has scoped value-lock and toggle-state folders", () => {
  const menu = new CheatMenuModel();
  menu.open(0);
  menu.currentFrame().selection = 1;
  menu.handle("start", 100, true, false);
  const rootSettings = menu.currentFrame();

  rootSettings.selection = 0;
  assert.equal(menu.selectedItem().label, "この項目を保持");
  menu.handle("a", 110, true, false);
  assert.equal(menu.selectedItem().value, true);
  assert.equal(menu.isItemRetained(menu.selectedItem().settingsTarget), true);

  rootSettings.selection = 3;
  menu.handle("a", 120, true, false);
  assert.equal(menu.currentFrame().title, "項目の保持設定");
  assert.deepEqual(menu.currentFrame().items.map((entry) => entry.label), ["値の固定", "トグル状態"]);

  menu.currentFrame().selection = 0;
  menu.handle("a", 130, true, false);
  assert.equal(menu.currentFrame().title, "値の固定");
  assert.deepEqual(menu.currentFrame().items.map((entry) => entry.label), ["保持された項目", "お気に入り", "全項目"]);
  assert.deepEqual(menu.currentFrame().items.map((entry) => entry.value), [true, false, false]);
  menu.currentFrame().selection = 2;
  menu.handle("a", 140, true, false);
  assert.equal(menu.persistenceSettingsSnapshot().keepAllValueLocks, true);
  assert.equal(menu.currentFrame().items[0].disabled, true);
  assert.equal(menu.currentFrame().items[1].disabled, true);

  menu.handle("b", 150, true, false);
  menu.currentFrame().selection = 1;
  menu.handle("a", 160, true, false);
  assert.equal(menu.currentFrame().title, "トグル状態");
  assert.deepEqual(menu.currentFrame().items.map((entry) => entry.label), ["保持された項目", "お気に入り", "全項目"]);
  assert.deepEqual(menu.currentFrame().items.map((entry) => entry.value), [true, true, false]);
  menu.currentFrame().selection = 2;
  menu.handle("a", 170, true, false);
  assert.equal(menu.persistenceSettingsSnapshot().keepAllToggleStates, true);
  assert.equal(menu.currentFrame().items[0].disabled, true);
  assert.equal(menu.currentFrame().items[1].disabled, true);

  assert.doesNotMatch(fixesSource, /"値の固定を保持"/);
  assert.doesNotMatch(fixesSource, /"オンにした項目を保持"/);
  assert.doesNotMatch(fixesSource, /"オンにしたお気に入りを保持"/);
  assert.match(fixesSource, /項目のトグル状態を次回も保持/);
});

test("notifications support variable row counts", () => {
  assert.equal(NOTICE_LINE_HEIGHT, 10);
  const timeline = new NotificationTimeline();
  const item = timeline.add(0, "TITLE", "one\ntwo\nthree");
  assert.equal(item.noticeHeight, NOTICE.height + NOTICE_LINE_HEIGHT * 2);
  const sample = timeline.sample(NOTICE.enterDuration);
  assert.equal(sample.length, 1);
  assert.equal(sample[0].noticeHeight, item.noticeHeight);
  assert.match(fixesSource, /wrapNoticeLine/);
  assert.match(fixesSource, /drawBrowserNotices/);
});

test("notification overflow exits upward and is removed only after it is fully outside", () => {
  const timeline = new NotificationTimeline();
  for (let index = 0; index < NOTICE.maximum + 1; index++) timeline.add(index * 10);
  const overflowStartedAt = NOTICE.spawnInterval * NOTICE.maximum;
  const duringExit = timeline.sample(overflowStartedAt);
  assert.equal(duringExit.length, NOTICE.maximum + 1, "overflow item remains alive while its exit animation is visible");
  assert.equal(duringExit[0].id, 1);
  assert.equal(duringExit[0].overflowExit, true);
  assert.ok(duringExit[0].y + NOTICE.height > 0, "oldest notice is not deleted until its lower edge leaves the screen");

  const afterExit = timeline.sample(overflowStartedAt + NOTICE.enterDuration);
  assert.equal(afterExit.length, NOTICE.maximum);
  assert.equal(afterExit[0].id, 2);
  assert.match(fixesSource, /this\.getY\(item, now\) \+ \(item\.noticeHeight \|\| NOTICE\.height\) > 0/);
});

test("menu row status uses one vertically split 1px line at the historical value-lock position", () => {
  assert.match(appSource, /if \(menu\.isFavorite\(entry\)\) statusColors\.push\("#d6c98a"\)/);
  assert.match(appSource, /entry\.hotkey !== "なし"\) statusColors\.push\("#78a9ff"\)/);
  assert.match(appSource, /if \(menu\.isItemRetained\?\.\(entry\)\) statusColors\.push\("#e5484d"\)/);
  assert.match(appSource, /const statusHeight = 12/);
  assert.match(appSource, /const statusAlpha = 0\.6/);
  assert.match(appSource, /top\.save\(\);\s*top\.globalAlpha = statusAlpha/s);
  assert.match(appSource, /top\.restore\(\)/);
  assert.match(appSource, /segmentTop = Math\.floor\(statusHeight \* statusIndex \/ statusColors\.length\)/);
  assert.match(appSource, /segmentBottom = Math\.floor\(statusHeight \* \(statusIndex \+ 1\) \/ statusColors\.length\)/);
  assert.match(appSource, /fillRect\(menuX \+ 4 \+ itemOffset, y - 2 \+ segmentTop, 1, segmentBottom - segmentTop\)/);
  assert.doesNotMatch(appSource, /menuX \+ 6 - statusIndex/);
  assert.doesNotMatch(appSource, /drawBitmapText\(top, font, "F"/);
  assert.doesNotMatch(appSource, /drawBitmapText\(top, font, "H"/);
  assert.doesNotMatch(overlaySource, /eraseLegacyFavoriteMarker|drawFavoriteMarkers/);
  assert.doesNotMatch(overlaySource, /VALUE_LOCK_MARKER_COLOR/);
});

test("description and footer hints follow the compact Japanese key layout", () => {
  assert.doesNotMatch(appSource, /R:ADD FAVORITE|R:REMOVE|START:FAVORITES/);
  assert.match(appSource, /"Yホットキー"/);
  assert.match(appSource, /"START設定"/);
  assert.match(appSource, /"R星"/);
  assert.match(appSource, /drawBitmapText\(top, font, "B戻る", footerYX/);
  assert.match(appSource, /drawBitmapText\(top, font, "L戻し", footerStartX/);
  assert.match(appSource, /footerStartX \+ measureBitmapText\(font, "START設定"\) \+ footerSpace/);
  assert.match(appSource, /drawBitmapText\(top, font, line, x \+ 8, y \+ 42 \+ index \* 11, "#c4cec7"\)/);
  assert.doesNotMatch(appSource, /entry\.disabled \? "#626b64"/);
  assert.doesNotMatch(overlaySource, /R:FAV|START:CLOSE|A:SELECT/);
});
