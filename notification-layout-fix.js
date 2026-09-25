"use strict";

(function (root) {
  const core = typeof module !== "undefined" && module.exports ? require("./ui-model.js") : root.CTRPFUiModel;
  if (!core?.NotificationTimeline) return;
  if (typeof module !== "undefined" && module.exports) require("./issue-fixes.js");

  const { NotificationTimeline, NOTICE, SCREEN, clamp } = core;
  const NOTICE_LINE_HEIGHT = root?.GohanIssueFixes?.NOTICE_LINE_HEIGHT ?? 10;
  const prototype = NotificationTimeline.prototype;
  if (prototype.__geometryOverflowPatchApplied) return;

  function measureBitmapText(font, text) {
    let width = 0;
    for (const character of Array.from(String(text))) {
      const glyph = font?.glyphs?.[String(character.codePointAt(0))];
      width += glyph ? glyph.advance : 4;
    }
    return width;
  }

  function wrapLine(font, text, maximumWidth) {
    const lines = [];
    for (const paragraph of String(text ?? "").split("\n")) {
      if (!paragraph) { lines.push(""); continue; }
      let line = "";
      for (const character of Array.from(paragraph)) {
        if (line && measureBitmapText(font, line + character) > maximumWidth) {
          lines.push(line);
          line = character;
        } else line += character;
      }
      lines.push(line);
    }
    return lines;
  }

  function noticeHeight(title, message) {
    const font = root?.MISAKI_GOTHIC_2ND_8;
    const titleRows = font ? wrapLine(font, title, NOTICE.width - 20) : String(title ?? "").split("\n");
    const messageRows = font ? wrapLine(font, message, NOTICE.width - 14) : String(message ?? "").split("\n");
    const rows = Math.max(2, titleRows.length + messageRows.length);
    return NOTICE.height + (rows - 2) * NOTICE_LINE_HEIGHT;
  }

  // Notification capacity is geometric, not a hard item count. New notices simply
  // push older notices upward by their rendered height. This is important for CTRPF:
  // a multi-line notice may consume several normal rows, while many short notices may
  // coexist. An item is removed only after its lower edge has actually left the screen.
  prototype.add = function (now, title = "CHEAT ENABLED", message = "歩行速度アップを有効にしました") {
    this.prune(now);
    const scheduledAt = Math.max(now, this.lastScheduledAt + NOTICE.spawnInterval);
    this.lastScheduledAt = scheduledAt;
    const height = noticeHeight(title, message);

    for (const entry of this.items) {
      entry.moveFromY = this.getY(entry, scheduledAt);
      entry.targetY -= height + NOTICE.gap;
      entry.moveStartedAt = scheduledAt;
      entry.overflowExit = false;
    }

    const bottomY = SCREEN.height - NOTICE.margin - height;
    const item = {
      id: this.nextId++, title, message, createdAt: scheduledAt,
      moveStartedAt: scheduledAt, moveFromY: bottomY, targetY: bottomY,
      noticeHeight: height, overflowExit: false
    };
    this.items.push(item);
    return item;
  };

  prototype.isAlive = function (item, now) {
    const age = now - item.createdAt;
    if (age >= 0 && this.getY(item, now) + (item.noticeHeight || NOTICE.height) <= 0) return false;
    return age < NOTICE.enterDuration + NOTICE.holdDuration + NOTICE.exitDuration;
  };

  Object.defineProperty(prototype, "__geometryOverflowPatchApplied", { value: true });

  const api = Object.freeze({ noticeHeight, NOTICE_LINE_HEIGHT });
  if (root) root.GohanNotificationLayoutFix = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
