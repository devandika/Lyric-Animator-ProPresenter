import { ANIMATION_PRESETS } from "./animationPresets";
import { VALID_TEXT_EFFECT_IDS } from "./textEffectEngine";
import {
  DEFAULT_QUICK_PRESETS,
  DEFAULT_SHORTCUTS,
  sanitizeQuickPresets,
  sanitizeShortcuts
} from "./shortcutConfig";

export const VALID_PRESET_IDS = new Set(Object.keys(ANIMATION_PRESETS));

export function clampNumber(val, min, max, fallback) {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num * 10) / 10));
}

export function sanitizeFavoriteIds(raw, validSet) {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(raw.filter((id) => typeof id === "string" && (validSet.has(id) || id.startsWith("custom-"))))
  );
}

export const DEFAULT_CONFIG = {
  configVersion: 8,
  proHost: "127.0.0.1",
  proPort: 50001,
  customWorkspaceDir: "",
  presetId: "cinematic-blur",
  durationSeconds: 1.0,
  animationEnabled: true,
  offTransitionMode: "fade",
  textEffectEnabled: false,
  textEffectId: "ae-wiggle-pos",
  textEffectIntensity: 1.0,
  textEffectSpeed: 1.0,
  smartScriptureEnabled: true,
  favoritePresets: [],
  favoriteEffects: [],
  propresenterScreenIndex: -1, // -1 = auto-detect from ProPresenter SelectedPreviewScreenID / Main
  shortcuts: { ...DEFAULT_SHORTCUTS },
  quickPresets: DEFAULT_QUICK_PRESETS.map((qp) => ({ ...qp })),
  countdownOverlay: {
    countdownEnabled: false,
    tickerEnabled: false,
    timerType: "duration",
    durationHours: 0,
    durationMinutes: 5,
    durationSeconds: 0,
    targetTime: "09:00:00",
    finishAction: "auto-hide",
    finishText: "Selamat Beribadah!",
    tickerText: "Selamat Datang di Ibadah Raya • Mohon Mengkondisikan HP ke Mode Senyap",
    tickerPosition: "bottom",
    tickerSpeed: 28,
    tickerBgColor: "#000000",
    tickerBgOpacity: 0.8,
    position: { x: 50, y: 85 },
    presetPosition: "bottom",
    fontFamily: "'Segoe UI', sans-serif",
    numberFontSize: 48,
    textFontSize: 24,
    textColor: "#ffffff",
    highlightColor: "#fbbf24"
  }
};

/**
 * Sanitize and normalize any config object (v8 or migrated older config) against DEFAULT_CONFIG.
 */
export function sanitizeConfigObject(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return { ...DEFAULT_CONFIG };
  }

  if (parsed.configVersion === 8 || !("configVersion" in parsed)) {
    const durationSec =
      typeof parsed?.durationSeconds === "number" &&
      parsed.durationSeconds >= 0.5 &&
      parsed.durationSeconds <= 5.0
        ? parsed.durationSeconds
        : DEFAULT_CONFIG.durationSeconds;

    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      configVersion: 8,
      proHost: typeof parsed?.proHost === "string" ? parsed.proHost : DEFAULT_CONFIG.proHost,
      proPort: typeof parsed?.proPort === "number" ? parsed.proPort : DEFAULT_CONFIG.proPort,
      customWorkspaceDir:
        typeof parsed?.customWorkspaceDir === "string"
          ? parsed.customWorkspaceDir.trim()
          : DEFAULT_CONFIG.customWorkspaceDir,
      durationSeconds: durationSec,
      countdownOverlay:
        parsed?.countdownOverlay && typeof parsed.countdownOverlay === "object"
          ? {
              ...DEFAULT_CONFIG.countdownOverlay,
              ...parsed.countdownOverlay,
              countdownEnabled: Boolean(
                parsed.countdownOverlay.countdownEnabled ??
                  (parsed.countdownOverlay.enabled && parsed.countdownOverlay.mode !== "ticker")
              ),
              tickerEnabled: Boolean(
                parsed.countdownOverlay.tickerEnabled ??
                  (parsed.countdownOverlay.enabled && parsed.countdownOverlay.mode !== "countdown")
              )
            }
          : DEFAULT_CONFIG.countdownOverlay,
      presetId:
        VALID_PRESET_IDS.has(parsed?.presetId) || parsed?.presetId?.startsWith("custom-")
          ? parsed.presetId
          : DEFAULT_CONFIG.presetId,
      animationEnabled: parsed?.animationEnabled !== false,
      offTransitionMode: parsed?.offTransitionMode === "cut" ? "cut" : "fade",
      smartScriptureEnabled: parsed?.smartScriptureEnabled !== false,
      textEffectEnabled: Boolean(parsed?.textEffectEnabled),
      textEffectId:
        VALID_TEXT_EFFECT_IDS.has(parsed?.textEffectId) || parsed?.textEffectId?.startsWith("custom-")
          ? parsed.textEffectId
          : DEFAULT_CONFIG.textEffectId,
      textEffectIntensity: clampNumber(
        parsed?.textEffectIntensity,
        0.2,
        2.5,
        DEFAULT_CONFIG.textEffectIntensity
      ),
      textEffectSpeed: clampNumber(
        parsed?.textEffectSpeed,
        0.2,
        3.0,
        DEFAULT_CONFIG.textEffectSpeed
      ),
      favoritePresets: sanitizeFavoriteIds(parsed?.favoritePresets, VALID_PRESET_IDS),
      favoriteEffects: sanitizeFavoriteIds(parsed?.favoriteEffects, VALID_TEXT_EFFECT_IDS),
      shortcuts: sanitizeShortcuts(parsed?.shortcuts),
      quickPresets: sanitizeQuickPresets(parsed?.quickPresets, VALID_PRESET_IDS)
    };
  }

  const migratedSec =
    typeof parsed?.durationSeconds === "number" &&
    parsed.durationSeconds >= 0.5 &&
    parsed.durationSeconds <= 5.0
      ? parsed.durationSeconds
      : DEFAULT_CONFIG.durationSeconds;

  return {
    ...DEFAULT_CONFIG,
    presetId: VALID_PRESET_IDS.has(parsed?.presetId) ? parsed.presetId : DEFAULT_CONFIG.presetId,
    durationSeconds: migratedSec,
    animationEnabled: parsed?.animationEnabled !== false,
    propresenterScreenIndex:
      typeof parsed?.propresenterScreenIndex === "number" ? parsed.propresenterScreenIndex : -1
  };
}

/**
 * Load and sanitize persisted configuration from localStorage, migrating older versions if needed.
 */
export function loadInitialConfig() {
  try {
    const saved = localStorage.getItem("pro_lyric_config");
    if (saved) {
      const parsed = JSON.parse(saved);
      return sanitizeConfigObject(parsed);
    }
  } catch (_) {}
  return { ...DEFAULT_CONFIG };
}
