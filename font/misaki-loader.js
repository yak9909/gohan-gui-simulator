(() => {
  const b64 = window.__CTRPF_MISAKI_B64 || "";
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  (0, eval)(new TextDecoder("utf-8").decode(bytes));
  delete window.__CTRPF_MISAKI_B64;
})();
