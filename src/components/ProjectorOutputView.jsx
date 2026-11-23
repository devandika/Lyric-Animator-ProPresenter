import { useState, useEffect, useRef } from "react";
import { loadInitialConfig } from "../lib/appConfig";
import { resolveShortcutAction } from "../lib/shortcutConfig";
import { resolveEffectiveSlideConfig } from "../lib/smartScriptureDetector";
import { ThemedLyricStage } from "./ThemedLyricStage";
import { MediaLayer } from "./MediaLayer";

/**
 * Dedicated Fullscreen Projector / Pop-out Live Program View
 * Loaded when URL has ?mode=projector or ?mode=live-popout
 */
export function ProjectorOutputView({ isPopout = false }) {
  const [slideText, setSlideText] = useState("");
  const [config, setConfig] = useState(() => loadInitialConfig());
  const [themeInfo, setThemeInfo] = useState(null);
  const [countdownRuntime, setCountdownRuntime] = useState(() => ({
    isRunning: false,
    isPaused: false,
    targetEndTimeMs: 0,
    remainingSeconds: 0,
    isFinished: false
  }));
  const [layerState, setLayerState] = useState({
    activeMedia: null,
    mediaTransition: null,
    slideTransition: null,
    stageMessage: ""
  });
  const bcRef = useRef(null);
  const configRef = useRef(config);
  configRef.current = config;
  const wasScriptureSlideRef = useRef(false);

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
        if (data.hasThemeInfo) {
          setThemeInfo(data.themeInfo || null);
        }
        setSlideText(data.text || "");
      } else if (data?.type === "CONFIG_UPDATE" && data.config) {
        setConfig(data.config);
      } else if (data?.type === "THEME_UPDATE") {
        setThemeInfo(data.themeInfo || null);
      } else if (data?.type === "LAYER_STATE_UPDATE" && data.layerState) {
        setLayerState(data.layerState);
      } else if (data?.type === "COUNTDOWN_RUNTIME_UPDATE" && data.runtime) {
        setCountdownRuntime(data.runtime);
      } else if (data?.type === "SYNC_STATE") {
        setSlideText(data.text || "");
        if (data.config) setConfig(data.config);
        if ("themeInfo" in data) setThemeInfo(data.themeInfo || null);
        if (data.layerState) setLayerState(data.layerState);
        if (data.countdownRuntime) setCountdownRuntime(data.countdownRuntime);
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

  const baseEffectiveSlide = resolveEffectiveSlideConfig(config, slideText);
  const isCurrentScripture =
    Boolean(slideText) &&
    (baseEffectiveSlide.isScriptureModeActive || themeInfo?.source === "bible-theme");
  if (slideText) {
    wasScriptureSlideRef.current = isCurrentScripture;
  }
  const keepCalmFadeOnClear = !slideText && wasScriptureSlideRef.current;
  const effectiveSlide =
    isCurrentScripture || keepCalmFadeOnClear
      ? {
          ...baseEffectiveSlide,
          animationEnabled: false,
          offTransitionMode: "fade",
          textEffectEnabled: false,
          isScriptureModeActive: isCurrentScripture
        }
      : baseEffectiveSlide;
  const showScriptureBadge = isCurrentScripture;

  const content = (
    <>
      <MediaLayer
        media={layerState.activeMedia}
        transition={layerState.mediaTransition}
      />
      <ThemedLyricStage
        text={slideText}
        themeInfo={themeInfo}
        presetId={effectiveSlide.presetId}
        durationSeconds={effectiveSlide.durationSeconds}
        animationEnabled={effectiveSlide.animationEnabled}
        offTransitionMode={effectiveSlide.offTransitionMode}
        textEffectEnabled={effectiveSlide.textEffectEnabled}
        textEffectId={config.textEffectId || "ae-wiggle-pos"}
        textEffectIntensity={config.textEffectIntensity ?? 1.0}
        textEffectSpeed={config.textEffectSpeed ?? 1.0}
        slideTransition={layerState.slideTransition}
        countdownConfig={config.countdownOverlay}
        countdownRuntime={countdownRuntime}
        isInteractiveCountdown={false}
      />
      {layerState.stageMessage && (
        <div className="pro-message-overlay">{layerState.stageMessage}</div>
      )}
    </>
  );

  if (isPopout) {
    return (
      <div className="popout-screen">
        <div
          className={`scripture-detected-badge ${
            showScriptureBadge ? "visible" : ""
          }`}
          aria-hidden={!showScriptureBadge}
        >
          <span className="scripture-badge-dot" />
          <span>Ayat Alkitab terdeteksi</span>
        </div>
        <div className="popout-stage-canvas">{content}</div>
      </div>
    );
  }

  return <div className="projector-screen">{content}</div>;
}
