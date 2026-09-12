"""Extract the preview glyph subset directly from Misaki Gothic 2nd BDF.

The BDF is the authoritative 8 px bitmap source. No outline rasterization,
resizing, antialiasing, or fallback font is used.
"""

from __future__ import annotations

import json
from pathlib import Path


PIXEL_SIZE = 8
GLYPH_TEXT = (
    " "
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    "0123456789"
    "[]<>:+-.,;'@\\/%#_!?="
    "あいうえおかきくけこさしすせそたちつてとなにぬねの"
    "はひふへほまみむめもやゆよらりるれろわをん"
    "ぁぃぅぇぉっゃゅょゎがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ"
    "アイウエオカキクケコサシスセソタチツテトナニヌネノ"
    "ハヒフヘホマミムメモヤユヨラリルレロワヲン"
    "ァィゥェォッャュョヮガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポヴー"
    "プレイヤー関連のチートを開きます。"
    "無敵モードダメージを受けなくなります。壁抜け当たり判定を無効にします。"
    "名前を変更下画面に五十音順キーボードを開きます。"
    "歩行速度アップ移動速度の変更を有効にします。"
    "セーブ実行UIを変更せずセーブ関数だけを呼び出します。"
    "しずえスキップしずえの会話を飛ばして村へ出ます。起動時の一括処理を先に実行します。"
    "天候項目の位置にリストを展開して選択します。晴れ雨雪"
    "数値設定入力とスライダーのサンプルです。"
    "所持ベル進数で左右ずつ変更します。アイテムID値通知時間横向き"
    "自前関数表示上画面下画面汎用リストボックス文字切り替えられます。"
    "件の変更を一括適用しました呼び出しましたオプション選択全離待中"
    "決定適用戻る説明取消符号消空白五十音キーボード最小最大改行けってい"
    "小型文字キーボード濁点半濁点小字消去あいう記号ケータイとじる！？"
    "スクロールテスト大量リスト追加チート多数確認用ュ"
    "通知を追加上画面右下へ自前通知を表示します。40ms間隔で3件追加します。"
    "。、・↑↓←→"
    "チャット漢字候補チャットの入力から漢字候補を取得し下画面に表示します。"
    "変換中です。Bで閉じる変換処理中です。チャットに文字を入力してください。"
    "普通のチャットを開いてください。入力文字を確認してください。"
    "フォントを取得できません。変換を開始できません。対応していないゲームの版です。"
    "変換に失敗しました。メモリ不足です。候補がありません。上限"
)

ROOT = Path(__file__).resolve().parents[1]
BDF_PATH = ROOT / "font-source" / "misaki_gothic_2nd.bdf"
JSON_OUTPUT = ROOT / "font" / "misaki-gothic-2nd-8.json"
JS_OUTPUT = ROOT / "font" / "misaki-gothic-2nd-8.js"
CPP_OUTPUT = ROOT.parent / "CTRPluginFramework-BlankTemplate-0.8.0" / "Sources" / "MisakiGothic2nd8.cpp"
GUI_TEST_CPP_OUTPUT = ROOT.parent / "CTRPF-GUI-Test" / "Sources" / "MisakiGothic2nd8.cpp"


def bdf_row_to_lsb_bits(hex_row: str, width: int) -> int:
    """Convert BDF's left-aligned MSB-first row to x=0 at bit 0."""
    if not hex_row or width == 0:
        return 0
    source = int(hex_row, 16)
    source_width = len(hex_row) * 4
    result = 0
    for x in range(width):
        if source & (1 << (source_width - 1 - x)):
            result |= 1 << x
    return result


def parse_bdf(path: Path) -> tuple[dict, dict[int, dict]]:
    ascent = None
    descent = None
    family = None
    glyphs: dict[int, dict] = {}
    current = None
    in_bitmap = False

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if line.startswith("FONT_ASCENT "):
            ascent = int(line.split()[1])
        elif line.startswith("FONT_DESCENT "):
            descent = int(line.split()[1])
        elif line.startswith("FAMILY_NAME "):
            family = line.split(" ", 1)[1].strip('"')
        elif line.startswith("STARTCHAR "):
            current = {
                "name": line.split(" ", 1)[1],
                "encoding": None,
                "advance": None,
                "bbx": None,
                "bitmap": [],
            }
            in_bitmap = False
        elif current is not None and line == "ENDCHAR":
            encoding = current["encoding"]
            width, height, offset_x, offset_y_from_baseline = current["bbx"]
            if encoding is not None:
                glyphs[encoding] = {
                    "character": chr(encoding),
                    "codepoint": encoding,
                    "width": width,
                    "height": height,
                    "offsetX": offset_x,
                    "offsetY": ascent - (offset_y_from_baseline + height),
                    "advance": current["advance"],
                    "rows": [bdf_row_to_lsb_bits(row, width) for row in current["bitmap"]],
                    "source": "BDF-8px",
                }
            current = None
            in_bitmap = False
        elif current is not None and line == "BITMAP":
            in_bitmap = True
        elif current is not None and in_bitmap:
            current["bitmap"].append(line)
        elif current is not None and line.startswith("ENCODING "):
            current["encoding"] = int(line.split()[1])
        elif current is not None and line.startswith("DWIDTH "):
            current["advance"] = int(line.split()[1])
        elif current is not None and line.startswith("BBX "):
            current["bbx"] = tuple(map(int, line.split()[1:5]))

    if ascent is None or descent is None or family is None:
        raise ValueError("BDF font metrics are incomplete")
    return {"family": family, "ascent": ascent, "descent": descent}, glyphs


def build_payload(metrics: dict, all_glyphs: dict[int, dict]) -> tuple[dict, list[dict]]:
    characters = list(dict.fromkeys(GLYPH_TEXT))
    missing = [character for character in characters if ord(character) not in all_glyphs]
    if missing:
        formatted = " ".join(f"U+{ord(character):04X}" for character in missing)
        raise ValueError(f"Misaki Gothic 2nd BDF is missing required glyphs: {formatted}")

    glyphs = [all_glyphs[ord(character)] for character in characters]
    payload = {
        "family": "Misaki Gothic 2nd",
        "bdfFamily": metrics["family"],
        "source": "font-source/misaki_gothic_2nd.bdf",
        "pixelSize": PIXEL_SIZE,
        "ascent": metrics["ascent"],
        "descent": metrics["descent"],
        "lineHeight": metrics["ascent"] + metrics["descent"],
        "bitmapFormat": "BDF 2.1 / ISO10646-1",
        "glyphCount": len(glyphs),
        "glyphs": {str(glyph["codepoint"]): glyph for glyph in glyphs},
    }
    return payload, glyphs


def write_web_assets(payload: dict) -> None:
    serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    JSON_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    JSON_OUTPUT.write_text(serialized, encoding="utf-8")
    JS_OUTPUT.write_text(f"window.MISAKI_GOTHIC_2ND_8={serialized};\n", encoding="utf-8")


def cpp_character_comment(character: str) -> str:
    if character == " ":
        return "SPACE"
    if character.isascii() and (character.isalnum() or character in "_-+"):
        return character
    return f"U+{ord(character):04X}"


def write_cpp(payload: dict, glyphs: list[dict]) -> None:
    maximum_rows = max(glyph["height"] for glyph in glyphs)
    lines = [
        "// Generated by CTRPF-GUI-Simulator/tools/extract_misaki_gothic_2nd_8.py.",
        "// Source: Misaki Gothic 2nd 2021-05-05 BDF; direct 8 px bitmap data.",
        '#include "MisakiGothic2nd8.hpp"',
        "",
        "#include <CTRPluginFramework.hpp>",
        "",
        "namespace CTRPluginFramework",
        "{",
        "    namespace MisakiGothic2nd8",
        "    {",
        "        namespace",
        "        {",
        "            struct Glyph",
        "            {",
        "                u32 codepoint;",
        "                u8  width;",
        "                u8  height;",
        "                s8  offsetX;",
        "                s8  offsetY;",
        "                u8  advance;",
        f"                u16 rows[{maximum_rows}];",
        "            };",
        "",
        "            static const Glyph kGlyphs[] =",
        "            {",
    ]

    for glyph in glyphs:
        rows = glyph["rows"] + [0] * (maximum_rows - len(glyph["rows"]))
        rows_text = ", ".join(f"0x{row:04X}" for row in rows)
        lines.append(
            "                {"
            f"0x{glyph['codepoint']:04X}, {glyph['width']}, {glyph['height']}, "
            f"{glyph['offsetX']}, {glyph['offsetY']}, {glyph['advance']}, "
            f"{{{rows_text}}}}}, // {cpp_character_comment(glyph['character'])}"
        )

    lines.extend(
        [
            "            };",
            "",
            "            static const Glyph *FindGlyph(u32 codepoint)",
            "            {",
            "                const u32 count = sizeof(kGlyphs) / sizeof(kGlyphs[0]);",
            "                for (u32 index = 0; index < count; ++index)",
            "                    if (kGlyphs[index].codepoint == codepoint)",
            "                        return &kGlyphs[index];",
            "                return nullptr;",
            "            }",
            "",
            "            static u32 DecodeUtf8(const std::string &text, u32 &index)",
            "            {",
            "                const u8 first = static_cast<u8>(text[index++]);",
            "                if (first < 0x80)",
            "                    return first;",
            "",
            "                u32 codepoint;",
            "                u32 remaining;",
            "                if ((first & 0xE0) == 0xC0)",
            "                {",
            "                    codepoint = first & 0x1F;",
            "                    remaining = 1;",
            "                }",
            "                else if ((first & 0xF0) == 0xE0)",
            "                {",
            "                    codepoint = first & 0x0F;",
            "                    remaining = 2;",
            "                }",
            "                else",
            "                {",
            "                    codepoint = first & 0x07;",
            "                    remaining = 3;",
            "                }",
            "",
            "                while (remaining-- && index < text.size())",
            "                    codepoint = (codepoint << 6) | (static_cast<u8>(text[index++]) & 0x3F);",
            "                return codepoint;",
            "            }",
            "        }",
            "",
            f"        int LineHeight(void) {{ return {payload['lineHeight']}; }}",
            "",
            "        int Measure(const std::string &text)",
            "        {",
            "            int width = 0;",
            "            u32 index = 0;",
            "            while (index < text.size())",
            "            {",
            "                const Glyph *glyph = FindGlyph(DecodeUtf8(text, index));",
            "                width += glyph ? glyph->advance : 4;",
            "            }",
            "            return width;",
            "        }",
            "",
            "        // ★GPU 経路用の公開窓（TODO-134 段 D）。中の kGlyphs は無名名前空間にあるので、",
            "        //   ここを通してしか触れない。",
            "        bool GetGlyph(u32 codepoint, GlyphInfo &out)",
            "        {",
            "            const Glyph *g = FindGlyph(codepoint);",
            "",
            "            if (g == nullptr)",
            "                return false;",
            "            out.width   = g->width;",
            "            out.height  = g->height;",
            "            out.offsetX = g->offsetX;",
            "            out.offsetY = g->offsetY;",
            "            out.advance = g->advance;",
            "            out.rows    = g->rows;",
            "            return true;",
            "        }",
            "",
            "        u32 NextCodepoint(const std::string &text, u32 &index)",
            "        {",
            "            return DecodeUtf8(text, index);",
            "        }",
            "",
            "        void Draw(const Screen &screen, const std::string &text, int x, int y, const Color &color)",
            "        {",
            "            int cursor = x;",
            "            u32 index = 0;",
            "            while (index < text.size())",
            "            {",
            "                const Glyph *glyph = FindGlyph(DecodeUtf8(text, index));",
            "                if (glyph == nullptr)",
            "                {",
            "                    cursor += 4;",
            "                    continue;",
            "                }",
            "",
            "                for (u32 row = 0; row < glyph->height; ++row)",
            "                {",
            "                    const u16 bits = glyph->rows[row];",
            "                    for (u32 column = 0; column < glyph->width; ++column)",
            "                        if (bits & (1U << column))",
            "                        {",
            "                            const int pixelX = cursor + glyph->offsetX + column;",
            "                            const int pixelY = y + glyph->offsetY + row;",
            "                            const int screenWidth = screen.IsTop ? 400 : 320;",
            "                            if (pixelX >= 0 && pixelX < screenWidth && pixelY >= 0 && pixelY < 240)",
            "                                screen.DrawPixel(pixelX, pixelY, color);",
            "                        }",
            "                }",
            "                cursor += glyph->advance;",
            "            }",
            "        }",
            "    }",
            "}",
            "",
        ]
    )
    generated = "\n".join(lines)
    CPP_OUTPUT.write_text(generated, encoding="utf-8")
    GUI_TEST_CPP_OUTPUT.write_text(generated, encoding="utf-8")


def main() -> None:
    if not BDF_PATH.exists():
        raise SystemExit(f"Misaki Gothic 2nd BDF was not found: {BDF_PATH}")
    metrics, all_glyphs = parse_bdf(BDF_PATH)
    payload, glyphs = build_payload(metrics, all_glyphs)
    write_web_assets(payload)
    write_cpp(payload, glyphs)
    print(f"BDF glyphs available: {len(all_glyphs)}")
    print(f"Extracted {len(glyphs)} direct bitmap glyphs at {PIXEL_SIZE}px")
    print(f"JSON: {JSON_OUTPUT}")
    print(f"JS:   {JS_OUTPUT}")
    print(f"C++:  {CPP_OUTPUT}")
    print(f"C++:  {GUI_TEST_CPP_OUTPUT}")


if __name__ == "__main__":
    main()
