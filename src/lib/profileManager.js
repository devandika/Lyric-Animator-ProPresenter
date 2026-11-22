import { DEFAULT_CONFIG, loadInitialConfig, sanitizeConfigObject } from "./appConfig";

export const PROFILES_STORAGE_KEY = "pro_lyric_profiles_v1";
export const DEFAULT_PROFILE_ID = "default";
export const DEFAULT_PROFILE_NAME = "Ibadah Raya";

function generateProfileId() {
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeProfileName(name, fallback = "Profil Baru") {
  if (typeof name !== "string") return fallback;
  const trimmed = name.trim();
  return trimmed || fallback;
}

function deepCloneConfig(cfg) {
  return sanitizeConfigObject(JSON.parse(JSON.stringify(cfg || DEFAULT_CONFIG)));
}

/**
 * Extract the per-song animation & text-effect settings from a full config object.
 */
export function extractSongPreset(config, songName = "") {
  const safe = sanitizeConfigObject(config);
  return {
    name: typeof songName === "string" ? songName.trim() : "",
    presetId: safe.presetId,
    durationSeconds: safe.durationSeconds,
    animationEnabled: safe.animationEnabled,
    offTransitionMode: safe.offTransitionMode,
    textEffectEnabled: safe.textEffectEnabled,
    textEffectId: safe.textEffectId,
    textEffectIntensity: safe.textEffectIntensity,
    textEffectSpeed: safe.textEffectSpeed,
    updatedAt: Date.now()
  };
}

function sanitizeSongPresetsMap(rawMap) {
  if (!rawMap || typeof rawMap !== "object" || Array.isArray(rawMap)) return {};
  const result = {};
  for (const [key, entry] of Object.entries(rawMap)) {
    if (!key || !entry || typeof entry !== "object") continue;
    const sanitizedCfg = sanitizeConfigObject(entry);
    result[key] = {
      name: typeof entry.name === "string" ? entry.name.trim() : "",
      presetId: sanitizedCfg.presetId,
      durationSeconds: sanitizedCfg.durationSeconds,
      animationEnabled: sanitizedCfg.animationEnabled,
      offTransitionMode: sanitizedCfg.offTransitionMode,
      textEffectEnabled: sanitizedCfg.textEffectEnabled,
      textEffectId: sanitizedCfg.textEffectId,
      textEffectIntensity: sanitizedCfg.textEffectIntensity,
      textEffectSpeed: sanitizedCfg.textEffectSpeed,
      updatedAt: Number(entry.updatedAt) || Date.now()
    };
  }
  return result;
}

/**
 * Build a stable song identifier from ProPresenter presentation metadata.
 */
export function getSongKeyFromMeta(proMeta) {
  if (!proMeta || typeof proMeta !== "object") return "";
  const id = typeof proMeta.presentationId === "string" ? proMeta.presentationId.trim() : "";
  const name = typeof proMeta.presentationName === "string" ? proMeta.presentationName.trim() : "";
  const path = typeof proMeta.presentationPath === "string" ? proMeta.presentationPath.trim() : "";
  if (id) return `id:${id.toLowerCase()}`;
  if (name) return `name:${name.toLowerCase()}`;
  if (path) return `path:${path.toLowerCase()}`;
  return "";
}

/**
 * Look up a saved song preset inside a profile by exact songKey or fallback by presentationName.
 */
export function findSongPresetInProfile(profile, songKey, songName = "") {
  const map = profile?.songPresets;
  if (!map || typeof map !== "object") return null;

  if (songKey && map[songKey]) {
    return map[songKey];
  }

  const trimmedName = typeof songName === "string" ? songName.trim().toLowerCase() : "";
  if (trimmedName) {
    const nameKey = `name:${trimmedName}`;
    if (map[nameKey]) return map[nameKey];

    for (const entry of Object.values(map)) {
      if (entry && typeof entry.name === "string" && entry.name.trim().toLowerCase() === trimmedName) {
        return entry;
      }
    }
  }

  return null;
}

/**
 * Return a profile's config overlaid with the saved preset for the given song (if found).
 */
export function resolveConfigForProfileAndSong(profile, songKey, songName = "") {
  const baseConfig = deepCloneConfig(profile?.config || DEFAULT_CONFIG);
  const songPreset = findSongPresetInProfile(profile, songKey, songName);
  if (!songPreset) return baseConfig;

  return sanitizeConfigObject({
    ...baseConfig,
    presetId: songPreset.presetId,
    durationSeconds: songPreset.durationSeconds,
    animationEnabled: songPreset.animationEnabled,
    offTransitionMode: songPreset.offTransitionMode,
    textEffectEnabled: songPreset.textEffectEnabled,
    textEffectId: songPreset.textEffectId,
    textEffectIntensity: songPreset.textEffectIntensity,
    textEffectSpeed: songPreset.textEffectSpeed
  });
}

export function saveProfilesState(state) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(state));
    }
  } catch (_) {}
}

/**
 * Load profiles state from localStorage, or bootstrap with the current config as "Ibadah Raya".
 */
export function loadProfilesState() {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.profiles) && parsed.profiles.length > 0) {
          const validProfiles = parsed.profiles
            .filter((p) => p && typeof p === "object" && typeof p.id === "string")
            .map((p) => ({
              id: p.id,
              name: normalizeProfileName(p.name, DEFAULT_PROFILE_NAME),
              updatedAt: Number(p.updatedAt) || Date.now(),
              config: sanitizeConfigObject(p.config),
              songPresets: sanitizeSongPresetsMap(p.songPresets)
            }));

          if (validProfiles.length > 0) {
            const activeExists = validProfiles.some((p) => p.id === parsed.activeProfileId);
            const activeProfileId = activeExists ? parsed.activeProfileId : validProfiles[0].id;
            return {
              version: 1,
              activeProfileId,
              profiles: validProfiles
            };
          }
        }
      }
    }
  } catch (_) {}

  const initialConfig = loadInitialConfig();
  const initialState = {
    version: 1,
    activeProfileId: DEFAULT_PROFILE_ID,
    profiles: [
      {
        id: DEFAULT_PROFILE_ID,
        name: DEFAULT_PROFILE_NAME,
        updatedAt: Date.now(),
        config: deepCloneConfig(initialConfig),
        songPresets: {}
      }
    ]
  };
  saveProfilesState(initialState);
  return initialState;
}

export function getActiveProfile(state) {
  if (!state || !Array.isArray(state.profiles) || state.profiles.length === 0) {
    return {
      id: DEFAULT_PROFILE_ID,
      name: DEFAULT_PROFILE_NAME,
      updatedAt: Date.now(),
      config: deepCloneConfig(DEFAULT_CONFIG),
      songPresets: {}
    };
  }
  return (
    state.profiles.find((p) => p.id === state.activeProfileId) ||
    state.profiles[0]
  );
}

/**
 * Update active profile config and optionally record the preset for the currently active ProPresenter song.
 */
export function updateActiveProfileConfig(state, nextConfig, activeSong = null) {
  const active = getActiveProfile(state);
  const sanitized = deepCloneConfig(nextConfig);
  const songKey = activeSong?.key ? String(activeSong.key).trim() : "";
  const songName = activeSong?.name ? String(activeSong.name).trim() : "";

  const nextProfiles = state.profiles.map((p) => {
    if (p.id !== active.id) return p;
    const nextSongPresets = { ...(p.songPresets || {}) };
    if (songKey) {
      nextSongPresets[songKey] = extractSongPreset(sanitized, songName || nextSongPresets[songKey]?.name || "");
    }
    return {
      ...p,
      updatedAt: Date.now(),
      config: sanitized,
      songPresets: nextSongPresets
    };
  });

  const nextState = {
    ...state,
    activeProfileId: active.id,
    profiles: nextProfiles
  };
  saveProfilesState(nextState);
  return nextState;
}

export function switchProfile(state, profileId) {
  const target = state.profiles.find((p) => p.id === profileId);
  if (!target) {
    return { state, activeProfile: getActiveProfile(state), changed: false };
  }
  const nextState = {
    ...state,
    activeProfileId: target.id
  };
  saveProfilesState(nextState);
  return { state: nextState, activeProfile: target, changed: true };
}

export function createProfile(state, name, baseConfig = DEFAULT_CONFIG, baseSongPresets = {}) {
  const newProfile = {
    id: generateProfileId(),
    name: normalizeProfileName(name, "Profil Baru"),
    updatedAt: Date.now(),
    config: deepCloneConfig(baseConfig),
    songPresets: sanitizeSongPresetsMap(baseSongPresets)
  };
  const nextState = {
    ...state,
    activeProfileId: newProfile.id,
    profiles: [...state.profiles, newProfile]
  };
  saveProfilesState(nextState);
  return { state: nextState, profile: newProfile };
}

export function duplicateProfile(state, sourceProfileId, newName) {
  const source =
    state.profiles.find((p) => p.id === sourceProfileId) || getActiveProfile(state);
  const fallbackName = `${source.name} (Salinan)`;
  const duplicated = {
    id: generateProfileId(),
    name: normalizeProfileName(newName, fallbackName),
    updatedAt: Date.now(),
    config: deepCloneConfig(source.config),
    songPresets: sanitizeSongPresetsMap(source.songPresets)
  };
  const nextState = {
    ...state,
    activeProfileId: duplicated.id,
    profiles: [...state.profiles, duplicated]
  };
  saveProfilesState(nextState);
  return { state: nextState, profile: duplicated };
}

export function renameProfile(state, profileId, newName) {
  const targetId = profileId || state.activeProfileId;
  const trimmed = normalizeProfileName(newName, "");
  if (!trimmed) {
    return { state, profile: getActiveProfile(state), changed: false };
  }
  let updatedProfile = null;
  const nextProfiles = state.profiles.map((p) => {
    if (p.id === targetId) {
      updatedProfile = { ...p, name: trimmed, updatedAt: Date.now() };
      return updatedProfile;
    }
    return p;
  });
  if (!updatedProfile) {
    return { state, profile: getActiveProfile(state), changed: false };
  }
  const nextState = {
    ...state,
    profiles: nextProfiles
  };
  saveProfilesState(nextState);
  return { state: nextState, profile: updatedProfile, changed: true };
}

export function deleteProfile(state, profileId) {
  if (!state || !Array.isArray(state.profiles) || state.profiles.length <= 1) {
    return {
      state,
      deleted: false,
      activeProfile: getActiveProfile(state),
      error: "Minimal harus ada 1 profil acara."
    };
  }
  const targetId = profileId || state.activeProfileId;
  const remaining = state.profiles.filter((p) => p.id !== targetId);
  if (remaining.length === 0 || remaining.length === state.profiles.length) {
    return {
      state,
      deleted: false,
      activeProfile: getActiveProfile(state)
    };
  }
  const nextActive =
    remaining.find((p) => p.id === state.activeProfileId) || remaining[0];
  const nextState = {
    ...state,
    activeProfileId: nextActive.id,
    profiles: remaining
  };
  saveProfilesState(nextState);
  return {
    state: nextState,
    deleted: true,
    activeProfile: nextActive
  };
}

export function serializeProfileForExport(profile) {
  const safeProfile = profile || {
    name: DEFAULT_PROFILE_NAME,
    config: DEFAULT_CONFIG,
    songPresets: {}
  };
  return JSON.stringify(
    {
      type: "propresenter-lyric-profile",
      version: 1,
      name: safeProfile.name,
      exportedAt: new Date().toISOString(),
      config: deepCloneConfig(safeProfile.config),
      songPresets: sanitizeSongPresetsMap(safeProfile.songPresets)
    },
    null,
    2
  );
}

export function importProfileFromJson(state, jsonString, fallbackName = "Profil Impor") {
  const parsed = JSON.parse(jsonString);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Format file profil tidak valid.");
  }

  const rawConfig =
    parsed.config && typeof parsed.config === "object" ? parsed.config : parsed;
  const rawSongPresets =
    parsed.songPresets && typeof parsed.songPresets === "object" ? parsed.songPresets : {};
  const rawName =
    typeof parsed.name === "string" && parsed.name.trim()
      ? parsed.name.trim()
      : fallbackName;

  const existingNames = new Set((state?.profiles || []).map((p) => p.name.toLowerCase()));
  const finalName = existingNames.has(rawName.toLowerCase())
    ? `${rawName} (Impor)`
    : rawName;

  return createProfile(state, finalName, sanitizeConfigObject(rawConfig), rawSongPresets);
}

/**
 * Remove a single saved song preset by songKey from a profile (defaults to active profile).
 */
export function removeSongPresetFromActiveProfile(state, songKey, profileId = null) {
  if (!state || !songKey) return { state, removed: false };
  const targetId = profileId || state.activeProfileId;
  const target = state.profiles.find((p) => p.id === targetId) || getActiveProfile(state);
  const currentMap = target.songPresets || {};
  if (!(songKey in currentMap)) return { state, removed: false };

  const nextSongPresets = { ...currentMap };
  delete nextSongPresets[songKey];

  const nextProfiles = state.profiles.map((p) =>
    p.id === target.id
      ? { ...p, updatedAt: Date.now(), songPresets: nextSongPresets }
      : p
  );
  const nextState = {
    ...state,
    profiles: nextProfiles
  };
  saveProfilesState(nextState);
  return { state: nextState, removed: true };
}

/**
 * Clear all saved song presets in a profile (defaults to active profile).
 */
export function clearAllSongPresetsInActiveProfile(state, profileId = null) {
  if (!state) return { state, cleared: false };
  const targetId = profileId || state.activeProfileId;
  const target = state.profiles.find((p) => p.id === targetId) || getActiveProfile(state);
  const nextProfiles = state.profiles.map((p) =>
    p.id === target.id
      ? { ...p, updatedAt: Date.now(), songPresets: {} }
      : p
  );
  const nextState = {
    ...state,
    profiles: nextProfiles
  };
  saveProfilesState(nextState);
  return { state: nextState, cleared: true };
}

