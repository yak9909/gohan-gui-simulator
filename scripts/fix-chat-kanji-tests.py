from pathlib import Path

path = Path('test/chat-kanji-preview.test.js')
text = path.read_text(encoding='utf-8')

text = text.replace('preview.CLEAR_BUTTON', 'preview.SELECT_ALL_BUTTON')
text = text.replace(
    'test("clear and cursor controls follow measured source-image geometry without replacing the input field"',
    'test("select-all and cursor controls follow measured source-image geometry without replacing the input field"'
)
text = text.replace('"clear key begins on the same vertical separator as 消去"', '"select-all key begins on the same vertical separator as 消去"')
text = text.replace('"clear key uses the full 消去 column width"', '"select-all key uses the full 消去 column width"')

old = '''  assert.match(source, /CLEAR_BUTTON\\.x, CLEAR_BUTTON\\.y, 1, CLEAR_BUTTON\\.height/);
  assert.match(source, /CHAT_LAYOUT\\.candidateY \\+ CHAT_LAYOUT\\.candidateHeight - 1/);
  assert.match(source, /const clearLabel = "クリア"/);
  assert.match(source, /drawBcfntText\\([\\s\\S]*clearLabel/);
  assert.match(source, /drawGohanControlButton\\(context, CURSOR_BUTTONS\\.left, "←"/);
  assert.match(source, /drawGohanControlButton\\(context, CURSOR_BUTTONS\\.right, "→"/);
  assert.match(source, /pointInside\\(point, CLEAR_BUTTON\\)/);'''
new = '''  assert.match(source, /SELECT_ALL_BUTTON/);
  assert.match(source, /CHAT_LAYOUT\\.candidateY \\+ CHAT_LAYOUT\\.candidateHeight - 1/);
  assert.match(source, /drawAcNlControlKey\\([\\s\\S]*SELECT_ALL_BUTTON,[\\s\\S]*"全選択"/);
  assert.match(source, /drawAcNlControlKey\\(context, CURSOR_BUTTONS\\.left, "←"/);
  assert.match(source, /drawAcNlControlKey\\(context, CURSOR_BUTTONS\\.right, "→"/);
  assert.match(source, /pointInside\\(point, SELECT_ALL_BUTTON\\)/);'''
if old not in text:
    raise SystemExit('legacy chat control source assertions not found')
text = text.replace(old, new, 1)

anchor = '''  assert.equal(preview.EXTRA_GLYPHS["→"].rows[11], "afffffffffffffa00");
});'''
replacement = '''  assert.equal(preview.EXTRA_GLYPHS["→"].rows[11], "afffffffffffffa00");
  for (const character of "全選択") {
    const glyph = preview.DRAW_DATA.glyphs[character];
    assert.ok(glyph, `missing Garden key glyph: ${character}`);
    assert.equal(glyph.rows.length, 24);
  }
});'''
if anchor not in text:
    raise SystemExit('Garden glyph test anchor not found')
text = text.replace(anchor, replacement, 1)

path.write_text(text, encoding='utf-8')
