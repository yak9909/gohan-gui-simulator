(() => {
  "use strict";

  const TARGET_FPS = 30;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;
  const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
  const nativeCancelAnimationFrame = window.cancelAnimationFrame.bind(window);
  const lastFrameByCallback = new WeakMap();
  const pendingFrames = new Map();
  let nextToken = 1;

  window.requestAnimationFrame = (callback) => {
    const token = nextToken++;

    const tick = (now) => {
      if (!pendingFrames.has(token)) return;

      const previous = lastFrameByCallback.get(callback);
      if (previous === undefined || now - previous >= FRAME_INTERVAL - 0.25) {
        const elapsed = previous === undefined ? FRAME_INTERVAL : now - previous;
        lastFrameByCallback.set(callback, now - (elapsed % FRAME_INTERVAL));
        pendingFrames.delete(token);
        callback(now);
        return;
      }

      const nativeId = nativeRequestAnimationFrame(tick);
      pendingFrames.set(token, nativeId);
    };

    const nativeId = nativeRequestAnimationFrame(tick);
    pendingFrames.set(token, nativeId);
    return token;
  };

  window.cancelAnimationFrame = (token) => {
    const nativeId = pendingFrames.get(token);
    if (nativeId === undefined) return;
    pendingFrames.delete(token);
    nativeCancelAnimationFrame(nativeId);
  };
})();