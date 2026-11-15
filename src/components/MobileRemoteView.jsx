import { useState, useEffect, useRef, useCallback } from "react";
import { ANIMATION_PRESETS, ANIMATION_CATEGORIES } from "../lib/animationPresets";
import {
  TEXT_EFFECT_PRESETS,
  TEXT_EFFECT_CATEGORIES
} from "../lib/textEffectEngine";
import { CountdownOverlay, formatCountdownTime } from "./CountdownOverlay";

const DEVICE_FONT_OPTIONS = [
  { label: "Segoe UI (Standar Windows)", value: "'Segoe UI', sans-serif" },
  { label: "Arial (Clean)", value: "Arial, sans-serif" },
  { label: "Montserrat / Modern Sans", value: "Montserrat, 'Segoe UI', sans-serif" },
  { label: "Impact (Tebal & Tegas)", value: "Impact, 'Arial Black', sans-serif" },
  { label: "Trebuchet MS (Elegan)", value: "'Trebuchet MS', sans-serif" },
  { label: "Calibri (Lembut)", value: "Calibri, sans-serif" },
  { label: "Bebas Neue / Display", value: "'Bebas Neue', Impact, sans-serif" },
  { label: "Tahoma (Padat)", value: "Tahoma, sans-serif" },
  { label: "Courier New / Monospace", value: "'Courier New', monospace" }
];

const QUICK_COLORS = ["#fbbf24", "#ffffff", "#38bdf8", "#34d399", "#f87171"];
const QUICK_BG_COLORS = ["#000000", "#0f172a", "#1e1b4b", "#450a0a", "#14532d"];

/**
 * Mobile-friendly touch stepper component
 */
function MobileStepper({ value, onChange, min = 0, max = 999, step = 1, unit = "" }) {
  const num = typeof value === "number" && !isNaN(value) ? value : parseFloat(value) || 0;

  const handleDec = (e) => {
    e.preventDefault();
    onChange(Math.max(min, Math.round((num - step) * 100) / 100));
  };

  const handleInc = (e) => {
    e.preventDefault();
    onChange(Math.min(max, Math.round((num + step) * 100) / 100));
  };

  return (
    <div className="mobile-stepper">
      <button
        type="button"
        className="mobile-stepper-btn"
        onClick={handleDec}
        aria-label="Kurangi nilai"
      >
        −
      </button>
      <span className="mobile-stepper-val">
        {num}
        {unit ? ` ${unit}` : ""}
      </span>
      <button
        type="button"
        className="mobile-stepper-btn"
        onClick={handleInc}
        aria-label="Tambah nilai"
      >
        +
      </button>
    </div>
  );
}

/**
 * Responsive 16:9 preview canvas for smartphone screen
 */
function MobilePreviewMonitor({ config, countdownRuntime, slideSummary }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(340 / 1920);
  const canvasWidth = 1920;
  const canvasHeight = 1080;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateScale = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setScale(Math.min(rect.width / canvasWidth, rect.height / canvasHeight));
      }
    };
    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="mobile-preview-monitor" ref={containerRef}>
      <div
        className="mobile-preview-canvas"
        style={{
          width: `${canvasWidth}px`,
          height: `${canvasHeight}px`,
          transform: `translate(-50%, -50%) scale(${scale})`
        }}
      >
        {/* Background slide watermark */}
        {slideSummary?.text ? (
          <div className="mobile-preview-slide-backdrop">
            <span>{slideSummary.text.split("\n")[0]}</span>
          </div>
        ) : null}

        <CountdownOverlay
          config={config}
          runtime={countdownRuntime}
          isInteractive={false}
          forceVisible={true}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
        />
      </div>
    </div>
  );
}

export function MobileRemoteView() {
  const [activeTab, setActiveTab] = useState("timer"); // "timer" | "lyrics"
  const [connState, setConnState] = useState("connecting"); // "connecting" | "connected" | "disconnected"

  const [config, setConfig] = useState({
    animationEnabled: true,
    offTransitionMode: "fade",
    presetId: "cinematic-blur",
    durationSeconds: 1.0,
    favoritePresets: [],
    textEffectEnabled: false,
    textEffectId: "ae-wiggle-pos",
    textEffectIntensity: 1.0,
    textEffectSpeed: 1.0,
    favoriteEffects: [],
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
  });

  const [countdownRuntime, setCountdownRuntime] = useState({
    isRunning: false,
    isPaused: false,
    targetEndTimeMs: 0,
    remainingSeconds: 0,
    isFinished: false
  });

  const [slideSummary, setSlideSummary] = useState({
    text: "",
    group: "",
    position: null,
    themeName: ""
  });

  // Local ticker draft for typing responsiveness
  const [tickerDraft, setTickerDraft] = useState(
    config.countdownOverlay?.tickerText || ""
  );

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  // Sync ticker draft when config updates from desktop
  useEffect(() => {
    if (config.countdownOverlay?.tickerText !== undefined) {
      setTickerDraft(config.countdownOverlay.tickerText);
    }
  }, [config.countdownOverlay?.tickerText]);

  // Connect WebSocket to same host
  const connectWebSocket = useCallback(() => {
    if (!isMountedRef.current) return;

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (_) {}
      wsRef.current = null;
    }

    const host = window.location.host || "localhost:4989";
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${host}`;

    setConnState("connecting");

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setConnState("connected");
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const msg = JSON.parse(event.data);
          if (!msg || typeof msg !== "object") return;

          if (msg.type === "INIT_STATE" || msg.type === "SYNC_STATE") {
            const payload = msg.payload || {};
            if (payload.config) {
              setConfig((prev) => ({
                ...prev,
                ...payload.config,
                animationEnabled: payload.config.animationEnabled !== false,
                offTransitionMode:
                  payload.config.offTransitionMode === "cut" ? "cut" : "fade",
                textEffectEnabled: Boolean(payload.config.textEffectEnabled),
                countdownOverlay: {
                  ...(prev.countdownOverlay || {}),
                  ...(payload.config.countdownOverlay || {})
                }
              }));
            }
            if (payload.countdownRuntime) {
              const maxSec = payload.countdownRuntime.initialTotalSeconds || Infinity;
              setCountdownRuntime((prev) => ({
                ...prev,
                ...payload.countdownRuntime,
                remainingSeconds: Math.min(
                  maxSec,
                  payload.countdownRuntime.remainingSeconds ?? prev.remainingSeconds
                )
              }));
            }
            if (payload.slideSummary) {
              setSlideSummary(payload.slideSummary);
            }
          } else if (msg.type === "SYNC_CONFIG" && msg.payload) {
            setConfig((prev) => ({
              ...prev,
              ...msg.payload,
              animationEnabled:
                msg.payload.animationEnabled !== undefined
                  ? msg.payload.animationEnabled !== false
                  : prev.animationEnabled,
              offTransitionMode:
                msg.payload.offTransitionMode !== undefined
                  ? msg.payload.offTransitionMode === "cut"
                    ? "cut"
                    : "fade"
                  : prev.offTransitionMode,
              textEffectEnabled:
                msg.payload.textEffectEnabled !== undefined
                  ? Boolean(msg.payload.textEffectEnabled)
                  : prev.textEffectEnabled,
              countdownOverlay: msg.payload.countdownOverlay
                ? {
                    ...(prev.countdownOverlay || {}),
                    ...msg.payload.countdownOverlay
                  }
                : prev.countdownOverlay
            }));
          } else if (msg.type === "SYNC_COUNTDOWN_RUNTIME" && msg.payload) {
            const maxSec = msg.payload.initialTotalSeconds || Infinity;
            setCountdownRuntime((prev) => ({
              ...prev,
              ...msg.payload,
              remainingSeconds: Math.min(
                maxSec,
                msg.payload.remainingSeconds ?? prev.remainingSeconds
              )
            }));
          }
        } catch (err) {
          console.warn("[MobileRemote] Error parsing message:", err);
        }
      };

      const handleDisconnect = () => {
        if (!isMountedRef.current) return;
        setConnState("disconnected");
        wsRef.current = null;

        if (!reconnectTimerRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            connectWebSocket();
          }, 2000);
        }
      };

      ws.onclose = handleDisconnect;
      ws.onerror = handleDisconnect;
    } catch (_) {
      setConnState("disconnected");
      if (!reconnectTimerRef.current) {
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          connectWebSocket();
        }, 2500);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    connectWebSocket();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          connectWebSocket();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (_) {}
        wsRef.current = null;
      }
    };
  }, [connectWebSocket]);

  // Local real-time timer ticking for countdown
  useEffect(() => {
    if (!countdownRuntime.isRunning || countdownRuntime.isPaused) return;

    const maxSec = countdownRuntime.initialTotalSeconds || Infinity;

    const timer = setInterval(() => {
      const now = Date.now();
      const diffMs = (countdownRuntime.targetEndTimeMs || 0) - now;
      const rem = Math.max(0, Math.min(maxSec, Math.ceil(diffMs / 1000)));

      if (rem <= 0) {
        setCountdownRuntime((prev) => ({
          ...prev,
          remainingSeconds: 0,
          isFinished: true
        }));
        clearInterval(timer);
      } else {
        setCountdownRuntime((prev) => ({
          ...prev,
          remainingSeconds: rem
        }));
      }
    }, 500);

    return () => clearInterval(timer);
  }, [
    countdownRuntime.isRunning,
    countdownRuntime.isPaused,
    countdownRuntime.targetEndTimeMs,
    countdownRuntime.initialTotalSeconds
  ]);

  // Dispatch config update to desktop server
  const sendConfigChange = useCallback((partial) => {
    setConfig((prev) => ({ ...prev, ...partial }));

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(
          JSON.stringify({
            type: "UPDATE_CONFIG",
            payload: partial
          })
        );
      } catch (err) {
        console.warn("[MobileRemote] Failed to send update:", err);
      }
    }
  }, []);

  // Update countdown overlay specifically
  const updateOverlay = useCallback((patch) => {
    setConfig((prev) => {
      const prevOverlay = prev.countdownOverlay || {};
      const nextOverlay = { ...prevOverlay, ...patch };
      const nextConfig = { ...prev, countdownOverlay: nextOverlay };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(
            JSON.stringify({
              type: "UPDATE_CONFIG",
              payload: { countdownOverlay: patch }
            })
          );
        } catch (err) {
          console.warn("[MobileRemote] Failed to send overlay update:", err);
        }
      }

      return nextConfig;
    });
  }, []);

  // Dispatch action to desktop server
  const triggerAction = useCallback((action, payload = null) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(
          JSON.stringify({
            type: "TRIGGER_ACTION",
            action,
            payload
          })
        );
      } catch (err) {
        console.warn("[MobileRemote] Failed to send action:", err);
      }
    }
  }, []);

  const ov = config.countdownOverlay || {};

  // Handlers for Countdown & Ticker ON/OFF
  const toggleCountdownOverlay = () => {
    const nextVal = !ov.countdownEnabled;
    updateOverlay({ countdownEnabled: nextVal });
  };

  const toggleTickerOverlay = () => {
    const nextVal = !ov.tickerEnabled;
    updateOverlay({
      tickerEnabled: nextVal,
      tickerStartedAt: nextVal ? Date.now() : 0
    });
  };

  // Timer Actions
  const handleStartTimer = () => {
    const total =
      (Number(ov.durationHours) || 0) * 3600 +
      (Number(ov.durationMinutes) || 0) * 60 +
      (Number(ov.durationSeconds) || 0);
    const startSec =
      countdownRuntime.isPaused && countdownRuntime.remainingSeconds > 0
        ? countdownRuntime.remainingSeconds
        : total > 0
        ? total
        : 300;

    triggerAction("start-countdown");
    setCountdownRuntime({
      isRunning: true,
      isPaused: false,
      initialTotalSeconds: startSec,
      targetEndTimeMs: Date.now() + startSec * 1000,
      remainingSeconds: startSec,
      isFinished: false
    });
  };

  const handlePauseTimer = () => {
    triggerAction("pause-countdown");
    setCountdownRuntime((prev) => ({
      ...prev,
      isPaused: true
    }));
  };

  const handleResetTimer = () => {
    triggerAction("reset-countdown");
    setCountdownRuntime({
      isRunning: false,
      isPaused: false,
      targetEndTimeMs: 0,
      remainingSeconds: 0,
      isFinished: false
    });
  };

  // Animation & Text Effect Handlers
  const toggleAnimation = () => {
    sendConfigChange({ animationEnabled: !config.animationEnabled });
  };

  const setOffTransition = (mode) => {
    sendConfigChange({ offTransitionMode: mode });
  };

  const handleAnimationPresetChange = (presetId) => {
    sendConfigChange({ presetId });
  };

  const handleAnimationDurationChange = (e) => {
    const val = parseFloat(e.target.value);
    sendConfigChange({ durationSeconds: val });
  };

  const handleToggleFavoritePreset = (presetId) => {
    const favs = Array.isArray(config.favoritePresets)
      ? [...config.favoritePresets]
      : [];
    const idx = favs.indexOf(presetId);
    if (idx >= 0) favs.splice(idx, 1);
    else favs.push(presetId);
    sendConfigChange({ favoritePresets: favs });
  };

  const toggleTextEffect = () => {
    sendConfigChange({ textEffectEnabled: !config.textEffectEnabled });
  };

  const handleTextEffectPresetChange = (textEffectId) => {
    sendConfigChange({ textEffectId });
  };

  const handleEffectIntensityChange = (e) => {
    const val = parseFloat(e.target.value);
    sendConfigChange({ textEffectIntensity: val });
  };

  const handleEffectSpeedChange = (e) => {
    const val = parseFloat(e.target.value);
    sendConfigChange({ textEffectSpeed: val });
  };

  const handleToggleFavoriteEffect = (effectId) => {
    const favs = Array.isArray(config.favoriteEffects)
      ? [...config.favoriteEffects]
      : [];
    const idx = favs.indexOf(effectId);
    if (idx >= 0) favs.splice(idx, 1);
    else favs.push(effectId);
    sendConfigChange({ favoriteEffects: favs });
  };

  const isAnimFav = (
    Array.isArray(config.favoritePresets) ? config.favoritePresets : []
  ).includes(config.presetId);
  const currentFxId = config.textEffectId || "ae-wiggle-pos";
  const isFxFav = (
    Array.isArray(config.favoriteEffects) ? config.favoriteEffects : []
  ).includes(currentFxId);

  // Maximum allowed font size based on format: 260px for hours, 380px for minutes
  const isHoursFormat =
    (Number(ov.durationHours) || 0) > 0 || ov.timerType === "target";
  const maxAllowedFontSize = isHoursFormat ? 260 : 380;

  return (
    <div className="mobile-remote-viewport">
      {/* Mobile Top Header */}
      <header className="mobile-header">
        <div className="mobile-header-left">
          <span className="mobile-app-icon">📱</span>
          <div>
            <h1 className="mobile-title">ProPresenter Remote</h1>
            <span className="mobile-subtitle">Kontrol Lirik &amp; Overlay</span>
          </div>
        </div>

        <div className={`mobile-conn-badge ${connState}`}>
          <span className="conn-dot" />
          <span>
            {connState === "connected"
              ? "Terhubung"
              : connState === "connecting"
              ? "Menghubungkan..."
              : "Terputus"}
          </span>
        </div>
      </header>

      {/* Navigation Tabs (Lirik vs Hitung Mundur & Teks) */}
      <nav className="mobile-nav-tabs" aria-label="Navigasi remote">
        <button
          type="button"
          className={`mobile-nav-tab ${activeTab === "timer" ? "active" : ""}`}
          onClick={() => setActiveTab("timer")}
        >
          <span>⏱ Hitung Mundur &amp; Teks</span>
          {(ov.countdownEnabled || ov.tickerEnabled) && (
            <span className="mobile-tab-dot" title="Overlay Sedang Live" />
          )}
        </button>

        <button
          type="button"
          className={`mobile-nav-tab ${activeTab === "lyrics" ? "active" : ""}`}
          onClick={() => setActiveTab("lyrics")}
        >
          <span>🎨 Animasi &amp; Lirik</span>
        </button>
      </nav>

      {/* Mini Slide Summary */}
      <div className="mobile-slide-summary-bar">
        <div className="mobile-slide-summary-meta">
          <span className="mobile-slide-tag">SLIDE AKTIF</span>
          {slideSummary.position && (
            <span className="mobile-slide-pos">
              {slideSummary.group ? `${slideSummary.group} • ` : ""}
              {slideSummary.position.index}/{slideSummary.position.total}
            </span>
          )}
        </div>
        <p className="mobile-slide-summary-text">
          {slideSummary.text
            ? slideSummary.text.split("\n")[0]
            : slideSummary.hasMedia
            ? "🎬 Slide Berisi Video"
            : "— Layar Kosong / Menunggu Slide —"}
        </p>
      </div>

      <main className="mobile-remote-content">
        {/* =========================================================
            TAB 1: HITUNG MUNDUR (COUNTDOWN) & TEKS BERJALAN (TICKER)
            ========================================================= */}
        {activeTab === "timer" && (
          <>
            {/* 16:9 Live Preview Section */}
            <section className="mobile-preview-section">
              <div className="mobile-preview-header-bar">
                <span className="mobile-preview-title">
                  📺 Preview Layar Tampilan (16:9)
                </span>
                <div className="mobile-preview-badges">
                  <span
                    className={`mobile-mini-badge ${
                      ov.countdownEnabled ? "live" : "muted"
                    }`}
                  >
                    ⏱ {ov.countdownEnabled ? "Live" : "Off"}
                  </span>
                  <span
                    className={`mobile-mini-badge ${
                      ov.tickerEnabled ? "live" : "muted"
                    }`}
                  >
                    💬 {ov.tickerEnabled ? "Live" : "Off"}
                  </span>
                  {countdownRuntime?.isRunning && (
                    <span
                      className={`mobile-mini-badge timer ${
                        countdownRuntime?.isPaused ? "paused" : "running"
                      }`}
                    >
                      {countdownRuntime?.isPaused ? "⏸ JEDA" : "▶ JALAN"}
                    </span>
                  )}
                </div>
              </div>

              <MobilePreviewMonitor
                config={ov}
                countdownRuntime={countdownRuntime}
                slideSummary={slideSummary}
              />
            </section>

            {/* DUAL BIG ON / OFF TOGGLES */}
            <div className="mobile-dual-toggle-grid">
              {/* Countdown ON/OFF */}
              <button
                type="button"
                className={`mobile-big-toggle ${
                  ov.countdownEnabled ? "on" : "off"
                }`}
                onClick={toggleCountdownOverlay}
                aria-pressed={Boolean(ov.countdownEnabled)}
              >
                <span className="toggle-indicator-dot" />
                <span className="toggle-label-main">
                  {ov.countdownEnabled ? "⏱ TIMER ON" : "⚪ TIMER OFF"}
                </span>
                <span className="toggle-hint-sub">
                  {ov.countdownEnabled
                    ? "Tampil di Layar Live"
                    : "Sentuh untuk aktifkan"}
                </span>
              </button>

              {/* Running Text ON/OFF */}
              <button
                type="button"
                className={`mobile-big-toggle ticker ${
                  ov.tickerEnabled ? "on" : "off"
                }`}
                onClick={toggleTickerOverlay}
                aria-pressed={Boolean(ov.tickerEnabled)}
              >
                <span className="toggle-indicator-dot" />
                <span className="toggle-label-main">
                  {ov.tickerEnabled ? "💬 TIMER ON" : "⚪ TIMER OFF"}
                </span>
                <span className="toggle-hint-sub">
                  {ov.tickerEnabled
                    ? "Tampil di Layar Live"
                    : "Sentuh untuk aktifkan"}
                </span>
              </button>
            </div>

            {/* CARD: PENGATURAN COUNTDOWN */}
            <section className="mobile-card">
              <div className="mobile-card-header">
                <span className="mobile-card-title">⏱ Pengaturan Countdown</span>
                <span className="mobile-value-badge">
                  {ov.timerType === "target" ? "Target Jam" : "Durasi Manual"}
                </span>
              </div>

              {/* Mode Timer: Durasi vs Target Jam */}
              <div
                className="mobile-segment-group"
                role="group"
                aria-label="Pilihan mode countdown"
              >
                <button
                  type="button"
                  className={`mobile-segment-btn ${
                    ov.timerType !== "target" ? "active" : ""
                  }`}
                  onClick={() => updateOverlay({ timerType: "duration" })}
                >
                  Durasi Manual
                </button>
                <button
                  type="button"
                  className={`mobile-segment-btn ${
                    ov.timerType === "target" ? "active" : ""
                  }`}
                  onClick={() => updateOverlay({ timerType: "target" })}
                >
                  Target Jam (HH:MM:SS)
                </button>
              </div>

              {/* Timer Controls: Play/Pause, Reset, Sisa */}
              <div className="mobile-timer-actions">
                {!countdownRuntime?.isRunning || countdownRuntime?.isPaused ? (
                  <button
                    type="button"
                    className="btn-mobile-timer play"
                    onClick={handleStartTimer}
                  >
                    ▶ Mulai
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-mobile-timer pause"
                    onClick={handlePauseTimer}
                  >
                    ⏸ Jeda
                  </button>
                )}
                <button
                  type="button"
                  className="btn-mobile-timer reset"
                  onClick={handleResetTimer}
                >
                  ⏹ Reset
                </button>
                <div className="mobile-timer-sisa">
                  Sisa:{" "}
                  <b>
                    {formatCountdownTime(
                      countdownRuntime?.remainingSeconds || 0,
                      isHoursFormat
                    )}
                  </b>
                </div>
              </div>

              {/* Input Durasi Stepper (Jam, Menit, Detik) */}
              {ov.timerType !== "target" ? (
                <div className="mobile-stepper-3col">
                  <div className="mobile-stepper-col">
                    <span className="mobile-stepper-col-label">Jam (j)</span>
                    <MobileStepper
                      value={ov.durationHours ?? 0}
                      min={0}
                      max={99}
                      step={1}
                      onChange={(val) => updateOverlay({ durationHours: val })}
                    />
                  </div>

                  <div className="mobile-stepper-col">
                    <span className="mobile-stepper-col-label">Menit (m)</span>
                    <MobileStepper
                      value={ov.durationMinutes ?? 5}
                      min={0}
                      max={59}
                      step={1}
                      onChange={(val) => updateOverlay({ durationMinutes: val })}
                    />
                  </div>

                  <div className="mobile-stepper-col">
                    <span className="mobile-stepper-col-label">Detik (s)</span>
                    <MobileStepper
                      value={ov.durationSeconds ?? 0}
                      min={0}
                      max={59}
                      step={5}
                      onChange={(val) => updateOverlay({ durationSeconds: val })}
                    />
                  </div>
                </div>
              ) : (
                <div className="mobile-field-group">
                  <label htmlFor="mobile-target-time">
                    Target Jam (Format 24 Jam: HH:mm:ss)
                  </label>
                  <input
                    id="mobile-target-time"
                    type="time"
                    step="1"
                    className="mobile-select"
                    value={ov.targetTime || "09:00:00"}
                    onChange={(e) =>
                      updateOverlay({ targetTime: e.target.value || "09:00:00" })
                    }
                  />
                </div>
              )}

              {/* Ukuran Angka & Warna */}
              <div className="mobile-sliders-grid">
                <div className="mobile-field-group">
                  <div className="mobile-field-label-row">
                    <label>Ukuran Angka</label>
                    <span className="mobile-value-badge">
                      {Math.min(
                        maxAllowedFontSize,
                        Number(ov.numberFontSize) || 48
                      )}
                      px
                    </span>
                  </div>
                  <MobileStepper
                    value={Math.min(
                      maxAllowedFontSize,
                      Number(ov.numberFontSize) || 48
                    )}
                    min={14}
                    max={maxAllowedFontSize}
                    step={4}
                    unit="px"
                    onChange={(val) =>
                      updateOverlay({
                        numberFontSize: Math.min(maxAllowedFontSize, val)
                      })
                    }
                  />
                </div>

                <div className="mobile-field-group">
                  <label>Warna Angka</label>
                  <div className="mobile-swatches-row">
                    {QUICK_COLORS.map((col) => (
                      <button
                        key={col}
                        type="button"
                        className={`mobile-swatch ${
                          ov.highlightColor === col ? "active" : ""
                        }`}
                        style={{ backgroundColor: col }}
                        onClick={() => updateOverlay({ highlightColor: col })}
                        aria-label={`Warna ${col}`}
                      />
                    ))}
                    <input
                      type="color"
                      value={ov.highlightColor || "#fbbf24"}
                      onChange={(e) =>
                        updateOverlay({ highlightColor: e.target.value })
                      }
                      style={{
                        width: 28,
                        height: 28,
                        padding: 0,
                        border: "none",
                        background: "transparent",
                        cursor: "pointer"
                      }}
                      title="Pilih Warna Kustom"
                    />
                  </div>
                </div>
              </div>

              {/* Posisi Angka Cepat di Layar */}
              <div className="mobile-field-group">
                <label>Posisi Angka di Layar</label>
                <div className="mobile-pos-preset-grid">
                  <button
                    type="button"
                    className={`mobile-pos-btn ${
                      ov.position?.y >= 75 ? "active" : ""
                    }`}
                    onClick={() =>
                      updateOverlay({
                        position: { x: 50, y: 85 },
                        presetPosition: "bottom"
                      })
                    }
                  >
                    ⬇️ Bawah Layar
                  </button>
                  <button
                    type="button"
                    className={`mobile-pos-btn ${
                      ov.position?.y >= 35 && ov.position?.y <= 65 ? "active" : ""
                    }`}
                    onClick={() =>
                      updateOverlay({
                        position: { x: 50, y: 50 },
                        presetPosition: "center"
                      })
                    }
                  >
                    ⏺️ Tengah Layar
                  </button>
                  <button
                    type="button"
                    className={`mobile-pos-btn ${
                      ov.position?.y <= 25 ? "active" : ""
                    }`}
                    onClick={() =>
                      updateOverlay({
                        position: { x: 50, y: 12 },
                        presetPosition: "top"
                      })
                    }
                  >
                    ⬆️ Atas Layar
                  </button>
                </div>
              </div>

              {/* Aksi Saat Selesai */}
              <div className="mobile-field-group">
                <label htmlFor="mobile-finish-action">
                  Aksi Saat Waktu Habis (00:00)
                </label>
                <select
                  id="mobile-finish-action"
                  className="mobile-select"
                  value={ov.finishAction || "auto-hide"}
                  onChange={(e) => updateOverlay({ finishAction: e.target.value })}
                >
                  <option value="auto-hide">Sembunyikan Otomatis (Fade Out)</option>
                  <option value="hold">Tetap Tampil di 00:00 (Hold)</option>
                  <option value="custom-text">Tampilkan Pesan Selesai (Tampil 3 Detik lalu Fade Out)</option>
                </select>
                {ov.finishAction === "custom-text" && (
                  <input
                    type="text"
                    placeholder="Pesan selesai (misal: Selamat Beribadah!)"
                    value={ov.finishText || ""}
                    onChange={(e) => updateOverlay({ finishText: e.target.value })}
                    className="mobile-select"
                    style={{ marginTop: 4 }}
                  />
                )}
              </div>
            </section>

            {/* CARD: PENGATURAN RUNNING TEXT */}
            <section className="mobile-card">
              <div className="mobile-card-header">
                <span className="mobile-card-title">
                  💬 Pengaturan Running Text
                </span>
                <span className="mobile-value-badge">Full-Width</span>
              </div>

              {/* Teks Pengumuman Textarea */}
              <div className="mobile-field-group">
                <div className="mobile-field-label-row">
                  <label htmlFor="mobile-ticker-textarea">Teks Pengumuman</label>
                  <button
                    type="button"
                    className="mobile-apply-text-btn"
                    onClick={() => updateOverlay({ tickerText: tickerDraft })}
                  >
                    ✓ Terapkan Teks
                  </button>
                </div>
                <textarea
                  id="mobile-ticker-textarea"
                  rows="3"
                  className="mobile-textarea"
                  placeholder="Ketik teks pengumuman yang berjalan selebar layar..."
                  value={tickerDraft}
                  onChange={(e) => setTickerDraft(e.target.value)}
                  onBlur={() => updateOverlay({ tickerText: tickerDraft })}
                />
              </div>

              {/* Posisi & Kecepatan Berjalan */}
              <div className="mobile-sliders-grid">
                <div className="mobile-field-group">
                  <label htmlFor="mobile-ticker-pos">Posisi di Layar</label>
                  <select
                    id="mobile-ticker-pos"
                    className="mobile-select"
                    value={ov.tickerPosition || "bottom"}
                    onChange={(e) =>
                      updateOverlay({ tickerPosition: e.target.value })
                    }
                  >
                    <option value="bottom">Bawah Layar (Bottom)</option>
                    <option value="top">Atas Layar (Top)</option>
                  </select>
                </div>

                <div className="mobile-field-group">
                  <div className="mobile-field-label-row">
                    <label>Kecepatan Jalan</label>
                    <span className="mobile-value-badge">
                      {ov.tickerSpeed || 28}s
                    </span>
                  </div>
                  <MobileStepper
                    value={ov.tickerSpeed || 28}
                    min={5}
                    max={120}
                    step={1}
                    unit="detik"
                    onChange={(val) => updateOverlay({ tickerSpeed: val })}
                  />
                </div>
              </div>

              {/* Warna Latar Kotak & Transparansi */}
              <div className="mobile-sliders-grid">
                <div className="mobile-field-group">
                  <label>Warna Latar Kotak</label>
                  <div className="mobile-swatches-row">
                    {QUICK_BG_COLORS.map((col) => (
                      <button
                        key={col}
                        type="button"
                        className={`mobile-swatch ${
                          ov.tickerBgColor === col ? "active" : ""
                        }`}
                        style={{ backgroundColor: col }}
                        onClick={() => updateOverlay({ tickerBgColor: col })}
                        aria-label={`Warna latar ${col}`}
                      />
                    ))}
                    <input
                      type="color"
                      value={ov.tickerBgColor || "#000000"}
                      onChange={(e) =>
                        updateOverlay({ tickerBgColor: e.target.value })
                      }
                      style={{
                        width: 28,
                        height: 28,
                        padding: 0,
                        border: "none",
                        background: "transparent",
                        cursor: "pointer"
                      }}
                      title="Pilih Warna Latar Kustom"
                    />
                  </div>
                </div>

                <div className="mobile-field-group">
                  <div className="mobile-field-label-row">
                    <label>Transparansi Latar</label>
                    <span className="mobile-value-badge">
                      {Math.round((ov.tickerBgOpacity ?? 0.8) * 100)}%
                    </span>
                  </div>
                  <MobileStepper
                    value={Math.round((ov.tickerBgOpacity ?? 0.8) * 100)}
                    min={0}
                    max={100}
                    step={5}
                    unit="%"
                    onChange={(val) =>
                      updateOverlay({ tickerBgOpacity: val / 100 })
                    }
                  />
                </div>
              </div>

              {/* Ukuran Teks & Font */}
              <div className="mobile-sliders-grid">
                <div className="mobile-field-group">
                  <div className="mobile-field-label-row">
                    <label>Ukuran Teks</label>
                    <span className="mobile-value-badge">
                      {ov.textFontSize || 24}px
                    </span>
                  </div>
                  <MobileStepper
                    value={ov.textFontSize || 24}
                    min={12}
                    max={64}
                    step={2}
                    unit="px"
                    onChange={(val) => updateOverlay({ textFontSize: val })}
                  />
                </div>

                <div className="mobile-field-group">
                  <label htmlFor="mobile-font-family">Jenis Font</label>
                  <select
                    id="mobile-font-family"
                    className="mobile-select"
                    value={ov.fontFamily || "'Segoe UI', sans-serif"}
                    onChange={(e) => updateOverlay({ fontFamily: e.target.value })}
                  >
                    {DEVICE_FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>
          </>
        )}

        {/* =========================================================
            TAB 2: KONTROL ANIMASI & EFEK TEKS (AFTER EFFECTS)
            ========================================================= */}
        {activeTab === "lyrics" && (
          <>
            {/* CARD 1: ANIMASI TEKS */}
            <section className="mobile-card">
              <div className="mobile-card-header">
                <span className="mobile-card-title">🎨 Animasi Teks</span>
              </div>

              {/* Big ON / OFF Toggle */}
              <button
                type="button"
                className={`mobile-big-toggle ${
                  config.animationEnabled ? "on" : "off"
                }`}
                onClick={toggleAnimation}
              >
                <span className="toggle-indicator-dot" />
                <span className="toggle-label-main">
                  {config.animationEnabled
                    ? "✨ ANIMASI AKTIF"
                    : "⚪ ANIMASI NONAKTIF"}
                </span>
                <span className="toggle-hint-sub">
                  {config.animationEnabled
                    ? "Sentuh untuk matikan"
                    : `Sentuh untuk aktifkan (${
                        config.offTransitionMode === "cut" ? "Cut" : "Fade"
                      })`}
                </span>
              </button>

              {/* Transition Mode when Anim Off: Fade vs Cut */}
              <div className="mobile-field-group">
                <div className="mobile-field-label-row">
                  <label>Mode Transisi Saat Animasi Off</label>
                  <span
                    className={`mobile-status-tag ${
                      config.animationEnabled ? "muted" : "active"
                    }`}
                  >
                    {config.animationEnabled ? "Otomatis Fade saat Off" : "Aktif"}
                  </span>
                </div>

                <div
                  className={`mobile-segment-group ${
                    config.animationEnabled ? "disabled" : ""
                  }`}
                  role="group"
                  aria-label="Mode transisi saat Animasi Off"
                >
                  <button
                    type="button"
                    disabled={config.animationEnabled}
                    className={`mobile-segment-btn ${
                      config.offTransitionMode === "fade" ? "active" : ""
                    }`}
                    onClick={() => setOffTransition("fade")}
                  >
                    🌊 Fade
                  </button>
                  <button
                    type="button"
                    disabled={config.animationEnabled}
                    className={`mobile-segment-btn ${
                      config.offTransitionMode === "cut" ? "active" : ""
                    }`}
                    onClick={() => setOffTransition("cut")}
                  >
                    ⚡ Cut
                  </button>
                </div>
                {config.animationEnabled && (
                  <span className="mobile-field-hint">
                    Pilihan Fade / Cut aktif saat tombol Animasi di atas
                    dimatikan.
                  </span>
                )}
              </div>

              {/* Preset Selector with Favorite Star */}
              <div className="mobile-field-group">
                <label htmlFor="anim-preset-select">Preset Animasi</label>
                <div className="mobile-select-fav-row">
                  <select
                    id="anim-preset-select"
                    className="mobile-select"
                    value={config.presetId}
                    onChange={(e) => handleAnimationPresetChange(e.target.value)}
                  >
                    {Array.isArray(config.favoritePresets) &&
                      config.favoritePresets.length > 0 && (
                        <optgroup label="⭐ Favorit">
                          {config.favoritePresets.map((id) => {
                            const p = ANIMATION_PRESETS[id];
                            if (!p) return null;
                            return (
                              <option key={`fav-${id}`} value={id}>
                                ★ {p.name || id}
                              </option>
                            );
                          })}
                        </optgroup>
                      )}
                    {ANIMATION_CATEGORIES.map((cat) => {
                      const catItems = Object.values(ANIMATION_PRESETS).filter(
                        (p) => p.category === cat.id
                      );
                      if (catItems.length === 0) return null;
                      return (
                        <optgroup key={cat.id} label={cat.label}>
                          {catItems.map((preset) => {
                            const isFav =
                              Array.isArray(config.favoritePresets) &&
                              config.favoritePresets.includes(preset.id);
                            return (
                              <option key={preset.id} value={preset.id}>
                                {isFav ? "★ " : ""}
                                {preset.name || preset.id}
                              </option>
                            );
                          })}
                        </optgroup>
                      );
                    })}
                  </select>

                  <button
                    type="button"
                    className={`btn-mobile-fav ${isAnimFav ? "active" : ""}`}
                    onClick={() => handleToggleFavoritePreset(config.presetId)}
                    title="Favorit"
                    aria-label="Toggle Favorit"
                  >
                    {isAnimFav ? "★" : "☆"}
                  </button>
                </div>
              </div>

              {/* Duration Slider */}
              <div className="mobile-field-group">
                <div className="mobile-field-label-row">
                  <label htmlFor="anim-duration-slider">Durasi Animasi</label>
                  <span className="mobile-value-badge">
                    {Number(config.durationSeconds || 1.0).toFixed(1)}s
                  </span>
                </div>
                <input
                  id="anim-duration-slider"
                  type="range"
                  min="0.5"
                  max="5.0"
                  step="0.1"
                  value={config.durationSeconds || 1.0}
                  onChange={handleAnimationDurationChange}
                  className="mobile-slider"
                />
              </div>
            </section>

            {/* CARD 2: EFEK TEKS (Wiggle & Distorsi) */}
            <section className="mobile-card">
              <div className="mobile-card-header">
                <span className="mobile-card-title">〰️ Efek Teks (Wiggle)</span>
              </div>

              {/* Big ON / OFF Toggle */}
              <button
                type="button"
                className={`mobile-big-toggle fx ${
                  config.textEffectEnabled ? "on" : "off"
                }`}
                onClick={toggleTextEffect}
              >
                <span className="toggle-indicator-dot" />
                <span className="toggle-label-main">
                  {config.textEffectEnabled
                    ? "〰️ EFEK TEKS AKTIF"
                    : "⚪ EFEK TEKS NONAKTIF"}
                </span>
                <span className="toggle-hint-sub">
                  {config.textEffectEnabled
                    ? "Sentuh untuk matikan"
                    : "Sentuh untuk aktifkan efek"}
                </span>
              </button>

              {/* Preset Efek Selector */}
              <div className="mobile-field-group">
                <label htmlFor="fx-preset-select">Preset Efek Teks</label>
                <div className="mobile-select-fav-row">
                  <select
                    id="fx-preset-select"
                    className="mobile-select"
                    value={currentFxId}
                    onChange={(e) =>
                      handleTextEffectPresetChange(e.target.value)
                    }
                  >
                    {Array.isArray(config.favoriteEffects) &&
                      config.favoriteEffects.length > 0 && (
                        <optgroup label="⭐ Favorit">
                          {config.favoriteEffects.map((id) => {
                            const fx = TEXT_EFFECT_PRESETS[id];
                            if (!fx) return null;
                            return (
                              <option key={`fav-${id}`} value={id}>
                                ★ {fx.name || id}
                              </option>
                            );
                          })}
                        </optgroup>
                      )}
                    {TEXT_EFFECT_CATEGORIES.map((cat) => {
                      const catItems = Object.values(
                        TEXT_EFFECT_PRESETS
                      ).filter((fx) => fx.category === cat.id);
                      if (catItems.length === 0) return null;
                      return (
                        <optgroup key={cat.id} label={cat.label}>
                          {catItems.map((effect) => {
                            const isFav =
                              Array.isArray(config.favoriteEffects) &&
                              config.favoriteEffects.includes(effect.id);
                            return (
                              <option key={effect.id} value={effect.id}>
                                {isFav ? "★ " : ""}
                                {effect.name || effect.id}
                              </option>
                            );
                          })}
                        </optgroup>
                      );
                    })}
                  </select>

                  <button
                    type="button"
                    className={`btn-mobile-fav ${isFxFav ? "active" : ""}`}
                    onClick={() => handleToggleFavoriteEffect(currentFxId)}
                    title="Favorit"
                    aria-label="Toggle Favorit"
                  >
                    {isFxFav ? "★" : "☆"}
                  </button>
                </div>
              </div>

              {/* Sliders Grid: Intensitas & Kecepatan */}
              <div className="mobile-sliders-grid">
                <div className="mobile-field-group">
                  <div className="mobile-field-label-row">
                    <label htmlFor="fx-intensity-slider">Intensitas</label>
                    <span className="mobile-value-badge">
                      {Number(config.textEffectIntensity || 1.0).toFixed(1)}x
                    </span>
                  </div>
                  <input
                    id="fx-intensity-slider"
                    type="range"
                    min="0.2"
                    max="2.5"
                    step="0.1"
                    value={config.textEffectIntensity ?? 1.0}
                    onChange={handleEffectIntensityChange}
                    className="mobile-slider"
                  />
                </div>

                <div className="mobile-field-group">
                  <div className="mobile-field-label-row">
                    <label htmlFor="fx-speed-slider">Kecepatan</label>
                    <span className="mobile-value-badge">
                      {Number(config.textEffectSpeed || 1.0).toFixed(1)}x
                    </span>
                  </div>
                  <input
                    id="fx-speed-slider"
                    type="range"
                    min="0.2"
                    max="3.0"
                    step="0.1"
                    value={config.textEffectSpeed ?? 1.0}
                    onChange={handleEffectSpeedChange}
                    className="mobile-slider"
                  />
                </div>
              </div>
            </section>
          </>
        )}

        {/* EMERGENCY ACTION: CLEAR LAYAR LIRIK (F1) */}
        <div className="mobile-emergency-bar">
          <button
            type="button"
            className="btn-mobile-clear"
            onClick={() => triggerAction("clear-slide")}
          >
            🗑️ Clear Layar Lirik (F1)
          </button>
        </div>
      </main>
    </div>
  );
}
