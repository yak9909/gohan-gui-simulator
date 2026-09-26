from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected 1 match, found {count}")
    p.write_text(text.replace(old, new), encoding="utf-8")


# --- ui-model.js: add the generic checkbox-list item behavior. ---
replace_once(
    "ui-model.js",
    '''  if (entry.type === "list" || entry.type === "linked-list") return entry.options[entry.value];\n  if (entry.format === "hex")''',
    '''  if (entry.type === "list" || entry.type === "linked-list") return entry.options[entry.value];\n  if (entry.type === "checkbox-list") {\n    const selected = entry.options.reduce((count, _option, index) => count + ((entry.value & (1 << index)) ? 1 : 0), 0);\n    return `${selected}/${entry.options.length}`;\n  }\n  if (entry.format === "hex")'''
)

replace_once(
    "ui-model.js",
    '''    else if (entry.type === "list" || entry.type === "linked-list") this.inlineList = {\n      item: entry, index: entry.value,\n      ...createListboxAnimation(now, entry.value, entry.options.length, LISTBOX.inlineVisibleRows)\n    };\n    else if (entry.type === "value" || entry.type === "linked-value") this.openNumeric(entry, false, now);''',
    '''    else if (entry.type === "list" || entry.type === "linked-list") this.inlineList = {\n      item: entry, index: entry.value,\n      ...createListboxAnimation(now, entry.value, entry.options.length, LISTBOX.inlineVisibleRows)\n    };\n    else if (entry.type === "checkbox-list") this.inlineList = {\n      item: entry, index: 0, checkboxMode: true,\n      ...createListboxAnimation(now, 0, entry.options.length, LISTBOX.inlineVisibleRows)\n    };\n    else if (entry.type === "value" || entry.type === "linked-value") this.openNumeric(entry, false, now);'''
)

replace_once(
    "ui-model.js",
    '''    else if (key === "a") { list.item.value = list.index; closeListbox(list, now); }\n    else if (key === "b") closeListbox(list, now);''',
    '''    else if (key === "a" && list.item.type === "checkbox-list") {\n      // チェックボックス式はリストを閉じず、カーソル位置のビットだけを反転する。\n      // CTRPF移植時も ListBox の選択移動を流用し、決定時だけ複数選択状態を更新する。\n      list.item.value ^= (1 << list.index);\n      if (typeof list.item.onCheckboxListChange === "function") {\n        list.item.onCheckboxListChange(list.item.value, list.index);\n      }\n    }\n    else if (key === "a") { list.item.value = list.index; closeListbox(list, now); }\n    else if (key === "b") closeListbox(list, now);'''
)

# --- app.js: render the new item type and per-option checkboxes. ---
replace_once(
    "app.js",
    '''    if (entry.type === "linked-list" || entry.type === "linked-value") return "S";\n    if (entry.type === "list") return "L";\n    return "V";''',
    '''    if (entry.type === "linked-list" || entry.type === "linked-value") return "S";\n    if (entry.type === "list") return "L";\n    if (entry.type === "checkbox-list") return "C";\n    return "V";'''
)

replace_once(
    "app.js",
    '''      drawBitmapText(top, font, list.item.options[index], x + 8, rowY + 2, index === list.index ? "#ffffff" : "#aeb9b1");''',
    '''      const optionText = list.item.type === "checkbox-list"\n        ? `[${list.item.value & (1 << index) ? "X" : " "}] ${list.item.options[index]}`\n        : list.item.options[index];\n      // チェックボックス式も通常のインラインListBoxと同じ行レイアウトを使う。\n      // CTRPF移植時は各行の先頭へ [ ] / [X] を描画すれば同じ見た目になる。\n      drawBitmapText(top, font, optionText, x + 8, rowY + 2, index === list.index ? "#ffffff" : "#aeb9b1");'''
)

# --- issue-fixes.js: replace the old boolean setting with the checkbox-list setting. ---
replace_once(
    "issue-fixes.js",
    '''    keepFavoriteToggleStates: true,\n    keepAllToggleStates: false,\n    blockAbxyUntilRelease: false''',
    '''    keepFavoriteToggleStates: true,\n    keepAllToggleStates: false,\n    // A/B/X/Y/START の順。初期状態では START のみ選択する。\n    blockButtonsUntilReleaseMask: 1 << 4'''
)

replace_once(
    "issue-fixes.js",
    '''  function settingsToggle(label, description, action, value, target = null, disabled = false) {\n    return {\n      id: `settings-${action}`,\n      type: "checkbox",\n      label,\n      description,\n      settingsAction: action,\n      settingsTarget: target,\n      value: Boolean(value),\n      appliedValue: Boolean(value),\n      hotkey: "なし",\n      appliedHotkey: "なし",\n      disabled: Boolean(disabled)\n    };\n  }\n\n  function ensurePersistenceSettings(menu) {''',
    '''  function settingsToggle(label, description, action, value, target = null, disabled = false) {\n    return {\n      id: `settings-${action}`,\n      type: "checkbox",\n      label,\n      description,\n      settingsAction: action,\n      settingsTarget: target,\n      value: Boolean(value),\n      appliedValue: Boolean(value),\n      hotkey: "なし",\n      appliedHotkey: "なし",\n      disabled: Boolean(disabled)\n    };\n  }\n\n  function settingsCheckboxList(label, description, action, options, value, onChange = null) {\n    const mask = Number(value) >>> 0;\n    return {\n      id: `settings-${action}`,\n      type: "checkbox-list",\n      label,\n      description,\n      settingsAction: action,\n      options: [...options],\n      value: mask,\n      appliedValue: mask,\n      onCheckboxListChange: onChange,\n      hotkey: "なし",\n      appliedHotkey: "なし",\n      disabled: false\n    };\n  }\n\n  function ensurePersistenceSettings(menu) {'''
)

replace_once(
    "issue-fixes.js",
    '''      keepAllToggleStates: stored?.keepAllToggleStates !== undefined\n        ? Boolean(stored.keepAllToggleStates)\n        : (stored?.keepEnabledItems !== undefined ? Boolean(stored.keepEnabledItems) : DEFAULT_PERSISTENCE_SETTINGS.keepAllToggleStates),\n      blockAbxyUntilRelease: stored?.blockAbxyUntilRelease !== undefined\n        ? Boolean(stored.blockAbxyUntilRelease)\n        : DEFAULT_PERSISTENCE_SETTINGS.blockAbxyUntilRelease''',
    '''      keepAllToggleStates: stored?.keepAllToggleStates !== undefined\n        ? Boolean(stored.keepAllToggleStates)\n        : (stored?.keepEnabledItems !== undefined ? Boolean(stored.keepEnabledItems) : DEFAULT_PERSISTENCE_SETTINGS.keepAllToggleStates),\n      blockButtonsUntilReleaseMask: Number.isInteger(stored?.blockButtonsUntilReleaseMask)\n        ? (stored.blockButtonsUntilReleaseMask & 0x1f)\n        // 旧ABXY設定がONだった場合はABXYを引き継ぎ、新規追加のSTARTも既定ONにする。\n        : (stored?.blockAbxyUntilRelease === true ? 0x1f : DEFAULT_PERSISTENCE_SETTINGS.blockButtonsUntilReleaseMask)'''
)

replace_once(
    "issue-fixes.js",
    '''    // CTRPF移植専用設定。シミュレーターの入力処理には接続しない。\n    // CTRPF側では A/B/X/Y の押下中はゲーム側へ入力を渡さず、ボタンを離した瞬間に\n    // 初めて単発のゲーム入力として渡す。押し続けている間のゲーム側反応やリピートは発生させない。\n    const blockAbxyUntilRelease = settingsToggle(\n      "押し切るまでABXYボタンの遮断",\n      "ABXYは押下中にゲームへ渡さず、離した時に入力します。",\n      "block-abxy-until-release",\n      persistence.blockAbxyUntilRelease\n    );\n\n    // SETTINGSだけは操作頻度を優先し、フォルダを先頭へ寄せず指定順を維持する。\n    return [keepThisItem, lock, favorites, retentionSettings, keepFavorites, blockAbxyUntilRelease];''',
    '''    // CTRPF移植専用設定。シミュレーターの入力処理には接続しない。\n    // チェックされた A/B/X/Y/START は押下中のゲーム入力を遮断し、物理ボタンを離した瞬間に\n    // 初めて単発入力としてゲーム側へ渡す。押下中の反応やキーリピートは発生させない。\n    // チェックボックス式のUI操作だけをシミュレーターで再現し、実際の入力遮断はCTRPF側だけで行う。\n    const blockButtonsUntilRelease = settingsCheckboxList(\n      "押し切るまでボタンの遮断",\n      "押下中にゲームへ渡さず、離した時に入力するボタンを選択します。",\n      "block-buttons-until-release",\n      ["A", "B", "X", "Y", "START"],\n      persistence.blockButtonsUntilReleaseMask,\n      (mask) => {\n        persistence.blockButtonsUntilReleaseMask = mask & 0x1f;\n        persistBrowserState(this);\n      }\n    );\n\n    // SETTINGSだけは操作頻度を優先し、フォルダを先頭へ寄せず指定順を維持する。\n    return [keepThisItem, lock, favorites, retentionSettings, keepFavorites, blockButtonsUntilRelease];'''
)

replace_once(
    "issue-fixes.js",
    '''      if (entry.settingsAction === "keep-this-item") {\n        const target = entry.settingsTarget;\n        if (!this.toggleItemRetained(target)) return false;\n        entry.value = this.isItemRetained(target);\n        entry.appliedValue = entry.value;\n        return true;\n      }\n      const settingKey = ({''',
    '''      if (entry.settingsAction === "keep-this-item") {\n        const target = entry.settingsTarget;\n        if (!this.toggleItemRetained(target)) return false;\n        entry.value = this.isItemRetained(target);\n        entry.appliedValue = entry.value;\n        return true;\n      }\n      if (entry.type === "checkbox-list") {\n        return original.activateSelected.call(this, now);\n      }\n      const settingKey = ({'''
)

replace_once(
    "issue-fixes.js",
    '''        "keep-retained-toggle-states": "keepRetainedToggleStates",\n        "keep-favorite-toggle-states": "keepFavoriteToggleStates",\n        "keep-all-toggle-states": "keepAllToggleStates",\n        "block-abxy-until-release": "blockAbxyUntilRelease"''',
    '''        "keep-retained-toggle-states": "keepRetainedToggleStates",\n        "keep-favorite-toggle-states": "keepFavoriteToggleStates",\n        "keep-all-toggle-states": "keepAllToggleStates"'''
)

# --- tests ---
replace_once(
    "test/issues.test.js",
    '''    "お気に入りを保持",\n    "押し切るまでABXYボタンの遮断"\n  ]);''',
    '''    "お気に入りを保持",\n    "押し切るまでボタンの遮断"\n  ]);'''
)

replace_once(
    "test/issues.test.js",
    '''  assert.equal(menu.currentFrame().items[5].type, "checkbox");\n  assert.equal(menu.currentFrame().items[5].value, false);\n  assert.equal(menu.currentFrame().items[5].description, "ABXYは押下中にゲームへ渡さず、離した時に入力します。");''',
    '''  assert.equal(menu.currentFrame().items[5].type, "checkbox-list");\n  assert.deepEqual(menu.currentFrame().items[5].options, ["A", "B", "X", "Y", "START"]);\n  assert.equal(menu.currentFrame().items[5].value, 1 << 4, "START is checked by default");\n  assert.equal(menu.currentFrame().items[5].description, "押下中にゲームへ渡さず、離した時に入力するボタンを選択します。");'''
)

old_test_start = '''test("ABXY release-block setting is UI/persistence only", () => {'''
old_test_end = '''test("値を固定 pins only editable linked list/value items", () => {'''
text = Path("test/issues.test.js").read_text(encoding="utf-8")
start = text.index(old_test_start)
end = text.index(old_test_end, start)
new_test = r'''test("checkbox-list setting toggles individual blocked buttons and remains UI/persistence only", () => {
  const menu = new CheatMenuModel();
  menu.open(0);
  menu.handle("start", 100, true, false);
  const frame = menu.currentFrame();
  frame.selection = 5;
  const setting = menu.selectedItem();
  assert.equal(setting.label, "押し切るまでボタンの遮断");
  assert.equal(setting.type, "checkbox-list");
  assert.equal(setting.value, 16);
  assert.equal(formatValue(setting), "1/5");

  menu.handle("a", 110, true, false);
  assert.equal(menu.inlineList?.item, setting, "A opens the checkbox-list inline UI");
  assert.equal(menu.inlineList.index, 0);
  menu.handle("a", 120, true, false);
  assert.equal(setting.value, 17, "A option can be checked without closing the list");
  assert.equal(menu.inlineList.index, 0);
  assert.equal(menu.persistenceSettingsSnapshot().blockButtonsUntilReleaseMask, 17);
  assert.equal(formatValue(setting), "2/5");

  for (let index = 0; index < 4; index++) menu.handle("down", 130 + index, true, false);
  assert.equal(menu.inlineList.index, 4);
  menu.handle("a", 140, true, false);
  assert.equal(setting.value, 1, "START can be unchecked independently");
  assert.equal(menu.persistenceSettingsSnapshot().blockButtonsUntilReleaseMask, 1);
  menu.handle("b", 150, true, false);
  assert.ok(menu.inlineList?.closing, "B closes the checkbox-list");

  // This simulator only stores/previews the CTRPF option. It must not alter the
  // simulator's game-input capture contract or synthesize release-time button input.
  assert.match(fixesSource, /チェックボックス式のUI操作だけをシミュレーターで再現/);
  assert.match(fixesSource, /物理ボタンを離した瞬間に/);
  assert.doesNotMatch(fixesSource, /gameInputCaptureState\s*=.*blockButtonsUntilReleaseMask/s);
  assert.match(appSource, /list\.item\.type === "checkbox-list"/);
});

test("値を固定 pins only editable linked list/value items", () => {'''
Path("test/issues.test.js").write_text(text[:start] + new_test + text[end + len(old_test_end):], encoding="utf-8")

# The test file now calls formatValue directly.
replace_once(
    "test/issues.test.js",
    '''const { CheatMenuModel, NotificationTimeline, NOTICE, MENU, walkItems } = core;''',
    '''const { CheatMenuModel, NotificationTimeline, NOTICE, MENU, walkItems, formatValue } = core;'''
)

# --- docs ---
replace_once(
    "docs/menu-state-indicators.md",
    '''6. `押し切るまでABXYボタンの遮断`''',
    '''6. `押し切るまでボタンの遮断`'''
)

replace_once(
    "docs/menu-state-indicators.md",
    '''`押し切るまでABXYボタンの遮断` is default OFF and is a CTRPF-port contract only. The simulator stores and displays the option but does not alter simulated input behavior. In CTRPF, when enabled, A/B/X/Y press events must be withheld from the game while the physical button remains down; the game receives a single corresponding input only when that button is released. Holding the button must not produce game-side press/repeat reactions before release.''',
    '''`押し切るまでボタンの遮断` uses the new `checkbox-list` item type. Its options are `A`, `B`, `X`, `Y`, and `START`; only `START` is checked by default. A opens an inline list where every row has its own checkbox, A toggles the highlighted checkbox without closing the list, and B closes it. The menu row shows the selected-count summary such as `1/5`.\n\nThis option remains a CTRPF-port contract only: the simulator stores and previews the checkbox-list selection but does not alter simulated game input. In CTRPF, each checked button must be withheld from the game while physically held, then delivered as one game-side input when released. Holding a checked button must not produce game-side press/repeat reactions before release.'''
)

# Sanity checks against legacy UI wording/setting key.
for path in ["issue-fixes.js", "test/issues.test.js", "docs/menu-state-indicators.md"]:
    content = Path(path).read_text(encoding="utf-8")
    if "押し切るまでABXYボタンの遮断" in content:
        raise SystemExit(f"{path}: legacy label remains")
