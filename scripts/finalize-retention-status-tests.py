from pathlib import Path

path = Path('test/issues.test.js')
text = path.read_text(encoding='utf-8')
old = '''test("menu row status markers use the historical lower H baseline without duplicate H", () => {
  assert.match(overlaySource, /drawBitmapText\\(context, font, "F", menuX \\+ 140 \\+ itemOffset, y \\+ 8, FAVORITE_ACTIVE_COLOR\\)/);
  assert.match(appSource, /entry\\.type !== "folder" && entry\\.hotkey !== "なし"[\\s\\S]*drawBitmapText\\(top, font, "H", menuX \\+ 147 \\+ itemOffset, y \\+ 8, "#78a9ff"\\)/);
  assert.doesNotMatch(overlaySource, /drawBitmapText\\(context, font, "H"/);
  assert.doesNotMatch(overlaySource, /MARKER_INACTIVE_COLOR/);
  assert.match(overlaySource, /eraseLegacyFavoriteMarker/);
});'''
new = '''test("menu row status uses stacked 1px lines and no F/H glyph markers", () => {
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
if old not in text:
    raise SystemExit('exact legacy marker test block not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
