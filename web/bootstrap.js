"use strict";
(async () => {
  async function inflate(b64) {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return await new Response(stream).text();
  }
  try {
    (0, eval)(await inflate(window.__CTRPF_UI_GZ_B64));
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
