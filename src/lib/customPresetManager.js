import { ANIMATION_CATEGORIES, ANIMATION_PRESETS } from "./animationPresets.js";
import { TEXT_EFFECT_CATEGORIES, TEXT_EFFECT_PRESETS } from "./textEffectEngine.js";

const CUSTOM_ANIM_KEY = "propresenter_animator_custom_presets";
const CUSTOM_EFFECT_KEY = "propresenter_animator_custom_effects";

export const CUSTOM_CATEGORY_ANIM = { id: "custom", label: "⭐ Kustom / Impor" };
export const CUSTOM_CATEGORY_EFFECT = { id: "custom", label: "⭐ Efek Kustom" };

function safeJsonParse(raw, fallback) {
  if (!raw || typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

export function getCustomAnimationPresets() {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(CUSTOM_ANIM_KEY);
  const data = safeJsonParse(raw, {});
  return typeof data === "object" && data !== null ? data : {};
}

export function saveCustomAnimationPresets(presets) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CUSTOM_ANIM_KEY, JSON.stringify(presets));
  notifyPresetsChanged();
}

export function getCustomTextEffectPresets() {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(CUSTOM_EFFECT_KEY);
  const data = safeJsonParse(raw, {});
  return typeof data === "object" && data !== null ? data : {};
}

export function saveCustomTextEffectPresets(effects) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CUSTOM_EFFECT_KEY, JSON.stringify(effects));
  notifyPresetsChanged();
}

// Event dispatcher so all open views / components refresh their preset lists immediately
function notifyPresetsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("propresenter_presets_updated"));
}

export function getAllAnimationPresets() {
  const custom = getCustomAnimationPresets();
  return { ...ANIMATION_PRESETS, ...custom };
}

export function getAllAnimationCategories() {
  const custom = getCustomAnimationPresets();
  const hasCustom = Object.keys(custom).length > 0;
  if (!hasCustom) return ANIMATION_CATEGORIES;
  return [...ANIMATION_CATEGORIES, CUSTOM_CATEGORY_ANIM];
}

export function getAllTextEffectPresets() {
  const custom = getCustomTextEffectPresets();
  return { ...TEXT_EFFECT_PRESETS, ...custom };
}

export function getAllTextEffectCategories() {
  const custom = getCustomTextEffectPresets();
  const hasCustom = Object.keys(custom).length > 0;
  if (!hasCustom) return TEXT_EFFECT_CATEGORIES;
  return [...TEXT_EFFECT_CATEGORIES, CUSTOM_CATEGORY_EFFECT];
}

/**
 * Validate and sanitize single animation item
 */
function sanitizeAnimationPreset(item, index = 0) {
  if (!item || typeof item !== "object") return null;
  const name = typeof item.name === "string" && item.name.trim() ? item.name.trim() : `Custom Anim ${Date.now()}_${index}`;
  const id = typeof item.id === "string" && item.id.trim()
    ? item.id.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-")
    : `custom-anim-${Date.now()}-${index}`;

  const target = ["per-character", "per-word", "per-line", "whole"].includes(item.target)
    ? item.target
    : "per-word";

  const enter = item.enter && typeof item.enter === "object" ? {
    durationMs: Math.max(100, Math.min(5000, Number(item.enter.durationMs) || 600)),
    staggerMs: Math.max(0, Math.min(500, Number(item.enter.staggerMs) || 20)),
    ...(item.enter.stepped ? { stepped: true } : {}),
    easing: Array.isArray(item.enter.easing) && item.enter.easing.length === 4
      ? item.enter.easing.map(Number)
      : [0.16, 1, 0.3, 1],
    from: item.enter.from && typeof item.enter.from === "object" ? item.enter.from : { opacity: 0, y: 30 },
    to: item.enter.to && typeof item.enter.to === "object" ? item.enter.to : { opacity: 1, y: 0 }
  } : {
    durationMs: 600,
    staggerMs: 20,
    easing: [0.16, 1, 0.3, 1],
    from: { opacity: 0, y: 30 },
    to: { opacity: 1, y: 0 }
  };

  const exit = item.exit && typeof item.exit === "object" ? {
    durationMs: Math.max(100, Math.min(5000, Number(item.exit.durationMs) || 350)),
    staggerMs: Math.max(0, Math.min(500, Number(item.exit.staggerMs) || 10)),
    ...(item.exit.stepped ? { stepped: true } : {}),
    easing: Array.isArray(item.exit.easing) && item.exit.easing.length === 4
      ? item.exit.easing.map(Number)
      : [0.7, 0, 0.84, 0],
    from: item.exit.from && typeof item.exit.from === "object" ? item.exit.from : { opacity: 1, y: 0 },
    to: item.exit.to && typeof item.exit.to === "object" ? item.exit.to : { opacity: 0, y: -20 }
  } : {
    durationMs: 350,
    staggerMs: 10,
    easing: [0.7, 0, 0.84, 0],
    from: { opacity: 1, y: 0 },
    to: { opacity: 0, y: -20 }
  };

  const validStaggerModes = ["normal", "center-out", "edges-in", "random", "reverse"];
  const staggerMode = validStaggerModes.includes(item.staggerMode) ? item.staggerMode : undefined;

  return {
    id,
    name: `${name} (Kustom)`,
    category: "custom",
    target,
    ...(staggerMode ? { staggerMode } : {}),
    ...(item.maskClip ? { maskClip: item.maskClip } : {}),
    ...(item.allowOpacityFade ? { allowOpacityFade: true } : {}),
    ...(typeof item.customRenderer === "string" && item.customRenderer.trim()
      ? { customRenderer: item.customRenderer.trim() }
      : {}),
    enter,
    exit,
    isCustom: true
  };
}

/**
 * Validate and sanitize single effect item
 */
function sanitizeEffectPreset(item, index = 0) {
  if (!item || typeof item !== "object") return null;
  const name = typeof item.name === "string" && item.name.trim() ? item.name.trim() : `Custom Effect ${Date.now()}_${index}`;
  const id = typeof item.id === "string" && item.id.trim()
    ? item.id.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-")
    : `custom-fx-${Date.now()}-${index}`;

  const target = ["per-character", "per-word", "per-line", "whole"].includes(item.target)
    ? item.target
    : "per-word";

  const mode = typeof item.mode === "string" ? item.mode : "wiggle-pos";

  return {
    id,
    name: `${name} (Kustom)`,
    category: "custom",
    target,
    mode,
    params: item.params && typeof item.params === "object" ? item.params : {},
    isCustom: true
  };
}

/**
 * Ingest JSON string dropped by user
 * Returns { success, importedCount, message, firstId, firstType }
 */
export function importPresetsFromJsonString(rawContent) {
  if (!rawContent || typeof rawContent !== "string") {
    return { success: false, error: "Konten file kosong." };
  }

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch (err) {
    return { success: false, error: "File bukan format JSON yang valid: " + err.message };
  }

  const animsToAdd = [];
  const effectsToAdd = [];

  // Can be array or single object or bundle
  const items = Array.isArray(parsed) ? parsed : [parsed];

  items.forEach((item, idx) => {
    if (!item || typeof item !== "object") return;

    // Check if it's a bundle with separate animations & effects
    if (Array.isArray(item.animations) || Array.isArray(item.effects)) {
      if (Array.isArray(item.animations)) {
        item.animations.forEach((a, i) => {
          const clean = sanitizeAnimationPreset(a, i);
          if (clean) animsToAdd.push(clean);
        });
      }
      if (Array.isArray(item.effects)) {
        item.effects.forEach((e, i) => {
          const clean = sanitizeEffectPreset(e, i);
          if (clean) effectsToAdd.push(clean);
        });
      }
      return;
    }

    // Single item detection
    if (item.type === "effect" || item.mode) {
      const clean = sanitizeEffectPreset(item, idx);
      if (clean) effectsToAdd.push(clean);
    } else {
      // Default to animation preset
      const clean = sanitizeAnimationPreset(item, idx);
      if (clean) animsToAdd.push(clean);
    }
  });

  if (animsToAdd.length === 0 && effectsToAdd.length === 0) {
    return { success: false, error: "Tidak ditemukan preset animasi atau efek yang sesuai di dalam file." };
  }

  // Save to storage
  const currentAnims = getCustomAnimationPresets();
  animsToAdd.forEach((a) => {
    currentAnims[a.id] = a;
  });
  saveCustomAnimationPresets(currentAnims);

  const currentEffects = getCustomTextEffectPresets();
  effectsToAdd.forEach((e) => {
    currentEffects[e.id] = e;
  });
  saveCustomTextEffectPresets(currentEffects);

  const total = animsToAdd.length + effectsToAdd.length;
  let firstId = "";
  let firstType = "animation";
  if (animsToAdd.length > 0) {
    firstId = animsToAdd[0].id;
    firstType = "animation";
  } else if (effectsToAdd.length > 0) {
    firstId = effectsToAdd[0].id;
    firstType = "effect";
  }

  return {
    success: true,
    count: total,
    animsCount: animsToAdd.length,
    effectsCount: effectsToAdd.length,
    firstId,
    firstType,
    message: `Berhasil menambahkan ${total} preset (${animsToAdd.length} Animasi, ${effectsToAdd.length} Efek).`
  };
}

/**
 * Delete a custom preset
 */
export function deleteCustomPreset(id, type = "animation") {
  if (type === "animation") {
    const anims = getCustomAnimationPresets();
    if (anims[id]) {
      delete anims[id];
      saveCustomAnimationPresets(anims);
      return true;
    }
  } else {
    const effects = getCustomTextEffectPresets();
    if (effects[id]) {
      delete effects[id];
      saveCustomTextEffectPresets(effects);
      return true;
    }
  }
  return false;
}

/**
 * Export preset(s) to downloadable JSON
 */
export function exportPresetToFile(preset, filename) {
  if (typeof window === "undefined" || !preset) return;
  const jsonStr = JSON.stringify(preset, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `${preset.id || "preset"}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
