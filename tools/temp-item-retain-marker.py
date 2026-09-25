from pathlib import Path


def replace_all(path, old, new, expected=None):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    count = text.count(old)
    if expected is not None and count != expected:
        raise SystemExit(f"{path}: expected {expected} matches, found {count}")
    if count == 0:
        raise SystemExit(f"{path}: no matches for {old!r}")
    p.write_text(text.replace(old, new), encoding="utf-8")


replace_all(
    "app.js",
    '''      // Keep the historical VALUE LOCK marker x position as the right edge, then
      // extend the status marker one pixel left for a total width of 2px.
      // CTRPF移植時も statusColors の順番を上→下の表示順として扱い、12pxを等分する。''',
    '''      // Row states share the historical VALUE LOCK marker position as a 1px line.
      // CTRPF移植時も statusColors の順番を上→下の表示順として扱い、12pxを等分する。''',
    expected=1
)
replace_all(
    "app.js",
    'if (menu.isItemRetained?.(entry)) statusColors.push("#63e4a4");',
    'if (menu.isItemRetained?.(entry)) statusColors.push("#e5484d");',
    expected=1
)
replace_all(
    "app.js",
    'top.fillRect(menuX + 3 + itemOffset, y - 2 + segmentTop, 2, segmentBottom - segmentTop);',
    'top.fillRect(menuX + 4 + itemOffset, y - 2 + segmentTop, 1, segmentBottom - segmentTop);',
    expected=1
)

replace_all(
    "test/menu-status-layout.test.js",
    'test("row states keep the historical value-lock right edge, extend left to 2px, and split vertically", () => {',
    'test("row states use the historical 1px value-lock position and split vertically", () => {',
    expected=1
)
replace_all(
    "test/menu-status-layout.test.js",
    'statusColors\\.push\\("#63e4a4"\\)',
    'statusColors\\.push\\("#e5484d"\\)',
    expected=1
)
replace_all(
    "test/menu-status-layout.test.js",
    'fillRect\\(menuX \\+ 3 \\+ itemOffset, y - 2 \\+ segmentTop, 2, segmentBottom - segmentTop\\)',
    'fillRect\\(menuX \\+ 4 \\+ itemOffset, y - 2 \\+ segmentTop, 1, segmentBottom - segmentTop\\)',
    expected=2
)

replace_all(
    "test/issues.test.js",
    'test("menu row status uses one vertically split 2px line extending left from the historical value-lock position", () => {',
    'test("menu row status uses one vertically split 1px line at the historical value-lock position", () => {',
    expected=1
)
replace_all(
    "test/issues.test.js",
    'statusColors\\.push\\("#63e4a4"\\)',
    'statusColors\\.push\\("#e5484d"\\)',
    expected=1
)
replace_all(
    "test/issues.test.js",
    'fillRect\\(menuX \\+ 3 \\+ itemOffset, y - 2 \\+ segmentTop, 2, segmentBottom - segmentTop\\)',
    'fillRect\\(menuX \\+ 4 \\+ itemOffset, y - 2 \\+ segmentTop, 1, segmentBottom - segmentTop\\)',
    expected=1
)

replace_all(
    "docs/menu-state-indicators.md",
    'State markers use one 2px-wide, 12px-tall vertical line spanning `menuX + 3` through `menuX + 4`. The historical `値を固定` side-marker position at `menuX + 4` remains the right edge, so the added width extends only to the left. When multiple states are active, that single line is split vertically into equal-height segments.',
    'State markers use one 1px-wide, 12px-tall vertical line at `menuX + 4`, matching the historical `値を固定` side-marker position. When multiple states are active, that single line is split vertically into equal-height segments.',
    expected=1
)
replace_all(
    "docs/menu-state-indicators.md",
    '3. `この項目を保持`: menu accent `#63e4a4`',
    '3. `この項目を保持`: red `#e5484d`',
    expected=1
)
