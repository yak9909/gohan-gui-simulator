from pathlib import Path

path = Path('test/app.test.js')
text = path.read_text(encoding='utf-8')
old = '''  assert.match(appSource, /menu\\.isFavorite\\(entry\\).*"F"/s);
  assert.match(appSource, /START:FAVORITES/);
  assert.match(html, /<b>R<\\/b> お気に入り切替/);
  assert.match(html, /<b>START<\\/b> 設定/);'''
new = '''  assert.match(appSource, /menu\\.isFavorite\\(entry\\)\\) statusColors\\.push\\("#d6c98a"\\)/);
  assert.doesNotMatch(appSource, /START:FAVORITES/);
  assert.doesNotMatch(appSource, /drawBitmapText\\(top, font, "F"/);
  assert.match(appSource, /"R星"/);
  assert.match(appSource, /"START設定"/);
  assert.doesNotMatch(html, /お気に入り切替/);
  assert.match(html, /<b>R<\\/b> 星/);
  assert.match(html, /<b>START<\\/b> 設定/);'''
if old not in text:
    raise SystemExit('legacy favorites visual assertions not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
