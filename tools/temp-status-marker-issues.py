from pathlib import Path

path = Path("test/issues.test.js")
text = path.read_text(encoding="utf-8")
old = '''test("menu row status uses stacked 1px lines and no F/H glyph markers", () => {
  assert.match(appSource, /if \\(menu\\.isItemRetained\\?\\.\\(entry\\)\\) statusColors\\.push\\("#63e4a4"\\)/);
  assert.match(appSource, /if \\(menu\\.isFavorite\\(entry\\)\\) statusColors\\.push\\("#d6c98a"\\)/);
  assert.match(appSource, /entry\\.hotkey !== "なし"\\) statusColors\\.push\\("#78a9ff"\\)/);
  assert.match(appSource, /fillRect\\(menuX \\+ 6 - statusIndex \\+ itemOffset, y - 2, 1, 12\\)/);
  assert.doesNotMatch(appSource, /drawBitmapText\\(top, font, "F"/);
  assert.doesNotMatch(appSource, /drawBitmapText\\(top, font, "H"/);
  assert.doesNotMatch(overlaySource, /eraseLegacyFavoriteMarker|drawFavoriteMarkers/);
  assert.doesNotMatch(overlaySource, /VALUE_LOCK_MARKER_COLOR/);
});'''
new = '''test("menu row status uses one vertically split 1px line at the historical value-lock position", () => {
  assert.match(appSource, /if \\(menu\\.isFavorite\\(entry\\)\\) statusColors\\.push\\("#d6c98a"\\)/);
  assert.match(appSource, /entry\\.hotkey !== "なし"\\) statusColors\\.push\\("#78a9ff"\\)/);
  assert.match(appSource, /if \\(menu\\.isItemRetained\\?\\.\\(entry\\)\\) statusColors\\.push\\("#63e4a4"\\)/);
  assert.match(appSource, /const statusHeight = 12/);
  assert.match(appSource, /segmentTop = Math\\.floor\\(statusHeight \\* statusIndex \\/ statusColors\\.length\\)/);
  assert.match(appSource, /segmentBottom = Math\\.floor\\(statusHeight \\* \\(statusIndex \\+ 1\\) \\/ statusColors\\.length\\)/);
  assert.match(appSource, /fillRect\\(menuX \\+ 4 \\+ itemOffset, y - 2 \\+ segmentTop, 1, segmentBottom - segmentTop\\)/);
  assert.doesNotMatch(appSource, /menuX \\+ 6 - statusIndex/);
  assert.doesNotMatch(appSource, /drawBitmapText\\(top, font, "F"/);
  assert.doesNotMatch(appSource, /drawBitmapText\\(top, font, "H"/);
  assert.doesNotMatch(overlaySource, /eraseLegacyFavoriteMarker|drawFavoriteMarkers/);
  assert.doesNotMatch(overlaySource, /VALUE_LOCK_MARKER_COLOR/);
});'''
if text.count(old) != 1:
    raise SystemExit(f"expected one issue-test block, found {text.count(old)}")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
