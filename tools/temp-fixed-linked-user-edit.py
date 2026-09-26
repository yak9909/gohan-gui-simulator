from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected 1 match, found {count}")
    p.write_text(text.replace(old, new), encoding="utf-8")


replace_once(
    "issue-fixes.js",
    '''  prototype.updateFixedLinkedItems = function () {\n    walkItems(this.rootItems, (entry) => {\n      if (!entry.fixed || !LINKED_TYPES.has(entry.type) || entry.disabled || entry.linkedAvailable === false) return;\n      entry.linkedValue = entry.fixedValue;\n      entry.value = entry.fixedValue;\n      entry.appliedValue = entry.fixedValue;\n    });\n  };''',
    '''  prototype.updateFixedLinkedItems = function () {\n    let fixedValueChanged = false;\n    walkItems(this.rootItems, (entry) => {\n      if (!entry.fixed || !LINKED_TYPES.has(entry.type) || entry.disabled || entry.linkedAvailable === false) return;\n\n      // 固定中でもメニュー上のユーザー編集は許可する。value と appliedValue が違う時だけ\n      // ユーザーが左右キー・数値入力・リスト選択で変更したとみなし、その値を新しい固定値にする。\n      // CTRPF移植時は「ゲーム側から読んだ値」と「UIが編集した値」を同様に分離し、\n      // 外部変動だけを固定値へ戻して、UI入力は固定値そのものを更新する。\n      if (entry.value !== entry.appliedValue) {\n        entry.fixedValue = entry.value;\n        entry.linkedValue = entry.value;\n        entry.appliedValue = entry.value;\n        fixedValueChanged = true;\n        return;\n      }\n\n      entry.linkedValue = entry.fixedValue;\n      entry.value = entry.fixedValue;\n      entry.appliedValue = entry.fixedValue;\n    });\n    if (fixedValueChanged) persistBrowserState(this);\n  };'''
)

replace_once(
    "ui-model.js",
    '''  changeValue(entry, direction, now) {\n    if (!entry || entry.disabled) return false;\n    const decimals = entry.format === "float" ? 10 : 1;\n    const next = clamp(Math.round((entry.value + direction * entry.step) * decimals) / decimals, entry.minimum, entry.maximum);\n    entry.value = next;\n    this.valueBounceDirection = direction;\n    this.valueBounceStartedAt = now;\n  }\n\n  openNumeric(entry, applyOnConfirm = false, now = 0) {''',
    '''  changeValue(entry, direction, now) {\n    if (!entry || entry.disabled) return false;\n    const decimals = entry.format === "float" ? 10 : 1;\n    const next = clamp(Math.round((entry.value + direction * entry.step) * decimals) / decimals, entry.minimum, entry.maximum);\n    entry.value = next;\n    this.valueBounceDirection = direction;\n    this.valueBounceStartedAt = now;\n  }\n\n  changeListValue(entry, direction, now) {\n    if (!entry || entry.disabled || !["list", "linked-list"].includes(entry.type)) return false;\n    const optionCount = entry.options?.length || 0;\n    if (optionCount <= 0) return false;\n    const next = clamp(Math.round(entry.value) + direction, 0, optionCount - 1);\n    if (next === entry.value) return false;\n    entry.value = next;\n    // CTRPF移植時も通常の数値左右変更と同じ入力フィードバックを使う。\n    this.valueBounceDirection = direction;\n    this.valueBounceStartedAt = now;\n    return true;\n  }\n\n  openNumeric(entry, applyOnConfirm = false, now = 0) {'''
)

replace_once(
    "ui-model.js",
    '''    else if ((key === "left" || key === "right") && ["value", "slider", "linked-value"].includes(this.selectedItem().type)) this.changeValue(this.selectedItem(), key === "right" ? 1 : -1, now);''',
    '''    else if ((key === "left" || key === "right") && ["value", "slider", "linked-value"].includes(this.selectedItem().type)) this.changeValue(this.selectedItem(), key === "right" ? 1 : -1, now);\n    else if ((key === "left" || key === "right") && ["list", "linked-list"].includes(this.selectedItem().type)) this.changeListValue(this.selectedItem(), key === "right" ? 1 : -1, now);'''
)

insert_marker = '''test("retained value, toggle-state, and value-lock snapshots are independent", () => {'''
new_test = r'''test("fixed linked items accept user edits and list values support left/right", () => {
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

test("retained value, toggle-state, and value-lock snapshots are independent", () => {'''
replace_once("test/issues.test.js", insert_marker, new_test)

replace_once(
    "docs/menu-state-indicators.md",
    '''## Description and footer''',
    '''## Fixed linked-item editing\n\nA fixed linked item still accepts explicit user edits. For `linked-value`, left/right adjustment and a confirmed numeric-keyboard value become the new fixed value. For `linked-list`, left/right changes the selected option directly; inline-list selection remains available with A. External/game-side linked-value drift is still overwritten by the current fixed value.\n\n`list` and `linked-list` rows both support direct left/right option changes. The option index is clamped at the first and last entry rather than wrapping.\n\n## Description and footer'''
)
