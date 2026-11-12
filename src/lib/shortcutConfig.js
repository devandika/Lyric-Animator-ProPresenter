export const DEFAULT_SHORTCUTS = {
  clear: "F1",
  toggleAnimation: "F2",
  slideBefore: "",
  slideAfter: ""
};

export const DEFAULT_QUICK_PRESETS = [
  {
    id: "quick-worship",
    label: "Worship",
    animationEnabled: true,
    presetId: "cinematic-blur",
    durationSeconds: 1.5,
    shortcut: "F3"
  },
  {
    id: "quick-praise",
    label: "Praise",
    animationEnabled: true,
    presetId: "dynamic-pop",
    durationSeconds: 0.7,
    shortcut: "F4"
  },
  {
    id: "quick-liturgi",
    label: "Liturgi",
    animationEnabled: false,
    presetId: "cinematic-blur",
    durationSeconds: 1.0,
    shortcut: "F5"
  }
];

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta", "CapsLock", "NumLock", "ScrollLock"]);

function normalizeKeyToken(e) {
  const code = e.code || "";
  const key = e.key || "";

  if (code === "Space" || key === " ") return "Space";
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(key)) return key;
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return code;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);

  const named = {
    ArrowLeft: "ArrowLeft",
    ArrowRight: "ArrowRight",
    ArrowUp: "ArrowUp",
    ArrowDown: "ArrowDown",
    PageUp: "PageUp",
    PageDown: "PageDown",
    Home: "Home",
    End: "End",
    Insert: "Insert",
    Delete: "Delete",
    Backspace: "Backspace",
    Enter: "Enter",
    Tab: "Tab",
    Backquote: "`",
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Backslash: "\\",
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/"
  };
  if (named[code]) return named[code];
  if (named[key]) return named[key];
  if (key.length === 1) return key.toUpperCase();
  return key;
}

/**
 * Convert a KeyboardEvent into a canonical shortcut string (e.g. "F2", "Ctrl+Alt+1", "ArrowLeft").
 * Returns "" for standalone modifier keys or Escape (used to cancel recording).
 */
export function formatKeyboardEvent(e) {
  if (!e || MODIFIER_KEYS.has(e.key) || e.key === "Escape") return "";
  const token = normalizeKeyToken(e);
  if (!token) return "";

  const parts = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  parts.push(token);
  return parts.join("+");
}

function matchesShortcut(e, shortcutStr) {
  if (!shortcutStr) return false;
  return formatKeyboardEvent(e) === shortcutStr;
}

function isPlainKeyEvent(e) {
  return !e.ctrlKey && !e.altKey && !e.metaKey;
}

function isFunctionKeyEvent(e) {
  return /^F([1-9]|1[0-9]|2[0-4])$/.test(e.key || "");
}

/**
 * Resolve which global shortcut action matches a KeyboardEvent, or null if none.
 */
export function resolveShortcutAction(e, config) {
  if (!e) return null;
  if (e.target?.closest?.('[data-shortcut-recorder="true"]')) return null;

  const tag = e.target?.tagName;
  const isEditingControl =
    tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target?.isContentEditable;
  if (isEditingControl && isPlainKeyEvent(e) && !isFunctionKeyEvent(e)) {
    return null;
  }

  const sc = config?.shortcuts || DEFAULT_SHORTCUTS;
  if (matchesShortcut(e, sc.clear)) return { type: "clear" };
  if (matchesShortcut(e, sc.toggleAnimation)) return { type: "toggleAnimation" };
  if (matchesShortcut(e, sc.slideBefore)) return { type: "slideBefore" };
  if (matchesShortcut(e, sc.slideAfter)) return { type: "slideAfter" };

  const quickList = config?.quickPresets || [];
  for (const qp of quickList) {
    if (matchesShortcut(e, qp.shortcut)) {
      return { type: "quickPreset", presetId: qp.id };
    }
  }

  return null;
}

export function sanitizeShortcuts(raw) {
  const base = { ...DEFAULT_SHORTCUTS };
  if (!raw || typeof raw !== "object") return base;
  for (const key of Object.keys(base)) {
    if (typeof raw[key] === "string") {
      base[key] = raw[key].trim();
    }
  }
  return base;
}

export function sanitizeQuickPresets(raw, validPresetIds) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_QUICK_PRESETS.map((item) => ({ ...item }));
  }
  const fallbackPreset = "cinematic-blur";
  return raw.slice(0, 8).map((item, idx) => {
    const presetId =
      item?.presetId && (!validPresetIds || validPresetIds.has(item.presetId))
        ? item.presetId
        : fallbackPreset;
    const dur =
      typeof item?.durationSeconds === "number" &&
      item.durationSeconds >= 0.5 &&
      item.durationSeconds <= 5.0
        ? Math.round(item.durationSeconds * 10) / 10
        : 1.0;
    return {
      id: String(item?.id || `quick-${idx + 1}`),
      label: String(item?.label || `Preset ${idx + 1}`).slice(0, 24),
      animationEnabled: item?.animationEnabled !== false,
      presetId,
      durationSeconds: dur,
      shortcut: typeof item?.shortcut === "string" ? item.shortcut.trim() : ""
    };
  });
}
