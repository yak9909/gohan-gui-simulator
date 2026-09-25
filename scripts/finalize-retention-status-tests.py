from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"{label}: source block not found")
    return text.replace(old, new, 1)

# The main patch intentionally stops after source edits because its legacy marker-test
# replacement predates the exact current test text. Finish all test-contract updates here.
path = Path('test/issues.test.js')
text = path.read_text(encoding='utf-8')

text = replace_once(text, '''  assert.deepEqual(menu.currentFrame().items.map((entry) => entry.label), [
    "FAVORITES",
    "値を固定",
    "お気に入りを保持",
    "オンにした項目を保持",
    "オンにしたお気に入りを保持"
  ]);''', '''  assert.deepEqual(menu.currentFrame().items.map((entry) => entry.label), [
    "FAVORITES",
    "値を固定",
    "この項目を保持",
    "値の固定を保持",
    "お気に入りを保持",
    "オンにした項目を保持",
    "オンにしたお気に入りを保持"
  ]);''', 'settings labels test')

text = replace_once(text, '''  assert.match(overlaySource, /通常のチート説明欄には/);
  assert.match(overlaySource, /else controlText = `\\$\\{menu\\.isItemFixed/);''', '''  assert.doesNotMatch(overlaySource, /R:FAV|START:CLOSE|A:SELECT/);
  assert.match(overlaySource, /menu\\.isItemFixed\\?\\.\\(selected\\) \\? "値を固定:ON" : ""/);''', 'settings description-hint test')

text = replace_once(text, '''  assert.deepEqual(all[linked.favoriteKey], { type: "linked-value", value: 1777, fixed: true, fixedValue: 1777 });
  assert.deepEqual(Object.keys(favorites), [weather.favoriteKey]);

  const restored = new CheatMenuModel();
  const count = restored.restoreRetainedStateSnapshot(all);
  assert.ok(count >= 4);
  assert.equal(findItem(restored, "歩行速度アップ").appliedValue, true);
  assert.equal(findItem(restored, "天候").appliedValue, 2);
  assert.equal(findItem(restored, "所持ベル").appliedValue, 4200);
  const restoredLinked = findItem(restored, "連動型数値");
  assert.equal(restoredLinked.fixed, true);
  assert.equal(restoredLinked.fixedValue, 1777);
  assert.match(fixesSource, /値固定、list\\/listbox、linked-list、value、slider、linked-value/);
  assert.match(fixesSource, /未適用の編集中値は保存しない/);''', '''  assert.deepEqual(all[linked.favoriteKey], { type: "linked-value", value: 1777 });
  assert.deepEqual(Object.keys(favorites), [weather.favoriteKey]);
  assert.deepEqual(menu.valueLockStateSnapshot()[linked.favoriteKey], { type: "linked-value", fixedValue: 1777 });

  const restored = new CheatMenuModel();
  const count = restored.restoreRetainedStateSnapshot(all);
  assert.ok(count >= 4);
  assert.equal(findItem(restored, "歩行速度アップ").appliedValue, true);
  assert.equal(findItem(restored, "天候").appliedValue, 2);
  assert.equal(findItem(restored, "所持ベル").appliedValue, 4200);
  const restoredLinked = findItem(restored, "連動型数値");
  assert.equal(restoredLinked.fixed, false, "applied-state retention does not implicitly retain value locks");
  restored.restoreValueLockStateSnapshot(menu.valueLockStateSnapshot());
  assert.equal(restoredLinked.fixed, true);
  assert.equal(restoredLinked.fixedValue, 1777);
  assert.match(fixesSource, /list\\/listbox、linked-list、value、slider、linked-value/);
  assert.match(fixesSource, /値の固定状態そのものは「値の固定を保持」で別途管理/);
  assert.match(fixesSource, /未適用の編集中値は保存しない/);''', 'retained state test')

text = replace_once(text, '''  frame.selection = 2;
  assert.equal(menu.selectedItem().value, true);
  menu.handle("a", 120, true, false);
  assert.equal(menu.persistenceSettingsSnapshot().keepFavorites, false);

  frame.selection = 3;
  menu.handle("a", 140, true, false);
  assert.equal(menu.persistenceSettingsSnapshot().keepEnabledItems, true);

  frame.selection = 4;
  menu.handle("a", 160, true, false);
  assert.equal(menu.persistenceSettingsSnapshot().keepEnabledFavorites, true);''', '''  frame.selection = 2;
  assert.equal(menu.selectedItem().label, "この項目を保持");
  menu.handle("a", 110, true, false);
  assert.equal(menu.isItemRetained(menu.settingsTarget), true);

  frame.selection = 3;
  menu.handle("a", 120, true, false);
  assert.equal(menu.persistenceSettingsSnapshot().keepValueLocks, true);

  frame.selection = 4;
  assert.equal(menu.selectedItem().value, true);
  menu.handle("a", 130, true, false);
  assert.equal(menu.persistenceSettingsSnapshot().keepFavorites, false);

  frame.selection = 5;
  menu.handle("a", 140, true, false);
  assert.equal(menu.persistenceSettingsSnapshot().keepEnabledItems, true);

  frame.selection = 6;
  menu.handle("a", 160, true, false);
  assert.equal(menu.persistenceSettingsSnapshot().keepEnabledFavorites, true);''', 'retention settings test')

text = text.replace('test("retained state includes listboxes, numeric values, checkboxes and fixed linked values"',
                    'test("retained state and value-lock state are persisted independently"', 1)

old_marker = '''test("menu row status markers use the historical lower H baseline without duplicate H", () => {
  assert.match(overlaySource, /drawBitmapText\\(context, font, "F", menuX \\+ 140 \\+ itemOffset, y \\+ 8, FAVORITE_ACTIVE_COLOR\\)/);
  assert.match(appSource, /entry\\.type !== "folder" && entry\\.hotkey !== "なし"[\\s\\S]*drawBitmapText\\(top, font, "H", menuX \\+ 147 \\+ itemOffset, y \\+ 8, "#78a9ff"\\)/);
  assert.doesNotMatch(overlaySource, /drawBitmapText\\(context, font, "H"/);
  assert.doesNotMatch(overlaySource, /MARKER_INACTIVE_COLOR/);
  assert.match(overlaySource, /eraseLegacyFavoriteMarker/);
});'''
new_marker = '''test("menu row status uses stacked 1px lines and no F/H glyph markers", () => {
  assert.match(appSource, /if \\(menu\\.isItemRetained\\?\\.\\(entry\\)\\) statusColors\\.push\\("#63e4a4"\\)/);
  assert.match(appSource, /if \\(menu\\.isFavorite\\(entry\\)\\) statusColors\\.push\\("#d6c98a"\\)/);
  assert.match(appSource, /entry\\.hotkey !== "なし"\\) statusColors\\.push\\("#78a9ff"\\)/);
  assert.match(appSource, /fillRect\\(menuX \\+ 6 - statusIndex \\+ itemOffset, y - 2, 1, 12\\)/);
  assert.doesNotMatch(appSource, /drawBitmapText\\(top, font, "F"/);
  assert.doesNotMatch(appSource, /drawBitmapText\\(top, font, "H"/);
  assert.doesNotMatch(overlaySource, /eraseLegacyFavoriteMarker|drawFavoriteMarkers/);
  assert.doesNotMatch(overlaySource, /VALUE_LOCK_MARKER_COLOR/);
});

test("description and footer hints follow the compact Japanese key layout", () => {
  assert.doesNotMatch(appSource, /R:ADD FAVORITE|R:REMOVE|START:FAVORITES/);
  assert.match(appSource, /"Yホットキー"/);
  assert.match(appSource, /"START設定"/);
  assert.match(appSource, /"R星"/);
  assert.match(appSource, /drawBitmapText\\(top, font, "B戻る", footerYX/);
  assert.match(appSource, /drawBitmapText\\(top, font, "L戻し", footerStartX/);
  assert.match(appSource, /footerStartX \\+ measureBitmapText\\(font, "START設定"\\) \\+ footerSpace/);
  assert.match(appSource, /drawBitmapText\\(top, font, line, x \\+ 8, y \\+ 42 \\+ index \\* 11, "#c4cec7"\\)/);
  assert.doesNotMatch(appSource, /entry\\.disabled \\? "#626b64"/);
  assert.doesNotMatch(overlaySource, /R:FAV|START:CLOSE|A:SELECT/);
});'''
text = replace_once(text, old_marker, new_marker, 'legacy marker test')
path.write_text(text, encoding='utf-8')

# Remove old hint names even from comments, so source searches reflect the UI contract.
overlay = Path('issue-overlay.js')
overlay_text = overlay.read_text(encoding='utf-8')
overlay_text = overlay_text.replace(
    '// remains here; SETTINGS intentionally has no START:CLOSE / A:SELECT hint.',
    '// remains here; SETTINGS intentionally has no description-panel key hint.'
)
overlay.write_text(overlay_text, encoding='utf-8')
