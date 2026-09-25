from pathlib import Path

path = Path('issue-fixes.js')
text = path.read_text(encoding='utf-8')
old = '''    const frame = original.currentFrame.call(this);
    if (frame?.kind === "settings" && pressed && !repeated && !modal && ["x", "y", "l", "r", "select", "left", "right"].includes(key)) {
      this.heldControls.add(key);
      this.releaseInactiveHotkeys();
      return;
    }
    const result = original.handle.call(this, key, now, pressed, repeated);'''
new = '''    const frame = original.currentFrame.call(this);
    if (frame?.kind === "settings" && pressed && !repeated && !modal && key === "a") {
      this.heldControls.add(key);
      this.releaseInactiveHotkeys();
      const result = this.activateSelected(now);
      persistBrowserState(this);
      return result;
    }
    if (frame?.kind === "settings" && pressed && !repeated && !modal && ["x", "y", "l", "r", "select", "left", "right"].includes(key)) {
      this.heldControls.add(key);
      this.releaseInactiveHotkeys();
      return;
    }
    const result = original.handle.call(this, key, now, pressed, repeated);'''
if old not in text:
    raise SystemExit('settings handle block not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
