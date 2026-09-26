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
    '''      onCheckboxListChange: onChange,\n      hotkey: "なし",''',
    '''      onCheckboxListChange: onChange,\n      // SETTINGS内のチェックボックス式は選択した瞬間を確定値として扱う。\n      // CTRPF移植時も設定系の複数選択は別途「適用」を要求せず即時反映する。\n      applyCheckboxListImmediately: true,\n      hotkey: "なし",'''
)

replace_once(
    "ui-model.js",
    '''      list.item.value ^= (1 << list.index);\n      if (typeof list.item.onCheckboxListChange === "function") {\n        list.item.onCheckboxListChange(list.item.value, list.index);\n      }''',
    '''      list.item.value ^= (1 << list.index);\n      if (list.item.applyCheckboxListImmediately) {\n        // 設定画面のチェックボックス式はAで切り替えた時点で適用済みにする。\n        // CTRPF移植時も設定値はこのタイミングで設定本体へ書き込み、未適用状態を残さない。\n        list.item.appliedValue = list.item.value;\n      }\n      if (typeof list.item.onCheckboxListChange === "function") {\n        list.item.onCheckboxListChange(list.item.value, list.index);\n      }'''
)

replace_once(
    "app.js",
    '''    drawBitmapText(top, font, "CHEAT MENU", menuX + 7, 7, "#ffffff");\n    drawBitmapText(top, font, trimBitmapText(font, frame.title, 62), menuX + 91, 7, "#79d9a7");''',
    '''    drawBitmapText(top, font, "-* GOHAN *-", menuX + 7, 7, "#ffffff");\n    // 固定タイトルが1文字分長くなったため、右側の現在フレーム名も同じ4px間隔を保つ。\n    // CTRPF移植時もタイトル同士が重ならないよう、この開始位置と最大幅をセットで扱う。\n    drawBitmapText(top, font, trimBitmapText(font, frame.title, 54), menuX + 99, 7, "#79d9a7");'''
)

replace_once(
    "test/issues.test.js",
    '''  menu.handle("a", 120, true, false);\n  assert.equal(setting.value, 17, "A option can be checked without closing the list");\n  assert.equal(menu.inlineList.index, 0);\n  assert.equal(menu.persistenceSettingsSnapshot().blockButtonsUntilReleaseMask, 17);''',
    '''  menu.handle("a", 120, true, false);\n  assert.equal(setting.value, 17, "A option can be checked without closing the list");\n  assert.equal(setting.appliedValue, 17, "SETTINGS checkbox-list changes apply immediately");\n  assert.equal(menu.inlineList.index, 0);\n  assert.equal(menu.persistenceSettingsSnapshot().blockButtonsUntilReleaseMask, 17);'''
)

replace_once(
    "test/issues.test.js",
    '''  menu.handle("a", 140, true, false);\n  assert.equal(setting.value, 1, "START can be unchecked independently");\n  assert.equal(menu.persistenceSettingsSnapshot().blockButtonsUntilReleaseMask, 1);''',
    '''  menu.handle("a", 140, true, false);\n  assert.equal(setting.value, 1, "START can be unchecked independently");\n  assert.equal(setting.appliedValue, 1, "immediate apply follows every checkbox-list toggle");\n  assert.equal(menu.persistenceSettingsSnapshot().blockButtonsUntilReleaseMask, 1);'''
)

replace_once(
    "test/issues.test.js",
    '''  assert.match(appSource, /list\\.item\\.type === "checkbox-list"/);\n});''',
    '''  assert.match(appSource, /list\\.item\\.type === "checkbox-list"/);\n  assert.match(appSource, /"-\\* GOHAN \\*-"/);\n  assert.doesNotMatch(appSource, /"CHEAT MENU"/);\n});'''
)

replace_once(
    "docs/menu-state-indicators.md",
    '''## SETTINGS order''',
    '''## Menu title\n\nThe fixed menu title is `-* GOHAN *-`. The current frame title starts farther right so the two labels retain a small gap and never overlap.\n\nSETTINGS `checkbox-list` entries apply each A-button toggle immediately: `value` and `appliedValue` are synchronized at the moment an option is checked/unchecked.\n\n## SETTINGS order'''
)
