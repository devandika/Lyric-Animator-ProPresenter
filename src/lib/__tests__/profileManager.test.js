import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadProfilesState,
  getActiveProfile,
  updateActiveProfileConfig,
  createProfile,
  duplicateProfile,
  renameProfile,
  deleteProfile,
  switchProfile,
  serializeProfileForExport,
  importProfileFromJson,
  getSongKeyFromMeta,
  findSongPresetInProfile,
  resolveConfigForProfileAndSong,
  removeSongPresetFromActiveProfile,
  clearAllSongPresetsInActiveProfile,
  DEFAULT_PROFILE_NAME
} from "../profileManager.js";

describe("profileManager (OBS-style Profil + Per-Song Auto-Preset)", () => {
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

  it("bootstraps with default 'Ibadah Raya' profile preserving initial config", () => {
    const state = loadProfilesState();
    expect(state.profiles).toHaveLength(1);
    const active = getActiveProfile(state);
    expect(active.name).toBe(DEFAULT_PROFILE_NAME);
    expect(active.config.presetId).toBe("cinematic-blur");
    expect(active.songPresets).toEqual({});
  });

  it("creates, switches, duplicates, renames, and deletes profiles safely", () => {
    let state = loadProfilesState();
    const defaultId = state.activeProfileId;

    // Update config on default profile
    state = updateActiveProfileConfig(state, {
      ...getActiveProfile(state).config,
      durationSeconds: 2.5
    });
    expect(getActiveProfile(state).config.durationSeconds).toBe(2.5);

    // Create new profile
    const created = createProfile(state, "Ibadah Youth");
    state = created.state;
    expect(state.profiles).toHaveLength(2);
    expect(getActiveProfile(state).name).toBe("Ibadah Youth");
    expect(getActiveProfile(state).config.durationSeconds).toBe(1.0);

    // Switch back to default profile
    const switched = switchProfile(state, defaultId);
    state = switched.state;
    expect(getActiveProfile(state).name).toBe(DEFAULT_PROFILE_NAME);
    expect(getActiveProfile(state).config.durationSeconds).toBe(2.5);

    // Duplicate default profile
    const dup = duplicateProfile(state, defaultId, "Ibadah Natal");
    state = dup.state;
    expect(state.profiles).toHaveLength(3);
    expect(getActiveProfile(state).name).toBe("Ibadah Natal");
    expect(getActiveProfile(state).config.durationSeconds).toBe(2.5);

    // Rename active profile
    const renamed = renameProfile(state, state.activeProfileId, "Malam Natal");
    state = renamed.state;
    expect(getActiveProfile(state).name).toBe("Malam Natal");

    // Delete active profile
    const del1 = deleteProfile(state, state.activeProfileId);
    expect(del1.deleted).toBe(true);
    state = del1.state;
    expect(state.profiles).toHaveLength(2);

    // Delete second profile -> 1 left
    const del2 = deleteProfile(state, state.activeProfileId);
    expect(del2.deleted).toBe(true);
    state = del2.state;
    expect(state.profiles).toHaveLength(1);

    // Cannot delete the last remaining profile
    const delLast = deleteProfile(state, state.activeProfileId);
    expect(delLast.deleted).toBe(false);
    expect(delLast.state.profiles).toHaveLength(1);
  });

  it("remembers and restores presets per ProPresenter song within a profile and across export/import", () => {
    let state = loadProfilesState();
    const songAMeta = { presentationId: "UUID-SONG-A", presentationName: "Besarlah Tuhan" };
    const songBMeta = { presentationId: "UUID-SONG-B", presentationName: "Bapa Engkau Sungguh Baik" };

    const keyA = getSongKeyFromMeta(songAMeta);
    const keyB = getSongKeyFromMeta(songBMeta);

    // Configure Song A (upbeat Praise: dynamic-pop, 0.7s, wiggle enabled)
    state = updateActiveProfileConfig(
      state,
      {
        ...getActiveProfile(state).config,
        presetId: "dynamic-pop",
        durationSeconds: 0.7,
        textEffectEnabled: true,
        textEffectId: "ae-wiggle-pos"
      },
      { key: keyA, name: songAMeta.presentationName }
    );

    // Configure Song B (slow Worship: cinematic-blur, 1.8s, effect disabled)
    state = updateActiveProfileConfig(
      state,
      {
        ...getActiveProfile(state).config,
        presetId: "cinematic-blur",
        durationSeconds: 1.8,
        textEffectEnabled: false
      },
      { key: keyB, name: songBMeta.presentationName }
    );

    const activeProfile = getActiveProfile(state);

    // Switching back to Song A resolves Song A's saved preset
    const resolvedA = resolveConfigForProfileAndSong(activeProfile, keyA, songAMeta.presentationName);
    expect(resolvedA.presetId).toBe("dynamic-pop");
    expect(resolvedA.durationSeconds).toBe(0.7);
    expect(resolvedA.textEffectEnabled).toBe(true);

    // Switching to Song B resolves Song B's saved preset
    const resolvedB = resolveConfigForProfileAndSong(activeProfile, keyB, songBMeta.presentationName);
    expect(resolvedB.presetId).toBe("cinematic-blur");
    expect(resolvedB.durationSeconds).toBe(1.8);
    expect(resolvedB.textEffectEnabled).toBe(false);

    // Even if exported to another PC where UUID differs, it matches by presentationName fallback
    const exportedJson = serializeProfileForExport(activeProfile);
    const imported = importProfileFromJson(state, exportedJson);
    const matchedByName = findSongPresetInProfile(
      imported.profile,
      "id:different-uuid-on-another-pc",
      "Besarlah Tuhan"
    );
    expect(matchedByName).not.toBeNull();
    expect(matchedByName.presetId).toBe("dynamic-pop");
    expect(matchedByName.durationSeconds).toBe(0.7);

    // Removing a single song preset or clearing all song presets works
    const afterRemoveA = removeSongPresetFromActiveProfile(state, keyA);
    expect(afterRemoveA.removed).toBe(true);
    expect(findSongPresetInProfile(getActiveProfile(afterRemoveA.state), keyA)).toBeNull();
    expect(findSongPresetInProfile(getActiveProfile(afterRemoveA.state), keyB)).not.toBeNull();

    const afterClearAll = clearAllSongPresetsInActiveProfile(afterRemoveA.state);
    expect(afterClearAll.cleared).toBe(true);
    expect(getActiveProfile(afterClearAll.state).songPresets).toEqual({});
  });
});
