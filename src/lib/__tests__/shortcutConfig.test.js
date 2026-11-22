import { describe, it, expect } from "vitest";
import {
  DEFAULT_SHORTCUTS,
  formatKeyboardEvent,
  sanitizeShortcuts,
  sanitizeQuickPresets,
  resolveShortcutAction
} from "../shortcutConfig.js";

describe("shortcutConfig", () => {
  it("formatKeyboardEvent formats single keys and modifier combinations", () => {
    expect(formatKeyboardEvent({ key: "F2", code: "F2" })).toBe("F2");
    expect(formatKeyboardEvent({ key: "a", code: "KeyA", ctrlKey: true, shiftKey: true })).toBe("Ctrl+Shift+A");
    expect(formatKeyboardEvent({ key: " ", code: "Space" })).toBe("Space");
    expect(formatKeyboardEvent({ key: "Escape", code: "Escape" })).toBe("");
    expect(formatKeyboardEvent({ key: "Control", code: "ControlLeft" })).toBe("");
  });

  it("sanitizeShortcuts falls back to defaults when invalid", () => {
    expect(sanitizeShortcuts(null)).toEqual(DEFAULT_SHORTCUTS);
    expect(sanitizeShortcuts({ clear: "F9" })).toEqual({
      ...DEFAULT_SHORTCUTS,
      clear: "F9"
    });
  });

  it("sanitizeQuickPresets clamps durationSeconds and validates presetId", () => {
    const valid = new Set(["cinematic-blur", "dynamic-pop"]);
    const result = sanitizeQuickPresets(
      [
        {
          id: "q1",
          label: "Slow",
          animationEnabled: true,
          presetId: "non-existent",
          durationSeconds: 10,
          shortcut: "F6"
        }
      ],
      valid
    );

    expect(result[0].presetId).toBe("cinematic-blur");
    expect(result[0].durationSeconds).toBe(1);
    expect(result[0].shortcut).toBe("F6");
  });

  it("resolveShortcutAction resolves configured shortcuts and ignores non-matching keys", () => {
    const config = {
      shortcuts: { clear: "F1", toggleAnimation: "F2", slideBefore: "ArrowLeft", slideAfter: "ArrowRight" },
      quickPresets: [{ id: "qp-1", label: "Worship", shortcut: "F3" }]
    };

    expect(resolveShortcutAction({ key: "F1", code: "F1" }, config)).toEqual({ type: "clear" });
    expect(resolveShortcutAction({ key: "F2", code: "F2" }, config)).toEqual({ type: "toggleAnimation" });
    expect(resolveShortcutAction({ key: "F3", code: "F3" }, config)).toEqual({
      type: "quickPreset",
      presetId: "qp-1"
    });
    expect(resolveShortcutAction({ key: "F12", code: "F12" }, config)).toBeNull();
  });
});
