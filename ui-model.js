"use strict";

(function () {

const SCREEN = Object.freeze({ width: 400, height: 240, widthMm: 84.6, heightMm: 50.76 });
const NOTICE = Object.freeze({ width: 144, height: 27, gap: 4, margin: 8, maximum: 7, spawnInterval: 40, enterDuration: 360, holdDuration: 2600, exitDuration: 360 });
const MENU = Object.freeze({
  width: 160,
  itemHeight: 18,
  enterDuration: 320,
  visibleRows: 10,
  selectionMoveDuration: 100,
  scrollDuration: 100,
  valueBounceDuration: 100,
  activationBounceDuration: 80,
  pulseDuration: 1800,
  holdDuration: 600
});
const FRAME = Object.freeze({ fps: 30, interval: 1000 / 30 });
const CONTROL_REPEAT = Object.freeze({ delay: 200, interval: 60 });
const TOGGLE_ACTION = Object.freeze({ feedbackDuration: 800 });
const LISTBOX = Object.freeze({ animationDuration: 180, scrollDuration: 100, inlineVisibleRows: 6, screenVisibleRows: 8 });
const BOTTOM_OVERLAY = Object.freeze({ animationDuration: 180, backdropAlpha: 0.72 });
const TEXT_KEYBOARD = Object.freeze({ animationDuration: 180, backdropAlpha: 0.38 });
// Hardware action messages; conversion is performed only by the ACNL plugin.
const CHAT_KANJI_MESSAGES = Object.freeze({
  pending: "変換中です。Bで閉じる", busy: "変換処理中です。",
  empty: "チャットに文字を入力してください。", closed: "普通のチャットを開いてください。",
  invalid: "入力文字を確認してください。", font: "フォントを取得できません。",
  thread: "変換を開始できません。", version: "対応していないゲームの版です。",
  hardware: "ACNL実機でチャットに入力して実行してください。"
});
const DIALOG = Object.freeze({ animationDuration: 160 });
const CLOSE_DIALOG_OPTIONS = Object.freeze(["適用", "キャンセル"]);
const DIALOG_DEFINITIONS = Object.freeze({
  close: Object.freeze({ title: "変更を適用しますか？", options: CLOSE_DIALOG_OPTIONS }),
  "apply-all": Object.freeze({ title: "全ての変更を適用しますか？", options: Object.freeze(["適用", "キャンセル"]) }),
  "revert-all": Object.freeze({ title: "全ての変更を戻しますか？", options: Object.freeze(["戻す", "キャンセル"]) }),
  "toggle-action-hotkey": Object.freeze({ title: "アクションを実行しますか？", options: Object.freeze(["実行", "キャンセル"]) })
});
const HOTKEYS = Object.freeze(["なし", "L+UP", "R+DOWN", "ZL+ZR", "SELECT"]);
const HOTKEY_BUTTON_ORDER = Object.freeze(["zl", "l", "r", "zr", "up", "down", "left", "right", "a", "b", "x", "y", "select", "start"]);
const HOTKEY_BUTTON_LABELS = Object.freeze({
  zl: "ZL", l: "L", r: "R", zr: "ZR", up: "UP", down: "DOWN", left: "LEFT", right: "RIGHT",
  a: "A", b: "B", x: "X", y: "Y", select: "SELECT", start: "START"
});
const LONG_LIST_OPTIONS = Object.freeze(Array.from({ length: 30 }, (_, index) => `リスト項目${String(index + 1).padStart(2, "0")}`));

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

function easeOutCubic(progress) {
  const value = clamp(progress, 0, 1);
  return 1 - Math.pow(1 - value, 3);
}

function mix(from, to, progress) {
  return from + (to - from) * progress;
}

function formatHotkeyButtons(buttons) {
  const selected = new Set(buttons);
  return HOTKEY_BUTTON_ORDER.filter((button) => selected.has(button)).map((button) => HOTKEY_BUTTON_LABELS[button]).join("+") || "なし";
}

function hotkeyButtons(hotkey) {
  if (!hotkey || hotkey === "なし") return [];
  const labels = new Map(Object.entries(HOTKEY_BUTTON_LABELS).map(([button, label]) => [label, button]));
  const selected = new Set(String(hotkey).split("+").map((label) => labels.get(label.toUpperCase())).filter(Boolean));
  return HOTKEY_BUTTON_ORDER.filter((button) => selected.has(button));
}

function hotkeyMatches(hotkey, heldControls) {
  const buttons = hotkeyButtons(hotkey);
  return buttons.length > 0 && buttons.length === heldControls.size && buttons.every((button) => heldControls.has(button));
}

function selectionPulse(now) {
  return 0.48 + 0.07 * Math.sin((Math.PI * 2 * now) / MENU.pulseDuration);
}

function selectionOutlinePulse(now) {
  return clamp(0.7 + 0.2 * Math.sin((Math.PI * 2 * now) / MENU.pulseDuration), 0.5, 0.9);
}

function scrollTarget(index, itemCount, visibleRows) {
  return clamp(index - Math.floor(visibleRows / 2), 0, Math.max(0, itemCount - visibleRows));
}

function createListboxAnimation(now, selected, itemCount, visibleRows) {
  const initialScroll = scrollTarget(selected, itemCount, visibleRows);
  return {
    animationFrom: 0, animationTarget: 1, animationStartedAt: now, animationDuration: LISTBOX.animationDuration, closing: false,
    visibleRows, scrollFrom: initialScroll, scrollTarget: initialScroll, scrollStartedAt: now
  };
}

function listboxAmount(listbox, now) {
  if (!listbox) return 0;
  if (listbox.animationDuration <= 0) return listbox.animationTarget;
  const progress = easeOutCubic((now - listbox.animationStartedAt) / listbox.animationDuration);
  return mix(listbox.animationFrom, listbox.animationTarget, progress);
}

function closeListbox(listbox, now) {
  if (!listbox || listbox.closing) return;
  const current = listboxAmount(listbox, now);
  listbox.animationFrom = current;
  listbox.animationTarget = 0;
  listbox.animationStartedAt = now;
  listbox.animationDuration = LISTBOX.animationDuration * current;
  listbox.closing = true;
}

function listboxExitComplete(listbox, now) {
  return listbox && listbox.closing && now - listbox.animationStartedAt >= listbox.animationDuration;
}

function createBottomOverlayAnimation(now) {
  return { animationFrom: 0, animationTarget: 1, animationStartedAt: now, animationDuration: BOTTOM_OVERLAY.animationDuration, closing: false };
}

function bottomOverlayAmount(overlay, now) {
  if (!overlay || overlay.screen !== "bottom" || ["listbox", "text"].includes(overlay.type)) return 0;
  if (overlay.animationDuration <= 0) return overlay.animationTarget;
  return mix(overlay.animationFrom, overlay.animationTarget, easeOutCubic((now - overlay.animationStartedAt) / overlay.animationDuration));
}

function closeBottomOverlay(overlay, now) {
  if (!overlay || overlay.screen !== "bottom" || ["listbox", "text"].includes(overlay.type) || overlay.closing) return false;
  const current = bottomOverlayAmount(overlay, now);
  overlay.animationFrom = current;
  overlay.animationTarget = 0;
  overlay.animationStartedAt = now;
  overlay.animationDuration = BOTTOM_OVERLAY.animationDuration * current;
  overlay.closing = true;
  return true;
}

function bottomOverlayExitComplete(overlay, now) {
  return overlay && overlay.screen === "bottom" && !["listbox", "text"].includes(overlay.type) &&
    overlay.closing && now - overlay.animationStartedAt >= overlay.animationDuration;
}

function createTextKeyboardAnimation(now) {
  return { animationFrom: 0, animationTarget: 1, animationStartedAt: now, animationDuration: TEXT_KEYBOARD.animationDuration, closing: false };
}

function textKeyboardAmount(overlay, now) {
  if (!overlay || overlay.type !== "text") return 0;
  if (overlay.animationDuration <= 0) return overlay.animationTarget;
  const progress = easeOutCubic((now - overlay.animationStartedAt) / overlay.animationDuration);
  return mix(overlay.animationFrom, overlay.animationTarget, progress);
}

function closeTextKeyboard(overlay, now) {
  if (!overlay || overlay.type !== "text" || overlay.closing) return;
  const current = textKeyboardAmount(overlay, now);
  overlay.animationFrom = current;
  overlay.animationTarget = 0;
  overlay.animationStartedAt = now;
  overlay.animationDuration = TEXT_KEYBOARD.animationDuration * current;
  overlay.closing = true;
}

function textKeyboardExitComplete(overlay, now) {
  return overlay && overlay.type === "text" && overlay.closing && now - overlay.animationStartedAt >= overlay.animationDuration;
}

function createDialog(type, now) {
  const definition = DIALOG_DEFINITIONS[type];
  if (!definition) return null;
  return {
    type, title: definition.title, options: definition.options, index: 0, outcome: null,
    animationFrom: 0, animationTarget: 1, animationStartedAt: now, animationDuration: DIALOG.animationDuration, closing: false
  };
}

function dialogAmount(dialog, now) {
  if (!dialog) return 0;
  if (dialog.animationDuration <= 0) return dialog.animationTarget;
  return mix(dialog.animationFrom, dialog.animationTarget, easeOutCubic((now - dialog.animationStartedAt) / dialog.animationDuration));
}

function closeDialogAnimation(dialog, outcome, now) {
  if (!dialog || dialog.closing) return false;
  const current = dialogAmount(dialog, now);
  dialog.outcome = outcome;
  dialog.animationFrom = current;
  dialog.animationTarget = 0;
  dialog.animationStartedAt = now;
  dialog.animationDuration = DIALOG.animationDuration * current;
  dialog.closing = true;
  return true;
}

function dialogExitComplete(dialog, now) {
  return dialog && dialog.closing && now - dialog.animationStartedAt >= dialog.animationDuration;
}

function listboxScrollPosition(listbox, now) {
  if (!listbox) return 0;
  const progress = easeOutCubic((now - listbox.scrollStartedAt) / LISTBOX.scrollDuration);
  return mix(listbox.scrollFrom, listbox.scrollTarget, progress);
}

function moveListboxSelection(listbox, direction, now, itemCount, allowWrap = true) {
  const nextIndex = listbox.index + direction;
  if (!allowWrap && (nextIndex < 0 || nextIndex >= itemCount)) return false;
  listbox.scrollFrom = listboxScrollPosition(listbox, now);
  listbox.index = (nextIndex + itemCount) % itemCount;
  listbox.scrollTarget = scrollTarget(listbox.index, itemCount, listbox.visibleRows);
  listbox.scrollStartedAt = now;
  return true;
}

class ControlRepeater {
  constructor(dispatch) {
    this.dispatch = dispatch;
    this.held = new Map();
  }

  press(key, now) {
    if (this.held.has(key)) return;
    this.held.set(key, {
      repeatable: ["up", "down", "left", "right"].includes(key),
      nextAt: now + CONTROL_REPEAT.delay
    });
    this.dispatch(key, now, true, false);
  }

  release(key, now) {
    if (!this.held.has(key)) return;
    this.held.delete(key);
    this.dispatch(key, now, false, false);
  }

  releaseAll(now) {
    for (const key of [...this.held.keys()]) this.release(key, now);
  }

  update(now) {
    for (const [key, state] of this.held) {
      if (!state.repeatable) continue;
      while (now >= state.nextAt) {
        this.dispatch(key, state.nextAt, true, true);
        state.nextAt += CONTROL_REPEAT.interval;
      }
    }
  }
}

class NotificationTimeline {
  constructor() {
    this.items = [];
    this.nextId = 1;
    this.lastScheduledAt = Number.NEGATIVE_INFINITY;
  }

  add(now, title = "CHEAT ENABLED", message = "歩行速度アップを有効にしました") {
    this.prune(now);
    const scheduledAt = Math.max(now, this.lastScheduledAt + NOTICE.spawnInterval);
    this.lastScheduledAt = scheduledAt;
    if (this.items.length >= NOTICE.maximum) this.items.shift();
    for (const item of this.items) {
      item.moveFromY = this.getY(item, scheduledAt);
      item.targetY -= NOTICE.height + NOTICE.gap;
      item.moveStartedAt = scheduledAt;
    }
    const bottomY = SCREEN.height - NOTICE.margin - NOTICE.height;
    const item = { id: this.nextId++, title, message, createdAt: scheduledAt, moveStartedAt: scheduledAt, moveFromY: bottomY, targetY: bottomY };
    this.items.push(item);
    return item;
  }

  clear() { this.items.length = 0; this.lastScheduledAt = Number.NEGATIVE_INFINITY; }
  getY(item, now) { return mix(item.moveFromY, item.targetY, easeOutCubic((now - item.moveStartedAt) / NOTICE.enterDuration)); }

  getX(item, now) {
    const targetX = SCREEN.width - NOTICE.margin - NOTICE.width;
    const age = now - item.createdAt;
    if (age < NOTICE.enterDuration) return mix(SCREEN.width, targetX, easeOutCubic(age / NOTICE.enterDuration));
    const exitStartedAt = NOTICE.enterDuration + NOTICE.holdDuration;
    if (age < exitStartedAt) return targetX;
    return mix(targetX, SCREEN.width, easeOutCubic((age - exitStartedAt) / NOTICE.exitDuration));
  }

  isAlive(item, now) { return now - item.createdAt < NOTICE.enterDuration + NOTICE.holdDuration + NOTICE.exitDuration; }
  prune(now) { this.items = this.items.filter((item) => this.isAlive(item, now)); }
  sample(now) {
    this.prune(now);
    return this.items
      .filter((item) => item.createdAt <= now)
      .map((item) => ({ id: item.id, title: item.title, message: item.message, x: this.getX(item, now), y: this.getY(item, now) }));
  }
}

let nextItemId = 1;

function item(type, label, description, options = {}) {
  const result = { id: `item-${nextItemId++}`, type, label, description, hotkey: "なし", appliedHotkey: "なし", ...options };
  if (Object.hasOwn(result, "value")) {
    result.appliedValue = result.value;
  }
  // CTRPF移植時も「項目の適用値」と「関数内の効果状態」は別フィールドで持つ。
  // ホットキーで変わるのは effectActive 側で、appliedValue はメニュー適用でしか変えない。
  if (result.type === "checkbox" && result.effectKind) result.effectActive = Boolean(result.effectActive);
  return result;
}

function numberedLabel(prefix, index) {
  return `${prefix}${String(index + 1).padStart(2, "0")}`;
}

function assignFavoriteKeys(items, parentPath = "") {
  for (const entry of items) {
    const path = parentPath ? `${parentPath}/${entry.label}` : entry.label;
    entry.favoriteKey = path;
    if (entry.children) assignFavoriteKeys(entry.children, path);
  }
}

function createMenuTree() {
  nextItemId = 1;
  const scrollTestItems = Array.from({ length: 24 }, (_, index) => item(
    "checkbox", numberedLabel("スクロール項目", index), "多数の項目を移動した時のスクロールを確認します。", { value: index % 3 === 0 }
  ));
  const additionalItems = Array.from({ length: 12 }, (_, index) => item(
    "checkbox", numberedLabel("追加チート", index), "ルートメニューのスクロール確認用項目です。", { value: false }
  ));
  const root = [
    item("folder", "プレイヤー", "プレイヤー関連のチートを開きます。", { children: [
      item("checkbox", "無敵モード", "ダメージを受けなくなります。", { value: false, effectKind: "toggle" }),
      item("checkbox", "壁抜け", "当たり判定を無効にします。", { value: false, effectKind: "toggle" }),
      item("action", "名前を変更", "下画面に五十音順キーボードを開きます。", { action: "text-keyboard" })
    ] }),
    item("checkbox", "歩行速度アップ", "移動速度の変更を有効にします。", { value: false }),
    item("action", "セーブ実行", "UIを変更せずセーブ関数だけを呼び出します。", { action: "save" }),
    item("list", "天候", "項目の位置にリストを展開して天候を選択します。", { options: ["晴れ", "雨", "雪"], value: 0 }),
    item("folder", "数値設定", "数値入力とスライダーのサンプルです。", { children: [
      item("value", "所持ベル", "10進数で入力します。左右で100ずつ変更します。", { format: "dec", value: 1000, minimum: 0, maximum: 99999, step: 100 }),
      item("value", "アイテムID", "16進数で入力します。左右で1ずつ変更します。", { format: "hex", value: 0x2001, minimum: 0, maximum: 0xFFFF, step: 1 }),
      item("value", "移動速度", "float値です。左右で0.1ずつ変更します。", { format: "float", value: 1.0, minimum: 0.1, maximum: 5.0, step: 0.1 }),
      item("slider", "通知時間", "下画面の横向きスライダーで変更します。", { format: "float", value: 3.0, minimum: 1.0, maximum: 8.0, step: 0.5 })
    ] }),
    item("folder", "UIテスト", "自前UI関数の表示サンプルです。", { children: [
      item("action", "上画面リスト", "上画面へ汎用リストボックスを開きます。", { action: "top-listbox" }),
      item("action", "下画面リスト", "下画面へ汎用リストボックスを開きます。", { action: "bottom-listbox" }),
      item("action", "文字キーボード", "五十音順とQWERTYを切り替えられます。", { action: "text-keyboard" }),
      item("action", "小型文字キーボード", "小さい文字キーボードを開きます。", { action: "compact-text-keyboard" }),
      item("linked-value", "連動型数値", "メニューを開いた時にゲームの値を取得し、適用時に設定する連動型です。", { format: "dec", value: 1250, linkedValue: 1250, linkedAvailable: true, minimum: 0, maximum: 99999, step: 50 }),
      item("linked-list", "連動型リスト", "メニューを開いた時にゲームの値を取得し、適用時に設定する連動型です。", { options: ["晴れ", "雨", "雪"], value: 0, linkedValue: 0, linkedAvailable: true }),
      item("toggle-action", "トグル型アクション", "ONにして適用すると一度実行してOFFへ戻ります。ホットキーでは確認します。", { value: false })
    ] }),
    item("list", "大量リスト", "多数のリスト項目をインライン表示してスクロールを確認します。", { options: [...LONG_LIST_OPTIONS], value: 0 }),
    item("folder", "スクロールテスト", "多数のチート項目を表示してスクロールを確認します。", { children: scrollTestItems }),
    item("checkbox", "しずえスキップ", "しずえの会話を飛ばして村へ出ます。起動時の一括処理を先に実行します。", { value: false, simulateTick: true }),
    item("action", "チャット漢字候補", "チャットの入力から漢字候補を取得し下画面に表示します。", { action: "chat-kanji" }),
    ...additionalItems
  ];
  assignFavoriteKeys(root);
  return root;
}

function isDirty(entry) {
  const valueChanged = Object.hasOwn(entry, "value") && entry.value !== entry.appliedValue;
  return valueChanged || entry.hotkey !== entry.appliedHotkey;
}

function walkItems(items, callback) {
  for (const entry of items) {
    callback(entry);
    if (entry.children) walkItems(entry.children, callback);
  }
}

function formatValue(entry, now = 0) {
  if (entry.type === "checkbox") return entry.value ? "ON" : "OFF";
  if (entry.type === "toggle-action") {
    if ((entry.executionFeedbackUntil || 0) > now) return "OK";
    return entry.value ? "ON" : "OFF";
  }
  if (entry.type === "list" || entry.type === "linked-list") return entry.options[entry.value];
  if (entry.format === "hex") return `0x${Math.round(entry.value).toString(16).toUpperCase().padStart(4, "0")}`;
  if (entry.format === "float") return Number(entry.value).toFixed(1);
  if (["value", "slider", "linked-value"].includes(entry.type)) return String(Math.round(entry.value));
  return "";
}

function numericKeys(mode, allowFloat) {
  return [
    ["7", "8", "9", "A"],
    ["4", "5", "6", "B"],
    ["1", "2", "3", "C"],
    ["0", "D", "E", "F"],
    ["SIGN", ".", mode === "hex" ? "DEC" : "HEX", "BS"],
    ["CANCEL", "OK"]
  ];
}

function numericKeyEnabled(overlay, key) {
  if (!overlay || overlay.type !== "numeric") return false;
  if (/^[A-F]$/.test(key)) return overlay.mode === "hex";
  if (key === ".") return overlay.mode === "dec" && overlay.item.format === "float";
  if (key === "SIGN") return overlay.mode === "dec" && overlay.item.minimum < 0;
  if (key === "HEX") return overlay.mode === "dec" && overlay.item.format !== "float";
  if (key === "DEC") return overlay.mode === "hex";
  return key !== "";
}

const KANA_COMMON_KEYS = Object.freeze([
  "DAKUTEN", "HANDAKUTEN", "SMALL", "HIRAGANA", "KATAKANA", "BS", "ENTER", "LONG", "SPACE",
  "ABC", "AIU", "SYMBOL", "PHONE", "CANCEL", "CONFIRM"
]);
const ABC_COMMON_KEYS = Object.freeze([
  "CAPS", "SHIFT", "SPACE", "BLANK", "HIRAGANA", "KATAKANA", "BS", "ENTER",
  "ABC", "AIU", "SYMBOL", "PHONE", "CANCEL", "CONFIRM"
]);

function textKeys(mode) {
  if (mode === "abc") return [
    Array.from("1234567890-"),
    Array.from("qwertyuiop"),
    ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'", "\\"],
    ["z", "x", "c", "v", "b", "n", "m", ",", ".", "/", "=", "@"],
    [...ABC_COMMON_KEYS]
  ];
  return [
    Array.from("わらやまはなたさかあ"),
    Array.from("をりゆみひにちしきい"),
    Array.from("んるよむふぬつすくう"),
    ["、", "れ", "！", "め", "へ", "ね", "て", "せ", "け", "え"],
    ["。", "ろ", "？", "も", "ほ", "の", "と", "そ", "こ", "お"],
    [...KANA_COMMON_KEYS]
  ];
}

function appendDistributedTextRow(layout, keys, row, startX, endX, y, height) {
  keys.forEach((key, column) => {
    const x = Math.round(mix(startX, endX, column / keys.length));
    const nextX = Math.round(mix(startX, endX, (column + 1) / keys.length));
    layout.push({ key, row, column, x, y, width: nextX - x - 1, height });
  });
}

function textKeyLayout(mode, compact = false) {
  const rows = textKeys(mode);
  const layout = [];
  const centralRows = rows.slice(0, -1);
  if (compact) {
    if (mode === "abc") {
      appendDistributedTextRow(layout, centralRows[0], 0, 28, 243, 69, 17);
      appendDistributedTextRow(layout, centralRows[1], 1, 28, 243, 88, 17);
      appendDistributedTextRow(layout, centralRows[2], 2, 28, 292, 107, 17);
      appendDistributedTextRow(layout, centralRows[3], 3, 28, 292, 126, 17);
    } else {
      centralRows.forEach((row, rowIndex) => row.forEach((key, column) => layout.push({
        key, row: rowIndex, column, x: 62 + column * 18, y: 69 + rowIndex * 19, width: 17, height: 17
      })));
    }

    const commonRow = rows.length - 1;
    const compactModeRects = mode === "abc" ? [
      ["CAPS", 28, 145, 40, 17], ["SHIFT", 69, 145, 51, 17], ["SPACE", 121, 145, 78, 17],
      ["BLANK", 200, 145, 24, 17], ["HIRAGANA", 225, 145, 29, 17], ["KATAKANA", 255, 145, 37, 17],
      ["BS", 243, 69, 49, 17], ["ENTER", 243, 88, 49, 17]
    ] : [
      ["DAKUTEN", 28, 69, 32, 17], ["HANDAKUTEN", 28, 88, 32, 17], ["SMALL", 28, 107, 32, 17],
      ["HIRAGANA", 28, 126, 32, 17], ["KATAKANA", 28, 145, 32, 17],
      ["BS", 243, 69, 49, 17], ["ENTER", 243, 88, 49, 36], ["LONG", 243, 126, 49, 17], ["SPACE", 243, 145, 49, 17]
    ];
    const compactCommonRects = [
      ...compactModeRects,
      ["ABC", 28, 164, 55, 17], ["AIU", 84, 164, 65, 17], ["SYMBOL", 150, 164, 63, 17], ["PHONE", 214, 164, 78, 17],
      ["CANCEL", 28, 184, 91, 21], ["CONFIRM", 120, 184, 172, 21]
    ];
    const commonKeys = mode === "abc" ? ABC_COMMON_KEYS : KANA_COMMON_KEYS;
    compactCommonRects.forEach(([key, x, y, width, height]) => layout.push({
      key, row: commonRow, column: commonKeys.indexOf(key), x, y, width, height
    }));
    return layout;
  }

  if (mode === "abc") {
    appendDistributedTextRow(layout, centralRows[0], 0, 3, 260, 68, 21);
    appendDistributedTextRow(layout, centralRows[1], 1, 3, 260, 91, 21);
    appendDistributedTextRow(layout, centralRows[2], 2, 3, 318, 114, 21);
    appendDistributedTextRow(layout, centralRows[3], 3, 3, 318, 137, 21);
  } else {
    centralRows.forEach((row, rowIndex) => row.forEach((key, column) => layout.push({
      key, row: rowIndex, column, x: 39 + column * 22, y: 68 + rowIndex * 23, width: 21, height: 21
    })));
  }

  const commonRow = rows.length - 1;
  const modeRects = mode === "abc" ? [
    ["CAPS", 3, 160, 48, 21], ["SHIFT", 52, 160, 60, 21], ["SPACE", 113, 160, 99, 21],
    ["BLANK", 213, 160, 32, 21], ["HIRAGANA", 246, 160, 33, 21], ["KATAKANA", 280, 160, 37, 21],
    ["BS", 260, 68, 57, 21], ["ENTER", 260, 91, 57, 21]
  ] : [
    ["DAKUTEN", 3, 68, 35, 21], ["HANDAKUTEN", 3, 91, 35, 21], ["SMALL", 3, 114, 35, 21],
    ["HIRAGANA", 3, 137, 35, 21], ["KATAKANA", 3, 160, 35, 21],
    ["BS", 260, 68, 57, 21], ["ENTER", 260, 91, 57, 44], ["LONG", 260, 137, 57, 21], ["SPACE", 260, 160, 57, 21]
  ];
  const commonRects = [
    ...modeRects,
    ["ABC", 3, 183, 68, 21], ["AIU", 72, 183, 88, 21], ["SYMBOL", 161, 183, 75, 21], ["PHONE", 237, 183, 80, 21],
    ["CANCEL", 3, 211, 116, 24], ["CONFIRM", 121, 211, 196, 24]
  ];
  const commonKeys = mode === "abc" ? ABC_COMMON_KEYS : KANA_COMMON_KEYS;
  commonRects.forEach(([key, x, y, width, height]) => layout.push({
    key, row: commonRow, column: commonKeys.indexOf(key), x, y, width, height
  }));
  return layout;
}

const DAKUTEN_TRANSFORMS = Object.freeze(Object.fromEntries(Array.from(
  "かがきぎくぐけげこごさざしじすずせぜそぞただちぢつづてでとどはばひびふぶへべほぼ" +
  "カガキギクグケゲコゴサザシジスズセゼソゾタダチヂツヅテデトドハバヒビフブヘベホボウヴ"
).reduce((pairs, character, index, characters) => {
  if (index % 2 === 0) pairs.push([character, characters[index + 1]]);
  return pairs;
}, [])));

const HANDAKUTEN_TRANSFORMS = Object.freeze(Object.fromEntries(Array.from(
  "はぱひぴふぷへぺほぽハパヒピフプヘペホポ"
).reduce((pairs, character, index, characters) => {
  if (index % 2 === 0) pairs.push([character, characters[index + 1]]);
  return pairs;
}, [])));

const SMALL_TRANSFORMS = Object.freeze(Object.fromEntries(Array.from(
  "あぁいぃうぅえぇおぉつっやゃゆゅよょわゎ" +
  "アァイィウゥエェオォツッヤャユュヨョワヮ"
).reduce((pairs, character, index, characters) => {
  if (index % 2 === 0) pairs.push([character, characters[index + 1]]);
  return pairs;
}, [])));

const TEXT_TRANSFORMS = Object.freeze({
  DAKUTEN: DAKUTEN_TRANSFORMS,
  HANDAKUTEN: HANDAKUTEN_TRANSFORMS,
  SMALL: SMALL_TRANSFORMS
});

const TEXT_VARIANT_BASES = Object.freeze(Object.fromEntries(
  Object.values(TEXT_TRANSFORMS).flatMap((transforms) =>
    Object.entries(transforms).map(([base, variant]) => [variant, base])
  )
));

function toKatakana(text) {
  return Array.from(String(text), (character) => {
    const codepoint = character.codePointAt(0);
    return codepoint >= 0x3041 && codepoint <= 0x3096 ? String.fromCodePoint(codepoint + 0x60) : character;
  }).join("");
}

function textCursor(overlay) {
  const length = Array.from(overlay && overlay.value || "").length;
  return clamp(Number.isInteger(overlay && overlay.cursor) ? overlay.cursor : length, 0, length);
}

function transformBeforeCursor(overlay, key, apply = false) {
  const transforms = TEXT_TRANSFORMS[key];
  if (!overlay || overlay.type !== "text" || !transforms) return false;
  const characters = Array.from(overlay.value);
  const cursor = textCursor(overlay);
  const current = cursor > 0 ? characters[cursor - 1] : null;
  const base = TEXT_VARIANT_BASES[current] || current;
  const target = transforms[base];
  if (!target) return false;
  if (apply) {
    characters[cursor - 1] = current === target ? base : target;
    overlay.value = characters.join("");
    overlay.cursor = cursor;
  }
  return true;
}

function textKeyEnabled(overlay, key) {
  if (!overlay || overlay.type !== "text") return false;
  if (TEXT_TRANSFORMS[key]) return transformBeforeCursor(overlay, key);
  if (key === "HIRAGANA" || key === "KATAKANA") return overlay.mode === "kana";
  return !["ENTER", "BLANK", "SYMBOL", "PHONE"].includes(key);
}

class CheatMenuModel {
  constructor(emit = () => {}, execute = null) {
    this.rootItems = createMenuTree();
    this.frames = [{ title: "ROOT", items: this.rootItems, selection: 0 }];
    this.emit = emit;
    this.execute = typeof execute === "function" ? execute : (entry, now) => {
      entry.executionCount = (entry.executionCount || 0) + 1;
      entry.lastExecutedAt = now;
    };
    this.visible = false;
    this.openTarget = 0;
    this.openFrom = 0;
    this.openStartedAt = 0;
    this.inlineList = null;
    this.overlay = null;
    this.dialog = null;
    this.playerName = "PLAYER";
    this.selectionFrom = 0;
    this.selectionTo = 0;
    this.selectionStartedAt = 0;
    this.viewportFrom = 0;
    this.viewportTarget = 0;
    this.viewportStartedAt = 0;
    this.valueBounceDirection = 0;
    this.valueBounceStartedAt = Number.NEGATIVE_INFINITY;
    this.activationBounceStartedAt = Number.NEGATIVE_INFINITY;
    this.selectionBoundaryBounceDirection = 0;
    this.selectionBoundaryBounceStartedAt = Number.NEGATIVE_INFINITY;
    this.selectionBoundaryBlockedDirection = 0;
    this.heldControls = new Set();
    this.activeHotkeyItems = new Set();
    this.holdAction = null;
    this.favoriteKeys = new Set();
  }

  currentFrame() { return this.frames[this.frames.length - 1]; }
  selectedItem() { return this.currentFrame().items[this.currentFrame().selection]; }

  favoriteItems() {
    const entries = [];
    walkItems(this.rootItems, (entry) => {
      if (this.favoriteKeys.has(entry.favoriteKey)) entries.push(entry);
    });
    return entries;
  }

  isFavorite(entry) {
    return Boolean(entry?.favoriteKey && this.favoriteKeys.has(entry.favoriteKey));
  }

  favoriteKeysArray() {
    return [...this.favoriteKeys];
  }

  restoreFavorites(keys = [], now = 0) {
    const validKeys = new Set();
    walkItems(this.rootItems, (entry) => validKeys.add(entry.favoriteKey));
    this.favoriteKeys = new Set((Array.isArray(keys) ? keys : []).filter((key) => validKeys.has(key)));
    if (this.currentFrame().kind === "favorites") {
      const items = this.favoriteItems();
      if (!items.length && this.frames.length > 1) this.frames.pop();
      else {
        this.currentFrame().items = items;
        this.currentFrame().selection = clamp(this.currentFrame().selection, 0, Math.max(0, items.length - 1));
      }
      this.resetSelectionAnimation(now);
    }
    return this.favoriteKeys.size;
  }

  toggleFavorite(entry = this.selectedItem(), now = 0) {
    if (!entry?.favoriteKey) return false;
    const removing = this.favoriteKeys.has(entry.favoriteKey);
    if (removing) this.favoriteKeys.delete(entry.favoriteKey);
    else this.favoriteKeys.add(entry.favoriteKey);
    this.emit("FAVORITES", `${removing ? "REMOVE" : "ADD"}: ${entry.label}`);

    if (this.currentFrame().kind === "favorites") {
      const items = this.favoriteItems();
      if (!items.length && this.frames.length > 1) {
        this.frames.pop();
      } else {
        const frame = this.currentFrame();
        frame.items = items;
        frame.selection = clamp(frame.selection, 0, Math.max(0, items.length - 1));
      }
      this.resetSelectionAnimation(now);
    }
    return true;
  }

  openFavorites(now = 0) {
    const items = this.favoriteItems();
    if (!items.length) {
      this.emit("FAVORITES", "NO ITEMS");
      return false;
    }
    if (this.currentFrame().kind === "favorites") return true;
    this.frames.push({ title: "FAVORITES", items, selection: 0, kind: "favorites" });
    this.resetSelectionAnimation(now);
    return true;
  }

  selectionPosition(now) {
    const progress = easeOutCubic((now - this.selectionStartedAt) / MENU.selectionMoveDuration);
    return mix(this.selectionFrom, this.selectionTo, progress);
  }

  viewportStart(now) {
    const progress = easeOutCubic((now - this.viewportStartedAt) / MENU.scrollDuration);
    return mix(this.viewportFrom, this.viewportTarget, progress);
  }

  viewportTargetFor(selection = this.currentFrame().selection) {
    return scrollTarget(selection, this.currentFrame().items.length, MENU.visibleRows);
  }

  normalizeSelection() {
    const frame = this.currentFrame();
    if (!frame.items[frame.selection]?.disabled) return;
    const next = frame.items.findIndex((entry) => !entry.disabled);
    if (next >= 0) frame.selection = next;
  }

  resetSelectionAnimation(now) {
    this.normalizeSelection();
    const selection = this.currentFrame().selection;
    this.selectionFrom = selection;
    this.selectionTo = selection;
    this.selectionStartedAt = now;
    this.viewportFrom = this.viewportTargetFor(selection);
    this.viewportTarget = this.viewportFrom;
    this.viewportStartedAt = now;
    this.selectionBoundaryBlockedDirection = 0;
  }

  moveSelection(direction, now, allowWrap = true) {
    const frame = this.currentFrame();
    const previous = frame.selection;
    let next = previous;
    for (let attempt = 0; attempt < frame.items.length; attempt++) {
      let candidate = next + direction;
      if (!allowWrap && (candidate < 0 || candidate >= frame.items.length)) {
        if (this.selectionBoundaryBlockedDirection !== direction) {
          this.selectionBoundaryBounceDirection = direction;
          this.selectionBoundaryBounceStartedAt = now;
          this.selectionBoundaryBlockedDirection = direction;
        }
        return false;
      }
      candidate = (candidate + frame.items.length) % frame.items.length;
      next = candidate;
      if (!frame.items[next].disabled) break;
    }
    if (next === previous || frame.items[next].disabled) return false;
    this.selectionBoundaryBlockedDirection = 0;
    this.viewportFrom = this.viewportStart(now);
    this.viewportTarget = scrollTarget(next, frame.items.length, MENU.visibleRows);
    this.viewportStartedAt = now;
    this.selectionFrom = this.selectionPosition(now);
    this.selectionTo = next;
    this.selectionStartedAt = now;
    frame.selection = next;
    return true;
  }

  selectionBounceOffset(now) {
    const elapsed = now - this.valueBounceStartedAt;
    if (elapsed < 0 || elapsed >= MENU.valueBounceDuration) return 0;
    const progress = elapsed / MENU.valueBounceDuration;
    const amount = progress < 0.28
      ? easeOutCubic(progress / 0.28)
      : 1 - easeOutCubic((progress - 0.28) / 0.72);
    return this.valueBounceDirection * 4 * amount;
  }

  activationBounceOffset(now) {
    const elapsed = now - this.activationBounceStartedAt;
    if (elapsed < 0 || elapsed >= MENU.activationBounceDuration) return 0;
    const progress = elapsed / MENU.activationBounceDuration;
    const amount = progress < 0.3
      ? easeOutCubic(progress / 0.3)
      : 1 - easeOutCubic((progress - 0.3) / 0.7);
    return 3 * amount;
  }

  selectionBoundaryBounceOffset(now) {
    const elapsed = now - this.selectionBoundaryBounceStartedAt;
    if (elapsed < 0 || elapsed >= MENU.selectionMoveDuration) return 0;
    const progress = elapsed / MENU.selectionMoveDuration;
    const amount = progress < 0.28
      ? easeOutCubic(progress / 0.28)
      : 1 - easeOutCubic((progress - 0.28) / 0.72);
    return amount === 0 ? 0 : this.selectionBoundaryBounceDirection * 4 * amount;
  }

  openAmount(now) {
    const progress = easeOutCubic((now - this.openStartedAt) / MENU.enterDuration);
    return mix(this.openFrom, this.openTarget, progress);
  }

  animateTo(target, now) {
    this.openFrom = this.openAmount(now);
    this.openTarget = target;
    this.openStartedAt = now;
    if (target === 1) this.visible = true;
  }

  syncLinkedItems() {
    walkItems(this.rootItems, (entry) => {
      if (!["linked-value", "linked-list"].includes(entry.type)) return;
      // CTRPF移植時はここを「メニューを開いた瞬間のゲームメモリ読取」に置き換える。
      // 読取失敗時は誤値を編集させないため disabled にする。
      if (entry.linkedAvailable === false || !Number.isFinite(Number(entry.linkedValue))) {
        entry.disabled = true;
        return;
      }
      entry.disabled = false;
      entry.value = entry.linkedValue;
      entry.appliedValue = entry.linkedValue;
    });
  }

  open(now) {
    // メニュー外ホットキーで開いたトグル型アクション確認は、メニューを開いても維持する。
    // 描画側が menu.openAmount() に追従させることで、中央からメニュー右側へそのまま退避する。
    if (this.dialog?.type !== "toggle-action-hotkey") this.dialog = null;
    this.holdAction = null;
    this.syncLinkedItems();
    this.resetSelectionAnimation(now);
    this.animateTo(1, now);
  }

  close(now) {
    if (this.inlineList) closeListbox(this.inlineList, now);
    if (this.overlay && this.overlay.type === "listbox") {
      // 上画面リストはメニュー本体とは独立した操作UIとして維持する。
      // メニューを閉じる時はリスト自体を閉じず、描画側で openAmount() に追従して中央へ戻す。
      // 下画面リストだけは従来どおりメニュー閉鎖と同時に退場させる。
      if (this.overlay.screen === "bottom") closeListbox(this.overlay, now);
    }
    else if (this.overlay && this.overlay.type === "text") closeTextKeyboard(this.overlay, now);
    else if (this.overlay && this.overlay.screen === "bottom") closeBottomOverlay(this.overlay, now);
    else this.overlay = null;
    if (this.dirtyCount() > 0) {
      this.openDialog("close", now);
      return false;
    }
    this.beginClose(now);
    return true;
  }

  beginClose(now) {
    // トグル型アクション確認はメニュー本体とは独立したモーダルUIなので、
    // メニューを閉じても破棄せず、描画側で中央位置へ戻す。
    if (this.dialog?.type !== "toggle-action-hotkey") this.dialog = null;
    this.holdAction = null;
    this.animateTo(0, now);
  }

  update(now) {
    this.updateHoldAction(now);
    this.executeActiveCheckboxes(now);
    if (this.openTarget === 0 && this.openAmount(now) <= 0.001) this.visible = false;
    if (listboxExitComplete(this.inlineList, now)) this.inlineList = null;
    if (this.overlay && this.overlay.type === "listbox" && listboxExitComplete(this.overlay, now)) this.overlay = null;
    if (textKeyboardExitComplete(this.overlay, now)) this.overlay = null;
    if (bottomOverlayExitComplete(this.overlay, now)) this.overlay = null;
    if (dialogExitComplete(this.dialog, now)) {
      const dialog = this.dialog;
      this.dialog = null;
      if (dialog.outcome === "confirm") {
        if (dialog.type === "close") {
          this.applyAll(now);
          this.beginClose(now);
        }
        else if (dialog.type === "apply-all") this.applyAll(now);
        else if (dialog.type === "revert-all") this.discardAll();
        else if (dialog.type === "toggle-action-hotkey" && dialog.item) this.executeToggleAction(dialog.item, now);
      }
    }
  }

  executeActiveCheckboxes(now) {
    walkItems(this.rootItems, (entry) => {
      if (entry.type === "checkbox" && entry.appliedValue === true && entry.simulateTick) this.execute(entry, now);
    });
  }

  setCheckboxEffect(entry, active, now = 0) {
    if (!entry || entry.type !== "checkbox" || !entry.effectKind) return false;
    const next = Boolean(active);
    if (entry.effectActive === next) return false;
    entry.effectActive = next;
    entry.effectChangeCount = (entry.effectChangeCount || 0) + 1;
    entry.lastEffectChangedAt = now;
    this.execute(entry, now);
    return true;
  }

  commitHotkeyValue(entry, value, now = 0) {
    const changed = entry.appliedValue !== value;
    entry.value = value;
    entry.appliedValue = value;
    if (["linked-value", "linked-list"].includes(entry.type)) entry.linkedValue = value;
    // メニュー外のホットキー入力UIには X 適用操作がないため、確定をそのまま適用として扱う。
    if (changed) this.execute(entry, now);
    return changed;
  }

  executeToggleAction(entry, now = 0) {
    this.execute(entry, now);
    entry.value = false;
    entry.appliedValue = false;
    entry.executionFeedbackUntil = now + TOGGLE_ACTION.feedbackDuration;
    this.emit("ACTION", `${entry.label}を実行しました`);
    return true;
  }

  holdActionProgress(now) {
    if (!this.holdAction) return null;
    return {
      key: this.holdAction.key,
      progress: clamp((now - this.holdAction.startedAt) / MENU.holdDuration, 0, 1),
      label: this.holdAction.key === "x" ? "X 全項目適用" : "L 全項目戻し"
    };
  }

  beginHoldAction(key, now) {
    if (!["x", "l"].includes(key) || this.dirtyCount() === 0) return false;
    this.holdAction = { key, startedAt: now };
    return true;
  }

  triggerLongHold(key, now) {
    this.holdAction = null;
    if (key === "x") return this.openDialog("apply-all", now);
    if (key === "l") return this.openDialog("revert-all", now);
    return false;
  }

  updateHoldAction(now) {
    if (!this.holdAction) return false;
    if (now - this.holdAction.startedAt < MENU.holdDuration) return false;
    return this.triggerLongHold(this.holdAction.key, now);
  }

  finishHoldAction(key, now) {
    if (!this.holdAction || this.holdAction.key !== key) return false;
    const elapsed = now - this.holdAction.startedAt;
    this.holdAction = null;
    if (elapsed >= MENU.holdDuration) return this.triggerLongHold(key, now);
    if (key === "x") this.applyItem(this.selectedItem(), now);
    else if (key === "l") this.discardItem(this.selectedItem());
    return true;
  }

  dirtyCount() {
    let count = 0;
    walkItems(this.rootItems, (entry) => { if (isDirty(entry)) count++; });
    return count;
  }

  commitItem(entry, now = 0) {
    if (!isDirty(entry)) return false;
    const hasValue = Object.hasOwn(entry, "value");
    const valueChanged = hasValue && entry.value !== entry.appliedValue;
    if (hasValue) entry.appliedValue = entry.value;
    entry.appliedHotkey = entry.hotkey;

    if (entry.type === "toggle-action" && valueChanged) {
      if (entry.appliedValue === true) this.executeToggleAction(entry, now);
    }
    else if (entry.type === "checkbox" && valueChanged) {
      if (entry.effectKind) {
        // パッチ/ToggledEffect系のCTRPF実装でも同じ順序にする:
        // ON適用時に束縛なしなら効果ON、束縛ありならアームのみ、OFF適用時は必ず効果OFF。
        this.setCheckboxEffect(entry, entry.appliedValue === true && entry.appliedHotkey === "なし", now);
      }
      this.emit(entry.appliedValue ? "CHEAT ENABLED" : "CHEAT DISABLED", entry.label);
    }
    else if (valueChanged && ["value", "slider", "list", "linked-value", "linked-list"].includes(entry.type)) {
      if (["linked-value", "linked-list"].includes(entry.type)) entry.linkedValue = entry.appliedValue;
      this.execute(entry, now);
    }

    // ホットキー設定だけを適用した場合は effectActive に触れない。
    // これはCTRPF側でも「束縛変更」と「効果のON/OFF」を分離するための契約。
    return true;
  }

  applyItem(entry, now = 0) {
    if (!this.commitItem(entry, now)) return false;
    return true;
  }

  applyAll(now = 0) {
    let count = 0;
    walkItems(this.rootItems, (entry) => {
      if (this.commitItem(entry, now)) count++;
    });
    return count;
  }

  discardItem(entry) {
    if (!entry || !isDirty(entry)) return false;
    if (Object.hasOwn(entry, "value")) entry.value = entry.appliedValue;
    entry.hotkey = entry.appliedHotkey;
    return true;
  }

  discardAll() {
    let count = 0;
    walkItems(this.rootItems, (entry) => {
      if (this.discardItem(entry)) count++;
    });
    return count;
  }

  openDialog(type, now, item = null) {
    if (this.dialog) return false;
    this.dialog = createDialog(type, now);
    if (this.dialog && item) {
      this.dialog.item = item;
      if (type === "toggle-action-hotkey") this.dialog.title = `${item.label}を実行しますか？`;
    }
    return Boolean(this.dialog);
  }

  chooseDialog(outcome, now) {
    if (!this.dialog || this.dialog.closing) return false;
    return closeDialogAnimation(this.dialog, outcome, now);
  }

  changeValue(entry, direction, now) {
    if (!entry || entry.disabled) return false;
    const decimals = entry.format === "float" ? 10 : 1;
    const next = clamp(Math.round((entry.value + direction * entry.step) * decimals) / decimals, entry.minimum, entry.maximum);
    entry.value = next;
    this.valueBounceDirection = direction;
    this.valueBounceStartedAt = now;
  }

  openNumeric(entry, applyOnConfirm = false, now = 0) {
    const mode = entry.format === "hex" ? "hex" : "dec";
    this.overlay = {
      type: "numeric", screen: "bottom", item: entry, mode,
      buffer: mode === "hex" ? Math.round(entry.value).toString(16).toUpperCase() : String(entry.value),
      row: 0, column: 0, applyOnConfirm,
      ...createBottomOverlayAnimation(now)
    };
  }

  openSlider(entry, applyOnConfirm = false, now = 0) {
    this.overlay = {
      type: "slider", screen: "bottom", item: entry, value: entry.value, applyOnConfirm,
      ...createBottomOverlayAnimation(now)
    };
  }

  openTextKeyboard(compact = false, now = 0) {
    this.overlay = {
      type: "text", screen: "bottom", mode: "kana", script: "hiragana", value: this.playerName,
      cursor: Array.from(this.playerName).length, row: 0, column: 0, caps: false, shift: false, compact,
      ...createTextKeyboardAnimation(now)
    };
  }

  openListbox(screen, title, options, onConfirm = null, selected = 0, now = 0) {
    this.overlay = {
      type: "listbox", screen, title, options, index: selected, onConfirm,
      ...createListboxAnimation(now, selected, options.length, LISTBOX.screenVisibleRows)
    };
  }

  runAction(entry, now) {
    this.execute(entry, now);
    if (entry.action === "save") this.emit("ACTION", "セーブ関数を呼び出しました");
    else if (entry.action === "text-keyboard") this.openTextKeyboard(false, now);
    else if (entry.action === "compact-text-keyboard") this.openTextKeyboard(true, now);
    else if (entry.action === "top-listbox") this.openListbox("top", "上画面リスト", [...LONG_LIST_OPTIONS], "generic", 0, now);
    else if (entry.action === "bottom-listbox") this.openListbox("bottom", "下画面リスト", [...LONG_LIST_OPTIONS], "generic", 0, now);
    else if (entry.action === "chat-kanji") this.emit("ACTION", CHAT_KANJI_MESSAGES.hardware);
  }

  activateSelected(now) {
    const entry = this.selectedItem();
    if (!entry || entry.disabled) return false;
    this.activationBounceStartedAt = now;
    if (entry.type === "folder") {
      this.frames.push({ title: entry.label, items: entry.children, selection: 0 });
      this.resetSelectionAnimation(now);
    }
    else if (entry.type === "checkbox" || entry.type === "toggle-action") entry.value = !entry.value;
    else if (entry.type === "action") this.runAction(entry, now);
    else if (entry.type === "list" || entry.type === "linked-list") this.inlineList = {
      item: entry, index: entry.value,
      ...createListboxAnimation(now, entry.value, entry.options.length, LISTBOX.inlineVisibleRows)
    };
    else if (entry.type === "value" || entry.type === "linked-value") this.openNumeric(entry, false, now);
    else if (entry.type === "slider") this.openSlider(entry, false, now);
    return true;
  }

  activateHotkeyItem(entry, now) {
    if (!entry || entry.disabled) return false;
    if (entry.type === "checkbox") {
      if (entry.appliedValue !== true || !entry.effectKind) return false;
      // CTRPF移植時もホットキーでは項目の applied を反転させない。
      // 反転対象は関数内の効果状態だけで、項目OFFなら発火自体を無視する。
      return this.setCheckboxEffect(entry, !entry.effectActive, now);
    }
    if (entry.type === "toggle-action") {
      return this.openDialog("toggle-action-hotkey", now, entry);
    }
    if (entry.type === "action") {
      this.runAction(entry, now);
      return true;
    }
    if (entry.type === "list" || entry.type === "linked-list") {
      this.openListbox("top", entry.label, entry.options, "hotkey-item", entry.value, now);
      this.overlay.item = entry;
      return true;
    }
    if (entry.type === "value" || entry.type === "linked-value") {
      this.openNumeric(entry, true, now);
      return true;
    }
    if (entry.type === "slider") {
      this.openSlider(entry, true, now);
      return true;
    }
    return false;
  }

  releaseInactiveHotkeys() {
    const matching = new Set();
    walkItems(this.rootItems, (entry) => {
      if (hotkeyMatches(entry.appliedHotkey, this.heldControls)) matching.add(entry.id);
    });
    for (const id of this.activeHotkeyItems) {
      if (!matching.has(id)) this.activeHotkeyItems.delete(id);
    }
  }

  triggerAppliedHotkeys(now) {
    let triggered = false;
    walkItems(this.rootItems, (entry) => {
      if (entry.type === "folder" || this.activeHotkeyItems.has(entry.id) || !hotkeyMatches(entry.appliedHotkey, this.heldControls)) return;
      if (!this.activateHotkeyItem(entry, now)) return;
      this.activeHotkeyItems.add(entry.id);
      triggered = true;
    });
    return triggered;
  }

  openHotkeyPicker(now) {
    const entry = this.selectedItem();
    if (!entry || entry.type === "folder" || entry.disabled) return;
    this.overlay = {
      type: "hotkey-capture", screen: "bottom", item: entry, phase: "arming", capturedButtons: [], startedAt: now,
      ...createBottomOverlayAnimation(now)
    };
  }

  handleHotkeyCapture(key, pressed, repeated, now = 0) {
    const overlay = this.overlay;
    if (!overlay || overlay.type !== "hotkey-capture" || overlay.closing) return;
    if (overlay.phase === "arming") {
      if (this.heldControls.size === 0) overlay.phase = "waiting";
      return;
    }
    if (!HOTKEY_BUTTON_ORDER.includes(key)) return;
    if (pressed && !repeated) {
      overlay.phase = "recording";
      if (!overlay.capturedButtons.includes(key)) overlay.capturedButtons.push(key);
      return;
    }
    if (!pressed && overlay.phase === "recording" && this.heldControls.size === 0) {
      overlay.item.hotkey = formatHotkeyButtons(overlay.capturedButtons);
      closeBottomOverlay(overlay, now);
    }
  }

  disableHotkeyCapture(now = 0) {
    if (!this.overlay || this.overlay.type !== "hotkey-capture" || this.overlay.closing) return false;
    this.overlay.item.hotkey = "なし";
    closeBottomOverlay(this.overlay, now);
    return true;
  }

  cancelHotkeyCapture(now = 0) {
    if (!this.overlay || this.overlay.type !== "hotkey-capture" || this.overlay.closing) return false;
    closeBottomOverlay(this.overlay, now);
    return true;
  }

  moveGrid(overlay, key, rows) {
    if (key === "up") overlay.row = (overlay.row - 1 + rows.length) % rows.length;
    if (key === "down") overlay.row = (overlay.row + 1) % rows.length;
    const columns = rows[overlay.row].length;
    if (key === "left") overlay.column = (overlay.column - 1 + columns) % columns;
    if (key === "right") overlay.column = (overlay.column + 1) % columns;
    overlay.column = Math.min(overlay.column, columns - 1);
  }

  activateNumericKey(key, now = 0) {
    const overlay = this.overlay;
    if (!overlay || overlay.type !== "numeric" || overlay.closing) return false;
    const entry = overlay.item;
    if (!numericKeyEnabled(overlay, key)) return false;
    if (/^[0-9A-F]$/.test(key)) overlay.buffer = overlay.buffer === "0" ? key : overlay.buffer + key;
    else if (key === "00") overlay.buffer += "00";
    else if (key === "." && !overlay.buffer.includes(".")) overlay.buffer += ".";
    else if (key === "BS") overlay.buffer = overlay.buffer.slice(0, -1) || "0";
    else if (key === "SIGN") overlay.buffer = overlay.buffer.startsWith("-") ? overlay.buffer.slice(1) : `-${overlay.buffer}`;
    else if (key === "HEX" && entry.format !== "float") {
      const value = Number.parseInt(overlay.buffer, 10) || 0;
      overlay.mode = "hex"; overlay.buffer = value.toString(16).toUpperCase(); overlay.row = 0; overlay.column = 0;
    } else if (key === "DEC") {
      const value = Number.parseInt(overlay.buffer, 16) || 0;
      overlay.mode = "dec"; overlay.buffer = String(value); overlay.row = 0; overlay.column = 0;
    } else if (key === "CANCEL") closeBottomOverlay(overlay, now);
    else if (key === "OK") {
      let value = overlay.mode === "hex" ? Number.parseInt(overlay.buffer, 16) : Number(overlay.buffer);
      if (!Number.isFinite(value)) value = entry.minimum;
      const decimals = entry.format === "float" ? 10 : 1;
      const confirmedValue = Math.round(clamp(value, entry.minimum, entry.maximum) * decimals) / decimals;
      if (overlay.applyOnConfirm) this.commitHotkeyValue(entry, confirmedValue, now);
      else entry.value = confirmedValue;
      closeBottomOverlay(overlay, now);
    }
    return true;
  }

  activateTextKey(key, now = 0) {
    const overlay = this.overlay;
    if (!overlay || overlay.type !== "text" || overlay.closing) return false;
    if (!textKeyEnabled(overlay, key)) return false;
    if (key === "ABC") { overlay.mode = "abc"; overlay.row = 0; overlay.column = 0; }
    else if (key === "AIU" || key === "HIRAGANA") { overlay.mode = "kana"; overlay.script = "hiragana"; overlay.row = 0; overlay.column = 0; }
    else if (key === "KATAKANA") { overlay.mode = "kana"; overlay.script = "katakana"; overlay.row = 0; overlay.column = 0; }
    else if (TEXT_TRANSFORMS[key]) transformBeforeCursor(overlay, key, true);
    else if (key === "CAPS") {
      overlay.caps = !overlay.caps;
      if (overlay.caps) overlay.shift = false;
    }
    else if (key === "SHIFT") {
      overlay.shift = !overlay.shift;
      if (overlay.shift) overlay.caps = false;
    }
    else if (key === "SPACE") this.insertTextAtCursor(" ");
    else if (key === "LONG") this.insertTextAtCursor("ー");
    else if (key === "BS") {
      const characters = Array.from(overlay.value);
      const cursor = textCursor(overlay);
      if (cursor > 0) {
        characters.splice(cursor - 1, 1);
        overlay.value = characters.join("");
        overlay.cursor = cursor - 1;
      }
    }
    else if (key === "ENTER") this.insertTextAtCursor("\n");
    else if (key === "CANCEL") closeTextKeyboard(overlay, now);
    else if (key === "CONFIRM") {
      this.playerName = overlay.value;
      this.emit("ACTION", "名前変更を呼び出しました");
      closeTextKeyboard(overlay, now);
    }
    else {
      let character = /^[a-z]$/.test(key) && (overlay.caps || overlay.shift) ? key.toUpperCase() : key;
      if (overlay.mode === "kana" && overlay.script === "katakana") character = toKatakana(character);
      this.insertTextAtCursor(character);
      if (overlay.shift) overlay.shift = false;
    }
    return true;
  }

  insertTextAtCursor(text) {
    const overlay = this.overlay;
    if (!overlay || overlay.type !== "text") return false;
    const characters = Array.from(overlay.value);
    const insertion = Array.from(String(text));
    if (characters.length + insertion.length > 8) return false;
    const cursor = textCursor(overlay);
    characters.splice(cursor, 0, ...insertion);
    overlay.value = characters.join("");
    overlay.cursor = cursor + insertion.length;
    return true;
  }

  setTextCursor(cursor) {
    if (!this.overlay || this.overlay.type !== "text") return false;
    this.overlay.cursor = clamp(Math.round(cursor), 0, Array.from(this.overlay.value).length);
    return true;
  }

  handleOverlay(key, now, repeated = false) {
    const overlay = this.overlay;
    if (!overlay || overlay.closing) return;
    if (overlay.type === "listbox") {
      if (overlay.closing) return;
      if (key === "up") moveListboxSelection(overlay, -1, now, overlay.options.length, !repeated);
      else if (key === "down") moveListboxSelection(overlay, 1, now, overlay.options.length, !repeated);
      else if (key === "b") closeListbox(overlay, now);
      else if (key === "a") {
        if (overlay.onConfirm === "hotkey") overlay.item.hotkey = overlay.options[overlay.index];
        else if (overlay.onConfirm === "hotkey-item") {
          this.commitHotkeyValue(overlay.item, overlay.index, now);
          this.emit("SELECTED", `${overlay.options[overlay.index]}を選択しました`);
        }
        else this.emit("SELECTED", `${overlay.options[overlay.index]}を選択しました`);
        closeListbox(overlay, now);
      }
      return;
    }
    if (overlay.type === "slider") {
      if (key === "left") overlay.value = clamp(overlay.value - overlay.item.step, overlay.item.minimum, overlay.item.maximum);
      else if (key === "right") overlay.value = clamp(overlay.value + overlay.item.step, overlay.item.minimum, overlay.item.maximum);
      else if (key === "up") overlay.value = clamp(overlay.value + overlay.item.step * 5, overlay.item.minimum, overlay.item.maximum);
      else if (key === "down") overlay.value = clamp(overlay.value - overlay.item.step * 5, overlay.item.minimum, overlay.item.maximum);
      else if (key === "a") {
        if (overlay.applyOnConfirm) this.commitHotkeyValue(overlay.item, overlay.value, now);
        else overlay.item.value = overlay.value;
        closeBottomOverlay(overlay, now);
      }
      else if (key === "b") closeBottomOverlay(overlay, now);
      return;
    }
    if (overlay.type === "numeric") {
      const keys = numericKeys(overlay.mode, overlay.item.format === "float");
      if (["up", "down", "left", "right"].includes(key)) this.moveGrid(overlay, key, keys);
      else if (key === "a") this.activateNumericKey(keys[overlay.row][overlay.column], now);
      else if (key === "b") closeBottomOverlay(overlay, now);
      return;
    }
    if (overlay.type === "text") {
      if (overlay.closing) return;
      const keys = textKeys(overlay.mode);
      if (["up", "down", "left", "right"].includes(key)) this.moveGrid(overlay, key, keys);
      else if (key === "a") this.activateTextKey(keys[overlay.row][overlay.column], now);
      else if (key === "b") closeTextKeyboard(overlay, now);
    }
  }

  handleInlineList(key, now, repeated = false) {
    const list = this.inlineList;
    if (list.closing) return;
    if (key === "up") moveListboxSelection(list, -1, now, list.item.options.length, !repeated);
    else if (key === "down") moveListboxSelection(list, 1, now, list.item.options.length, !repeated);
    else if (key === "a") { list.item.value = list.index; closeListbox(list, now); }
    else if (key === "b") closeListbox(list, now);
  }

  gameInputCaptureState() {
    // CTRPF移植時の入力占有契約:
    // 操作可能なUI（メニュー本体、ダイアログ、リスト、数値/スライダー/文字入力等）が表示中は、
    // UIがDPad/A/B/X/Y/L/R/ZL/ZR等を消費し、ゲーム本体へは渡さない。
    // 例外としてゲーム側で許可するのはスライドパッドとメニュー開閉操作。
    // 下画面UIが表示中はタッチもUIが占有し、ゲーム本体へは渡さない
    // （UI自身のタッチ操作は有効なまま）。
    const active = Boolean(this.visible || this.dialog || this.overlay || this.inlineList);
    return {
      active,
      blockGameButtons: active,
      blockGameTouch: Boolean(this.overlay && this.overlay.screen === "bottom")
    };
  }

  handle(key, now, pressed = true, repeated = false) {
    // この入力経路はUI側のモーダル入力。gameInputCaptureState() が active の間、
    // ここで扱うボタン入力はゲーム側へパススルーしない前提でCTRPFへ移植する。
    if (pressed && !repeated) this.heldControls.add(key);
    else if (!pressed) this.heldControls.delete(key);
    if (this.overlay && this.overlay.type === "hotkey-capture") {
      this.handleHotkeyCapture(key, pressed, repeated, now);
      return;
    }
    this.releaseInactiveHotkeys();
    if (this.dialog) {
      if (!pressed) return;
      if (this.dialog.closing) return;
      if (key === "up") this.dialog.index = (this.dialog.index - 1 + this.dialog.options.length) % this.dialog.options.length;
      else if (key === "down") this.dialog.index = (this.dialog.index + 1) % this.dialog.options.length;
      else if (key === "a") this.chooseDialog(this.dialog.index === 0 ? "confirm" : "cancel", now);
      else if (key === "b") this.chooseDialog("cancel", now);
      return;
    }
    if (!this.visible && !this.overlay && !this.inlineList && pressed && !repeated && this.triggerAppliedHotkeys(now)) return;
    if (!pressed) {
      if ((key === "x" || key === "l") && this.finishHoldAction(key, now)) return;
      if (key === "up" || key === "down") this.selectionBoundaryBlockedDirection = 0;
      return;
    }
    if (this.overlay) {
      if (repeated && this.overlay.type !== "listbox") return;
      this.handleOverlay(key, now, repeated);
      return;
    }
    if (!this.visible) return;
    if (this.inlineList) { this.handleInlineList(key, now, repeated); return; }
    const frame = this.currentFrame();
    if (key === "up") this.moveSelection(-1, now, !repeated);
    else if (key === "down") this.moveSelection(1, now, !repeated);
    else if (key === "a") this.activateSelected(now);
    else if (key === "b") {
      if (this.frames.length > 1) { this.frames.pop(); this.resetSelectionAnimation(now); }
      else this.close(now);
    }
    else if ((key === "x" || key === "l") && !repeated) this.beginHoldAction(key, now);
    else if (key === "y") this.openHotkeyPicker(now);
    else if (key === "r" && !repeated) this.toggleFavorite(this.selectedItem(), now);
    else if (key === "select" && !repeated) this.openFavorites(now);
    else if ((key === "left" || key === "right") && ["value", "slider", "linked-value"].includes(this.selectedItem().type)) this.changeValue(this.selectedItem(), key === "right" ? 1 : -1, now);
  }

  selectOverlayCell(row, column, updateSelection = true, now = 0) {
    if (!this.overlay || !["numeric", "text"].includes(this.overlay.type)) return;
    const keys = this.overlay.type === "numeric" ? numericKeys(this.overlay.mode, this.overlay.item.format === "float") : textKeys(this.overlay.mode);
    if (!keys[row] || keys[row][column] === undefined) return;
    if (updateSelection) { this.overlay.row = row; this.overlay.column = column; }
    if (this.overlay.type === "numeric") this.activateNumericKey(keys[row][column], now);
    else this.activateTextKey(keys[row][column], now);
  }
}

const CTRPFUiModel = Object.freeze({
  CHAT_KANJI_MESSAGES,
  SCREEN, NOTICE, MENU, FRAME, CONTROL_REPEAT, TOGGLE_ACTION, LISTBOX, BOTTOM_OVERLAY, TEXT_KEYBOARD, DIALOG, CLOSE_DIALOG_OPTIONS, DIALOG_DEFINITIONS, HOTKEYS, HOTKEY_BUTTON_ORDER, HOTKEY_BUTTON_LABELS, LONG_LIST_OPTIONS,
  clamp, easeOutCubic, mix, formatHotkeyButtons, hotkeyButtons, hotkeyMatches, NotificationTimeline, ControlRepeater,
  createMenuTree, isDirty, walkItems, formatValue, numericKeys, numericKeyEnabled,
  selectionPulse, selectionOutlinePulse, listboxAmount, listboxScrollPosition, bottomOverlayAmount, textKeyboardAmount, dialogAmount, textKeys, textKeyLayout, textKeyEnabled,
  toKatakana, textCursor, transformBeforeCursor, CheatMenuModel
});

if (typeof module !== "undefined" && module.exports) module.exports = CTRPFUiModel;
if (typeof window !== "undefined") window.CTRPFUiModel = CTRPFUiModel;
})();
