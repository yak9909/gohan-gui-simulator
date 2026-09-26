# Menu state indicators

This file records the current Gohan Menu state-indicator, SETTINGS, and footer contracts so later CTRPF work does not regress.

## Row state indicators

State markers use one 1px-wide, 12px-tall vertical line at `menuX + 4`, matching the historical `値を固定` side-marker position. The entire marker is drawn at 60% opacity. When multiple states are active, that single line is split vertically into equal-height segments.

Segments are ordered from top to bottom as follows:

1. お気に入り: yellow `#d6c98a`
2. `この項目を保持`: red `#e5484d`
3. ホットキー: blue `#78a9ff`

For example, お気に入り + ホットキー uses yellow/blue at 1:1, and お気に入り + `この項目を保持` + ホットキー uses yellow/red/blue at 1:1:1. ホットキーは複数状態の中で常に一番下へ配置する。Inactive states draw nothing. `値を固定` does not add a vertical line; a fixed value is indicated by its cyan value text only.

## Menu title

The fixed menu title is `-* GOHAN *-`. The current frame title starts farther right so the two labels retain a small gap and never overlap.

SETTINGS `checkbox-list` entries apply each A-button toggle immediately: `value` and `appliedValue` are synchronized at the moment an option is checked/unchecked.

## SETTINGS order

SETTINGS is intentionally not folder-first. The root order is:

1. `この項目を保持`
2. `値を固定`
3. `お気に入り` (folder)
4. `項目の保持設定` (folder)
5. `お気に入りを保持`
6. `押し切るまでボタンの遮断`

`この項目を保持` uses the description `選択中の項目の状態を次回も保持します。`.

`お気に入り` is a folder-style entry, not an action-style SETTINGS command. Opening it uses the normal favorites frame so favorite items remain live references to the original menu entries.

`押し切るまでボタンの遮断` uses the new `checkbox-list` item type. Its options are `A`, `B`, `X`, `Y`, and `START`; only `START` is checked by default. A opens an inline list where every row has its own checkbox, A toggles the highlighted checkbox without closing the list, and B closes it. The menu row shows the selected-count summary such as `1/5`.

This option remains a CTRPF-port contract only: the simulator stores and previews the checkbox-list selection but does not alter simulated game input. In CTRPF, each checked button must be withheld from the game while physically held, then delivered as one game-side input when released. Holding a checked button must not produce game-side press/repeat reactions before release.

## 項目の保持設定

`項目の保持設定` contains two folders:

- `値の固定`
  - `保持された項目`: default ON. Retains value-lock state for items marked by `この項目を保持`.
  - `お気に入り`: default OFF. Retains value-lock state for favorite items.
  - `全項目`: default OFF. Retains value-lock state for every linked item. While ON, the two scope controls above are disabled.
- `トグル状態`
  - `保持された項目`: default ON. Retains toggle state for items marked by `この項目を保持`.
  - `お気に入り`: default ON. Retains toggle state for favorite items.
  - `全項目`: default OFF. Retains toggle state for every item. While ON, the two scope controls above are disabled.

The old root settings `値の固定を保持`, `オンにした項目を保持`, and `オンにしたお気に入りを保持` no longer exist. Toggle persistence is unified under `項目の保持設定/トグル状態`.

The per-item retention selector is stored independently from retained state. Non-checkbox applied values for specifically retained items continue to use the per-item retained-state snapshot; checkbox toggle state and linked-item value-lock state use their respective scoped settings above.

## Fixed linked-item editing

A fixed linked item still accepts explicit user edits. For `linked-value`, left/right adjustment and a confirmed numeric-keyboard value become the new fixed value. For `linked-list`, left/right changes the selected option directly; inline-list selection remains available with A. External/game-side linked-value drift is still overwritten by the current fixed value.

`list` and `linked-list` rows both support direct left/right option changes. The option index is clamped at the first and last entry rather than wrapping.

## Description and footer

The description panel does not paint a separate opaque black status strip. `値を固定:ON` may still be drawn as text, but it is rendered directly on the existing description panel background.

The item description panel does not show `R:FAV`, `START:CLOSE`, or `A:SELECT`. Disabled-item description text remains readable instead of being gray-disabled.

The menu footer uses independently positioned tokens so the dirty-count width cannot shift controls:

- first row: `A決定`, `X適用`, `Yホットキー`, `START設定`
- second row: `<n>変更`, `B戻る`, `L戻し`, `R星`

`B戻る` aligns with `Yホットキー`. `L戻し` aligns with `START設定`. `R星` begins one space after the end of `START設定`.

## ACNL kanji preview keys

The conversion-row utility key is `全選択`. `全選択`, `←`, and `→` use the same brown ACNL keyboard-key visual treatment and Garden_msg_size16.bcfnt glyph rendering. The existing ACNL input field remains untouched.
