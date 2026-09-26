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
    '''    keepRetainedToggleStates: true,\n    keepFavoriteToggleStates: true,\n    keepAllToggleStates: false\n  });''',
    '''    keepRetainedToggleStates: true,\n    keepFavoriteToggleStates: true,\n    keepAllToggleStates: false,\n    blockAbxyUntilRelease: false\n  });'''
)

replace_once(
    "issue-fixes.js",
    '''      keepAllToggleStates: stored?.keepAllToggleStates !== undefined\n        ? Boolean(stored.keepAllToggleStates)\n        : (stored?.keepEnabledItems !== undefined ? Boolean(stored.keepEnabledItems) : DEFAULT_PERSISTENCE_SETTINGS.keepAllToggleStates)\n    };''',
    '''      keepAllToggleStates: stored?.keepAllToggleStates !== undefined\n        ? Boolean(stored.keepAllToggleStates)\n        : (stored?.keepEnabledItems !== undefined ? Boolean(stored.keepEnabledItems) : DEFAULT_PERSISTENCE_SETTINGS.keepAllToggleStates),\n      blockAbxyUntilRelease: stored?.blockAbxyUntilRelease !== undefined\n        ? Boolean(stored.blockAbxyUntilRelease)\n        : DEFAULT_PERSISTENCE_SETTINGS.blockAbxyUntilRelease\n    };'''
)

replace_once(
    "issue-fixes.js",
    '''    const keepFavorites = settingsToggle(\n      "お気に入りを保持",\n      "お気に入り登録を次回も保持します。",\n      "keep-favorites",\n      persistence.keepFavorites\n    );\n\n    // SETTINGSだけは操作頻度を優先し、フォルダを先頭へ寄せず指定順を維持する。\n    return [keepThisItem, lock, favorites, retentionSettings, keepFavorites];''',
    '''    const keepFavorites = settingsToggle(\n      "お気に入りを保持",\n      "お気に入り登録を次回も保持します。",\n      "keep-favorites",\n      persistence.keepFavorites\n    );\n    // CTRPF移植専用設定。シミュレーターの入力処理には接続しない。\n    // CTRPF側では A/B/X/Y の押下中はゲーム側へ入力を渡さず、ボタンを離した瞬間に\n    // 初めて単発のゲーム入力として渡す。押し続けている間のゲーム側反応やリピートは発生させない。\n    const blockAbxyUntilRelease = settingsToggle(\n      "押し切るまでABXYボタンの遮断",\n      "ABXYは押下中にゲームへ渡さず、離した時に入力します。",\n      "block-abxy-until-release",\n      persistence.blockAbxyUntilRelease\n    );\n\n    // SETTINGSだけは操作頻度を優先し、フォルダを先頭へ寄せず指定順を維持する。\n    return [keepThisItem, lock, favorites, retentionSettings, keepFavorites, blockAbxyUntilRelease];'''
)

replace_once(
    "issue-fixes.js",
    '''        "keep-favorite-toggle-states": "keepFavoriteToggleStates",\n        "keep-all-toggle-states": "keepAllToggleStates"\n      })[entry.settingsAction];''',
    '''        "keep-favorite-toggle-states": "keepFavoriteToggleStates",\n        "keep-all-toggle-states": "keepAllToggleStates",\n        "block-abxy-until-release": "blockAbxyUntilRelease"\n      })[entry.settingsAction];'''
)

replace_once(
    "test/issues.test.js",
    '''    "お気に入り",\n    "項目の保持設定",\n    "お気に入りを保持"\n  ]);''',
    '''    "お気に入り",\n    "項目の保持設定",\n    "お気に入りを保持",\n    "押し切るまでABXYボタンの遮断"\n  ]);'''
)

replace_once(
    "test/issues.test.js",
    '''  assert.equal(menu.currentFrame().items[2].type, "folder");\n  assert.equal(menu.currentFrame().items[3].type, "folder");\n  assert.deepEqual(menu.persistenceSettingsSnapshot(), DEFAULT_PERSISTENCE_SETTINGS);''',
    '''  assert.equal(menu.currentFrame().items[2].type, "folder");\n  assert.equal(menu.currentFrame().items[3].type, "folder");\n  assert.equal(menu.currentFrame().items[5].type, "checkbox");\n  assert.equal(menu.currentFrame().items[5].value, false);\n  assert.equal(menu.currentFrame().items[5].description, "ABXYは押下中にゲームへ渡さず、離した時に入力します。");\n  assert.deepEqual(menu.persistenceSettingsSnapshot(), DEFAULT_PERSISTENCE_SETTINGS);'''
)

insert_marker = '''test("値を固定 pins only editable linked list/value items", () => {'''
new_test = r'''test("ABXY release-block setting is UI/persistence only", () => {
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

test("値を固定 pins only editable linked list/value items", () => {'''
replace_once("test/issues.test.js", insert_marker, new_test)

replace_once(
    "docs/menu-state-indicators.md",
    '''5. `お気に入りを保持`\n''',
    '''5. `お気に入りを保持`\n6. `押し切るまでABXYボタンの遮断`\n'''
)

replace_once(
    "docs/menu-state-indicators.md",
    '''`お気に入り` is a folder-style entry, not an action-style SETTINGS command. Opening it uses the normal favorites frame so favorite items remain live references to the original menu entries.\n\n## 項目の保持設定''',
    '''`お気に入り` is a folder-style entry, not an action-style SETTINGS command. Opening it uses the normal favorites frame so favorite items remain live references to the original menu entries.\n\n`押し切るまでABXYボタンの遮断` is default OFF and is a CTRPF-port contract only. The simulator stores and displays the option but does not alter simulated input behavior. In CTRPF, when enabled, A/B/X/Y press events must be withheld from the game while the physical button remains down; the game receives a single corresponding input only when that button is released. Holding the button must not produce game-side press/repeat reactions before release.\n\n## 項目の保持設定'''
)
