import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  clampNumber,
  sanitizeFavoriteIds,
  DEFAULT_CONFIG,
  loadInitialConfig,
  VALID_PRESET_IDS
} from "../appConfig.js";

describe("appConfig", () => {
  beforeEach(() => {
    const store = {};
    vi.stubGlobal("localStorage", {
      getItem: (key) => (key in store ? store[key] : null),
      setItem: (key, val) => {
        store[key] = String(val);
      },
      removeItem: (key) => {
        delete store[key];
      }
    });
  });

  it("clampNumber clamps values and rounds to 1 decimal place", () => {
    expect(clampNumber(1.24, 0.2, 2.5, 1.0)).toBe(1.2);
    expect(clampNumber(0.05, 0.2, 2.5, 1.0)).toBe(0.2);
    expect(clampNumber(9.9, 0.2, 2.5, 1.0)).toBe(2.5);
    expect(clampNumber("not-a-number", 0.2, 2.5, 1.0)).toBe(1.0);
  });

  it("sanitizeFavoriteIds keeps valid and custom- prefixed IDs without duplicates", () => {
    const valid = new Set(["cinematic-blur", "dynamic-pop"]);
    const res = sanitizeFavoriteIds(
      ["cinematic-blur", "cinematic-blur", "unknown-id", "custom-my-anim", 123],
      valid
    );
    expect(res).toEqual(["cinematic-blur", "custom-my-anim"]);
  });

  it("loadInitialConfig returns DEFAULT_CONFIG when localStorage is empty or corrupt", () => {
    expect(loadInitialConfig()).toEqual(DEFAULT_CONFIG);

    localStorage.setItem("pro_lyric_config", "{bad-json");
    expect(loadInitialConfig()).toEqual(DEFAULT_CONFIG);
  });

  it("loadInitialConfig sanitizes saved v8 config while preserving custom presets", () => {
    const firstValidPreset = Array.from(VALID_PRESET_IDS)[0];
    localStorage.setItem(
      "pro_lyric_config",
      JSON.stringify({
        configVersion: 8,
        proHost: "192.168.1.50",
        proPort: 50002,
        presetId: "custom-worship-glow",
        offTransitionMode: "cut",
        textEffectIntensity: 99,
        favoritePresets: [firstValidPreset, "invalid-id"]
      })
    );

    const cfg = loadInitialConfig();
    expect(cfg.proHost).toBe("192.168.1.50");
    expect(cfg.proPort).toBe(50002);
    expect(cfg.presetId).toBe("custom-worship-glow");
    expect(cfg.offTransitionMode).toBe("cut");
    expect(cfg.textEffectIntensity).toBe(2.5);
    expect(cfg.favoritePresets).toEqual([firstValidPreset]);
  });

  it("loadInitialConfig migrates older config versions safely", () => {
    const firstValidPreset = Array.from(VALID_PRESET_IDS)[0];
    localStorage.setItem(
      "pro_lyric_config",
      JSON.stringify({
        configVersion: 5,
        presetId: firstValidPreset,
        durationSeconds: 2.2,
        animationEnabled: false,
        propresenterScreenIndex: 2
      })
    );

    const cfg = loadInitialConfig();
    expect(cfg.configVersion).toBe(8);
    expect(cfg.presetId).toBe(firstValidPreset);
    expect(cfg.durationSeconds).toBe(2.2);
    expect(cfg.animationEnabled).toBe(false);
    expect(cfg.propresenterScreenIndex).toBe(2);
  });
});
