const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {
  SCREEN,
  NOTICE,
  MENU,
  CONTROL_REPEAT,
  LISTBOX,
  TEXT_KEYBOARD,
  DIALOG,
  CLOSE_DIALOG_OPTIONS,
  DIALOG_DEFINITIONS,
  LONG_LIST_OPTIONS,
  ControlRepeater,
  easeOutCubic,
  NotificationTimeline,
  CheatMenuModel,
  HOTKEYS,
  HOTKEY_BUTTON_ORDER,
  formatHotkeyButtons,
  hotkeyButtons,
  hotkeyMatches,
  createMenuTree,
  walkItems,
  isDirty,
  formatValue,
  numericKeys,
  numericKeyEnabled,
  selectionPulse,
  selectionOutlinePulse,
  dialogAmount,
  listboxAmount,
  listboxScrollPosition,
  textKeyboardAmount,
  textKeys,
  textKeyLayout,
  textKeyEnabled,
  measureBitmapText,
  bitmapTextCursorAt,
  drawBitmapText,
  listboxVerticalPosition,
  textKeyboardGeometry,
  topOverlayHorizontalPosition,
  isNumericEntry,
  isNumericKeyLabel
} = require("../app.js");

const font = JSON.parse(fs.readFileSync(path.join(__dirname, "../font/misaki-gothic-2nd-8.json"), "utf8"));
const numericFont = JSON.parse(fs.readFileSync(path.join(__dirname, "../font/pixel-mplus-10-numeric-8.json"), "utf8"));
const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "../styles.css"), "utf8");
const appSource = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const modelSource = fs.readFileSync(path.join(__dirname, "../ui-model.js"), "utf8");
const serverSource = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
const fontScript = fs.readFileSync(path.join(__dirname, "../font/misaki-gothic-2nd-8.js"), "utf8");
const numericFontScript = fs.readFileSync(path.join(__dirname, "../font/pixel-mplus-10-numeric-8.js"), "utf8");

test("preview keeps the New 3DS native logical dimensions", () => {
  assert.deepEqual(SCREEN, { width: 400, height: 240, widthMm: 84.6, heightMm: 50.76 });
});

test("default and two-times modes use exact integer pixel scales", () => {
  assert.match(css, /#topScreen\s*\{[^}]*width:\s*400px;[^}]*height:\s*240px;/s);
  assert.match(css, /#bottomScreen\s*\{[^}]*width:\s*320px;[^}]*height:\s*240px;/s);
  assert.match(css, /double-size #topScreen\s*\{[^}]*width:\s*800px;[^}]*height:\s*480px;/s);
  assert.match(css, /double-size #bottomScreen\s*\{[^}]*width:\s*640px;[^}]*height:\s*480px;/s);
  assert.match(css, /\.preview-area\.double-size\s*\{[^}]*overflow:\s*visible;/s);
  assert.doesNotMatch(css, /\.preview-area\.double-size\s*\{[^}]*overflow:\s*auto;/s);
  assert.match(css, /width:\s*min\(800px,\s*calc\(100vw - 72px\)\)/);
  assert.match(css, /width:\s*min\(640px,\s*calc\(100vw - 72px\)\)/);
  assert.doesNotMatch(css, /#(?:top|bottom)Screen\s*\{[^}]*mm;/s);
  assert.match(css, /image-rendering:\s*pixelated/);
  const referencedIds = [...appSource.matchAll(/getElementById\("([^"]+)"\)/g)].map((match) => match[1]);
  for (const id of referencedIds) assert.match(html, new RegExp(`id=["']${id}["']`));
  assert.ok(html.indexOf('src="font/misaki-gothic-2nd-8.js?v=') < html.indexOf('src="font/pixel-mplus-10-numeric-8.js?v='));
  assert.ok(html.indexOf('src="font/pixel-mplus-10-numeric-8.js?v=') < html.indexOf('src="ui-model.js?v='));
  assert.ok(html.indexOf('src="ui-model.js?v=') < html.indexOf('src="app.js?v='));
});

test("classic browser scripts share no conflicting globals and register every main button", () => {
  const elements = new Map();
  const animationFrames = [];
  const fakeContext = {
    fillRect() {}, strokeRect() {}, beginPath() {}, moveTo() {}, arcTo() {}, closePath() {}, fill() {}, stroke() {},
    save() {}, restore() {}, rect() {}, clip() {}
  };
  function element(id) {
    if (!elements.has(id)) {
      const listeners = {};
      const classes = new Set();
      elements.set(id, {
        id,
        listeners,
        classes,
        textContent: "",
        dataset: {},
        classList: {
          add(name) { classes.add(name); },
          remove(name) { classes.delete(name); },
          toggle(name, force) { if (force === undefined ? !classes.has(name) : force) classes.add(name); else classes.delete(name); }
        },
        setAttribute() {}, setPointerCapture() {},
        addEventListener(type, listener) { (listeners[type] ||= []).push(listener); },
        getContext() { return fakeContext; },
        getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 240 }; }
      });
    }
    return elements.get(id);
  }
  const sandbox = {
    console,
    performance: { now: () => 0 },
    requestAnimationFrame: (callback) => { animationFrames.push(callback); return animationFrames.length; },
    setTimeout: () => 1,
    clearTimeout() {}
  };
  sandbox.window = sandbox;
  sandbox.addEventListener = () => {};
  sandbox.document = {
    readyState: "complete",
    getElementById: element,
    querySelector: () => element("previewArea"),
    querySelectorAll: () => [],
    addEventListener() {}
  };
  vm.createContext(sandbox);
  vm.runInContext(fontScript, sandbox, { filename: "misaki-gothic-2nd-8.js" });
  vm.runInContext(numericFontScript, sandbox, { filename: "pixel-mplus-10-numeric-8.js" });
  vm.runInContext(modelSource, sandbox, { filename: "ui-model.js" });
  vm.runInContext(appSource, sandbox, { filename: "app.js" });

  for (const id of ["scaleButton", "openMenuButton", "addButton", "burstButton", "clearButton"]) {
    assert.equal(element(id).listeners.click.length, 1, `${id} should have one click handler`);
  }
  assert.ok(sandbox.MISAKI_GOTHIC_2ND_8);
  assert.ok(sandbox.PIXEL_MPLUS_10_NUMERIC_8);
  assert.ok(sandbox.CTRPFUiModel);
  assert.ok(sandbox.CTRPFPreviewCore);
  assert.doesNotMatch(appSource, /fetch\s*\(/);

  element("scaleButton").listeners.click[0]();
  element("openMenuButton").listeners.click[0]();
  element("addButton").listeners.click[0]();
  animationFrames.shift()(320);
  assert.equal(element("previewArea").classes.has("double-size"), true);
  assert.equal(element("openMenuButton").textContent, "チートメニューを閉じる");
  assert.equal(element("activeCount").textContent, "1");
  assert.equal(fakeContext.imageSmoothingEnabled, false);
});

test("Misaki Gothic 2nd is read directly as an 8px 1-bit BDF glyph set", () => {
  assert.equal(font.family, "Misaki Gothic 2nd");
  assert.equal(font.bdfFamily, "MisakiGothic2nd");
  assert.equal(font.pixelSize, 8);
  assert.equal(font.lineHeight, 8);
  assert.equal(font.bitmapFormat, "BDF 2.1 / ISO10646-1");
  assert.equal(font.glyphCount, 370);
  assert.ok(Object.values(font.glyphs).every((glyph) => glyph.source === "BDF-8px"));
  const kana = font.glyphs[String("あ".codePointAt(0))];
  assert.equal(kana.width, 7);
  assert.equal(kana.height, 7);
  assert.equal(kana.advance, 8);
  assert.deepEqual(kana.rows, [4, 62, 4, 62, 85, 77, 38]);
  assert.ok(font.glyphs[String("歩".codePointAt(0))].rows.every(Number.isInteger));
  assert.equal(measureBitmapText(font, "CHEAT ENABLED"), 52);
  assert.equal(measureBitmapText(font, "歩行速度アップを有効にしました"), 120);
});

test("each bitmap dot is drawn once as an unscaled integer 1x1 pixel", () => {
  const rectangles = [];
  const context = {
    fillStyle: "",
    fillRect(...rectangle) { rectangles.push(rectangle); }
  };
  drawBitmapText(context, font, "あ", 10.4, 20.4, "#fff");
  assert.ok(rectangles.length > 0);
  for (const [x, y, width, height] of rectangles) {
    assert.equal(Number.isInteger(x), true);
    assert.equal(Number.isInteger(y), true);
    assert.equal(width, 1);
    assert.equal(height, 1);
  }
});

test("PixelMplus10 source pixels are used only for numeric value contexts", () => {
  assert.equal(numericFont.family, "PixelMplus10");
  assert.equal(numericFont.pixelSize, 8);
  assert.equal(numericFont.sourceDesignPixelSize, 10);
  assert.equal(numericFont.lineHeight, 8);
  assert.equal(numericFont.usage, "numeric-values-only");
  assert.equal(numericFont.glyphCount, 27);
  assert.ok(Object.values(numericFont.glyphs).every((glyph) => glyph.source === "PixelMplus10-source-BDF-8px-cell"));
  assert.deepEqual(numericFont.glyphs[String("1".codePointAt(0))].rows, [4, 6, 5, 4, 4, 4, 4, 0]);
  assert.deepEqual(numericFont.glyphs[String("x".codePointAt(0))].rows, [0, 0, 9, 9, 6, 9, 9, 0]);
  assert.equal(measureBitmapText(font, "123"), 12, "normal text must keep Misaki metrics");
  assert.equal(measureBitmapText(numericFont, "0x1A"), 20, "numeric values must use PixelMplus10 metrics");
  const numericFolder = createMenuTree().find((entry) => entry.label === "数値設定");
  assert.equal(formatValue(numericFolder.children[1]), "0x2001");
  assert.equal(isNumericEntry({ type: "value" }), true);
  assert.equal(isNumericEntry({ type: "slider" }), true);
  assert.equal(isNumericEntry({ type: "checkbox" }), false);
  for (const label of ["0", "00", "9", "A", "F", "."]) assert.equal(isNumericKeyLabel(label), true);
  for (const label of ["HEX", "DEC", "決定", "16進数"]) assert.equal(isNumericKeyLabel(label), false);
});

test("Shizue skip is a default-off root checkbox with the preparation contract", () => {
  const matches = createMenuTree().filter((entry) => entry.label === "しずえスキップ");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].type, "checkbox");
  assert.equal(matches[0].value, false);
  assert.match(matches[0].description, /起動時の一括処理を先に実行/);
});

test("bitmap subset contains every glyph used by menu labels and descriptions", () => {
  const strings = [
    "CHEAT MENU ROOT A決定 X適用 Y HOTKEY B戻る HOLD 全変更を適用しますか？",
    "数値入力 DEC HEX MIN MAX 数値スライダー STEP 左右 取消 符号 消 空白 かな カナ 濁点 半濁点 小字 改行 けってい 五十音キーボード QWERTY KEYBOARD",
    "ぁぃぅぇぉっゃゅょゎがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ",
    "ァィゥェォッャュョヮガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポヴ",
    "ACTION SELECTED 名前変更を呼び出しました ボタンを全て離す入力待ち中",
    ...HOTKEYS,
    ...numericKeys("dec", true).flat(),
    ...numericKeys("hex", false).flat(),
    ...textKeys("kana").flat(),
    ...textKeys("abc").flat()
  ];
  walkItems(createMenuTree(), (entry) => {
    strings.push(entry.label, entry.description, ...(entry.options || []));
  });
  const missing = new Set();
  for (const character of Array.from(strings.join(""))) {
    if (!font.glyphs[String(character.codePointAt(0))]) missing.add(character);
  }
  assert.deepEqual([...missing], []);
});

test("text keyboard matches both reference bitmap layouts", () => {
  const kana = textKeys("kana");
  assert.deepEqual(kana.slice(0, 5).map((row) => row.join("")), [
    "わらやまはなたさかあ",
    "をりゆみひにちしきい",
    "んるよむふぬつすくう",
    "、れ！めへねてせけえ",
    "。ろ？もほのとそこお"
  ]);
  assert.deepEqual(textKeys("abc").slice(0, 4).map((row) => row.join("")), [
    "1234567890-", "qwertyuiop", "asdfghjkl;'\\", "zxcvbnm,./=@"
  ]);

  const kanaLayout = textKeyLayout("kana");
  const abcLayout = textKeyLayout("abc");
  const common = ["BS", "ABC", "AIU", "SYMBOL", "PHONE", "CANCEL", "CONFIRM"];
  for (const key of common) {
    const kanaKey = kanaLayout.find((entry) => entry.key === key);
    const abcKey = abcLayout.find((entry) => entry.key === key);
    assert.deepEqual(
      [kanaKey.x, kanaKey.y, kanaKey.width, kanaKey.height],
      [abcKey.x, abcKey.y, abcKey.width, abcKey.height]
    );
  }
  assert.deepEqual(["CAPS", "SHIFT", "SPACE", "BLANK", "HIRAGANA", "KATAKANA"].map((key) => abcLayout.find((entry) => entry.key === key).y), [160, 160, 160, 160, 160, 160]);
  assert.equal(abcLayout.find((entry) => entry.key === "1").y, 68);
  assert.equal(abcLayout.find((entry) => entry.key === "q").y, 91);
  assert.equal(abcLayout.find((entry) => entry.key === "a").y, 114);
  assert.equal(abcLayout.find((entry) => entry.key === "z").y, 137);
  assert.deepEqual(["DAKUTEN", "HANDAKUTEN", "SMALL", "HIRAGANA", "KATAKANA"].map((key) => {
    const entry = kanaLayout.find((candidate) => candidate.key === key);
    return [entry.x, entry.y, entry.width, entry.height];
  }), [[3, 68, 35, 21], [3, 91, 35, 21], [3, 114, 35, 21], [3, 137, 35, 21], [3, 160, 35, 21]]);
  assert.deepEqual(["CANCEL", "CONFIRM"].map((key) => {
    const entry = kanaLayout.find((candidate) => candidate.key === key);
    return [entry.x, entry.y, entry.width, entry.height];
  }), [[3, 211, 116, 24], [121, 211, 196, 24]]);
  assert.ok([...kanaLayout, ...abcLayout].every((entry) => entry.x >= 0 && entry.y >= 0 && entry.x + entry.width <= 320 && entry.y + entry.height <= 240));
  const kanaOverlay = { type: "text", mode: "kana", value: "", cursor: 0 };
  const abcOverlay = { type: "text", mode: "abc", value: "", cursor: 0 };
  assert.equal(textKeyEnabled(kanaOverlay, "BS"), true);
  assert.equal(textKeyEnabled(kanaOverlay, "ENTER"), false);
  assert.equal(textKeyEnabled(kanaOverlay, "CONFIRM"), true);
  assert.equal(textKeyEnabled(kanaOverlay, "SYMBOL"), false);
  for (const key of ["BLANK", "HIRAGANA", "KATAKANA"]) assert.equal(textKeyEnabled(abcOverlay, key), false);
});

test("compact text keyboard keeps 8px glyphs while reducing key geometry", () => {
  const fullKana = textKeyLayout("kana");
  const compactKana = textKeyLayout("kana", true);
  const compactAbc = textKeyLayout("abc", true);
  assert.deepEqual(compactKana.map((entry) => entry.key), fullKana.map((entry) => entry.key));
  assert.equal(compactKana.find((entry) => entry.key === "わ").width, 17);
  assert.equal(fullKana.find((entry) => entry.key === "わ").width, 21);
  for (const entry of [...compactKana, ...compactAbc]) {
    assert.ok(entry.x >= 28 && entry.x + entry.width <= 292);
    assert.ok(entry.y >= 69 && entry.y + entry.height <= 205);
  }
  assert.deepEqual(textKeyboardGeometry(true), {
    titleX: 39, titleY: 23, inputX: 39, inputY: 37, inputWidth: 242, inputHeight: 21, inputRadius: 6,
    textX: 45, textY: 44, countX: 253, countY: 44, caretY: 42, caretHeight: 11
  });
  assert.equal(textKeyboardGeometry(false).inputWidth, 274);

  const menu = new CheatMenuModel();
  menu.openTextKeyboard(true);
  assert.equal(menu.overlay.compact, true);
  menu.overlay.value = "あ";
  menu.setTextCursor(1);
  menu.activateTextKey("SMALL");
  assert.equal(menu.overlay.value, "ぁ");
  menu.activateTextKey("ABC");
  assert.equal(menu.overlay.mode, "abc");
  assert.equal(menu.overlay.compact, true);

  const uiFolder = createMenuTree().find((entry) => entry.label === "UIテスト");
  assert.ok(uiFolder.children.some((entry) => entry.action === "compact-text-keyboard"));
});

test("QWERTY Caps and Shift are mutually exclusive physical keyboard modifiers", () => {
  const menu = new CheatMenuModel();
  menu.openTextKeyboard();
  menu.activateTextKey("ABC");
  menu.overlay.value = "";
  menu.activateTextKey("CAPS");
  assert.equal(menu.overlay.caps, true);
  assert.equal(menu.overlay.shift, false);
  menu.activateTextKey("SHIFT");
  assert.equal(menu.overlay.caps, false);
  assert.equal(menu.overlay.shift, true);
  menu.activateTextKey("CAPS");
  assert.equal(menu.overlay.caps, true);
  assert.equal(menu.overlay.shift, false);
  menu.activateTextKey("q");
  menu.activateTextKey("CAPS");
  menu.activateTextKey("SHIFT");
  menu.activateTextKey("w");
  menu.activateTextKey("e");
  assert.equal(menu.overlay.value, "QWe");
  assert.equal(menu.overlay.shift, false);
});

test("disabled Enter cannot add a newline and the separate confirm button commits text", () => {
  const menu = new CheatMenuModel();
  menu.openTextKeyboard();
  menu.overlay.value = "TEST";
  menu.setTextCursor(4);
  assert.equal(menu.activateTextKey("ENTER"), false);
  assert.equal(menu.overlay.value, "TEST");
  assert.equal(menu.activateTextKey("CONFIRM"), true);
  assert.equal(menu.playerName, "TEST");
  assert.equal(menu.overlay.closing, true);
  menu.update(0);
  assert.equal(menu.overlay, null);
});

test("text keyboards fade a thin black bottom-screen backdrop in and out", () => {
  assert.deepEqual(TEXT_KEYBOARD, { animationDuration: 180, backdropAlpha: 0.38 });
  const menu = new CheatMenuModel();
  menu.openTextKeyboard(false, 100);
  const overlay = menu.overlay;
  assert.equal(textKeyboardAmount(overlay, 100), 0);
  assert.ok(textKeyboardAmount(overlay, 190) > 0.5);
  assert.equal(textKeyboardAmount(overlay, 280), 1);
  menu.activateTextKey("CANCEL", 280);
  assert.equal(menu.overlay, overlay);
  assert.equal(overlay.closing, true);
  assert.ok(textKeyboardAmount(overlay, 370) < 0.5);
  menu.update(459);
  assert.equal(menu.overlay, overlay);
  menu.update(460);
  assert.equal(menu.overlay, null);
  assert.match(appSource, /TEXT_KEYBOARD\.backdropAlpha \* amount/);
  assert.match(appSource, /bottom\.globalAlpha = amount/);
});

test("touch keyboard highlight lasts only for the active pointer press", () => {
  assert.match(appSource, /let touchedTextKey = null/);
  assert.match(appSource, /const selected = touchedTextKey !== null && key === touchedTextKey/);
  assert.doesNotMatch(appSource, /touchedTextKey === null \? row === overlay\.row/);
  assert.match(appSource, /selectOverlayCell\(region\.row, region\.column, false, performance\.now\(\)\)/);
  assert.match(appSource, /addEventListener\("pointerup", \(\) => \{ touchedTextKey = null; \}\)/);
  assert.match(appSource, /addEventListener\("pointercancel", \(\) => \{ touchedTextKey = null; \}\)/);
});

test("text cursor inserts and deletes in the middle of the input", () => {
  const menu = new CheatMenuModel();
  menu.openTextKeyboard();
  menu.overlay.value = "あう";
  menu.setTextCursor(1);
  menu.activateTextKey("い");
  assert.equal(menu.overlay.value, "あいう");
  assert.equal(menu.overlay.cursor, 2);
  menu.activateTextKey("BS");
  assert.equal(menu.overlay.value, "あう");
  assert.equal(menu.overlay.cursor, 1);
  menu.setTextCursor(99);
  assert.equal(menu.overlay.cursor, 2);
  assert.equal(bitmapTextCursorAt(font, "あいう", 3), 0);
  assert.equal(bitmapTextCursorAt(font, "あいう", 13), 2);
  assert.equal(bitmapTextCursorAt(font, "あいう", 100), 3);
  assert.match(appSource, /textCursor:\s*true/);
  assert.match(appSource, /fillRect\(caretX, geometry\.caretY, 1, geometry\.caretHeight\)/);
});

test("dakuten, handakuten, and small keys toggle variants derived from the same base kana", () => {
  const menu = new CheatMenuModel();
  menu.openTextKeyboard();
  menu.overlay.value = "かはつ";
  menu.setTextCursor(1);
  assert.equal(textKeyEnabled(menu.overlay, "DAKUTEN"), true);
  assert.equal(textKeyEnabled(menu.overlay, "HANDAKUTEN"), false);
  assert.equal(textKeyEnabled(menu.overlay, "SMALL"), false);
  menu.activateTextKey("DAKUTEN");
  assert.equal(menu.overlay.value, "がはつ");
  assert.equal(textKeyEnabled(menu.overlay, "DAKUTEN"), true);
  menu.activateTextKey("DAKUTEN");
  assert.equal(menu.overlay.value, "かはつ");

  menu.setTextCursor(2);
  assert.equal(textKeyEnabled(menu.overlay, "DAKUTEN"), true);
  assert.equal(textKeyEnabled(menu.overlay, "HANDAKUTEN"), true);
  menu.activateTextKey("HANDAKUTEN");
  assert.equal(menu.overlay.value, "かぱつ");

  menu.setTextCursor(3);
  assert.equal(textKeyEnabled(menu.overlay, "SMALL"), true);
  menu.activateTextKey("SMALL");
  assert.equal(menu.overlay.value, "かぱっ");
  assert.equal(textKeyEnabled(menu.overlay, "DAKUTEN"), true);
  menu.activateTextKey("DAKUTEN");
  assert.equal(menu.overlay.value, "かぱづ", "dakuten must normalize small っ back to base つ before voicing it");
  assert.equal(menu.overlay.cursor, 3);

  menu.overlay.value = "あ";
  menu.setTextCursor(1);
  menu.activateTextKey("SMALL");
  assert.equal(menu.overlay.value, "ぁ");
  menu.activateTextKey("SMALL");
  assert.equal(menu.overlay.value, "あ");

  menu.overlay.value = "ぱ";
  menu.setTextCursor(1);
  menu.activateTextKey("DAKUTEN");
  assert.equal(menu.overlay.value, "ば", "dakuten must replace handakuten on the same base kana");
  menu.activateTextKey("DAKUTEN");
  assert.equal(menu.overlay.value, "は");

  menu.overlay.value = "ば";
  menu.setTextCursor(1);
  menu.activateTextKey("HANDAKUTEN");
  assert.equal(menu.overlay.value, "ぱ", "handakuten must replace dakuten on the same base kana");
});

test("katakana mode converts key input and both QWERTY kana keys stay disabled", () => {
  const menu = new CheatMenuModel();
  menu.openTextKeyboard();
  menu.overlay.value = "";
  menu.setTextCursor(0);
  menu.activateTextKey("KATAKANA");
  assert.equal(menu.overlay.mode, "kana");
  assert.equal(menu.overlay.script, "katakana");
  menu.activateTextKey("か");
  assert.equal(menu.overlay.value, "カ");
  menu.activateTextKey("DAKUTEN");
  assert.equal(menu.overlay.value, "ガ");

  menu.activateTextKey("ABC");
  assert.equal(menu.overlay.mode, "abc");
  assert.equal(textKeyEnabled(menu.overlay, "HIRAGANA"), false);
  assert.equal(menu.activateTextKey("HIRAGANA"), false);
  assert.equal(menu.overlay.mode, "abc");
  assert.equal(textKeyEnabled(menu.overlay, "KATAKANA"), false);
  assert.equal(menu.activateTextKey("KATAKANA"), false);
  assert.equal(menu.overlay.mode, "abc");
  menu.activateTextKey("AIU");
  assert.equal(menu.overlay.mode, "kana");
  assert.equal(menu.overlay.script, "hiragana");
});

test("top and bottom backgrounds use changeable solid colors without loading top.bmp", () => {
  assert.doesNotMatch(html, /src="top\.bmp"|topBackgroundImage/);
  assert.doesNotMatch(appSource, /top\.bmp|topBackgroundImage|drawImage\(/);
  assert.match(html, /class="screen-settings"/);
  assert.match(html, /id="topBackgroundColor"[^>]+type="color"/);
  assert.match(html, /id="bottomBackgroundColor"[^>]+type="color"/);
  assert.match(html, /app\.js\?v=20260831-6/);
  assert.match(appSource, /top\.fillStyle = topBackgroundColor\.value/);
  assert.match(appSource, /bottom\.fillStyle = bottomBackgroundColor\.value/);
  assert.match(serverSource, /requested\.toLowerCase\(\) === "top\.bmp"/);
  assert.match(serverSource, /writeHead\(410/);
  for (const alpha of [".78", ".74", ".76", ".82", ".64", ".72"]) assert.ok(appSource.includes(alpha));
  assert.doesNotMatch(appSource, /top\.fillStyle = "#(?:1c2b22|151b17|0a0d0b|294537)"/);
});

test("ease-out curve reaches both endpoints and advances faster than linear", () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.ok(easeOutCubic(0.5) > 0.5);
});

test("menu selection eases between rows, pulses gently, and value changes bounce by direction", () => {
  assert.equal(MENU.selectionMoveDuration, 100);
  assert.equal(MENU.valueBounceDuration, 100);
  const menu = new CheatMenuModel();
  menu.open(0);
  menu.handle("down", 100);
  assert.equal(menu.currentFrame().selection, 1);
  assert.equal(menu.selectionPosition(100), 0);
  assert.ok(menu.selectionPosition(210) > 0.5);
  assert.equal(menu.selectionPosition(320), 1);

  assert.ok(selectionPulse(450) > selectionPulse(0));
  assert.ok(selectionPulse(1350) < selectionPulse(0));
  assert.ok([0, 450, 900, 1350].every((time) => selectionPulse(time) >= 0.4 && selectionPulse(time) <= 0.56));
  assert.ok(selectionOutlinePulse(450) > selectionOutlinePulse(0));
  assert.ok(selectionOutlinePulse(1350) < selectionOutlinePulse(0));
  assert.ok([0, 450, 900, 1350].every((time) => selectionOutlinePulse(time) >= 0.5 && selectionOutlinePulse(time) <= 0.9));

  menu.currentFrame().selection = 4;
  menu.activateSelected(400);
  menu.handle("right", 500);
  assert.equal(menu.selectionBounceOffset(500), 0);
  assert.ok(menu.selectionBounceOffset(550) > 0);
  assert.ok(Math.abs(menu.selectionBounceOffset(525)) <= 4);
  assert.equal(menu.selectionBounceOffset(760), 0);
  menu.handle("left", 800);
  assert.ok(menu.selectionBounceOffset(850) < 0);
});

test("pressing A gives the selected item a small 80ms horizontal bounce", () => {
  assert.equal(MENU.activationBounceDuration, 80);
  const menu = new CheatMenuModel();
  menu.open(0);
  menu.currentFrame().selection = 1;
  menu.handle("a", 100);
  assert.equal(menu.activationBounceOffset(100), 0);
  assert.ok(menu.activationBounceOffset(124) > 0);
  assert.ok(menu.activationBounceOffset(124) <= 3);
  assert.equal(menu.activationBounceOffset(180), 0);
  assert.match(appSource, /const activationOffset = menu\.activationBounceOffset\(now\)/);
  assert.match(appSource, /const itemOffset = selected \? Math\.round\(activationOffset\) : 0/);
});

test("menu selection eases directly between the first and last items when wrapping", () => {
  const menu = new CheatMenuModel();
  menu.open(0);
  const last = menu.currentFrame().items.length - 1;

  menu.handle("up", 100);
  assert.equal(menu.currentFrame().selection, last);
  assert.equal(menu.selectionPosition(100), 0);
  assert.ok(menu.selectionPosition(150) > 0 && menu.selectionPosition(150) < last);
  assert.equal(menu.selectionPosition(200), last);

  menu.handle("down", 300);
  assert.equal(menu.currentFrame().selection, 0);
  assert.equal(menu.selectionPosition(300), last);
  assert.ok(menu.selectionPosition(350) > 0 && menu.selectionPosition(350) < last);
  assert.equal(menu.selectionPosition(400), 0);
});

test("large cheat menus ease their viewport and expose a proportional scrollbar", () => {
  const tree = createMenuTree();
  assert.ok(tree.length > MENU.visibleRows);
  assert.equal(tree[6].type, "list");
  assert.equal(tree[6].options.length, 30);
  assert.equal(tree[7].type, "folder");
  assert.equal(tree[7].children.length, 24);

  const menu = new CheatMenuModel();
  menu.open(0);
  for (let step = 1; step <= 12; step++) menu.handle("down", step * 120);
  assert.equal(menu.currentFrame().selection, 12);
  assert.ok(menu.viewportTarget > 0);
  assert.ok(menu.viewportStart(1490) > 0 && menu.viewportStart(1490) < menu.viewportTarget);
  assert.equal(menu.viewportStart(1540), menu.viewportTarget);
  assert.match(appSource, /function drawScrollBar\(/);
});

test("DPad hold starts repeating after 200ms and stops immediately on release", () => {
  assert.deepEqual(CONTROL_REPEAT, { delay: 200, interval: 60 });
  const events = [];
  const repeater = new ControlRepeater((key, now, pressed, repeated) => events.push({ key, now, pressed, repeated }));

  repeater.press("down", 100);
  repeater.update(299);
  assert.equal(events.length, 1);
  repeater.update(300);
  repeater.update(360);
  assert.deepEqual(events.map((event) => [event.now, event.repeated]), [[100, false], [300, true], [360, true]]);

  repeater.release("down", 370);
  repeater.update(1000);
  assert.deepEqual(events.at(-1), { key: "down", now: 370, pressed: false, repeated: false });
});

test("only repeated selection input stops at the first and last items", () => {
  const menu = new CheatMenuModel();
  menu.open(0);
  const frame = menu.currentFrame();
  const last = frame.items.length - 1;

  menu.handle("up", 100, true, true);
  assert.equal(frame.selection, 0);
  assert.equal(menu.selectionBoundaryBounceOffset(100), 0);
  assert.ok(menu.selectionBoundaryBounceOffset(125) < 0);
  assert.ok(Math.abs(menu.selectionBoundaryBounceOffset(125)) <= 4);
  menu.handle("up", 160, true, true);
  assert.equal(menu.selectionBoundaryBounceStartedAt, 100);
  menu.handle("up", 200, true, false);
  assert.equal(frame.selection, last);
  menu.handle("down", 300, true, true);
  assert.equal(frame.selection, last);
  assert.ok(menu.selectionBoundaryBounceOffset(325) > 0);
  menu.handle("down", 400, true, false);
  assert.equal(frame.selection, 0);
});

test("repeated DPad left and right input continuously changes numeric items", () => {
  const menu = new CheatMenuModel();
  menu.open(0);
  menu.currentFrame().selection = 4;
  menu.handle("a", 10);
  const valueItem = menu.selectedItem();
  const repeater = new ControlRepeater((key, now, pressed, repeated) => menu.handle(key, now, pressed, repeated));

  repeater.press("right", 100);
  assert.equal(valueItem.value, 1100);
  repeater.update(299);
  assert.equal(valueItem.value, 1100);
  repeater.update(300);
  repeater.update(360);
  assert.equal(valueItem.value, 1300);
  repeater.release("right", 370);
});

test("selected menu background has a crisp one-pixel outline", () => {
  assert.match(appSource, /strokeRect\(highlightX \+ \.5, highlightY - 2\.5, highlightWidth - 1, highlightHeight - 1\)/);
  assert.match(appSource, /selectionOutlinePulse\(now\)\.toFixed\(3\)/);
});

test("notification enters from outside right and settles at bottom-right", () => {
  const timeline = new NotificationTimeline();
  timeline.add(0);
  assert.deepEqual(timeline.sample(0)[0], { id: 1, title: "CHEAT ENABLED", message: "歩行速度アップを有効にしました", x: 400, y: 205 });
  assert.deepEqual(timeline.sample(NOTICE.enterDuration)[0], { id: 1, title: "CHEAT ENABLED", message: "歩行速度アップを有効にしました", x: 248, y: 205 });
  assert.match(appSource, /top\.fillStyle = "rgba\(10, 13, 11, \.78\)"/);
});

test("a new notification eases the older one upward and occupies the bottom slot", () => {
  const timeline = new NotificationTimeline();
  timeline.add(0);
  timeline.add(1000);
  const start = timeline.sample(1000);
  assert.equal(start[0].y, 205);
  assert.equal(start[1].y, 205);

  const settled = timeline.sample(1000 + NOTICE.enterDuration);
  assert.equal(settled[0].y, 174);
  assert.equal(settled[1].y, 205);
});

test("simultaneous notification requests start one at a time with a 40ms interval", () => {
  assert.equal(NOTICE.spawnInterval, 40);
  const timeline = new NotificationTimeline();
  const first = timeline.add(100);
  const second = timeline.add(100);
  const third = timeline.add(105);
  assert.deepEqual([first.createdAt, second.createdAt, third.createdAt], [100, 140, 180]);
  assert.equal(timeline.sample(100).length, 1);
  assert.equal(timeline.sample(139).length, 1);
  assert.equal(timeline.sample(140).length, 2);
  assert.equal(timeline.sample(179).length, 2);
  assert.equal(timeline.sample(180).length, 3);
  assert.match(appSource, /setTimeout\(addNotice, NOTICE\.spawnInterval\)/);
  assert.match(appSource, /setTimeout\(addNotice, NOTICE\.spawnInterval \* 2\)/);
});

test("notification exits to the right with the same ease-out curve", () => {
  const timeline = new NotificationTimeline();
  const item = timeline.add(0);
  const exitStart = NOTICE.enterDuration + NOTICE.holdDuration;
  assert.equal(timeline.getX(item, exitStart), 248);
  assert.ok(timeline.getX(item, exitStart + NOTICE.exitDuration / 2) > 324);
  assert.equal(timeline.getX(item, exitStart + NOTICE.exitDuration), 400);
  assert.equal(timeline.sample(exitStart + NOTICE.exitDuration).length, 0);
});

test("stack is capped at seven visible notices and remains inside the screen", () => {
  const timeline = new NotificationTimeline();
  for (let index = 0; index < 8; index++) timeline.add(index * 10);
  const items = timeline.sample(1000);
  assert.equal(items.length, 7);
  assert.equal(items[0].id, 2);
  assert.ok(items.every((item) => item.y >= NOTICE.margin));
});

test("cheat menu eases in from the left and checkbox changes remain pending", () => {
  const menu = new CheatMenuModel();
  menu.open(0);
  assert.equal(menu.openAmount(0), 0);
  assert.ok(menu.openAmount(160) > 0.5);
  assert.equal(menu.openAmount(320), 1);

  menu.currentFrame().selection = 1;
  const checkbox = menu.selectedItem();
  menu.handle("a", 400);
  assert.equal(checkbox.value, true);
  assert.equal(checkbox.appliedValue, false);
  assert.equal(isDirty(checkbox), true);
  menu.handle("x", 410, true);
  assert.equal(checkbox.appliedValue, true);
  assert.equal(isDirty(checkbox), false);
});

test("checkbox applied state and effect state are independent", () => {
  const emitted = [];
  const executed = [];
  const menu = new CheatMenuModel(
    (title, message) => emitted.push({ title, message }),
    (entry, now) => executed.push({ entry, now })
  );
  const playerFolder = menu.rootItems.find((entry) => entry.label === "プレイヤー");
  const invincible = playerFolder.children.find((entry) => entry.label === "無敵モード");

  invincible.value = true;
  menu.applyItem(invincible, 10);
  assert.equal(invincible.appliedValue, true);
  assert.equal(invincible.effectActive, true, "without a hotkey, applying ON enables the effect");
  assert.equal(executed.filter((call) => call.entry === invincible).length, 1);

  invincible.hotkey = "L+A";
  menu.applyItem(invincible, 20);
  assert.equal(invincible.appliedHotkey, "L+A");
  assert.equal(invincible.effectActive, true, "changing only the binding must preserve the current effect");

  menu.handle("l", 30, true);
  menu.handle("a", 31, true);
  assert.equal(invincible.appliedValue, true, "hotkey must not change the item applied state");
  assert.equal(invincible.value, true, "hotkey must not change the editable item state");
  assert.equal(invincible.effectActive, false, "hotkey toggles only the effect");
  menu.handle("a", 32, false);
  menu.handle("l", 33, false);

  invincible.value = false;
  menu.applyItem(invincible, 40);
  assert.equal(invincible.appliedValue, false);
  assert.equal(invincible.effectActive, false, "applying OFF always disables the effect");
  assert.equal(emitted.filter((notice) => notice.title === "CHEAT ENABLED").length, 1);
  assert.equal(emitted.filter((notice) => notice.title === "CHEAT DISABLED").length, 1);

  menu.handle("l", 50, true);
  menu.handle("a", 51, true);
  assert.equal(invincible.effectActive, false, "an OFF item ignores its hotkey");
  menu.handle("a", 52, false);
  menu.handle("l", 53, false);
});

test("bound checkbox applies as armed and the first hotkey press enables its effect", () => {
  const menu = new CheatMenuModel();
  const playerFolder = menu.rootItems.find((entry) => entry.label === "プレイヤー");
  const wallClip = playerFolder.children.find((entry) => entry.label === "壁抜け");
  wallClip.hotkey = "L+A";
  wallClip.value = true;
  menu.applyItem(wallClip, 10);

  assert.equal(wallClip.appliedValue, true);
  assert.equal(wallClip.effectActive, false, "bound ON applies as armed only");

  menu.handle("l", 20, true);
  menu.handle("a", 21, true);
  assert.equal(wallClip.effectActive, true);
  menu.handle("a", 22, true, true);
  assert.equal(wallClip.effectActive, true, "held key repeat must not retrigger the chord");
  menu.handle("a", 23, false);
  menu.handle("a", 24, true);
  assert.equal(wallClip.effectActive, false, "the next complete chord toggles the effect again");
  menu.handle("a", 25, false);
  menu.handle("l", 26, false);
});

test("only explicitly simulated tick checkboxes execute on every update", () => {
  const executed = [];
  const menu = new CheatMenuModel(() => {}, (entry, now) => executed.push({ entry, now }));
  const shizue = menu.rootItems.find((entry) => entry.label === "しずえスキップ");
  const walking = menu.rootItems.find((entry) => entry.label === "歩行速度アップ");

  shizue.value = true;
  walking.value = true;
  menu.applyItem(shizue, 10);
  menu.applyItem(walking, 10);
  menu.update(11);
  menu.update(12);

  assert.equal(executed.filter((call) => call.entry === shizue).length, 2);
  assert.equal(executed.filter((call) => call.entry === walking).length, 0);
});

test("value, slider, and list items execute their simulated apply only when the value is applied", () => {
  const executed = [];
  const menu = new CheatMenuModel(() => {}, (entry, now) => executed.push({ entry, now }));
  const numericFolder = menu.rootItems.find((entry) => entry.label === "数値設定");
  const bells = numericFolder.children.find((entry) => entry.label === "所持ベル");
  const weather = menu.rootItems.find((entry) => entry.label === "天候");

  bells.value += 100;
  assert.equal(executed.length, 0);
  menu.applyItem(bells, 10);
  assert.equal(executed.filter((call) => call.entry === bells).length, 1);

  weather.value = 1;
  menu.applyItem(weather, 20);
  assert.equal(executed.filter((call) => call.entry === weather).length, 1);

  bells.hotkey = "R";
  menu.applyItem(bells, 30);
  assert.equal(executed.filter((call) => call.entry === bells).length, 1, "binding-only apply must not write the value again");
});

test("action items run immediately when A is pressed", () => {
  const emitted = [];
  const menu = new CheatMenuModel((title, message) => emitted.push({ title, message }));
  menu.open(0);
  menu.currentFrame().selection = 2;
  const action = menu.selectedItem();
  menu.handle("a", 10);
  assert.equal(action.executionCount, 1);
  assert.equal(isDirty(action), false);
  assert.ok(emitted.some((notice) => notice.title === "ACTION" && /セーブ/.test(notice.message)));

  const keyboardMenu = new CheatMenuModel();
  keyboardMenu.open(0);
  keyboardMenu.currentFrame().selection = 0;
  keyboardMenu.handle("a", 30);
  keyboardMenu.currentFrame().selection = 2;
  keyboardMenu.handle("a", 40);
  assert.equal(keyboardMenu.overlay.type, "text");
  assert.equal(keyboardMenu.overlay.animationStartedAt, 40);
});

test("X applies only the selected item and holding it never applies all items", () => {
  const emitted = [];
  const menu = new CheatMenuModel((title, message) => emitted.push({ title, message }));
  menu.open(0);
  const first = menu.rootItems[1];
  const second = menu.rootItems.at(-1);
  first.value = true;
  second.value = true;
  menu.currentFrame().selection = 1;
  const repeater = new ControlRepeater((key, now, pressed, repeated) => menu.handle(key, now, pressed, repeated));
  repeater.press("x", 0);
  assert.equal(first.appliedValue, true);
  repeater.update(199);
  assert.equal(second.appliedValue, false);
  repeater.update(200);
  repeater.update(320);
  assert.equal(second.appliedValue, false);
  assert.equal(menu.dialog, null);
  assert.equal(emitted.some((notice) => notice.title === "APPLIED"), false);
  repeater.release("x", 321);
  assert.doesNotMatch(appSource, /xHoldProgress|X HOLD/);
  assert.doesNotMatch(modelSource, /apply-all|emit\("APPLIED"/);
});

test("closing with pending changes offers only apply and cancel with animation", () => {
  assert.equal(DIALOG.animationDuration, 160);
  assert.deepEqual(CLOSE_DIALOG_OPTIONS, ["適用", "キャンセル"]);
  assert.deepEqual(DIALOG_DEFINITIONS.close.options, CLOSE_DIALOG_OPTIONS);

  const applyMenu = new CheatMenuModel();
  applyMenu.open(0);
  applyMenu.rootItems[1].value = true;
  assert.equal(applyMenu.close(100), false);
  assert.equal(applyMenu.dialog.type, "close");
  assert.equal(dialogAmount(applyMenu.dialog, 100), 0);
  assert.equal(applyMenu.openTarget, 1);
  applyMenu.handle("a", 260);
  assert.equal(applyMenu.rootItems[1].appliedValue, false);
  applyMenu.update(419);
  assert.equal(applyMenu.openTarget, 1);
  applyMenu.update(420);
  assert.equal(applyMenu.rootItems[1].appliedValue, true);
  assert.equal(applyMenu.openTarget, 0);

  const cancelMenu = new CheatMenuModel();
  cancelMenu.open(0);
  cancelMenu.rootItems[1].value = true;
  cancelMenu.close(100);
  cancelMenu.handle("down", 260);
  cancelMenu.handle("a", 270);
  assert.equal(cancelMenu.dialog.closing, true);
  cancelMenu.update(430);
  assert.equal(cancelMenu.dialog, null);
  assert.equal(cancelMenu.openTarget, 1);
  assert.equal(cancelMenu.rootItems[1].value, true);
  assert.equal(cancelMenu.rootItems[1].appliedValue, false);
  assert.match(appSource, /function drawDialog\(now\)/);
  assert.match(appSource, /drawDescriptionPanel\(amount\)/);
  assert.doesNotMatch(appSource, /descriptionHeld|R説明/);
});

test("L discards only yellow pending changes and preserves applied state", () => {
  const emitted = [];
  const menu = new CheatMenuModel((title, message) => emitted.push({ title, message }));
  menu.open(0);
  const checkbox = menu.rootItems[1];
  checkbox.value = true;
  checkbox.hotkey = "L+A";
  menu.applyItem(checkbox, 10);
  assert.equal(checkbox.appliedValue, true);
  assert.equal(checkbox.appliedHotkey, "L+A");

  checkbox.value = false;
  checkbox.hotkey = "R";
  assert.equal(isDirty(checkbox), true);

  menu.handle("l", 100);
  assert.equal(menu.dialog.type, "revert-all");
  assert.equal(menu.dialog.title, "変更を戻しますか？");
  assert.deepEqual(menu.dialog.options, ["戻す", "キャンセル"]);
  menu.handle("down", 260);
  menu.handle("a", 270);
  menu.update(430);
  assert.equal(checkbox.value, false, "cancel must preserve the pending edit");
  assert.equal(checkbox.hotkey, "R");
  assert.equal(checkbox.appliedValue, true);
  assert.equal(checkbox.appliedHotkey, "L+A");

  menu.handle("l", 500);
  menu.handle("a", 660);
  menu.update(820);
  assert.equal(checkbox.value, true, "pending value returns to the applied value");
  assert.equal(checkbox.appliedValue, true, "applied value must not be reverted");
  assert.equal(checkbox.hotkey, "L+A", "pending hotkey returns to the applied hotkey");
  assert.equal(checkbox.appliedHotkey, "L+A", "applied hotkey must not be reverted");
  assert.equal(isDirty(checkbox), false);
  assert.equal(emitted.filter((notice) => notice.title === "CHEAT DISABLED").length, 0);

  menu.handle("l", 900);
  assert.equal(menu.dialog, null, "L does nothing when there are no yellow pending changes");
});

test("inline list changes locally and closing the menu asks before applying pending values", () => {
  const emitted = [];
  const menu = new CheatMenuModel((title, message) => emitted.push({ title, message }));
  menu.open(0);
  menu.currentFrame().selection = 3;
  const weather = menu.selectedItem();
  menu.handle("a", 400);
  menu.handle("down", 410);
  menu.handle("a", 420);
  assert.equal(formatValue(weather), "雨");
  assert.equal(weather.appliedValue, 0);
  menu.close(500);
  assert.equal(menu.dialog.type, "close");
  assert.equal(menu.openTarget, 1);
  assert.equal(weather.appliedValue, 0);
  menu.handle("a", 660);
  menu.update(820);
  assert.equal(weather.appliedValue, 1);
  assert.equal(menu.openTarget, 0);
  assert.equal(emitted.some((notice) => /一括適用/.test(notice.message)), false);
});

test("inline and screen listboxes ease in and remain mounted through their exit animation", () => {
  assert.equal(LISTBOX.animationDuration, 180);
  const menu = new CheatMenuModel();
  menu.open(0);
  menu.currentFrame().selection = 3;
  menu.handle("a", 100);
  const inline = menu.inlineList;
  assert.equal(listboxAmount(inline, 100), 0);
  assert.ok(listboxAmount(inline, 190) > 0.5);
  assert.equal(listboxAmount(inline, 280), 1);

  menu.handle("b", 280);
  assert.equal(menu.inlineList, inline);
  assert.equal(listboxAmount(inline, 280), 1);
  assert.ok(listboxAmount(inline, 370) < 0.5);
  menu.update(459);
  assert.equal(menu.inlineList, inline);
  menu.update(460);
  assert.equal(menu.inlineList, null);

  menu.openListbox("bottom", "TEST", ["A", "B"], null, 0, 500);
  const overlay = menu.overlay;
  assert.equal(listboxAmount(overlay, 500), 0);
  assert.equal(listboxAmount(overlay, 680), 1);
  menu.handle("b", 680);
  assert.equal(menu.overlay, overlay);
  menu.update(860);
  assert.equal(menu.overlay, null);
});

test("closing the cheat menu cancels open listboxes with their exit animation", () => {
  const inlineMenu = new CheatMenuModel();
  inlineMenu.open(0);
  inlineMenu.currentFrame().selection = 3;
  const listItem = inlineMenu.selectedItem();
  inlineMenu.handle("a", 100);
  inlineMenu.handle("down", 280);
  const inline = inlineMenu.inlineList;
  assert.equal(inline.index, 1);
  inlineMenu.close(300);
  assert.equal(inlineMenu.inlineList, inline);
  assert.equal(inline.closing, true);
  assert.equal(listItem.value, 0, "cancel must not commit the highlighted list option");
  inlineMenu.update(479);
  assert.equal(inlineMenu.inlineList, inline);
  inlineMenu.update(480);
  assert.equal(inlineMenu.inlineList, null);

  const screenMenu = new CheatMenuModel();
  screenMenu.open(0);
  screenMenu.openListbox("bottom", "TEST", ["A", "B"], null, 0, 100);
  screenMenu.handle("down", 280);
  const overlay = screenMenu.overlay;
  screenMenu.close(300);
  assert.equal(screenMenu.overlay, overlay);
  assert.equal(overlay.closing, true);
  screenMenu.update(480);
  assert.equal(screenMenu.overlay, null);
});

test("long inline and screen listboxes scroll their selection inside fixed-height windows", () => {
  assert.equal(LONG_LIST_OPTIONS.length, 30);
  assert.equal(LISTBOX.inlineVisibleRows, 6);
  assert.equal(LISTBOX.screenVisibleRows, 8);
  const menu = new CheatMenuModel();
  menu.open(0);
  menu.currentFrame().selection = 6;
  menu.handle("a", 100);
  const inline = menu.inlineList;
  for (let step = 1; step <= 10; step++) menu.handle("down", 100 + step * 120);
  assert.equal(inline.index, 10);
  assert.ok(inline.scrollTarget > 0);
  assert.ok(listboxScrollPosition(inline, 1350) > 0);

  menu.close(1500);
  menu.open(1600);
  menu.openListbox("top", "LONG", [...LONG_LIST_OPTIONS], null, 0, 1600);
  const overlay = menu.overlay;
  for (let step = 1; step <= 12; step++) menu.handle("down", 1600 + step * 120);
  assert.equal(overlay.index, 12);
  assert.ok(overlay.scrollTarget > inline.scrollTarget);
  assert.ok(listboxScrollPosition(overlay, 3090) > 0);
});

test("inline and screen listboxes accept held DPad repeat input", () => {
  const screenMenu = new CheatMenuModel();
  screenMenu.open(0);
  screenMenu.openListbox("top", "LONG", [...LONG_LIST_OPTIONS], null, 0, 0);
  const screenRepeater = new ControlRepeater((key, now, pressed, repeated) => screenMenu.handle(key, now, pressed, repeated));
  screenRepeater.press("down", 0);
  assert.equal(screenMenu.overlay.index, 1);
  screenRepeater.update(199);
  assert.equal(screenMenu.overlay.index, 1);
  screenRepeater.update(200);
  screenRepeater.update(260);
  assert.equal(screenMenu.overlay.index, 3);
  screenRepeater.release("down", 261);

  const inlineMenu = new CheatMenuModel();
  inlineMenu.open(0);
  inlineMenu.currentFrame().selection = 6;
  inlineMenu.handle("a", 0);
  const inlineRepeater = new ControlRepeater((key, now, pressed, repeated) => inlineMenu.handle(key, now, pressed, repeated));
  inlineRepeater.press("down", 0);
  inlineRepeater.update(200);
  assert.equal(inlineMenu.inlineList.index, 2);
  inlineRepeater.release("down", 201);
});

test("only repeated listbox movement stops at the first and last options", () => {
  const menu = new CheatMenuModel();
  menu.open(0);
  menu.openListbox("top", "BOUNDARY", ["A", "B", "C"], null, 1, 0);
  const repeater = new ControlRepeater((key, now, pressed, repeated) => menu.handle(key, now, pressed, repeated));

  repeater.press("down", 0);
  assert.equal(menu.overlay.index, 2);
  repeater.update(200);
  repeater.update(320);
  assert.equal(menu.overlay.index, 2, "held down must stop at the last option");
  repeater.release("down", 321);

  menu.handle("down", 400);
  assert.equal(menu.overlay.index, 0, "a new single press must still wrap to the first option");

  menu.overlay.index = 1;
  repeater.press("up", 500);
  assert.equal(menu.overlay.index, 0);
  repeater.update(700);
  repeater.update(820);
  assert.equal(menu.overlay.index, 0, "held up must stop at the first option");
  repeater.release("up", 821);

  menu.handle("up", 900);
  assert.equal(menu.overlay.index, 2, "a new single press must still wrap to the last option");
});

test("top and bottom screen listboxes are vertically centered for their rendered height", () => {
  assert.equal(listboxVerticalPosition(30, LISTBOX.screenVisibleRows), 28);
  assert.equal(listboxVerticalPosition(2, LISTBOX.screenVisibleRows), 88);
  assert.equal(topOverlayHorizontalPosition(0, 204, 178), 98);
  assert.equal(topOverlayHorizontalPosition(1, 204, 178), 178);
  assert.equal(topOverlayHorizontalPosition(0.5, 204, 178), 138);
  assert.match(appSource, /const y = listboxVerticalPosition\(overlay\.options\.length, overlay\.visibleRows\)/);
  assert.match(appSource, /topOverlayHorizontalPosition\(0, 204, 178\)/);
  assert.match(appSource, /topOverlayHorizontalPosition\(amount, 204, 178\)/);
  assert.match(appSource, /drawListbox\(bottom, 52, 216, overlay/);
});

test("numeric keyboard can switch decimal and hexadecimal and clamps to limits", () => {
  const menu = new CheatMenuModel();
  menu.open(0);
  menu.currentFrame().selection = 4;
  menu.handle("a", 400);
  menu.currentFrame().selection = 0;
  const valueItem = menu.selectedItem();
  menu.handle("a", 410);
  assert.equal(menu.overlay.type, "numeric");
  assert.equal(menu.overlay.mode, "dec");
  menu.overlay.buffer = "999999";
  menu.activateNumericKey("OK");
  assert.equal(valueItem.value, valueItem.maximum);

  menu.currentFrame().selection = 1;
  menu.handle("a", 420);
  assert.equal(menu.overlay.mode, "hex");
  menu.activateNumericKey("DEC");
  assert.equal(menu.overlay.mode, "dec");
  assert.equal(numericKeys("hex", false).length, 6);
});

test("decimal and hexadecimal keyboards share one layout and disabled keys cannot input", () => {
  const decimal = numericKeys("dec", true);
  const hexadecimal = numericKeys("hex", false);
  assert.deepEqual(decimal.map((row) => row.length), hexadecimal.map((row) => row.length));
  assert.deepEqual(decimal.slice(0, 4), hexadecimal.slice(0, 4));
  assert.deepEqual(decimal[5], hexadecimal[5]);
  assert.deepEqual(decimal[4].filter((key) => !["HEX", "DEC"].includes(key)), hexadecimal[4].filter((key) => !["HEX", "DEC"].includes(key)));

  const menu = new CheatMenuModel();
  menu.open(0);
  menu.currentFrame().selection = 4;
  menu.activateSelected(10);
  menu.currentFrame().selection = 0;
  menu.handle("a", 20);
  const overlay = menu.overlay;
  const original = overlay.buffer;
  for (const key of ["A", "B", "C", "D", "E", "F"]) {
    assert.equal(numericKeyEnabled(overlay, key), false);
    assert.equal(menu.activateNumericKey(key), false);
    assert.equal(overlay.buffer, original);
  }
  assert.equal(numericKeyEnabled(overlay, "7"), true);
  assert.equal(numericKeyEnabled(overlay, "."), false);
  menu.activateNumericKey("HEX");
  assert.equal(overlay.mode, "hex");
  for (const key of ["A", "B", "C", "D", "E", "F"]) assert.equal(numericKeyEnabled(overlay, key), true);
  assert.equal(numericKeyEnabled(overlay, "."), false);
  assert.equal(numericKeyEnabled(overlay, "SIGN"), false);
});

test("hotkey capture records a unique chord until every held button is released", () => {
  const menu = new CheatMenuModel();
  menu.open(0);
  menu.currentFrame().selection = 1;
  menu.handle("y", 400, true);
  assert.equal(menu.overlay.type, "hotkey-capture");
  assert.equal(menu.overlay.screen, "bottom");
  assert.equal(menu.overlay.phase, "arming");
  menu.handle("y", 410, false);
  assert.equal(menu.overlay.phase, "waiting");

  menu.handle("l", 420, true);
  menu.handle("a", 430, true);
  menu.handle("a", 440, false);
  assert.equal(menu.overlay.type, "hotkey-capture", "capture must continue while L remains held");
  menu.handle("a", 450, true);
  menu.handle("a", 460, false);
  assert.deepEqual(menu.overlay.capturedButtons, ["l", "a"], "repeated A presses must not duplicate the chord");
  menu.handle("l", 470, false);
  assert.equal(menu.overlay, null);
  assert.equal(menu.selectedItem().hotkey, "L+A");
  assert.equal(isDirty(menu.selectedItem()), true);
  assert.equal(formatHotkeyButtons(["a", "l", "a"]), "L+A");
  assert.deepEqual(HOTKEY_BUTTON_ORDER.slice(0, 4), ["zl", "l", "r", "zr"]);
  assert.equal(menu.openHotkeyPicker(480), undefined);
  assert.equal(menu.overlay.screen, "bottom");
  menu.cancelHotkeyCapture();
  assert.doesNotMatch(modelSource, /descriptionHeld/);
  assert.match(appSource, /drawDescriptionPanel\(amount\)/);
  assert.match(appSource, /drawHotkeyCapture\(/);
  assert.match(appSource, /menu\.overlay\.type === "hotkey-capture"/);
  assert.match(appSource, /drawKeyboardKey\(bottom, "DISABLE"/);
  assert.match(appSource, /region\.captureAction === "disable"/);
  for (const control of ["zl", "l", "r", "zr", "select", "start"]) assert.match(html, new RegExp(`data-control=["']${control}["']`));

  const disableMenu = new CheatMenuModel();
  disableMenu.open(0);
  disableMenu.currentFrame().selection = 1;
  disableMenu.handle("y", 500, true);
  disableMenu.handle("y", 510, false);
  assert.equal(disableMenu.disableHotkeyCapture(), true);
  assert.equal(disableMenu.selectedItem().hotkey, "なし");
  assert.equal(textKeys("kana").length, 6);
  assert.equal(textKeys("abc")[1].join(""), "qwertyuiop");
});

test("applied hotkeys activate supported items once per complete button chord", () => {
  const emitted = [];
  const menu = new CheatMenuModel((title, message) => emitted.push({ title, message }));
  const playerFolder = menu.rootItems.find((entry) => entry.label === "プレイヤー");
  const checkbox = playerFolder.children.find((entry) => entry.label === "壁抜け");
  checkbox.hotkey = "L+A";
  checkbox.value = true;
  menu.applyItem(checkbox);

  assert.deepEqual(hotkeyButtons("A+L+A"), ["l", "a"]);
  assert.equal(hotkeyMatches("L+A", new Set(["l", "a"])), true);
  assert.equal(hotkeyMatches("L+A", new Set(["l", "a", "b"])), false);

  menu.handle("l", 0, true);
  assert.equal(checkbox.effectActive, false);
  menu.handle("a", 10, true);
  assert.equal(checkbox.effectActive, true);
  assert.equal(checkbox.appliedValue, true, "hotkey activation keeps the item applied state unchanged");
  menu.handle("a", 20, true, true);
  assert.equal(checkbox.effectActive, true, "key repeat must not retrigger a held chord");
  menu.handle("a", 30, false);
  menu.handle("a", 40, true);
  assert.equal(checkbox.effectActive, false, "the chord can trigger again after it is broken");

  menu.handle("a", 50, false);
  menu.handle("l", 60, false);
  const action = menu.rootItems.find((entry) => entry.label === "セーブ実行");
  action.hotkey = "R";
  menu.applyItem(action);
  menu.handle("r", 70, true);
  assert.ok(emitted.some((notice) => notice.title === "ACTION" && /セーブ/.test(notice.message)));
  menu.handle("r", 80, false);

  const pending = menu.rootItems.at(-1);
  pending.hotkey = "X";
  const before = pending.value;
  menu.handle("x", 90, true);
  assert.equal(pending.value, before, "an unapplied hotkey setting must not run");
  menu.handle("x", 100, false);
});
