import { describe, it, expect } from "vitest";
import {
  isScriptureSlide,
  resolveEffectiveSlideConfig
} from "../smartScriptureDetector.js";

describe("smartScriptureDetector", () => {
  it("detects Bible references in Indonesian and English formats", () => {
    expect(
      isScriptureSlide(
        "Karena begitu besar kasih Allah akan dunia ini — Yohanes 3:16"
      )
    ).toBe(true);
    expect(isScriptureSlide("1 Korintus 13:4-7\nKasih itu sabar; kasih itu murah hati")).toBe(true);
    expect(isScriptureSlide("Mazmur 23 : 1 - TUHAN adalah gembalaku")).toBe(true);
    expect(isScriptureSlide("Kej. 1:1 Pada mulanya Allah menciptakan langit dan bumi.")).toBe(true);
  });

  it("detects long prose passages as scripture even if verse ref is on another textbox", () => {
    const longVerse =
      "Sebab Aku ini mengetahui rancangan-rancangan apa yang ada pada-Ku mengenai kamu, demikianlah firman TUHAN, yaitu rancangan damai sejahtera dan bukan rancangan kecelakaan.";
    expect(isScriptureSlide(longVerse)).toBe(true);
  });

  it("does not misclassify normal worship lyrics or clock times as scripture", () => {
    expect(isScriptureSlide("Besar setia-Mu, ya Tuhan\nKasih-Mu tak berkesudahan")).toBe(false);
    expect(isScriptureSlide("Haleluya, terpujilah nama-Mu\n09:00")).toBe(false);
    expect(isScriptureSlide("")).toBe(false);
  });

  it("resolveEffectiveSlideConfig disables both animation and textEffect and uses fade on scripture slides", () => {
    const energeticConfig = {
      presetId: "dynamic-pop",
      durationSeconds: 0.6,
      animationEnabled: true,
      offTransitionMode: "cut",
      textEffectEnabled: true
    };

    const onVerse = resolveEffectiveSlideConfig(
      energeticConfig,
      "Yohanes 3:16\nKarena begitu besar kasih Allah akan dunia ini"
    );
    expect(onVerse.isScriptureModeActive).toBe(true);
    expect(onVerse.animationEnabled).toBe(false);
    expect(onVerse.textEffectEnabled).toBe(false);
    expect(onVerse.offTransitionMode).toBe("fade");

    // Returning to a worship lyric restores the energetic config automatically
    const onLyric = resolveEffectiveSlideConfig(
      energeticConfig,
      "Besarlah Tuhan dan sangat terpuji"
    );
    expect(onLyric.isScriptureModeActive).toBe(false);
    expect(onLyric.animationEnabled).toBe(true);
    expect(onLyric.presetId).toBe("dynamic-pop");
    expect(onLyric.textEffectEnabled).toBe(true);
    expect(onLyric.durationSeconds).toBe(0.6);
  });
});
