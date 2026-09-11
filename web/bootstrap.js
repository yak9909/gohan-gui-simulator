"use strict";
(async () => {
  async function inflate(b64) {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return await new Response(stream).text();
  }
  try {
    const uiSource = await inflate(window.__CTRPF_UI_GZ_B64);
    const feedbackUiSource = uiSource
      .replace(
        'function formatValue(entry) {\n  if (entry.type === "checkbox") return entry.value ? "ON" : "OFF";\n  if (entry.type === "toggle-action") return entry.value ? "T:ON" : "T:OFF";',
        'function formatValue(entry, now = (typeof performance !== "undefined" ? performance.now() : Number.POSITIVE_INFINITY)) {\n  if (entry.type === "checkbox") return entry.value ? "ON" : "OFF";\n  if (entry.type === "toggle-action") {\n    if (entry.value) return "T:ON";\n    if (Number.isFinite(entry.appliedFeedbackUntil) && now < entry.appliedFeedbackUntil) return "T:OK";\n    return "T:OFF";\n  }'
      )
      .replace(
        '        this.emit("TOGGLE ACTION", `${entry.label}: EXECUTED`);\n      }\n      entry.value = false;',
        '        this.emit("TOGGLE ACTION", `${entry.label}: EXECUTED`);\n        entry.appliedFeedbackUntil = now + 200;\n      }\n      entry.value = false;'
      );
    if (feedbackUiSource === uiSource || !feedbackUiSource.includes('return "T:OK"') || !feedbackUiSource.includes("appliedFeedbackUntil = now + 200")) {
      throw new Error("Toggle action feedback patch failed");
    }
    (0, eval)(feedbackUiSource);
    delete window.__CTRPF_UI_GZ_B64;
    (0, eval)(await inflate(window.__CTRPF_APP_GZ_B64));
    delete window.__CTRPF_APP_GZ_B64;
  } catch (error) {
    console.error("CTRPF preview bootstrap failed", error);
    const target = document.querySelector(".app-shell");
    if (target) {
      const p = document.createElement("p");
      p.textContent = "プレビューの読み込みに失敗しました。対応ブラウザの最新版で開いてください。";
      p.style.cssText = "padding:16px;color:#ffb4b4";
      target.prepend(p);
    }
  }
})();
