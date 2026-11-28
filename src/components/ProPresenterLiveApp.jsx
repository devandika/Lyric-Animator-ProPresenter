import { useState, useEffect, useRef, useCallback } from "react";
import { ProPresenterConnector } from "../lib/propresenterConnector";
import { VALID_TEXT_EFFECT_IDS } from "../lib/textEffectEngine";
import { resolveShortcutAction } from "../lib/shortcutConfig";
import { VALID_PRESET_IDS } from "../lib/appConfig";
import {
  loadProfilesState,
  getActiveProfile,
  updateActiveProfileConfig,
  switchProfile,
  createProfile,
  renameProfile,
  deleteProfile,
  serializeProfileForExport,
  importProfileFromJson,
  getSongKeyFromMeta,
  findSongPresetInProfile,
  resolveConfigForProfileAndSong,
  removeSongPresetFromActiveProfile,
  clearAllSongPresetsInActiveProfile
} from "../lib/profileManager";
import { useCountdownControl } from "../hooks/useCountdownControl";
export { ProjectorOutputView } from "./ProjectorOutputView";
import { SettingsView } from "./SettingsView";
import {
  ThemedLyricStage,
  doesThemeHaveSlideMedia,
  doesThemeHaveSlideVideo
} from "./ThemedLyricStage";
import { MediaLayer } from "./MediaLayer";
import { FavoriteSelect } from "./FavoriteSelect";
import { RemoteQrModal } from "./RemoteQrModal";
import { UserGuideModal } from "./UserGuideModal";
import { ProfileActionModal } from "./ProfileActionModal";
import { UpdateModal } from "./UpdateModal";
import { PresetDropzoneOverlay } from "./PresetDropzoneOverlay";
import { formatCountdownTime } from "./CountdownOverlay";
import { Slider } from "./ui/Slider";
import { isScriptureSlide, resolveEffectiveSlideConfig } from "../lib/smartScriptureDetector";
import {
  clearSkippedUpdateVersion,
  normalizeVersion,
  shouldShowStartupUpdateModal,
  skipUpdateVersion
} from "../lib/updateManager";
import {
  getAllAnimationPresets,
  getAllAnimationCategories,
  getAllTextEffectPresets,
  getAllTextEffectCategories
} from "../lib/customPresetManager";
import appIconUrl from "../assets/app-icon.svg";

const PROPRESENTER_HOST = "127.0.0.1";
const PROPRESENTER_PORT = 50001;

function normalizeProUuid(val) {
  return String(val || "").trim().toLowerCase();
}

function findMatchingLookScreen(lookScreens, audienceScreens, targetIdx) {
  if (!Array.isArray(lookScreens) || lookScreens.length === 0) return null;
  const selectedScreen = Array.isArray(audienceScreens) ? audienceScreens[targetIdx] : null;
  if (selectedScreen) {
    const targetUuid = normalizeProUuid(selectedScreen.uuid);
    if (targetUuid) {
      const byUuid = lookScreens.find(
        (ls) => normalizeProUuid(ls?.id?.uuid || ls?.uuid || ls?.screen_uuid) === targetUuid
      );
      if (byUuid) return byUuid;
    }
    const targetName = String(selectedScreen.name || "").trim().toLowerCase();
    if (targetName) {
      const byName = lookScreens.find(
        (ls) => String(ls?.id?.name || ls?.name || "").trim().toLowerCase() === targetName
      );
      if (byName) return byName;
    }
  }
  return lookScreens[targetIdx] || lookScreens[0] || null;
}

function extractLookThemeSlideUuid(lookScr) {
  if (!lookScr) return "";
  const raw = lookScr.presentation;
  if (!raw) return "";
  if (typeof raw === "string") {
    const clean = raw.trim();
    if (clean.includes(":")) {
      const parts = clean.split(":").map((s) => s.trim()).filter(Boolean);
      return parts[parts.length - 1] || "";
    }
    return clean;
  }
  if (typeof raw === "object") {
    return String(raw.slide?.uuid || raw.id?.uuid || raw.uuid || "").trim();
  }
  return "";
}

function OffTransitionSegment({ value, disabled, toolbar = false, onChange }) {
  const mode = value === "cut" ? "cut" : "fade";
  return (
    <div
      className={`off-mode-segment ${toolbar ? "toolbar" : ""} ${disabled ? "disabled" : ""}`}
      role="group"
      aria-label="Mode transisi saat Animasi Off"
    >
      <button
        type="button"
        disabled={disabled}
        className={`btn-off-mode ${mode === "fade" ? "active" : ""}`}
        onClick={() => onChange("fade")}
        title={
          disabled
            ? "Matikan tombol Animasi untuk memilih Fade / Cut"
            : "Crossfade halus antar slide tanpa jeda kosong"
        }
        aria-pressed={mode === "fade"}
      >
        Fade
      </button>
      <button
        type="button"
        disabled={disabled}
        className={`btn-off-mode ${mode === "cut" ? "active" : ""}`}
        onClick={() => onChange("cut")}
        title={
          disabled
            ? "Matikan tombol Animasi untuk memilih Fade / Cut"
            : "Pindah langsung tanpa transisi (Cut)"
        }
        aria-pressed={mode === "cut"}
      >
        Cut
      </button>
    </div>
  );
}

export function ProPresenterLiveApp() {
  const [profilesState, setProfilesState] = useState(loadProfilesState);
  const [config, setConfig] = useState(() => getActiveProfile(loadProfilesState()).config);
  const [profileModalState, setProfileModalState] = useState({
    isOpen: false,
    mode: "new",
    initialValue: ""
  });
  const [connStatus, setConnStatus] = useState({
    connected: false,
    message: "Siap menghubungkan"
  });
  const [currentSlideText, setCurrentSlideText] = useState("");
  const [nextSlideText, setNextSlideText] = useState("");
  const [defaultScreenUuid, setDefaultScreenUuid] = useState("");
  const [proMeta, setProMeta] = useState({
    audienceScreens: [],
    lookName: "",
    lookScreens: [],
    layers: {
      video_input: false,
      media: false,
      slide: true,
      announcements: false,
      props: false,
      messages: false,
      audio: false
    },
    activeMediaItem: null,
    activeProps: [],
    stageMessage: "",
    announcementActive: null,
    presentationPath: "",
    presentationName: "",
    presentationId: "",
    cueUuid: "",
    slideLayerActive: true,
    currSlideGroup: "",
    slidePosition: null,
    prevSlide: null,
    afterSlide: null
  });
  const [themeInfo, setThemeInfo] = useState(null);
  const [activeMedia, setActiveMedia] = useState(null);
  const [layerTransitions, setLayerTransitions] = useState({ media: null, slide: null });

  // Windows Physical Displays & Output Live State
  const [screensList, setScreensList] = useState([]);
  const [selectedScreenIndex, setSelectedScreenIndex] = useState(1);
  const [isProjectorLive, setIsProjectorLive] = useState(false);
  const [isLivePopoutOpen, setIsLivePopoutOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRemoteModal, setShowRemoteModal] = useState(false);
  const [remoteClientCount, setRemoteClientCount] = useState(0);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showCountdownModal, setShowCountdownModal] = useState(false);

  // Auto-Update State (electron-updater via GitHub Releases)
  const [updateState, setUpdateState] = useState({
    status: "idle",
    currentVersion: "2.1.2",
    isPackaged: false,
    version: "",
    releaseNotes: "",
    releaseDate: "",
    progress: null,
    error: "",
    source: "startup"
  });
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const dismissedUpdateVersionRef = useRef("");

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return undefined;

    const applyNextUpdateState = (next) => {
      if (!next || typeof next !== "object") return;
      setUpdateState((prev) => ({ ...prev, ...next }));
      const nextVer = normalizeVersion(next.version);
      if (
        shouldShowStartupUpdateModal(next) &&
        nextVer &&
        dismissedUpdateVersionRef.current !== nextVer
      ) {
        setShowUpdateModal(true);
      }
    };

    if (api.getUpdateState) {
      api
        .getUpdateState()
        .then((st) => applyNextUpdateState(st))
        .catch(() => {});
    } else if (api.getAppVersion) {
      api
        .getAppVersion()
        .then((ver) => {
          if (ver) setUpdateState((prev) => ({ ...prev, currentVersion: ver }));
        })
        .catch(() => {});
    }

    if (api.onUpdateStatus) {
      return api.onUpdateStatus(applyNextUpdateState);
    }
    return undefined;
  }, []);

  const handleCheckForUpdates = useCallback(async () => {
    if (!window.electronAPI?.checkForUpdates) {
      setUpdateState((prev) => ({
        ...prev,
        status: "error",
        source: "manual",
        error: "Auto-update hanya tersedia di aplikasi desktop Electron."
      }));
      return;
    }
    await window.electronAPI.checkForUpdates();
  }, []);

  const handleDownloadUpdate = useCallback(async () => {
    if (!window.electronAPI?.downloadUpdate) return;
    if (updateState?.version) {
      clearSkippedUpdateVersion(updateState.version);
    }
    await window.electronAPI.downloadUpdate();
  }, [updateState?.version]);

  const handleQuitAndInstall = useCallback(() => {
    window.electronAPI?.quitAndInstall?.();
  }, []);

  const handleSkipUpdateVersion = useCallback((version) => {
    const norm = normalizeVersion(version);
    if (norm) {
      skipUpdateVersion(norm);
      dismissedUpdateVersionRef.current = norm;
    }
    setShowUpdateModal(false);
  }, []);

  const handleCloseUpdateModal = useCallback(() => {
    if (updateState?.version) {
      dismissedUpdateVersionRef.current = normalizeVersion(updateState.version);
    }
    setShowUpdateModal(false);
  }, [updateState?.version]);

  // Dynamic Custom Presets & Categories
  const [allAnimPresets, setAllAnimPresets] = useState(() => getAllAnimationPresets());
  const [allAnimCategories, setAllAnimCategories] = useState(() => getAllAnimationCategories());
  const [allTextEffects, setAllTextEffects] = useState(() => getAllTextEffectPresets());
  const [allTextEffectCategories, setAllTextEffectCategories] = useState(() => getAllTextEffectCategories());

  useEffect(() => {
    const handlePresetsUpdated = () => {
      setAllAnimPresets(getAllAnimationPresets());
      setAllAnimCategories(getAllAnimationCategories());
      setAllTextEffects(getAllTextEffectPresets());
      setAllTextEffectCategories(getAllTextEffectCategories());
    };
    window.addEventListener("propresenter_presets_updated", handlePresetsUpdated);
    return () => window.removeEventListener("propresenter_presets_updated", handlePresetsUpdated);
  }, []);

  const screenDetailsRef = useRef(null);
  const popupWindowRef = useRef(null);
  const livePopoutRef = useRef(null);
  const stageViewportRef = useRef(null);

  // Persistent BroadcastChannel & sync refs
  const broadcastChannelRef = useRef(null);
  const connectorRef = useRef(null);
  const currentSlideTextRef = useRef(currentSlideText);
  const configRef = useRef(config);
  const themeInfoRef = useRef(themeInfo);
  const wasScriptureSlideRef = useRef(false);
  const defaultScreenUuidRef = useRef(defaultScreenUuid);
  const layerStateRef = useRef({
    activeMedia: null,
    mediaTransition: null,
    slideTransition: null,
    stageMessage: "",
    preloadMedia: []
  });
  const suppressedSlideKeyRef = useRef("");
  const lastThemeVersionRef = useRef("");
  const lastMediaKeyRef = useRef("");
  const lastLayerTransitionsKeyRef = useRef("");
  const resolvedMediaCacheRef = useRef(new Map());
  const dispatchShortcutActionRef = useRef(null);
  const slideSyncSeqRef = useRef(0);
  const slideSyncInFlightRef = useRef(false);
  const latestLiveTextRef = useRef("");
  const themeDepsRef = useRef({
    presentationPath: "",
    themeSlideUuid: "",
    slideAllowed: true
  });

  currentSlideTextRef.current = currentSlideText;
  configRef.current = config;
  themeInfoRef.current = themeInfo;
  defaultScreenUuidRef.current = defaultScreenUuid;

  const safeBroadcast = useCallback((msg) => {
    try {
      if (!broadcastChannelRef.current) {
        broadcastChannelRef.current = new BroadcastChannel("propresenter_animator_channel");
      }
      broadcastChannelRef.current.postMessage(msg);
    } catch (e) {
      console.warn("BroadcastChannel error:", e);
    }
  }, []);

  const {
    countdownRuntime,
    countdownRuntimeRef,
    handleStartCountdown,
    handlePauseCountdown,
    handleResetCountdown,
    handleCountdownPositionChange,
    handleCountdownFontSizeChange,
    handleToggleCountdownOverlay,
    handleToggleTickerOverlay
  } = useCountdownControl({ config, setConfig, safeBroadcast });

  // BroadcastChannel setup (persistent for app lifetime)
  useEffect(() => {
    const bc = new BroadcastChannel("propresenter_animator_channel");
    broadcastChannelRef.current = bc;

    bc.onmessage = (event) => {
      const data = event.data;
      if (data?.type === "REQUEST_STATE") {
        try {
          bc.postMessage({
            type: "SYNC_STATE",
            text: currentSlideTextRef.current,
            config: configRef.current,
            themeInfo: themeInfoRef.current,
            layerState: layerStateRef.current,
            countdownRuntime: countdownRuntimeRef.current
          });
        } catch (_) {}
      } else if (data?.type === "SHORTCUT_ACTION" && data.action) {
        dispatchShortcutActionRef.current?.(data.action);
      }
    };

    return () => {
      try {
        bc.close();
      } catch (_) {}
      broadcastChannelRef.current = null;
    };
  }, []);

  const currentSongKey = getSongKeyFromMeta(proMeta);
  const currentSongName = proMeta.presentationName || "";
  const appliedSongContextRef = useRef({
    profileId: profilesState.activeProfileId,
    songKey: ""
  });

  // Auto-apply or initialize per-song preset when ProPresenter active presentation changes
  useEffect(() => {
    if (!currentSongKey) {
      appliedSongContextRef.current = {
        profileId: profilesState.activeProfileId,
        songKey: ""
      };
      return;
    }

    const prevCtx = appliedSongContextRef.current;
    if (
      prevCtx.profileId === profilesState.activeProfileId &&
      prevCtx.songKey === currentSongKey
    ) {
      return;
    }

    appliedSongContextRef.current = {
      profileId: profilesState.activeProfileId,
      songKey: currentSongKey
    };

    const activeProfile = getActiveProfile(profilesState);
    const savedSongPreset = findSongPresetInProfile(
      activeProfile,
      currentSongKey,
      currentSongName
    );

    if (savedSongPreset) {
      setConfig((prev) => ({
        ...prev,
        presetId: savedSongPreset.presetId,
        durationSeconds: savedSongPreset.durationSeconds,
        animationEnabled: savedSongPreset.animationEnabled,
        offTransitionMode: savedSongPreset.offTransitionMode,
        textEffectEnabled: savedSongPreset.textEffectEnabled,
        textEffectId: savedSongPreset.textEffectId,
        textEffectIntensity: savedSongPreset.textEffectIntensity,
        textEffectSpeed: savedSongPreset.textEffectSpeed
      }));
    } else {
      // First time seeing this song in the active profile: remember current animation settings for it
      setProfilesState((prev) =>
        updateActiveProfileConfig(prev, configRef.current, {
          key: currentSongKey,
          name: currentSongName
        })
      );
    }
  }, [currentSongKey, currentSongName, profilesState]);

  // Persist config & sync to active Profil (including active ProPresenter song) + BroadcastChannel
  useEffect(() => {
    localStorage.setItem("pro_lyric_config", JSON.stringify(config));
    const activeSong =
      currentSongKey &&
      appliedSongContextRef.current.songKey === currentSongKey &&
      appliedSongContextRef.current.profileId === profilesState.activeProfileId
        ? { key: currentSongKey, name: currentSongName }
        : null;
    setProfilesState((prev) => updateActiveProfileConfig(prev, config, activeSong));
    safeBroadcast({
      type: "CONFIG_UPDATE",
      config
    });
  }, [config, currentSongKey, currentSongName, profilesState.activeProfileId, safeBroadcast]);

  // Sync OBS-style Profil menu (with per-profile saved songs flyout submenu) in Electron application menu bar
  useEffect(() => {
    const profilesWithSongs = profilesState.profiles.map((p) => {
      const songEntries = Object.entries(p.songPresets || {});
      const savedSongs = songEntries.map(([key, item]) => {
        const songTitle = item.name || key.replace(/^(id|name|path):/, "");
        const presetLabel = allAnimPresets[item.presetId]?.name || item.presetId;
        const durLabel = `${Number(item.durationSeconds || 1).toFixed(1)}s`;
        const statusLabel =
          item.animationEnabled === false ? "Animasi Off" : `${presetLabel} (${durLabel})`;
        return {
          key,
          label: `${songTitle} — ${statusLabel}`
        };
      });
      return {
        id: p.id,
        name: p.name,
        savedSongs
      };
    });

    window.electronAPI?.syncProfileMenu?.({
      activeProfileId: profilesState.activeProfileId,
      profiles: profilesWithSongs
    });
  }, [profilesState, allAnimPresets]);

  // Handle OBS-style Profil menu actions triggered from top menu bar
  useEffect(() => {
    if (!window.electronAPI?.onProfileMenuAction) return undefined;

    return window.electronAPI.onProfileMenuAction(async (action) => {
      if (!action || typeof action !== "object") return;
      const currentActive = getActiveProfile(profilesState);

      if (action.type === "switch" && action.profileId) {
        const res = switchProfile(profilesState, action.profileId);
        if (res.changed) {
          appliedSongContextRef.current = {
            profileId: res.activeProfile.id,
            songKey: currentSongKey
          };
          setProfilesState(res.state);
          setConfig(
            resolveConfigForProfileAndSong(
              res.activeProfile,
              currentSongKey,
              currentSongName
            )
          );
        }
      } else if (action.type === "remove-song" && action.songKey) {
        const res = removeSongPresetFromActiveProfile(
          profilesState,
          action.songKey,
          action.profileId
        );
        if (res.removed) {
          setProfilesState(res.state);
        }
      } else if (action.type === "clear-songs") {
        const res = clearAllSongPresetsInActiveProfile(
          profilesState,
          action.profileId
        );
        if (res.cleared) {
          setProfilesState(res.state);
        }
      } else if (action.type === "save" || action.type === "new") {
        setProfileModalState({
          isOpen: true,
          mode: "save",
          initialValue: `Profil ${profilesState.profiles.length + 1}`
        });
      } else if (action.type === "rename") {
        setProfileModalState({
          isOpen: true,
          mode: "rename",
          initialValue: currentActive.name
        });
      } else if (action.type === "delete") {
        if (profilesState.profiles.length <= 1) return;
        setProfileModalState({
          isOpen: true,
          mode: "delete",
          initialValue: currentActive.name
        });
      } else if (action.type === "export") {
        const content = serializeProfileForExport(currentActive);
        await window.electronAPI.exportProfileFile?.({
          defaultName: currentActive.name,
          content
        });
      } else if (action.type === "import") {
        const res = await window.electronAPI.importProfileFile?.();
        if (res?.ok && res.content) {
          try {
            const imported = importProfileFromJson(
              profilesState,
              res.content,
              res.fileName || "Profil Impor"
            );
            appliedSongContextRef.current = {
              profileId: imported.profile.id,
              songKey: currentSongKey
            };
            setProfilesState(imported.state);
            setConfig(
              resolveConfigForProfileAndSong(
                imported.profile,
                currentSongKey,
                currentSongName
              )
            );
          } catch (err) {
            console.warn("Gagal mengimpor profil:", err);
          }
        }
      }
    });
  }, [profilesState, currentSongKey, currentSongName]);

  const handleConfirmProfileModal = useCallback(
    (inputValue) => {
      const mode = profileModalState.mode;
      const currentActive = getActiveProfile(profilesState);

      if (mode === "save" || mode === "new") {
        const res = createProfile(
          profilesState,
          inputValue,
          configRef.current,
          currentActive.songPresets
        );
        appliedSongContextRef.current = {
          profileId: res.profile.id,
          songKey: currentSongKey
        };
        setProfilesState(res.state);
        setConfig(res.profile.config);
      } else if (mode === "rename") {
        const res = renameProfile(profilesState, currentActive.id, inputValue);
        if (res.changed) {
          setProfilesState(res.state);
        }
      } else if (mode === "delete") {
        const res = deleteProfile(profilesState, currentActive.id);
        if (res.deleted) {
          appliedSongContextRef.current = {
            profileId: res.activeProfile.id,
            songKey: currentSongKey
          };
          setProfilesState(res.state);
          setConfig(
            resolveConfigForProfileAndSong(
              res.activeProfile,
              currentSongKey,
              currentSongName
            )
          );
        }
      }

      setProfileModalState((prev) => ({ ...prev, isOpen: false }));
    },
    [profileModalState.mode, profilesState, currentSongKey, currentSongName]
  );

  // Read ProPresenter's default preview/output screen UUID when connected to local ProPresenter
  useEffect(() => {
    const effectiveHost = config.proHost || PROPRESENTER_HOST;
    resolvedMediaCacheRef.current.clear();
    lastThemeVersionRef.current = "";
    window.electronAPI
      ?.getDefaultProScreen?.({ proHost: effectiveHost })
      ?.then((uuid) => {
        setDefaultScreenUuid(uuid || "");
      })
      .catch(() => {});
  }, [config.proHost, config.customWorkspaceDir]);

  // Track projector window & live pop-out window state from Electron
  useEffect(() => {
    if (!window.electronAPI?.onProjectorStatusChange) return;
    window.electronAPI.getProjectorStatus?.().then((live) => {
      setIsProjectorLive(Boolean(live));
    });
    return window.electronAPI.onProjectorStatusChange((live) => {
      setIsProjectorLive(Boolean(live));
    });
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.onLivePopoutStatusChange) return;
    window.electronAPI.getLivePopoutStatus?.().then((open) => {
      setIsLivePopoutOpen(Boolean(open));
    });
    return window.electronAPI.onLivePopoutStatusChange((open) => {
      setIsLivePopoutOpen(Boolean(open));
    });
  }, []);

  // Connect to ProPresenter
  useEffect(() => {
    const effectiveHost = config.proHost || PROPRESENTER_HOST;
    const effectivePort = Number(config.proPort) || PROPRESENTER_PORT;
    const conn = new ProPresenterConnector({
      host: effectiveHost,
      port: effectivePort,
      onStatusChange: (status) => {
        setConnStatus(status);
      },
      onSlideChange: ({ text, uuid, nextText }) => {
        const slideKey = `${uuid}::${text}`;
        if (suppressedSlideKeyRef.current && suppressedSlideKeyRef.current === slideKey) {
          return;
        }
        suppressedSlideKeyRef.current = "";

        const seq = ++slideSyncSeqRef.current;
        latestLiveTextRef.current = text || "";
        const canResolveSync =
          (Boolean(uuid) || (Boolean(text) && isScriptureSlide(text))) &&
          Boolean(window.electronAPI?.resolveSlideTheme) &&
          themeDepsRef.current.slideAllowed;

        if (!canResolveSync) {
          slideSyncInFlightRef.current = false;
          if (!uuid && !text && lastThemeVersionRef.current !== "none") {
            lastThemeVersionRef.current = "none";
            setThemeInfo(null);
          }
          setCurrentSlideText(text);
          setNextSlideText(nextText || "");
          safeBroadcast({
            type: "SLIDE_UPDATE",
            text,
            nextText: nextText || "",
            ...( !uuid && !text ? { hasThemeInfo: true, themeInfo: null } : {} )
          });
          return;
        }

        const presPath =
          connectorRef.current?.presentationPath || themeDepsRef.current.presentationPath || "";
        const themeUuid = themeDepsRef.current.themeSlideUuid || "";

        slideSyncInFlightRef.current = true;
        window.electronAPI
          .resolveSlideTheme({
            presentationPath: presPath,
            cueUuid: uuid,
            themeSlideUuid: themeUuid,
            customWorkspaceDir: configRef.current?.customWorkspaceDir || "",
            proHost: effectiveHost,
            liveText: text
          })
          .then((resolved) => {
            if (seq !== slideSyncSeqRef.current) return;
            slideSyncInFlightRef.current = false;
            const nextTheme = resolved || null;
            const vKey = nextTheme?.versionKey || "none";
            if (vKey !== lastThemeVersionRef.current) {
              lastThemeVersionRef.current = vKey;
              setThemeInfo(nextTheme);
            }
            setCurrentSlideText(text);
            setNextSlideText(nextText || "");
            safeBroadcast({
              type: "SLIDE_UPDATE",
              text,
              nextText: nextText || "",
              hasThemeInfo: true,
              themeInfo: nextTheme
            });
          })
          .catch(() => {
            if (seq !== slideSyncSeqRef.current) return;
            slideSyncInFlightRef.current = false;
            setCurrentSlideText(text);
            setNextSlideText(nextText || "");
            safeBroadcast({
              type: "SLIDE_UPDATE",
              text,
              nextText: nextText || ""
            });
          });
      },
      onMetaChange: (meta) => {
        themeDepsRef.current.presentationPath = meta?.presentationPath || "";
        if (typeof meta?.liveText === "string") {
          latestLiveTextRef.current = meta.liveText;
        }
        const screens = meta?.audienceScreens || [];
        let scrIdx = 0;
        if (screens.length > 0) {
          const prefIdx = configRef.current?.propresenterScreenIndex;
          const prefUuid = defaultScreenUuidRef.current;
          if (prefIdx >= 0 && prefIdx < screens.length) {
            scrIdx = prefIdx;
          } else if (prefUuid) {
            const found = screens.findIndex((s) => s.uuid === prefUuid);
            if (found >= 0) scrIdx = found;
          } else {
            const mainIdx = screens.findIndex((s) => /\bmain\b/i.test(s.name || ""));
            scrIdx = mainIdx >= 0 ? mainIdx : 0;
          }
        }
        const lookScr = findMatchingLookScreen(meta?.lookScreens, screens, scrIdx);
        themeDepsRef.current.themeSlideUuid = extractLookThemeSlideUuid(lookScr);
        themeDepsRef.current.slideAllowed = lookScr?.slide !== false;
        setProMeta(meta);
      },
      onError: (err) => {
        console.warn("ProPresenter error:", err);
      }
    });

    connectorRef.current = conn;
    conn.connect();

    return () => {
      conn.disconnect();
    };
  }, [config.proHost, config.proPort, safeBroadcast]);

  // Pick active ProPresenter Audience Screen index
  const effectiveProScreenIndex = (() => {
    const screens = proMeta.audienceScreens || [];
    if (screens.length === 0) return 0;
    if (config.propresenterScreenIndex >= 0 && config.propresenterScreenIndex < screens.length) {
      return config.propresenterScreenIndex;
    }
    if (defaultScreenUuid) {
      const prefIdx = screens.findIndex((s) => s.uuid === defaultScreenUuid);
      if (prefIdx >= 0) return prefIdx;
    }
    const mainIdx = screens.findIndex((s) => /\bmain\b/i.test(s.name || ""));
    return mainIdx >= 0 ? mainIdx : 0;
  })();

  const activeLookScreen = findMatchingLookScreen(
    proMeta.lookScreens,
    proMeta.audienceScreens,
    effectiveProScreenIndex
  );
  const lookPresentationUuid = extractLookThemeSlideUuid(activeLookScreen);
  const lookSlideAllowed = activeLookScreen?.slide !== false;
  themeDepsRef.current = {
    presentationPath: proMeta.presentationPath || "",
    themeSlideUuid: lookPresentationUuid,
    slideAllowed: lookSlideAllowed
  };

  // Live resolve ProPresenter Theme, Layer Transitions & Slide Layout (checks mtimeMs every 450ms)
  useEffect(() => {
    let cancelled = false;
    const effectiveHost = config.proHost || PROPRESENTER_HOST;
    const customWorkspaceDir = config.customWorkspaceDir || "";

    const resolveTheme = async () => {
      if (window.electronAPI?.getLayerTransitions) {
        try {
          const lt = await window.electronAPI.getLayerTransitions({ proHost: effectiveHost });
          const ltKey = JSON.stringify(lt || null);
          if (!cancelled && ltKey !== lastLayerTransitionsKeyRef.current) {
            lastLayerTransitionsKeyRef.current = ltKey;
            setLayerTransitions(lt || { media: null, slide: null });
          }
        } catch (_) {}
      } else if (window.electronAPI?.getMediaTransition) {
        try {
          const tr = await window.electronAPI.getMediaTransition({ proHost: effectiveHost });
          const trKey = JSON.stringify(tr || null);
          if (!cancelled && trKey !== lastLayerTransitionsKeyRef.current) {
            lastLayerTransitionsKeyRef.current = trKey;
            setLayerTransitions({ media: tr || null, slide: null });
          }
        } catch (_) {}
      }

      if (!window.electronAPI?.resolveSlideTheme) return;

      if (!lookSlideAllowed) {
        if (!cancelled && lastThemeVersionRef.current !== "disabled") {
          lastThemeVersionRef.current = "disabled";
          setThemeInfo(null);
          safeBroadcast({ type: "THEME_UPDATE", themeInfo: null });
        }
        return;
      }

      if (slideSyncInFlightRef.current) return;
      const liveTxt = latestLiveTextRef.current || currentSlideTextRef.current;
      if (!proMeta.cueUuid && !liveTxt && proMeta.slideLayerActive === false) {
        if (!cancelled && lastThemeVersionRef.current !== "none") {
          lastThemeVersionRef.current = "none";
          setThemeInfo(null);
          safeBroadcast({ type: "THEME_UPDATE", themeInfo: null });
        }
        return;
      }

      const startSeq = slideSyncSeqRef.current;
      const resolved = await window.electronAPI.resolveSlideTheme({
        presentationPath: proMeta.presentationPath,
        cueUuid: proMeta.cueUuid,
        themeSlideUuid: lookPresentationUuid,
        customWorkspaceDir,
        proHost: effectiveHost,
        liveText: liveTxt
      });

      if (cancelled || slideSyncInFlightRef.current || startSeq !== slideSyncSeqRef.current) {
        return;
      }

      const vKey = resolved?.versionKey || "none";
      if (vKey !== lastThemeVersionRef.current) {
        lastThemeVersionRef.current = vKey;
        setThemeInfo(resolved || null);
        safeBroadcast({ type: "THEME_UPDATE", themeInfo: resolved || null });
      }
    };

    resolveTheme();
    const timer = setInterval(resolveTheme, 450);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [
    proMeta.presentationPath,
    proMeta.cueUuid,
    lookPresentationUuid,
    lookSlideAllowed,
    config.proHost,
    config.customWorkspaceDir,
    safeBroadcast
  ]);

  // Resolve ProPresenter Media, Video Input, Props & Message Layers directly
  const showVideoInputLayer = Boolean(
    proMeta.layers?.video_input && activeLookScreen?.video_input !== false
  );
  const showMediaLayer = Boolean(
    proMeta.layers?.media && activeLookScreen?.media !== false
  );
  const showPropsLayer = Boolean(
    proMeta.layers?.props && activeLookScreen?.props !== false
  );
  const showMessageOverlay = Boolean(
    proMeta.layers?.messages &&
      activeLookScreen?.messages !== false &&
      proMeta.stageMessage
  );
  const activePropsList = showPropsLayer ? proMeta.activeProps || [] : [];
  const lookSlideDisabled = activeLookScreen?.slide === false;
  const isSlideLayerLive = proMeta.slideLayerActive !== false && !lookSlideDisabled;
  const displaySlideText = isSlideLayerLive ? currentSlideText : "";
  const hasSlideMedia = isSlideLayerLive && doesThemeHaveSlideMedia(themeInfo);
  const hasSlideVideo = isSlideLayerLive && doesThemeHaveSlideVideo(themeInfo);
  const isSlideActive = Boolean(displaySlideText) || hasSlideMedia;

  // Pre-warm media catalog lookup map (metadata only — no GPU video decoders created until playback)
  useEffect(() => {
    let cancelled = false;
    window.electronAPI
      ?.getMediaCatalog?.({
        presentationPath: proMeta.presentationPath,
        customWorkspaceDir: config.customWorkspaceDir || "",
        proHost: config.proHost || PROPRESENTER_HOST
      })
      ?.then((items) => {
        if (cancelled || !Array.isArray(items)) return;
        for (const item of items) {
          if (item.uuid) {
            resolvedMediaCacheRef.current.set(`uuid:${String(item.uuid).toLowerCase()}`, item);
          }
          if (item.name) {
            const base = item.name.replace(/\.[^.]+$/, "").toLowerCase();
            resolvedMediaCacheRef.current.set(`name:${item.name.toLowerCase()}`, item);
            resolvedMediaCacheRef.current.set(`name:${base}`, item);
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [proMeta.presentationPath, config.proHost, config.customWorkspaceDir]);

  useEffect(() => {
    let cancelled = false;

    const syncLayers = async () => {
      let nextMedia = null;

      if (showMediaLayer) {
        if (proMeta.activeMediaItem?.uuid || proMeta.activeMediaItem?.name) {
          const normUuid = String(proMeta.activeMediaItem.uuid || "").toLowerCase();
          const normName = String(proMeta.activeMediaItem.name || "").trim().toLowerCase();
          const normNameNoExt = normName.replace(/\.[^.]+$/, "");
          const cacheKey = `${normUuid}::${normName}::${proMeta.presentationPath || ""}`;
          let resolved =
            resolvedMediaCacheRef.current.get(cacheKey) ||
            (normUuid && resolvedMediaCacheRef.current.get(`uuid:${normUuid}`)) ||
            (normName && resolvedMediaCacheRef.current.get(`name:${normName}`)) ||
            (normNameNoExt && resolvedMediaCacheRef.current.get(`name:${normNameNoExt}`));
          if (resolved === undefined) {
            resolved = await window.electronAPI?.resolveMediaItem?.({
              mediaUuid: proMeta.activeMediaItem.uuid,
              mediaName: proMeta.activeMediaItem.name,
              presentationPath: proMeta.presentationPath,
              customWorkspaceDir: config.customWorkspaceDir || "",
              proHost: config.proHost || PROPRESENTER_HOST
            });
            if (resolved?.fileUrl) {
              resolvedMediaCacheRef.current.set(cacheKey, resolved);
            }
          }
          const thumbUrl = proMeta.activeMediaItem.uuid
            ? `http://${config.proHost || PROPRESENTER_HOST}:${config.proPort || PROPRESENTER_PORT}/v1/media/${proMeta.activeMediaItem.uuid}/thumbnail?quality=1920`
            : "";

          if (resolved?.fileUrl) {
            nextMedia = {
              url: resolved.fileUrl,
              thumbUrl,
              mediaType: resolved.mediaType,
              name: resolved.name || proMeta.activeMediaItem.name,
              transition: resolved.transition || null
            };
          } else if (themeInfo?.cueMedia?.fileUrl) {
            nextMedia = {
              url: themeInfo.cueMedia.fileUrl,
              thumbUrl,
              mediaType: themeInfo.cueMedia.mediaType,
              name: themeInfo.cueMedia.name || proMeta.activeMediaItem.name || "Media",
              transition: themeInfo.cueMedia.transition || null
            };
          } else if (thumbUrl) {
            nextMedia = {
              url: thumbUrl,
              thumbUrl,
              mediaType: "image",
              name: proMeta.activeMediaItem.name || "Media",
              transition: null
            };
          }
        } else if (themeInfo?.cueMedia?.fileUrl) {
          nextMedia = {
            url: themeInfo.cueMedia.fileUrl,
            thumbUrl: "",
            mediaType: themeInfo.cueMedia.mediaType,
            name: themeInfo.cueMedia.name,
            transition: themeInfo.cueMedia.transition || null
          };
        }
      }

      if (cancelled) return;

      const mediaKey = JSON.stringify({
        nextMedia,
        layerTransitions,
        stageMessage: showMessageOverlay ? proMeta.stageMessage : ""
      });

      if (mediaKey !== lastMediaKeyRef.current) {
        lastMediaKeyRef.current = mediaKey;
        setActiveMedia(nextMedia);
        const payload = {
          activeMedia: nextMedia,
          mediaTransition: layerTransitions.media || null,
          slideTransition: layerTransitions.slide || null,
          stageMessage: showMessageOverlay ? proMeta.stageMessage : ""
        };
        layerStateRef.current = payload;
        safeBroadcast({
          type: "LAYER_STATE_UPDATE",
          layerState: payload
        });
      }
    };

    syncLayers();
    return () => {
      cancelled = true;
    };
  }, [
    showMediaLayer,
    showMessageOverlay,
    proMeta.activeMediaItem,
    proMeta.presentationPath,
    proMeta.stageMessage,
    config.proHost,
    config.proPort,
    config.customWorkspaceDir,
    themeInfo,
    layerTransitions,
    safeBroadcast
  ]);

  const handleReconnect = () => {
    suppressedSlideKeyRef.current = "";
    lastThemeVersionRef.current = "";
    connectorRef.current?.connect();
  };

  const handleClearSlide = useCallback(() => {
    slideSyncSeqRef.current++;
    slideSyncInFlightRef.current = false;
    latestLiveTextRef.current = "";
    lastThemeVersionRef.current = "none";
    const conn = connectorRef.current;
    const prevKey = conn ? `${conn.currentUuid || ""}::${conn.currentText || ""}` : "";
    if (prevKey && prevKey !== "::") {
      suppressedSlideKeyRef.current = prevKey;
    }
    setThemeInfo(null);
    setCurrentSlideText("");
    safeBroadcast({
      type: "SLIDE_UPDATE",
      text: "",
      nextText: "",
      hasThemeInfo: true,
      themeInfo: null
    });
    if (conn?.clearSlideLayer) {
      conn.clearSlideLayer().then((ok) => {
        if (ok && suppressedSlideKeyRef.current === prevKey) {
          suppressedSlideKeyRef.current = "";
        }
      });
    }
  }, [safeBroadcast]);

  const handleToggleAnimation = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      animationEnabled: prev.animationEnabled === false
    }));
  }, []);

  const handleToggleTextEffect = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      textEffectEnabled: !prev.textEffectEnabled
    }));
  }, []);

  const handleToggleFavoritePreset = useCallback((id) => {
    if (!VALID_PRESET_IDS.has(id)) return;
    setConfig((prev) => {
      const list = Array.isArray(prev.favoritePresets) ? prev.favoritePresets : [];
      const exists = list.includes(id);
      return {
        ...prev,
        favoritePresets: exists ? list.filter((item) => item !== id) : [...list, id]
      };
    });
  }, []);

  const handleToggleFavoriteEffect = useCallback((id) => {
    if (!VALID_TEXT_EFFECT_IDS.has(id)) return;
    setConfig((prev) => {
      const list = Array.isArray(prev.favoriteEffects) ? prev.favoriteEffects : [];
      const exists = list.includes(id);
      return {
        ...prev,
        favoriteEffects: exists ? list.filter((item) => item !== id) : [...list, id]
      };
    });
  }, []);

  const handleApplyQuickPreset = useCallback((qp) => {
    if (!qp) return;
    setConfig((prev) => {
      if (qp.animationEnabled === false) {
        return { ...prev, animationEnabled: false };
      }
      return {
        ...prev,
        animationEnabled: true,
        presetId: qp.presetId || prev.presetId,
        durationSeconds: qp.durationSeconds || prev.durationSeconds
      };
    });
  }, []);

  const handlePreviousSlide = useCallback(() => {
    suppressedSlideKeyRef.current = "";
    connectorRef.current?.triggerPreviousSlide();
  }, []);

  const handleNextSlide = useCallback(() => {
    suppressedSlideKeyRef.current = "";
    connectorRef.current?.triggerNextSlide();
  }, []);

  const dispatchShortcutAction = useCallback(
    (action) => {
      if (!action?.type) return;
      switch (action.type) {
        case "clear":
          handleClearSlide();
          break;
        case "toggleAnimation":
          handleToggleAnimation();
          break;
        case "slideBefore":
          handlePreviousSlide();
          break;
        case "slideAfter":
          handleNextSlide();
          break;
        case "quickPreset": {
          const qp = (configRef.current?.quickPresets || []).find(
            (item) => item.id === action.presetId
          );
          if (qp) handleApplyQuickPreset(qp);
          break;
        }
        default:
          break;
      }
    },
    [
      handleClearSlide,
      handleToggleAnimation,
      handlePreviousSlide,
      handleNextSlide,
      handleApplyQuickPreset
    ]
  );
  dispatchShortcutActionRef.current = dispatchShortcutAction;

  // Configurable global keyboard shortcuts (disabled while configuring on Settings page)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (showSettings) return;
      const action = resolveShortcutAction(e, configRef.current);
      if (!action) return;
      e.preventDefault();
      dispatchShortcutAction(action);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showSettings, dispatchShortcutAction]);

  // Auto detect Windows displays on mount
  const handleScanScreens = useCallback(async () => {
    if (window.electronAPI?.getScreens) {
      try {
        const screens = await window.electronAPI.getScreens();
        setScreensList(screens);
        setSelectedScreenIndex((prev) => {
          if (screens.length > 1 && (prev >= screens.length || prev === 0)) return 1;
          if (screens.length === 1) return 0;
          return prev;
        });
        return;
      } catch (_) {}
    }

    if ("getScreenDetails" in window) {
      try {
        const details = await window.getScreenDetails();
        screenDetailsRef.current = details;
        setScreensList([...details.screens]);
        if (details.screens.length > 1) setSelectedScreenIndex(1);
      } catch (_) {}
    }
  }, []);

  useEffect(() => {
    handleScanScreens();
  }, [handleScanScreens]);

  // Track remote smartphone clients and receive remote commands
  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubs = [];

    if (window.electronAPI.onRemoteClientCountChange) {
      unsubs.push(
        window.electronAPI.onRemoteClientCountChange((count) => {
          setRemoteClientCount(count);
        })
      );
    }

    if (window.electronAPI.onRemoteConfigUpdate) {
      unsubs.push(
        window.electronAPI.onRemoteConfigUpdate((configDelta) => {
          setConfig((prev) => {
            if (configDelta.countdownOverlay) {
              return {
                ...prev,
                ...configDelta,
                countdownOverlay: {
                  ...(prev.countdownOverlay || {}),
                  ...configDelta.countdownOverlay
                }
              };
            }
            return { ...prev, ...configDelta };
          });
        })
      );
    }

    if (window.electronAPI.onRemoteActionTrigger) {
      unsubs.push(
        window.electronAPI.onRemoteActionTrigger((action) => {
          if (action === "clear-slide") {
            handleClearSlide();
          } else if (action === "start-countdown") {
            handleStartCountdown();
          } else if (action === "pause-countdown") {
            handlePauseCountdown();
          } else if (action === "reset-countdown") {
            handleResetCountdown();
          } else if (action === "toggle-countdown") {
            handleToggleCountdownOverlay();
          } else if (action === "toggle-ticker") {
            handleToggleTickerOverlay();
          }
        })
      );
    }

    return () => {
      unsubs.forEach((unsub) => {
        try {
          unsub();
        } catch (_) {}
      });
    };
  }, [
    handleClearSlide,
    handleStartCountdown,
    handlePauseCountdown,
    handleResetCountdown,
    handleToggleCountdownOverlay,
    handleToggleTickerOverlay
  ]);

  // Sync state to remote smartphone clients
  useEffect(() => {
    if (!window.electronAPI?.syncRemoteState) return;

    window.electronAPI.syncRemoteState({
      config,
      countdownRuntime,
      slideSummary: {
        text: currentSlideText,
        hasMedia: hasSlideMedia,
        group: proMeta.currSlideGroup || "",
        position: proMeta.slidePosition || null,
        themeName: themeInfo?.themeName || ""
      }
    });
  }, [
    config,
    countdownRuntime,
    currentSlideText,
    hasSlideMedia,
    proMeta.currSlideGroup,
    proMeta.slidePosition,
    themeInfo?.themeName
  ]);

  const handleToggleProjector = async () => {
    if (window.electronAPI?.launchProjector) {
      if (isProjectorLive) {
        window.electronAPI.closeProjector();
      } else {
        window.electronAPI.launchProjector(selectedScreenIndex);
      }
      return;
    }

    // Web browser fallback
    if (popupWindowRef.current && !popupWindowRef.current.closed) {
      popupWindowRef.current.close();
      popupWindowRef.current = null;
      setIsProjectorLive(false);
      return;
    }

    const url = `${window.location.origin}${window.location.pathname}?mode=projector`;
    const screens = screenDetailsRef.current?.screens || screensList;
    let win = null;
    if (screens && screens.length > 0 && screens[selectedScreenIndex]) {
      const targetScreen = screens[selectedScreenIndex];
      const left = targetScreen.availLeft ?? targetScreen.left ?? 0;
      const top = targetScreen.availTop ?? targetScreen.top ?? 0;
      const width = targetScreen.availWidth ?? targetScreen.width ?? 1920;
      const height = targetScreen.availHeight ?? targetScreen.height ?? 1080;

      const windowFeatures = `left=${left},top=${top},width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no,resizable=yes`;
      win = window.open(url, "LyricProjectorWindow", windowFeatures);
    } else {
      win = window.open(
        url,
        "LyricProjectorWindow",
        "width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no"
      );
    }
    if (win) {
      popupWindowRef.current = win;
      setIsProjectorLive(true);
      win.focus();
      win.addEventListener("beforeunload", () => {
        popupWindowRef.current = null;
        setIsProjectorLive(false);
      });
    }
  };

  const handleToggleLivePopout = () => {
    const rect = stageViewportRef.current?.getBoundingClientRect();
    const bounds = rect
      ? {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          left: Math.round(rect.left),
          top: Math.round(rect.top)
        }
      : { width: 720, height: 405, left: 0, top: 0 };

    if (window.electronAPI?.launchLivePopout) {
      if (isLivePopoutOpen) {
        window.electronAPI.closeLivePopout();
      } else {
        window.electronAPI.launchLivePopout(bounds);
      }
      return;
    }

    if (livePopoutRef.current && !livePopoutRef.current.closed) {
      livePopoutRef.current.close();
      livePopoutRef.current = null;
      setIsLivePopoutOpen(false);
      return;
    }

    const url = `${window.location.origin}${window.location.pathname}?mode=live-popout`;
    const win = window.open(
      url,
      "LiveProgramPopout",
      `width=${bounds.width},height=${bounds.height},menubar=no,toolbar=no,location=no,status=no,resizable=yes`
    );
    if (win) {
      livePopoutRef.current = win;
      setIsLivePopoutOpen(true);
      win.focus();
      win.addEventListener("beforeunload", () => {
        livePopoutRef.current = null;
        setIsLivePopoutOpen(false);
      });
    }
  };

  const activeScreenLabel = screensList[selectedScreenIndex]?.label || `Layar ${selectedScreenIndex + 1}`;

  return (
    <div className={`pro-app-container ${showSettings ? "settings-view" : "live-view"}`}>
      {/* Top Header */}
      <header className="pro-header">
        <div className="pro-header-brand">
          <img
            src={appIconUrl}
            alt="ProPresenter Lyric Animator"
            className="pro-logo-icon"
          />
          <div className="pro-header-brand-text">
            <h1 className="pro-title">ProPresenter Lyric Animator</h1>
            <p className="pro-subtitle">
              Sinkronisasi Otomatis Theme, Media &amp; Animasi Teks &bull; by Devan Andika Wiratama
            </p>
          </div>
        </div>

        <div className="pro-header-actions">
          <div className={`pro-status-indicator ${connStatus.connected ? "connected" : "disconnected"}`} title={connStatus.message || (connStatus.connected ? "Terhubung" : "Terputus")}>
            <span className="status-dot" />
            <span className="status-text">{connStatus.message || (connStatus.connected ? "Terhubung" : "Terputus")}</span>
          </div>

          <button className="btn-secondary" onClick={handleReconnect} title="Hubungkan Ulang ke ProPresenter">
            <span>↻</span>
            <span className="btn-reconnect-text"> Reconnect</span>
          </button>

          <button
            type="button"
            className={`btn-secondary btn-settings-nav ${showSettings ? "active" : ""}`}
            onClick={() => setShowSettings(true)}
            disabled={showSettings}
            title={
              showSettings
                ? "Sedang berada di halaman Pengaturan"
                : "Buka Pengaturan Shortcut & Tombol Cepat"
            }
          >
            <span>⚙️</span>
            <span className="btn-settings-nav-text"> Pengaturan</span>
          </button>

          {/* Direct Windows Display Selector + ProPresenter-style Round Live Toggle */}
          <div className="screen-select-wrap">
            {screensList.length > 0 ? (
              <>
                <select
                  className="screen-select"
                  value={selectedScreenIndex}
                  onChange={(e) => {
                    const nextIdx = Number(e.target.value);
                    setSelectedScreenIndex(nextIdx);
                    if (isProjectorLive && window.electronAPI?.launchProjector) {
                      window.electronAPI.launchProjector(nextIdx);
                    }
                  }}
                >
                  {screensList.map((screen, idx) => (
                    <option key={screen.id || idx} value={idx}>
                      🖥️ {screen.label || `Layar ${idx + 1}`}
                      {screen.isPrimary ? " [Utama]" : " [Eksternal]"}
                    </option>
                  ))}
                </select>
                <button
                  className="btn-secondary"
                  onClick={handleScanScreens}
                  title="Muat ulang daftar layar"
                >
                  ↻
                </button>
              </>
            ) : (
              <button className="btn-scan-screens" onClick={handleScanScreens}>
                🔍 Deteksi Layar
              </button>
            )}

            <button
              type="button"
              className={`btn-output-toggle ${isProjectorLive ? "live" : "offline"}`}
              onClick={handleToggleProjector}
              title={
                isProjectorLive
                  ? `Output Aktif (Live) di ${activeScreenLabel} — Klik untuk matikan`
                  : `Output Non-Aktif — Klik untuk buka Live di ${activeScreenLabel}`
              }
              aria-label={
                isProjectorLive ? "Matikan layar output live" : `Buka layar output di ${activeScreenLabel}`
              }
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="2" y="4" width="20" height="13" rx="2" />
                <path d="M8 21h8" />
                <path d="M12 17v4" />
              </svg>
            </button>
          </div>

          {/* Smartphone Web Remote Control Button */}
          <button
            type="button"
            className={`btn-remote-status ${remoteClientCount > 0 ? "connected" : ""}`}
            onClick={() => setShowRemoteModal(true)}
            title={
              remoteClientCount > 0
                ? `${remoteClientCount} HP terhubung — Klik untuk lihat QR / URL`
                : "Kontrol lewat HP — Klik untuk scan QR Code"
            }
          >
            <span className="remote-status-dot" />
            <span className="remote-icon">📱</span>
            <span className="remote-btn-text">
              {remoteClientCount > 0 ? "Terhubung HP" : "Kontrol HP"}
            </span>
            {remoteClientCount > 0 && (
              <span className="remote-count-num">({remoteClientCount})</span>
            )}
          </button>

          {/* User Guide Modal Button (Sebelah Kanan Kontrol HP) */}
          <button
            type="button"
            className="btn-guide-nav"
            onClick={() => setShowGuideModal(true)}
            title="Buka Buku Panduan Pengguna Lengkap & Referensi Shortcut"
          >
            <span className="guide-icon">📖</span>
            <span className="guide-btn-text">Panduan</span>
          </button>

        </div>
      </header>

      {showSettings && (
        <SettingsView
          config={config}
          onUpdateConfig={setConfig}
          onBack={() => setShowSettings(false)}
          countdownRuntime={countdownRuntime}
          onStartTimer={handleStartCountdown}
          onPauseTimer={handlePauseCountdown}
          onResetTimer={handleResetCountdown}
          updateState={updateState}
          onCheckForUpdates={handleCheckForUpdates}
          onDownloadUpdate={handleDownloadUpdate}
          onQuitAndInstall={handleQuitAndInstall}
        />
      )}

      {/* Main Grid: Control & Live Stage */}
      <div
        className="pro-grid"
        style={{ display: showSettings ? "none" : undefined }}
      >
        {/* Left Column: ProPresenter Sync & Animation */}
        <aside className="pro-sidebar">
          {/* ProPresenter Connection & Theme Sync */}
          <div className="card card-connection">
            <h2 className="card-title">📡 Koneksi &amp; Theme ProPresenter</h2>

            {proMeta.audienceScreens.length > 0 && (
              <div className="form-group">
                <label>Ikuti Screen / Device ProPresenter</label>
                <select
                  value={effectiveProScreenIndex}
                  onChange={(e) =>
                    setConfig({ ...config, propresenterScreenIndex: Number(e.target.value) })
                  }
                >
                  {proMeta.audienceScreens.map((scr) => (
                    <option key={scr.uuid || scr.index} value={scr.index}>
                      {scr.name} ({scr.width}x{scr.height})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="theme-status-box">
              <div className="theme-status-meta">
                <div>
                  <strong>Look Aktif:</strong> {proMeta.lookName || "-"}
                </div>
                <div>
                  <strong>Presentasi:</strong> {proMeta.presentationName || "-"}
                </div>
                <div>
                  <strong>Theme Terbaca:</strong>{" "}
                  {themeInfo
                    ? themeInfo.source === "bible-theme"
                      ? `${themeInfo.themeName}${themeInfo.slideName ? ` • ${themeInfo.slideName}` : ""} (Bible Theme)`
                      : themeInfo.source === "look-theme"
                      ? `${themeInfo.themeName}${themeInfo.slideName ? ` • ${themeInfo.slideName}` : ""} (Look Override)`
                      : themeInfo.matchedByLayout
                      ? `${themeInfo.themeName}${themeInfo.slideName ? ` • ${themeInfo.slideName}` : ""} (Slide Theme)`
                      : "Layout Bawaan Slide (Tanpa Look Override)"
                    : "Menunggu slide / file .pro"}
                </div>
                {showPropsLayer && (
                  <div>
                    <strong>Prop Aktif:</strong>{" "}
                    {activePropsList.length > 0
                      ? activePropsList.map((p) => p.name).join(", ")
                      : "Aktif"}
                  </div>
                )}
                {activeMedia && (
                  <div>
                    <strong>Media Aktif:</strong> {activeMedia.name} ({activeMedia.mediaType})
                  </div>
                )}
              </div>

              <div className="layers-channel-strip">
                <span className={`layer-strip-item ${showVideoInputLayer ? "active" : ""}`}>
                  Live Input
                </span>
                <span className={`layer-strip-item ${showMediaLayer ? "active" : ""}`}>
                  Media
                </span>
                <span className={`layer-strip-item ${!lookSlideDisabled && proMeta.layers?.slide ? "active" : ""}`}>
                  Slide
                </span>
                <span className={`layer-strip-item ${showPropsLayer ? "active" : ""}`}>
                  Props
                </span>
                <span className={`layer-strip-item ${proMeta.layers?.announcements ? "active" : ""}`}>
                  Announcements
                </span>
                <span className={`layer-strip-item ${showMessageOverlay ? "active" : ""}`}>
                  Messages
                </span>
              </div>
            </div>
          </div>

          {/* Animation Settings */}
          <div className="card card-animation">
            <h2 className="card-title">🎨 Animasi Teks (After Effects)</h2>

            {config.quickPresets?.length > 0 && (
              <div className="quick-preset-row">
                {config.quickPresets.map((qp) => {
                  const isMatch =
                    qp.animationEnabled === false
                      ? config.animationEnabled === false
                      : config.animationEnabled !== false &&
                        config.presetId === qp.presetId &&
                        Math.abs((config.durationSeconds || 1.0) - qp.durationSeconds) < 0.05;
                  return (
                    <button
                      key={qp.id}
                      type="button"
                      className={`btn-quick-preset ${isMatch ? "active" : ""} ${
                        qp.animationEnabled === false ? "liturgy" : ""
                      }`}
                      onClick={() => handleApplyQuickPreset(qp)}
                      title={`${qp.label}: ${
                        qp.animationEnabled === false
                          ? "Ikut Animasi / Transisi ProPresenter"
                          : `${allAnimPresets[qp.presetId]?.name || qp.presetId} (${qp.durationSeconds.toFixed(1)}s)`
                      }${qp.shortcut ? ` — Shortcut: ${qp.shortcut}` : ""}`}
                    >
                      <span>{qp.label}</span>
                      {qp.shortcut && <kbd className="shortcut-kbd">{qp.shortcut}</kbd>}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="form-group">
              <label>Preset Animasi In &amp; Out</label>
              {(() => {
                const favPresetIds = Array.isArray(config.favoritePresets)
                  ? config.favoritePresets
                  : [];
                const isPresetFav = favPresetIds.includes(config.presetId);
                return (
                  <div className="select-with-fav">
                    <FavoriteSelect
                      value={config.presetId}
                      onChange={(nextId) => setConfig({ ...config, presetId: nextId })}
                      categories={allAnimCategories}
                      itemsById={allAnimPresets}
                      favoriteIds={favPresetIds}
                      onToggleFavorite={handleToggleFavoritePreset}
                      ariaLabel="Preset Animasi In & Out"
                      previewMode="animation"
                      previewOptions={{
                        durationSeconds: config.durationSeconds,
                        sampleText: displaySlideText,
                        themeInfo,
                        activeMedia
                      }}
                    />
                    <button
                      type="button"
                      className={`btn-fav-star ${isPresetFav ? "active" : ""}`}
                      onClick={() => handleToggleFavoritePreset(config.presetId)}
                      title={
                        isPresetFav
                          ? "Hapus animasi ini dari Favorit"
                          : "Tambah animasi ini ke Favorit"
                      }
                      aria-label={
                        isPresetFav
                          ? "Hapus animasi ini dari Favorit"
                          : "Tambah animasi ini ke Favorit"
                      }
                      aria-pressed={isPresetFav}
                    >
                      {isPresetFav ? "★" : "☆"}
                    </button>
                  </div>
                );
              })()}
            </div>

            <div className="form-group">
              <div className="flex-between">
                <label>Durasi Animasi</label>
                <span className="value-tag">{Number(config.durationSeconds || 1.0).toFixed(1)}s</span>
              </div>
              <Slider
                min={0.5}
                max={5.0}
                step={0.1}
                value={config.durationSeconds}
                onChange={(val) => setConfig({ ...config, durationSeconds: val })}
                aria-label="Durasi Animasi"
              />
            </div>

            <div className="fx-section-box">
              <div className="fx-section-header">
                <span className="fx-section-title">⚡ Transisi Saat Animasi Off</span>
                <OffTransitionSegment
                  value={config.offTransitionMode}
                  disabled={config.animationEnabled !== false}
                  onChange={(mode) => setConfig({ ...config, offTransitionMode: mode })}
                />
              </div>
            </div>

            <div className="fx-section-box">
              <div className="fx-section-header">
                <span className="fx-section-title">〰️ Efek Teks (Wiggle &amp; Distorsi)</span>
              </div>

              <div className="fx-controls-body">
                <div className="form-group">
                  {(() => {
                    const currentFxId = config.textEffectId || "ae-wiggle-pos";
                    const favEffectIds = Array.isArray(config.favoriteEffects)
                      ? config.favoriteEffects
                      : [];
                    const isEffectFav = favEffectIds.includes(currentFxId);
                    return (
                      <div className="select-with-fav">
                        <FavoriteSelect
                          value={currentFxId}
                          onChange={(nextId) => setConfig({ ...config, textEffectId: nextId })}
                          categories={allTextEffectCategories}
                          itemsById={allTextEffects}
                          favoriteIds={favEffectIds}
                          onToggleFavorite={handleToggleFavoriteEffect}
                          ariaLabel="Pilih Efek Teks Bergoyang"
                          previewMode="effect"
                          previewOptions={{
                            intensity: config.textEffectIntensity,
                            speed: config.textEffectSpeed,
                            sampleText: displaySlideText,
                            themeInfo,
                            activeMedia
                          }}
                        />
                        <button
                          type="button"
                          className={`btn-fav-star ${isEffectFav ? "active" : ""}`}
                          onClick={() => handleToggleFavoriteEffect(currentFxId)}
                          title={
                            isEffectFav
                              ? "Hapus efek teks ini dari Favorit"
                              : "Tambah efek teks ini ke Favorit"
                          }
                          aria-label={
                            isEffectFav
                              ? "Hapus efek teks ini dari Favorit"
                              : "Tambah efek teks ini ke Favorit"
                          }
                          aria-pressed={isEffectFav}
                        >
                          {isEffectFav ? "★" : "☆"}
                        </button>
                      </div>
                    );
                  })()}
                </div>

                <div className="fx-sliders-grid">
                  <div className="form-group">
                    <div className="flex-between">
                      <label>Intensitas</label>
                      <span className="value-tag">
                        {Number(config.textEffectIntensity || 1.0).toFixed(1)}x
                      </span>
                    </div>
                    <Slider
                      min={0.2}
                      max={2.5}
                      step={0.1}
                      value={config.textEffectIntensity ?? 1.0}
                      onChange={(val) =>
                        setConfig({
                          ...config,
                          textEffectIntensity: val
                        })
                      }
                      aria-label="Intensitas Efek Teks"
                    />
                  </div>

                  <div className="form-group">
                    <div className="flex-between">
                      <label>Kecepatan</label>
                      <span className="value-tag">
                        {Number(config.textEffectSpeed || 1.0).toFixed(1)}x
                      </span>
                    </div>
                    <Slider
                      min={0.2}
                      max={3.0}
                      step={0.1}
                      value={config.textEffectSpeed ?? 1.0}
                      onChange={(val) =>
                        setConfig({
                          ...config,
                          textEffectSpeed: val
                        })
                      }
                      aria-label="Kecepatan Efek Teks"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Column: Live Monitor & Output Preview */}
        {(() => {
          const baseEffectiveSlide = resolveEffectiveSlideConfig(
            config,
            displaySlideText,
            proMeta.presentationName,
            proMeta.currSlideGroup
          );
          const isCurrentScripture =
            Boolean(isSlideActive && displaySlideText) &&
            (baseEffectiveSlide.isScriptureModeActive || themeInfo?.source === "bible-theme");
          const isCurrentVideoLyric = Boolean(isSlideActive && hasSlideVideo);
          const isAutoCalmMode = isCurrentScripture || isCurrentVideoLyric;
          if (isSlideActive) {
            wasScriptureSlideRef.current = isAutoCalmMode;
          }
          const keepCalmFadeOnClear = !isSlideActive && wasScriptureSlideRef.current;
          const effectiveSlide = isAutoCalmMode
            ? {
                ...baseEffectiveSlide,
                animationEnabled: false,
                offTransitionMode: "fade",
                textEffectEnabled: false,
                isScriptureModeActive: isCurrentScripture
              }
            : baseEffectiveSlide;
          const stageEffectiveSlide = keepCalmFadeOnClear
            ? {
                ...baseEffectiveSlide,
                animationEnabled: false,
                offTransitionMode: "fade",
                textEffectEnabled: false,
                isScriptureModeActive: false
              }
            : effectiveSlide;
          const showAutoModeBadge = isAutoCalmMode;
          const autoModeBadgeLabel = isCurrentVideoLyric
            ? "Video Lirik Slide terdeteksi"
            : "Ayat Alkitab terdeteksi";

          return (
            <main className="pro-main-preview">
              <div className="preview-toolbar">
                <span className="preview-title live-program-tally">Live Program</span>
                <span className="preview-hint">
                  {isSlideActive
                    ? proMeta.slidePosition
                      ? `${proMeta.currSlideGroup ? `${proMeta.currSlideGroup} • ` : ""}Slide ${proMeta.slidePosition.index}/${proMeta.slidePosition.total}${hasSlideMedia && !displaySlideText ? " (Video)" : ""}`
                      : hasSlideMedia
                      ? "Slide Aktif Menampilkan Video"
                      : "Slide Aktif Menampilkan Lirik"
                    : activeMedia
                    ? "Background Media Aktif"
                    : "Slide Kosong (Clear)"}
                </span>
                <div className="preview-tools">
                  <button
                    type="button"
                    className={`btn-anim-toggle ${config.countdownOverlay?.countdownEnabled ? "on" : "off"}`}
                    onClick={handleToggleCountdownOverlay}
                    title={
                      config.countdownOverlay?.countdownEnabled
                        ? `Hitung Mundur Aktif (${countdownRuntime?.isRunning ? formatCountdownTime(countdownRuntime.remainingSeconds) : "Siap"}) — Klik untuk nonaktifkan`
                        : "Hitung Mundur Nonaktif — Klik untuk aktifkan di layar"
                    }
                    aria-pressed={Boolean(config.countdownOverlay?.countdownEnabled)}
                  >
                    ⏱ {config.countdownOverlay?.countdownEnabled && countdownRuntime?.isRunning
                      ? formatCountdownTime(countdownRuntime.remainingSeconds)
                      : "Countdown"}
                  </button>

                  <button
                    type="button"
                    className={`btn-anim-toggle ${config.countdownOverlay?.tickerEnabled ? "on" : "off"}`}
                    onClick={handleToggleTickerOverlay}
                    title={
                      config.countdownOverlay?.tickerEnabled
                        ? "Running Text Aktif — Klik untuk nonaktifkan"
                        : "Running Text Nonaktif — Klik untuk aktifkan di layar"
                    }
                    aria-pressed={Boolean(config.countdownOverlay?.tickerEnabled)}
                  >
                    💬 Ticker
                  </button>

                  <button
                    type="button"
                    className={`btn-anim-toggle ${effectiveSlide.textEffectEnabled ? "on" : "off"}`}
                    onClick={handleToggleTextEffect}
                    title={
                      isCurrentVideoLyric
                        ? "Efek Teks otomatis dimatikan saat Slide Video Lirik aktif"
                        : isCurrentScripture
                        ? "Efek Teks otomatis dimatikan saat Ayat Alkitab"
                        : config.textEffectEnabled
                        ? "Efek Teks Aktif — Klik untuk nonaktifkan"
                        : "Efek Teks Nonaktif — Klik untuk aktifkan"
                    }
                    aria-pressed={Boolean(effectiveSlide.textEffectEnabled)}
                  >
                    Efek
                  </button>

                  <button
                    type="button"
                    className={`btn-anim-toggle ${effectiveSlide.animationEnabled ? "on" : "off"}`}
                    onClick={handleToggleAnimation}
                    title={
                      isCurrentVideoLyric
                        ? "Animasi otomatis dimatikan (Mode Fade) saat Slide Video Lirik aktif"
                        : isCurrentScripture
                        ? "Animasi otomatis dimatikan (Mode Fade) saat Ayat Alkitab"
                        : config.animationEnabled !== false
                        ? "Animasi Teks Aktif — Klik untuk nonaktifkan"
                        : "Animasi Teks Nonaktif — Klik untuk aktifkan"
                    }
                    aria-pressed={Boolean(effectiveSlide.animationEnabled)}
                  >
                    Animasi
                  </button>

                  <OffTransitionSegment
                    value={effectiveSlide.offTransitionMode}
                    disabled={effectiveSlide.animationEnabled}
                    toolbar
                    onChange={(mode) => setConfig({ ...config, offTransitionMode: mode })}
                  />
                  <button
                    type="button"
                    className={`btn-popout-sm ${isLivePopoutOpen ? "active" : ""}`}
                    onClick={handleToggleLivePopout}
                    title={
                      isLivePopoutOpen
                        ? "Tutup window Live Program Preview"
                        : "Buka Live Program sebagai window baru seukuran kotak saat ini"
                    }
                    aria-label={
                      isLivePopoutOpen
                        ? "Tutup window Live Program Preview"
                        : "Buka Live Program sebagai window baru"
                    }
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M15 3h6v6" />
                      <path d="M10 14L21 3" />
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* The Viewport Stage (16:9 ProPresenter Compositor) */}
              <div className="stage-bay">
                <div
                  className={`scripture-detected-badge ${
                    showAutoModeBadge ? "visible" : ""
                  }`}
                  aria-hidden={!showAutoModeBadge}
                >
                  <span className="scripture-badge-dot" />
                  <span>{autoModeBadgeLabel}</span>
                </div>

                <div ref={stageViewportRef} className="stage-viewport">
                  {/* Layer 1: Direct ProPresenter Media Video/Image */}
                  <MediaLayer
                    media={activeMedia}
                    transition={layerTransitions.media}
                  />

                  {/* Layer 2: ProPresenter Theme 1:1 + After Effects Text Animation (or ProPresenter Slide transition when OFF) */}
                  <ThemedLyricStage
                    text={displaySlideText}
                    themeInfo={themeInfo}
                    presetId={stageEffectiveSlide.presetId}
                    durationSeconds={stageEffectiveSlide.durationSeconds}
                    animationEnabled={stageEffectiveSlide.animationEnabled}
                    offTransitionMode={stageEffectiveSlide.offTransitionMode}
                    textEffectEnabled={stageEffectiveSlide.textEffectEnabled}
                    textEffectId={config.textEffectId || "ae-wiggle-pos"}
                    textEffectIntensity={config.textEffectIntensity ?? 1.0}
                    textEffectSpeed={config.textEffectSpeed ?? 1.0}
                    slideTransition={layerTransitions.slide}
                    countdownConfig={config.countdownOverlay}
                    countdownRuntime={countdownRuntime}
                    isInteractiveCountdown={true}
                    onCountdownPositionChange={handleCountdownPositionChange}
                    onCountdownFontSizeChange={handleCountdownFontSizeChange}
                  />

                  {/* Layer 3: Messages Layer */}
                  {showMessageOverlay && (
                    <div className="pro-message-overlay">{proMeta.stageMessage}</div>
                  )}

                  {!isSlideActive && !activeMedia && (
                    <div className="stage-placeholder">
                      <p>Menunggu slide atau media dari ProPresenter...</p>
                      <small>Tampilan mengikuti Theme &amp; Layer aktif di ProPresenter secara otomatis</small>
                    </div>
                  )}
                </div>
              </div>

          {/* Slide Before & After Monitor (Clickable Slide Navigation) */}
          <div className="slide-neighbors-grid">
            <button
              type="button"
              className="slide-neighbor-card before clickable"
              onClick={handlePreviousSlide}
              title={`Klik untuk pindah ke Slide Before${
                config.shortcuts?.slideBefore
                  ? ` (Shortcut: ${config.shortcuts.slideBefore})`
                  : ""
              }`}
            >
              <div className="slide-neighbor-header">
                <span className="slide-neighbor-title">
                  Slide Before
                  {config.shortcuts?.slideBefore && (
                    <kbd className="shortcut-kbd">{config.shortcuts.slideBefore}</kbd>
                  )}
                </span>
                {proMeta.prevSlide?.groupName && (
                  <span className="slide-neighbor-group">{proMeta.prevSlide.groupName}</span>
                )}
              </div>
              <div className="slide-neighbor-body">
                {proMeta.prevSlide?.text ? (
                  <p className="slide-neighbor-text">{proMeta.prevSlide.text}</p>
                ) : (
                  <p className="slide-neighbor-empty">Belum ada slide sebelumnya</p>
                )}
              </div>
            </button>

            <button
              type="button"
              className="slide-neighbor-card after clickable"
              onClick={handleNextSlide}
              title={`Klik untuk pindah ke Slide After${
                config.shortcuts?.slideAfter
                  ? ` (Shortcut: ${config.shortcuts.slideAfter})`
                  : ""
              }`}
            >
              <div className="slide-neighbor-header">
                <span className="slide-neighbor-title">
                  Slide After
                  {config.shortcuts?.slideAfter && (
                    <kbd className="shortcut-kbd">{config.shortcuts.slideAfter}</kbd>
                  )}
                </span>
                {proMeta.afterSlide?.groupName && (
                  <span className="slide-neighbor-group">{proMeta.afterSlide.groupName}</span>
                )}
              </div>
              <div className="slide-neighbor-body">
                {proMeta.afterSlide?.text || nextSlideText ? (
                  <p className="slide-neighbor-text">{proMeta.afterSlide?.text || nextSlideText}</p>
                ) : (
                  <p className="slide-neighbor-empty">Tidak ada slide berikutnya</p>
                )}
              </div>
            </button>
          </div>
            </main>
          );
        })()}
      </div>

      {/* Smartphone Web Remote Control QR Modal */}
      <RemoteQrModal
        isOpen={showRemoteModal}
        onClose={() => setShowRemoteModal(false)}
        connectedClients={remoteClientCount}
      />

      {/* User Guide Modal */}
      <UserGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
      />

      {/* OBS-style Profil Acara Action Modal */}
      <ProfileActionModal
        modalState={profileModalState}
        activeProfileName={getActiveProfile(profilesState).name}
        onClose={() => setProfileModalState((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmProfileModal}
      />

      {/* Startup Auto-Update Modal (GitHub Releases via electron-updater) */}
      <UpdateModal
        isOpen={showUpdateModal}
        updateState={updateState}
        onUpdate={handleDownloadUpdate}
        onQuitAndInstall={handleQuitAndInstall}
        onSkipVersion={handleSkipUpdateVersion}
        onClose={handleCloseUpdateModal}
      />

      {/* Preset Dropzone Global Overlay */}
      <PresetDropzoneOverlay
        onPresetImported={({ id, type }) => {
          if (type === "animation") {
            setConfig((prev) => ({
              ...prev,
              presetId: id,
              animationEnabled: true
            }));
          } else {
            setConfig((prev) => ({
              ...prev,
              textEffectId: id,
              textEffectEnabled: true
            }));
          }
        }}
      />
    </div>
  );
}
