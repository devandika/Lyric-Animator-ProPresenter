/**
 * Automatic Bible Verse / Scripture Slide Detector (Smart Scripture Mode)
 * Detects scripture slides from ProPresenter text or metadata and overrides
 * energetic song animations / wiggle effects with a calm, readable transition.
 */

// Matches book + chapter:verse patterns on the same line (never matching clock times like 09:00 or newlines):
// "Yohanes 3:16", "1 Korintus 13:4-7", "Mazmur 23 : 1", "Kej. 1:1", "2 Tim 4:7", "Wahyu 21:4 (TB)"
const BIBLE_REF_REGEX =
  /\b(?:[1-3][ \t]+|I{1,3}[ \t]+)?[A-Za-z]{2,18}\.?[ \t]+[1-9]\d{0,2}[ \t]*:[ \t]*[1-9]\d{0,2}(?:[ \t]*[-–—][ \t]*[1-9]\d{0,2})?\b/;

const SCRIPTURE_META_REGEX = /\b(alkitab|ayat|scripture|firman|bacaan)\b/i;

const LONG_SCRIPTURE_CHAR_THRESHOLD = 145;

/**
 * Determine whether the active slide is a Bible verse / scripture slide.
 */
export function isScriptureSlide(text, presentationName = "", slideGroup = "") {
  const rawText = typeof text === "string" ? text.replace(/\u001F/g, "\n").trim() : "";
  const presName = typeof presentationName === "string" ? presentationName.trim() : "";
  const grpName = typeof slideGroup === "string" ? slideGroup.trim() : "";

  if (!rawText) return false;

  // 1. Check explicit scripture reference in slide text, presentation name, or slide group
  if (BIBLE_REF_REGEX.test(rawText) || BIBLE_REF_REGEX.test(presName) || BIBLE_REF_REGEX.test(grpName)) {
    return true;
  }

  // 2. Check presentation name or slide group keywords (e.g. "Alkitab", "Ayat Pokok", "Scripture")
  if (SCRIPTURE_META_REGEX.test(presName) || SCRIPTURE_META_REGEX.test(grpName)) {
    return true;
  }

  // 3. Long paragraph heuristic (worship lyrics are short lines; scripture passages are longer)
  if (rawText.length >= LONG_SCRIPTURE_CHAR_THRESHOLD) {
    return true;
  }

  return false;
}

/**
 * Compute effective animation & text-effect props for the active slide.
 * Does not mutate the user's saved song/profile config.
 */
export function resolveEffectiveSlideConfig(
  config,
  text,
  presentationName = "",
  slideGroup = ""
) {
  const basePresetId = config?.presetId || "cinematic-blur";
  const baseDuration = Number(config?.durationSeconds) || 1.0;
  const baseAnimEnabled = config?.animationEnabled !== false;
  const baseOffMode = config?.offTransitionMode || "fade";
  const baseFxEnabled = Boolean(config?.textEffectEnabled);

  const scriptureDetected = isScriptureSlide(text, presentationName, slideGroup);

  if (!scriptureDetected) {
    return {
      presetId: basePresetId,
      durationSeconds: baseDuration,
      animationEnabled: baseAnimEnabled,
      offTransitionMode: baseOffMode,
      textEffectEnabled: baseFxEnabled,
      isScriptureModeActive: false
    };
  }

  // Calm override for Bible verses: turn off animation and text effects, use simple fade transition
  return {
    presetId: basePresetId,
    durationSeconds: baseDuration,
    animationEnabled: false,
    offTransitionMode: "fade",
    textEffectEnabled: false,
    isScriptureModeActive: true
  };
}
