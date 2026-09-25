from pathlib import Path

path = Path('issue-fixes.js')
text = path.read_text(encoding='utf-8')
text = text.replace(
    '// did not include the three kanji now used by the settings labels.',
    '// did not include these kanji now used by settings/footer labels.',
    1,
)
old = '      27671: { character: "気", codepoint: 27671, width: 7, height: 7, offsetX: 0, offsetY: 0, advance: 8, rows: [2, 126, 29, 62, 42, 36, 75], source: "BDF-8px" }\n'
new = '      27671: { character: "気", codepoint: 27671, width: 7, height: 7, offsetX: 0, offsetY: 0, advance: 8, rows: [2, 126, 29, 62, 42, 36, 75], source: "BDF-8px" },\n      26143: { character: "星", codepoint: 26143, width: 7, height: 7, offsetX: 0, offsetY: 0, advance: 8, rows: [62, 34, 63, 40, 94, 8, 127], source: "BDF-8px" }\n'
if old not in text:
    raise SystemExit('supplemental glyph tail not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
