# Menu state indicators

This file records the current Gohan Menu state-indicator and footer contracts so later CTRPF work does not regress to the old F/H glyph layout.

## Row state indicators

State markers are 1px vertical lines at the left edge of each menu row. Active markers are appended in this order and each additional marker stacks one pixel farther left:

1. `この項目を保持`: menu accent `#63e4a4`
2. お気に入り: yellow `#d6c98a`
3. ホットキー: blue `#78a9ff`

Inactive states draw nothing. `値を固定` does not add a vertical line; a fixed value is indicated by its cyan value text only. The marker geometry is rendered inside the same menu-item clip as labels and values, including the partially visible eleventh row.

## Persistence settings

SETTINGS contains, in order:

1. FAVORITES
2. 値を固定
3. この項目を保持
4. 値の固定を保持
5. お気に入りを保持
6. オンにした項目を保持
7. オンにしたお気に入りを保持

`この項目を保持` persists only the selected stateful item's applied state. `値の固定を保持` separately persists linked-item fixed state. General applied-state persistence includes checkbox/list/listbox/value/slider/linked values, but does not implicitly retain value-lock state.

## Description and footer

The item description panel does not show `R:FAV`, `START:CLOSE`, or `A:SELECT`. Disabled-item description text remains readable instead of being gray-disabled.

The menu footer uses independently positioned tokens so the dirty-count width cannot shift controls:

- first row: `A決定`, `X適用`, `Yホットキー`, `START設定`
- second row: `<n>変更`, `B戻る`, `L戻し`, `R星`

`B戻る` aligns with `Yホットキー`. `L戻し` aligns with `START設定`. `R星` begins one space after the end of `START設定`.

## ACNL kanji preview keys

The conversion-row utility key is `全選択`. `全選択`, `←`, and `→` use the same brown ACNL keyboard-key visual treatment and Garden_msg_size16.bcfnt glyph rendering. The existing ACNL input field remains untouched.
