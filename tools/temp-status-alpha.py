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
    """      const statusHeight = 12;\n      statusColors.forEach((statusColor, statusIndex) => {\n""",
    """      const statusHeight = 12;\n      // CTRPF移植時も各状態色へ同じ透過率を掛け、色分割の比率だけを変える。\n      const statusAlpha = 0.6;\n      top.save();\n      top.globalAlpha = statusAlpha;\n      statusColors.forEach((statusColor, statusIndex) => {\n""",
)
replace_once(
    "app.js",
    """      });\n\n      drawItemIcon(entry, menuX + 8 + itemOffset, y, color);\n""",
    """      });\n      top.restore();\n\n      drawItemIcon(entry, menuX + 8 + itemOffset, y, color);\n""",
)

for path in ["test/menu-status-layout.test.js", "test/issues.test.js"]:
    replace_once(
        path,
        """  assert.match(appSource, /const statusHeight = 12/);\n""",
        """  assert.match(appSource, /const statusHeight = 12/);\n  assert.match(appSource, /const statusAlpha = 0\\.6/);\n  assert.match(appSource, /top\\.save\\(\\);\\s*top\\.globalAlpha = statusAlpha/s);\n  assert.match(appSource, /top\\.restore\\(\\)/);\n""",
    )

replace_once(
    "docs/menu-state-indicators.md",
    """State markers use one 1px-wide, 12px-tall vertical line at `menuX + 4`, matching the historical `値を固定` side-marker position. When multiple states are active, that single line is split vertically into equal-height segments.\n""",
    """State markers use one 1px-wide, 12px-tall vertical line at `menuX + 4`, matching the historical `値を固定` side-marker position. The entire marker is drawn at 60% opacity. When multiple states are active, that single line is split vertically into equal-height segments.\n""",
)
