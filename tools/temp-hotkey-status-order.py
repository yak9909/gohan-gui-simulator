from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one match, found {count}')
    p.write_text(text.replace(old, new), encoding='utf-8')

replace_once(
    'app.js',
    '      if (menu.isFavorite(entry)) statusColors.push("#d6c98a");\n      if (entry.type !== "folder" && entry.hotkey !== "なし") statusColors.push("#78a9ff");\n      if (menu.isItemRetained?.(entry)) statusColors.push("#e5484d");',
    '      if (menu.isFavorite(entry)) statusColors.push("#d6c98a");\n      if (menu.isItemRetained?.(entry)) statusColors.push("#e5484d");\n      if (entry.type !== "folder" && entry.hotkey !== "なし") statusColors.push("#78a9ff");'
)

replace_once(
    'docs/menu-state-indicators.md',
    '1. お気に入り: yellow `#d6c98a`\n2. ホットキー: blue `#78a9ff`\n3. `この項目を保持`: red `#e5484d`\n\nFor example, お気に入り + ホットキー uses yellow/blue at 1:1, and お気に入り + ホットキー + `この項目を保持` uses yellow/blue/red at 1:1:1.',
    '1. お気に入り: yellow `#d6c98a`\n2. `この項目を保持`: red `#e5484d`\n3. ホットキー: blue `#78a9ff`\n\nFor example, お気に入り + ホットキー uses yellow/blue at 1:1, and お気に入り + `この項目を保持` + ホットキー uses yellow/red/blue at 1:1:1. ホットキーは複数状態の中で常に一番下へ配置する。'
)

replace_once(
    'test/menu-status-layout.test.js',
    '  assert.match(appSource, /menu\\.isFavorite\\(entry\\).*statusColors\\.push\\("#d6c98a"\\)/s);\n  assert.match(appSource, /entry\\.type !== "folder" && entry\\.hotkey !== "なし".*statusColors\\.push\\("#78a9ff"\\)/s);\n  assert.match(appSource, /menu\\.isItemRetained\\?\\.\\(entry\\).*statusColors\\.push\\("#e5484d"\\)/s);',
    '  assert.match(appSource, /menu\\.isFavorite\\(entry\\).*statusColors\\.push\\("#d6c98a"\\)/s);\n  assert.match(appSource, /menu\\.isItemRetained\\?\\.\\(entry\\).*statusColors\\.push\\("#e5484d"\\)/s);\n  assert.match(appSource, /entry\\.type !== "folder" && entry\\.hotkey !== "なし".*statusColors\\.push\\("#78a9ff"\\)/s);\n  assert.match(appSource, /statusColors\\.push\\("#d6c98a"\\);[\\s\\S]*statusColors\\.push\\("#e5484d"\\);[\\s\\S]*statusColors\\.push\\("#78a9ff"\\);/);'
)
