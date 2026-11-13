import { useState, useEffect, useRef, useCallback } from "react";
import { ANIMATION_PRESETS, ANIMATION_CATEGORIES } from "../lib/animationPresets";
import {
  TEXT_EFFECT_PRESETS,
  TEXT_EFFECT_CATEGORIES
} from "../lib/textEffectEngine";

export function MobileRemoteView() {
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
    favoriteEffects: []
  });

  const [slideSummary, setSlideSummary] = useState({
    text: "",
    group: "",
    position: null,
    themeName: ""
  });

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const isMountedRef = useRef(true);

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
                offTransitionMode: payload.config.offTransitionMode === "cut" ? "cut" : "fade",
                textEffectEnabled: Boolean(payload.config.textEffectEnabled)
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
                  ? msg.payload.offTransitionMode === "cut" ? "cut" : "fade"
                  : prev.offTransitionMode,
              textEffectEnabled:
                msg.payload.textEffectEnabled !== undefined
                  ? Boolean(msg.payload.textEffectEnabled)
                  : prev.textEffectEnabled
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

        // Schedule auto-reconnect
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

    // Auto reconnect on visibility change (e.g. user unlocks phone)
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

  // Dispatch action (e.g. clear-slide)
  const triggerAction = useCallback((action) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(
          JSON.stringify({
            type: "TRIGGER_ACTION",
            action
          })
        );
      } catch (err) {
        console.warn("[MobileRemote] Failed to send action:", err);
      }
    }
  }, []);

  // Handlers for Animation
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
    const favs = Array.isArray(config.favoritePresets) ? [...config.favoritePresets] : [];
    const idx = favs.indexOf(presetId);
    if (idx >= 0) {
      favs.splice(idx, 1);
    } else {
      favs.push(presetId);
    }
    sendConfigChange({ favoritePresets: favs });
  };

  // Handlers for Text Effect
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
    const favs = Array.isArray(config.favoriteEffects) ? [...config.favoriteEffects] : [];
    const idx = favs.indexOf(effectId);
    if (idx >= 0) {
      favs.splice(idx, 1);
    } else {
      favs.push(effectId);
    }
    sendConfigChange({ favoriteEffects: favs });
  };

  const isAnimFav = (Array.isArray(config.favoritePresets) ? config.favoritePresets : []).includes(
    config.presetId
  );
  const currentFxId = config.textEffectId || "ae-wiggle-pos";
  const isFxFav = (Array.isArray(config.favoriteEffects) ? config.favoriteEffects : []).includes(
    currentFxId
  );

  return (
    <div className="mobile-remote-viewport">
      {/* Mobile Top Header */}
      <header className="mobile-header">
        <div className="mobile-header-left">
          <span className="mobile-app-icon">📱</span>
          <div>
            <h1 className="mobile-title">ProPresenter Remote</h1>
            <span className="mobile-subtitle">Kontrol Lirik &amp; Animasi</span>
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

      {/* Mini Slide Summary (Read-only, no video/monitor preview) */}
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
        {/* CARD 1: ANIMASI TEKS */}
        <section className="mobile-card">
          <div className="mobile-card-header">
            <span className="mobile-card-title">🎨 Animasi Teks</span>
          </div>

          {/* Big ON / OFF Toggle */}
          <button
            type="button"
            className={`mobile-big-toggle ${config.animationEnabled ? "on" : "off"}`}
            onClick={toggleAnimation}
          >
            <span className="toggle-indicator-dot" />
            <span className="toggle-label-main">
              {config.animationEnabled ? "✨ ANIMASI AKTIF" : "⚪ ANIMASI NONAKTIF"}
            </span>
            <span className="toggle-hint-sub">
              {config.animationEnabled
                ? "Sentuh untuk matikan"
                : `Sentuh untuk aktifkan (${config.offTransitionMode === "cut" ? "Cut" : "Fade"})`}
            </span>
          </button>

          {/* Transition Mode when Anim Off: Fade vs Cut */}
          <div className="mobile-field-group">
            <div className="mobile-field-label-row">
              <label>Mode Transisi Saat Animasi Off</label>
              <span className={`mobile-status-tag ${config.animationEnabled ? "muted" : "active"}`}>
                {config.animationEnabled ? "Otomatis Fade saat Off" : "Aktif"}
              </span>
            </div>

            <div
              className={`mobile-segment-group ${config.animationEnabled ? "disabled" : ""}`}
              role="group"
              aria-label="Mode transisi saat Animasi Off"
            >
              <button
                type="button"
                disabled={config.animationEnabled}
                className={`mobile-segment-btn ${config.offTransitionMode === "fade" ? "active" : ""}`}
                onClick={() => setOffTransition("fade")}
              >
                🌊 Fade
              </button>
              <button
                type="button"
                disabled={config.animationEnabled}
                className={`mobile-segment-btn ${config.offTransitionMode === "cut" ? "active" : ""}`}
                onClick={() => setOffTransition("cut")}
              >
                ⚡ Cut
              </button>
            </div>
            {config.animationEnabled && (
              <span className="mobile-field-hint">
                Pilihan Fade / Cut aktif saat tombol Animasi di atas dimatikan.
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
                {Array.isArray(config.favoritePresets) && config.favoritePresets.length > 0 && (
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
            className={`mobile-big-toggle fx ${config.textEffectEnabled ? "on" : "off"}`}
            onClick={toggleTextEffect}
          >
            <span className="toggle-indicator-dot" />
            <span className="toggle-label-main">
              {config.textEffectEnabled ? "〰️ EFEK TEKS AKTIF" : "⚪ EFEK TEKS NONAKTIF"}
            </span>
            <span className="toggle-hint-sub">
              {config.textEffectEnabled ? "Sentuh untuk matikan" : "Sentuh untuk aktifkan efek"}
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
                onChange={(e) => handleTextEffectPresetChange(e.target.value)}
              >
                {Array.isArray(config.favoriteEffects) && config.favoriteEffects.length > 0 && (
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
                  const catItems = Object.values(TEXT_EFFECT_PRESETS).filter(
                    (fx) => fx.category === cat.id
                  );
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

          {/* Sliders Grid: Intensitas & Kecepatan (Selalu aktif walau Efek OFF) */}
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

        {/* EMERGENCY / QUICK ACTION */}
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
