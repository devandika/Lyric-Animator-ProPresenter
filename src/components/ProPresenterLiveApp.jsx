import { useState, useEffect, useRef, useCallback } from "react";
import { ProPresenterConnector } from "../lib/propresenterConnector";
import { ANIMATION_PRESETS, ANIMATION_CATEGORIES } from "../lib/animationPresets";
import {
  TEXT_EFFECT_CATEGORIES,
  TEXT_EFFECT_PRESETS,
  VALID_TEXT_EFFECT_IDS
} from "../lib/textEffectEngine";
import {
  DEFAULT_QUICK_PRESETS,
  DEFAULT_SHORTCUTS,
  resolveShortcutAction,
  sanitizeQuickPresets,
  sanitizeShortcuts
} from "../lib/shortcutConfig";
import { SettingsView } from "./SettingsView";
import { ThemedLyricStage } from "./ThemedLyricStage";
import { MediaLayer } from "./MediaLayer";
import { FavoriteSelect } from "./FavoriteSelect";
import appIconUrl from "../assets/app-icon.svg";

const PROPRESENTER_HOST = "127.0.0.1";
const PROPRESENTER_PORT = 50001;
const VALID_PRESET_IDS = new Set(Object.keys(ANIMATION_PRESETS));

function clampNumber(val, min, max, fallback) {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num * 10) / 10));
}

function sanitizeFavoriteIds(raw, validSet) {
  if (!Array.isArray(raw)) return [];
  return Array.from(new Set(raw.filter((id) => typeof id === "string" && validSet.has(id))));
}

const DEFAULT_CONFIG = {
  configVersion: 8,
  presetId: "cinematic-blur",
  durationSeconds: 1.0,
  animationEnabled: true,
  textEffectEnabled: false,
  textEffectId: "ae-wiggle-pos",
  textEffectIntensity: 1.0,
  textEffectSpeed: 1.0,
  favoritePresets: [],
  favoriteEffects: [],
  propresenterScreenIndex: -1, // -1 = auto-detect from ProPresenter SelectedPreviewScreenID / Main
  shortcuts: { ...DEFAULT_SHORTCUTS },
  quickPresets: DEFAULT_QUICK_PRESETS.map((qp) => ({ ...qp }))
};

function loadInitialConfig() {
  try {
    const saved = localStorage.getItem("pro_lyric_config");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.configVersion === 8) {
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          presetId: VALID_PRESET_IDS.has(parsed?.presetId)
            ? parsed.presetId
            : DEFAULT_CONFIG.presetId,
          animationEnabled: parsed?.animationEnabled !== false,
          textEffectEnabled: Boolean(parsed?.textEffectEnabled),
          textEffectId: VALID_TEXT_EFFECT_IDS.has(parsed?.textEffectId)
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
        presetId: VALID_PRESET_IDS.has(parsed?.presetId)
          ? parsed.presetId
          : DEFAULT_CONFIG.presetId,
        durationSeconds: migratedSec,
        animationEnabled: parsed?.animationEnabled !== false,
        propresenterScreenIndex:
          typeof parsed?.propresenterScreenIndex === "number"
            ? parsed.propresenterScreenIndex
            : -1
      };
    }
  } catch (_) {}
  return DEFAULT_CONFIG;
}

export function ProPresenterLiveApp() {
  const [config, setConfig] = useState(loadInitialConfig);
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
      media: false,
      slide: true,
      announcements: false,
      props: false,
      messages: false,
      audio: false
    },
    activeMediaItem: null,
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
  const [preloadMediaItems, setPreloadMediaItems] = useState([]);
  const [layerTransitions, setLayerTransitions] = useState({ media: null, slide: null });

  // Windows Physical Displays & Output Live State
  const [screensList, setScreensList] = useState([]);
  const [selectedScreenIndex, setSelectedScreenIndex] = useState(1);
  const [isProjectorLive, setIsProjectorLive] = useState(false);
  const [isLivePopoutOpen, setIsLivePopoutOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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
  const layerStateRef = useRef({
    activeMedia: null,
    mediaTransition: null,
    slideTransition: null,
    stageMessage: ""
  });
  const suppressedSlideKeyRef = useRef("");
  const lastThemeVersionRef = useRef("");
  const lastMediaKeyRef = useRef("");
  const lastLayerTransitionsKeyRef = useRef("");
  const resolvedMediaCacheRef = useRef(new Map());
  const dispatchShortcutActionRef = useRef(null);

  currentSlideTextRef.current = currentSlideText;
  configRef.current = config;
  themeInfoRef.current = themeInfo;

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
            layerState: layerStateRef.current
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

  // Persist config & sync
  useEffect(() => {
    localStorage.setItem("pro_lyric_config", JSON.stringify(config));
    safeBroadcast({
      type: "CONFIG_UPDATE",
      config
    });
  }, [config, safeBroadcast]);

  // Read ProPresenter's default preview/output screen UUID if available
  useEffect(() => {
    window.electronAPI?.getDefaultProScreen?.().then((uuid) => {
      if (uuid) setDefaultScreenUuid(uuid);
    });
  }, []);

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
    const conn = new ProPresenterConnector({
      host: PROPRESENTER_HOST,
      port: PROPRESENTER_PORT,
      onStatusChange: (status) => {
        setConnStatus(status);
      },
      onSlideChange: ({ text, uuid, nextText }) => {
        const slideKey = `${uuid}::${text}`;
        if (suppressedSlideKeyRef.current && suppressedSlideKeyRef.current === slideKey) {
          return;
        }
        suppressedSlideKeyRef.current = "";
        setCurrentSlideText(text);
        setNextSlideText(nextText || "");
        safeBroadcast({
          type: "SLIDE_UPDATE",
          text,
          nextText: nextText || ""
        });
      },
      onMetaChange: (meta) => {
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
  }, [safeBroadcast]);

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

  const activeLookScreen = proMeta.lookScreens?.[effectiveProScreenIndex];

  // Live resolve ProPresenter Theme, Layer Transitions & Slide Layout (checks mtimeMs every 450ms)
  useEffect(() => {
    let cancelled = false;

    const resolveTheme = async () => {
      if (window.electronAPI?.getLayerTransitions) {
        try {
          const lt = await window.electronAPI.getLayerTransitions();
          const ltKey = JSON.stringify(lt || null);
          if (!cancelled && ltKey !== lastLayerTransitionsKeyRef.current) {
            lastLayerTransitionsKeyRef.current = ltKey;
            setLayerTransitions(lt || { media: null, slide: null });
          }
        } catch (_) {}
      } else if (window.electronAPI?.getMediaTransition) {
        try {
          const tr = await window.electronAPI.getMediaTransition();
          const trKey = JSON.stringify(tr || null);
          if (!cancelled && trKey !== lastLayerTransitionsKeyRef.current) {
            lastLayerTransitionsKeyRef.current = trKey;
            setLayerTransitions({ media: tr || null, slide: null });
          }
        } catch (_) {}
      }

      if (!window.electronAPI?.resolveSlideTheme) return;

      const themeSlideUuid = activeLookScreen?.presentation || "";

      if (activeLookScreen && activeLookScreen.slide === false) {
        if (!cancelled && lastThemeVersionRef.current !== "disabled") {
          lastThemeVersionRef.current = "disabled";
          setThemeInfo(null);
          safeBroadcast({ type: "THEME_UPDATE", themeInfo: null });
        }
        return;
      }

      const resolved = await window.electronAPI.resolveSlideTheme({
        presentationPath: proMeta.presentationPath,
        cueUuid: proMeta.cueUuid,
        themeSlideUuid
      });

      const vKey = resolved?.versionKey || "none";
      if (!cancelled && vKey !== lastThemeVersionRef.current) {
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
    activeLookScreen,
    safeBroadcast
  ]);

  // Resolve ProPresenter Media Layer & Message Layer directly
  const showMediaLayer = Boolean(
    proMeta.layers?.media && activeLookScreen?.media !== false
  );
  const showMessageOverlay = Boolean(
    proMeta.layers?.messages &&
      activeLookScreen?.messages !== false &&
      proMeta.stageMessage
  );

  // Pre-warm media catalog cache for 0ms synchronous media lookup on initial trigger
  useEffect(() => {
    let cancelled = false;
    window.electronAPI
      ?.getMediaCatalog?.({ presentationPath: proMeta.presentationPath })
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
        setPreloadMediaItems(items.slice(0, 4));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [proMeta.presentationPath]);

  useEffect(() => {
    let cancelled = false;

    const syncLayers = async () => {
      let nextMedia = null;

      if (showMediaLayer) {
        if (proMeta.activeMediaItem?.uuid || proMeta.activeMediaItem?.name) {
          const normUuid = String(proMeta.activeMediaItem.uuid || "").toLowerCase();
          const normName = String(proMeta.activeMediaItem.name || "").trim().toLowerCase();
          const cacheKey = `${normUuid}::${normName}::${proMeta.presentationPath || ""}`;
          let resolved =
            resolvedMediaCacheRef.current.get(cacheKey) ||
            (normUuid && resolvedMediaCacheRef.current.get(`uuid:${normUuid}`)) ||
            (normName && resolvedMediaCacheRef.current.get(`name:${normName}`));
          if (resolved === undefined) {
            resolved = await window.electronAPI?.resolveMediaItem?.({
              mediaUuid: proMeta.activeMediaItem.uuid,
              mediaName: proMeta.activeMediaItem.name,
              presentationPath: proMeta.presentationPath
            });
            if (resolved?.fileUrl) {
              resolvedMediaCacheRef.current.set(cacheKey, resolved);
            }
          }
          const thumbUrl = proMeta.activeMediaItem.uuid
            ? `http://${PROPRESENTER_HOST}:${PROPRESENTER_PORT}/v1/media/${proMeta.activeMediaItem.uuid}/thumbnail?quality=1920`
            : "";

          if (resolved?.fileUrl) {
            nextMedia = {
              url: resolved.fileUrl,
              thumbUrl,
              mediaType: resolved.mediaType,
              name: resolved.name || proMeta.activeMediaItem.name,
              transition: resolved.transition || null
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
    const conn = connectorRef.current;
    if (conn) {
      suppressedSlideKeyRef.current = `${conn.currentUuid || ""}::${conn.currentText || ""}`;
    }
    setCurrentSlideText("");
    safeBroadcast({
      type: "SLIDE_UPDATE",
      text: "",
      nextText: ""
    });
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

  const lookSlideDisabled = activeLookScreen?.slide === false;
  const displaySlideText = lookSlideDisabled ? "" : currentSlideText;

  const activeScreenLabel = screensList[selectedScreenIndex]?.label || `Layar ${selectedScreenIndex + 1}`;

  return (
    <div className={`pro-app-container ${showSettings ? "settings-view" : "live-view"}`}>
      {/* Offscreen metadata warmers so Black -> Media opens video headers promptly */}
      {preloadMediaItems.length > 0 && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            left: "-9999px",
            top: "-9999px",
            width: "2px",
            height: "2px",
            opacity: 0,
            pointerEvents: "none",
            overflow: "hidden"
          }}
        >
          {preloadMediaItems.map((item) =>
            item.mediaType === "image" ? (
              <img key={item.fileUrl} src={item.fileUrl} alt="" />
            ) : (
              <video key={item.fileUrl} src={item.fileUrl} preload="metadata" muted playsInline />
            )
          )}
        </div>
      )}
      {/* Top Header */}
      <header className="pro-header">
        <div className="pro-header-brand">
          <img
            src={appIconUrl}
            alt="ProPresenter Lyric Animator"
            className="pro-logo-icon"
          />
          <div>
            <h1 className="pro-title">ProPresenter Lyric Animator</h1>
            <p className="pro-subtitle">
              Sinkronisasi Otomatis Theme, Media &amp; Animasi Teks After Effects
            </p>
          </div>
        </div>

        <div className="pro-header-actions">
          <div className={`conn-badge ${connStatus.connected ? "connected" : "disconnected"}`}>
            <span className="dot" />
            <span>{connStatus.message || (connStatus.connected ? "Terhubung" : "Terputus")}</span>
          </div>

          <button className="btn-secondary" onClick={handleReconnect}>
            ↻ Reconnect
          </button>

          <button
            type="button"
            className={`btn-secondary btn-settings-nav ${showSettings ? "active" : ""}`}
            onClick={() => setShowSettings((prev) => !prev)}
            title={
              showSettings
                ? "Kembali ke Live Monitor"
                : "Buka Pengaturan Shortcut & Tombol Cepat"
            }
          >
            {showSettings ? "← Live" : "⚙️ Pengaturan"}
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
                  title="Muat ulang daftar layar dari Windows"
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
        </div>
      </header>

      {showSettings ? (
        <SettingsView
          config={config}
          onUpdateConfig={setConfig}
          onBack={() => setShowSettings(false)}
        />
      ) : (
      /* Main Grid: Control & Live Stage */
      <div className="pro-grid">
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
                    ? `${themeInfo.themeName}${themeInfo.slideName ? ` • ${themeInfo.slideName}` : ""} (${
                        themeInfo.source === "look-theme" ? "Look Override" : "Slide Theme"
                      })`
                    : "Menunggu slide / file .pro"}
                </div>
                {activeMedia && (
                  <div>
                    <strong>Media Aktif:</strong> {activeMedia.name} ({activeMedia.mediaType})
                  </div>
                )}
              </div>

              <div className="layers-pill-row">
                <span className={`layer-pill ${showMediaLayer ? "active" : ""}`}>
                  Media
                </span>
                <span className={`layer-pill ${!lookSlideDisabled && proMeta.layers?.slide ? "active" : ""}`}>
                  Slide
                </span>
                <span className={`layer-pill ${proMeta.layers?.announcements ? "active" : ""}`}>
                  Announcements
                </span>
                <span className={`layer-pill ${showMessageOverlay ? "active" : ""}`}>
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
                          : `${ANIMATION_PRESETS[qp.presetId]?.name || qp.presetId} (${qp.durationSeconds.toFixed(1)}s)`
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
                      categories={ANIMATION_CATEGORIES}
                      itemsById={ANIMATION_PRESETS}
                      favoriteIds={favPresetIds}
                      onToggleFavorite={handleToggleFavoritePreset}
                      ariaLabel="Preset Animasi In & Out"
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
              <input
                type="range"
                min="0.5"
                max="5.0"
                step="0.1"
                value={config.durationSeconds}
                onChange={(e) =>
                  setConfig({ ...config, durationSeconds: parseFloat(e.target.value) })
                }
              />
            </div>

            <div className="fx-section-box">
              <div className="fx-section-header">
                <span className="fx-section-title">〰️ Efek Teks (Wiggle &amp; Distorsi)</span>
                <span className={`value-tag ${config.textEffectEnabled ? "" : "muted"}`}>
                  {config.textEffectEnabled ? "Aktif" : "Nonaktif"}
                </span>
              </div>

              <div className={`fx-controls-body ${config.textEffectEnabled ? "active" : "muted"}`}>
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
                          categories={TEXT_EFFECT_CATEGORIES}
                          itemsById={TEXT_EFFECT_PRESETS}
                          favoriteIds={favEffectIds}
                          onToggleFavorite={handleToggleFavoriteEffect}
                          ariaLabel="Pilih Efek Teks Bergoyang"
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
                    <input
                      type="range"
                      min="0.2"
                      max="2.5"
                      step="0.1"
                      value={config.textEffectIntensity ?? 1.0}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          textEffectIntensity: parseFloat(e.target.value)
                        })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <div className="flex-between">
                      <label>Kecepatan</label>
                      <span className="value-tag">
                        {Number(config.textEffectSpeed || 1.0).toFixed(1)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.2"
                      max="3.0"
                      step="0.1"
                      value={config.textEffectSpeed ?? 1.0}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          textEffectSpeed: parseFloat(e.target.value)
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <p className="card-hint">
              Posisi, ukuran, font, kotak, bayangan, serta background media mengikuti pengaturan langsung dari ProPresenter.
            </p>
          </div>
        </aside>

        {/* Right Column: Live Monitor & Output Preview */}
        <main className="pro-main-preview">
          <div className="preview-toolbar">
            <span className="badge-live">LIVE PROGRAM PREVIEW</span>
            <span className="preview-hint">
              {displaySlideText
                ? proMeta.slidePosition
                  ? `${proMeta.currSlideGroup ? `${proMeta.currSlideGroup} • ` : ""}Slide ${proMeta.slidePosition.index}/${proMeta.slidePosition.total}`
                  : "Slide Aktif Menampilkan Lirik"
                : "Slide Kosong (Clear)"}
            </span>
            <div className="preview-tools">
              <button
                type="button"
                className={`btn-anim-toggle ${config.textEffectEnabled ? "on" : "off"}`}
                onClick={handleToggleTextEffect}
                title={
                  config.textEffectEnabled
                    ? "Efek Teks Aktif — Klik untuk menonaktifkan efek bergoyang"
                    : "Efek Teks Nonaktif — Klik untuk mengaktifkan efek teks bergoyang"
                }
                aria-pressed={Boolean(config.textEffectEnabled)}
              >
                Efek Teks
              </button>
              <button
                type="button"
                className={`btn-anim-toggle ${config.animationEnabled !== false ? "on" : "off"}`}
                onClick={handleToggleAnimation}
                title={`${
                  config.animationEnabled !== false
                    ? "Animasi Teks Aktif — Klik untuk nonaktifkan (ikut animasi ProPresenter)"
                    : "Mengikuti Transisi ProPresenter — Klik untuk aktifkan animasi teks aplikasi"
                }${
                  config.shortcuts?.toggleAnimation
                    ? ` (Shortcut: ${config.shortcuts.toggleAnimation})`
                    : ""
                }`}
                aria-pressed={config.animationEnabled !== false}
              >
                Animasi
              </button>
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
            <div ref={stageViewportRef} className="stage-viewport">
              {/* Layer 1: Direct ProPresenter Media Video/Image */}
              <MediaLayer media={activeMedia} transition={layerTransitions.media} />

              {/* Layer 2: ProPresenter Theme 1:1 + After Effects Text Animation (or ProPresenter Slide transition when OFF) */}
              <ThemedLyricStage
                text={displaySlideText}
                themeInfo={themeInfo}
                presetId={config.presetId}
                durationSeconds={config.durationSeconds}
                animationEnabled={config.animationEnabled !== false}
                textEffectEnabled={Boolean(config.textEffectEnabled)}
                textEffectId={config.textEffectId || "ae-wiggle-pos"}
                textEffectIntensity={config.textEffectIntensity ?? 1.0}
                textEffectSpeed={config.textEffectSpeed ?? 1.0}
                slideTransition={layerTransitions.slide}
              />

              {/* Layer 3: Messages Layer */}
              {showMessageOverlay && (
                <div className="pro-message-overlay">{proMeta.stageMessage}</div>
              )}

              {!displaySlideText && !activeMedia && (
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
                <span className="slide-neighbor-badge">
                  ⬅️ Slide Before
                  {config.shortcuts?.slideBefore && (
                    <kbd className="shortcut-kbd">{config.shortcuts.slideBefore}</kbd>
                  )}
                </span>
                {proMeta.prevSlide?.groupName && (
                  <span className="slide-neighbor-tag">{proMeta.prevSlide.groupName}</span>
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
                <span className="slide-neighbor-badge">
                  Slide After ➡️
                  {config.shortcuts?.slideAfter && (
                    <kbd className="shortcut-kbd">{config.shortcuts.slideAfter}</kbd>
                  )}
                </span>
                {proMeta.afterSlide?.groupName && (
                  <span className="slide-neighbor-tag">{proMeta.afterSlide.groupName}</span>
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
      </div>
      )}
    </div>
  );
}

/**
 * Dedicated Fullscreen Projector / Pop-out Live Program View
 * Loaded when URL has ?mode=projector or ?mode=live-popout
 */
export function ProjectorOutputView({ isPopout = false }) {
  const [slideText, setSlideText] = useState("");
  const [config, setConfig] = useState(() => loadInitialConfig());
  const [themeInfo, setThemeInfo] = useState(null);
  const [layerState, setLayerState] = useState({
    activeMedia: null,
    mediaTransition: null,
    slideTransition: null,
    stageMessage: ""
  });
  const bcRef = useRef(null);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    if (isPopout) {
      document.title = "Live Program Preview";
    }
  }, [isPopout]);

  useEffect(() => {
    const bc = new BroadcastChannel("propresenter_animator_channel");
    bcRef.current = bc;

    bc.onmessage = (event) => {
      const data = event.data;
      if (data?.type === "SLIDE_UPDATE") {
        setSlideText(data.text || "");
      } else if (data?.type === "CONFIG_UPDATE" && data.config) {
        setConfig(data.config);
      } else if (data?.type === "THEME_UPDATE") {
        setThemeInfo(data.themeInfo || null);
      } else if (data?.type === "LAYER_STATE_UPDATE" && data.layerState) {
        setLayerState(data.layerState);
      } else if (data?.type === "SYNC_STATE") {
        setSlideText(data.text || "");
        if (data.config) setConfig(data.config);
        if ("themeInfo" in data) setThemeInfo(data.themeInfo || null);
        if (data.layerState) setLayerState(data.layerState);
      }
    };

    bc.postMessage({ type: "REQUEST_STATE" });

    const toggleFullscreen = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    };
    window.addEventListener("dblclick", toggleFullscreen);

    return () => {
      bcRef.current = null;
      bc.close();
      window.removeEventListener("dblclick", toggleFullscreen);
    };
  }, []);

  // Forward shortcuts triggered from detached Live Program Preview window to main window
  useEffect(() => {
    if (!isPopout) return undefined;

    const onKeyDown = (e) => {
      const action = resolveShortcutAction(e, configRef.current);
      if (!action) return;
      e.preventDefault();
      try {
        bcRef.current?.postMessage({
          type: "SHORTCUT_ACTION",
          action
        });
      } catch (_) {}
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPopout]);

  const content = (
    <>
      <MediaLayer
        media={layerState.activeMedia}
        transition={layerState.mediaTransition}
      />
      <ThemedLyricStage
        text={slideText}
        themeInfo={themeInfo}
        presetId={config.presetId || "cinematic-blur"}
        durationSeconds={config.durationSeconds || 1.0}
        animationEnabled={config.animationEnabled !== false}
        textEffectEnabled={Boolean(config.textEffectEnabled)}
        textEffectId={config.textEffectId || "ae-wiggle-pos"}
        textEffectIntensity={config.textEffectIntensity ?? 1.0}
        textEffectSpeed={config.textEffectSpeed ?? 1.0}
        slideTransition={layerState.slideTransition}
      />
      {layerState.stageMessage && (
        <div className="pro-message-overlay">{layerState.stageMessage}</div>
      )}
    </>
  );

  if (isPopout) {
    return (
      <div className="popout-screen">
        <div className="popout-stage-canvas">{content}</div>
      </div>
    );
  }

  return <div className="projector-screen">{content}</div>;
}
