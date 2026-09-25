from pathlib import Path

path = Path('test/issues.test.js')
text = path.read_text(encoding='utf-8')
old = '''test("retention settings toggle independently inside SETTINGS", () => {
  const menu = new CheatMenuModel();
  menu.open(0);
  menu.handle("start", 100, true, false);'''
new = '''test("retention settings toggle independently inside SETTINGS", () => {
  const menu = new CheatMenuModel();
  menu.open(0);
  menu.currentFrame().selection = 1;
  menu.handle("start", 100, true, false);'''
if old not in text:
    raise SystemExit('retention settings test preamble not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
