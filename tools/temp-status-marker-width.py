from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "app.js",
    '''      // Row states share the historical VALUE LOCK marker position. Multiple active
      // states split the same 1px x 12px line vertically instead of spreading left.
      // CTRPF移植時も statusColors の順番を上→下の表示順として扱い、12pxを等分する。''',
    '''      // Keep the historical VALUE LOCK marker x position as the right edge, then
      // extend the status marker one pixel left for a total width of 2px.
      // CTRPF移植時も statusColors の順番を上→下の表示順として扱い、12pxを等分する。'''
)
replace_once(
    "app.js",
    "top.fillRect(menuX + 4 + itemOffset, y - 2 + segmentTop, 1, segmentBottom - segmentTop);",
    "top.fillRect(menuX + 3 + itemOffset, y - 2 + segmentTop, 2, segmentBottom - segmentTop);"
)

replace_once(
    "test/menu-status-layout.test.js",
    'test("row states share the historical value-lock x position and split vertically", () => {',
    'test("row states keep the historical value-lock right edge, extend left to 2px, and split vertically", () => {'
)
replace_once(
    "test/menu-status-layout.test.js",
    'assert.match(appSource, /fillRect\\(menuX \\+ 4 \\+ itemOffset, y - 2 \\+ segmentTop, 1, segmentBottom - segmentTop\\)/);',
    'assert.match(appSource, /fillRect\\(menuX \\+ 3 \\+ itemOffset, y - 2 \\+ segmentTop, 2, segmentBottom - segmentTop\\)/);'
)
replace_once(
    "test/menu-status-layout.test.js",
    'assert.match(appSource, /fillRect\\(menuX \\+ 4 \\+ itemOffset, y - 2 \\+ segmentTop, 1, segmentBottom - segmentTop\\)/);',
    'assert.match(appSource, /fillRect\\(menuX \\+ 3 \\+ itemOffset, y - 2 \\+ segmentTop, 2, segmentBottom - segmentTop\\)/);'
)

replace_once(
    "test/issues.test.js",
    'test("menu row status uses one vertically split 1px line at the historical value-lock position", () => {',
    'test("menu row status uses one vertically split 2px line extending left from the historical value-lock position", () => {'
)
replace_once(
    "test/issues.test.js",
    'assert.match(appSource, /fillRect\\(menuX \\+ 4 \\+ itemOffset, y - 2 \\+ segmentTop, 1, segmentBottom - segmentTop\\)/);',
    'assert.match(appSource, /fillRect\\(menuX \\+ 3 \\+ itemOffset, y - 2 \\+ segmentTop, 2, segmentBottom - segmentTop\\)/);'
)

replace_once(
    "docs/menu-state-indicators.md",
    "State markers use one 1px-wide, 12px-tall vertical line at `menuX + 4`, matching the historical `値を固定` side-marker position. When multiple states are active, that single line is split vertically into equal-height segments instead of adding more lines to the left.",
    "State markers use one 2px-wide, 12px-tall vertical line spanning `menuX + 3` through `menuX + 4`. The historical `値を固定` side-marker position at `menuX + 4` remains the right edge, so the added width extends only to the left. When multiple states are active, that single line is split vertically into equal-height segments."
)
