import { useState, useEffect, useRef } from "react";
import TimePicker from "react-time-picker";
import "react-time-picker/dist/TimePicker.css";
import "react-clock/dist/Clock.css";
import { ANIMATION_CATEGORIES, ANIMATION_PRESETS } from "../lib/animationPresets";
import { FavoriteSelect } from "./FavoriteSelect";
import {
  DEFAULT_QUICK_PRESETS,
  DEFAULT_SHORTCUTS,
  formatKeyboardEvent
} from "../lib/shortcutConfig";
import {
  getCustomAnimationPresets,
  getCustomTextEffectPresets,
  deleteCustomPreset,
  exportPresetToFile
} from "../lib/customPresetManager";
import { CountdownOverlay, formatCountdownTime } from "./CountdownOverlay";
import { Slider } from "./ui/Slider";

function VMixStepper({
  value,
  onChange,
  min = 1,
  max = 999,
  step = 1,
  title = ""
}) {
  const numVal = typeof value === "number" && !isNaN(value) ? value : parseFloat(value) || 0;
  const [localText, setLocalText] = useState(String(numVal));

  useEffect(() => {
    setLocalText(String(numVal));
  }, [numVal]);

  const handleDecrement = (e) => {
    e.preventDefault();
    const next = Math.max(min, Math.round((numVal - step) * 100) / 100);
    setLocalText(String(next));
    onChange(next);
  };

  const handleIncrement = (e) => {
    e.preventDefault();
    const next = Math.min(max, Math.round((numVal + step) * 100) / 100);
    setLocalText(String(next));
    onChange(next);
  };

  const handleInputChange = (e) => {
    const text = e.target.value;
    setLocalText(text);
    const parsed = parseFloat(text);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    const parsed = parseFloat(localText);
    const clamped = isNaN(parsed) ? min : Math.max(min, Math.min(max, parsed));
    setLocalText(String(clamped));
    onChange(clamped);
  };

  return (
    <div className="vmix-stepper-wrap" title={title}>
      <input
        type="number"
        className="vmix-stepper-input"
        value={localText}
        min={min}
        max={max}
        step={step}
        onChange={handleInputChange}
        onBlur={handleBlur}
      />
      <div className="vmix-stepper-buttons">
        <button
          type="button"
          className="vmix-btn-minus"
          onClick={handleDecrement}
          aria-label="Kurang"
        >
          –
        </button>
        <button
          type="button"
          className="vmix-btn-plus"
          onClick={handleIncrement}
          aria-label="Tambah"
        >
          +
        </button>
      </div>
    </div>
  );
}

function SettingsOverlayPreview({
  config,
  countdownRuntime,
  onPositionChange,
  onFontSizeChange
}) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(480 / 1920);
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
    <div className="settings-preview-monitor" ref={containerRef}>
      {/* 16:9 Scaled Canvas */}
      <div
        className="settings-preview-canvas"
        style={{
          width: `${canvasWidth}px`,
          height: `${canvasHeight}px`,
          transform: `translate(-50%, -50%) scale(${scale})`
        }}
      >
        <CountdownOverlay
          config={config}
          runtime={countdownRuntime}
          isInteractive={true}
          forceVisible={true}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          onPositionChange={onPositionChange}
          onFontSizeChange={onFontSizeChange}
        />
      </div>

      <div className="settings-preview-badge">16:9 Live Preview</div>
    </div>
  );
}

const DEVICE_FONT_OPTIONS = [
  { label: "Segoe UI (Standar Windows)", value: "'Segoe UI', sans-serif" },
  { label: "Arial (Clean)", value: "Arial, sans-serif" },
  { label: "Montserrat / Modern Sans", value: "Montserrat, 'Segoe UI', sans-serif" },
  { label: "Impact (Tebal & Tegas)", value: "Impact, 'Arial Black', sans-serif" },
  { label: "Trebuchet MS (Elegan)", value: "'Trebuchet MS', sans-serif" },
  { label: "Calibri (Lembut)", value: "Calibri, sans-serif" },
  { label: "Bebas Neue / Display", value: "'Bebas Neue', Impact, sans-serif" },
  { label: "Tahoma (Padat)", value: "Tahoma, sans-serif" },
  { label: "Courier New / Monospace", value: "'Courier New', monospace" },
  { label: "Lainnya (Ketik Manual)...", value: "custom" }
];

const MAIN_SHORTCUT_ITEMS = [
  {
    key: "clear",
    label: "Clear Layar",
    desc: "Membersihkan slide teks dari preview, output proyektor, sekaligus layer Slide di ProPresenter."
  },
  {
    key: "toggleAnimation",
    label: "Tombol Animasi (On / Off)",
    desc: "Hijau = animasi teks aplikasi, Merah = mengikuti animasi / transisi langsung dari ProPresenter."
  },
  {
    key: "slideBefore",
    label: "Slide Before (Sebelumnya)",
    desc: "Pindah ke slide sebelumnya di ProPresenter."
  },
  {
    key: "slideAfter",
    label: "Slide After (Berikutnya)",
    desc: "Pindah ke slide berikutnya di ProPresenter."
  }
];

const SETTINGS_TABS = [
  { id: "connection", label: "📡 Koneksi & Port" },
  { id: "overlay", label: "⏱ Hitung Mundur & Teks" },
  { id: "shortcuts", label: "⌨️ Shortcut Keyboard" },
  { id: "quickPresets", label: "⚡ Tombol Cepat Suasana" },
  { id: "customPresets", label: "✨ Preset Kustom" }
];

function ShortcutRecorder({ id, value, isRecording, onStartRecord, onCancelRecord, onAssign }) {
  const handleKeyDown = (e) => {
    if (!isRecording) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.key === "Escape") {
      onCancelRecord();
      return;
    }

    const formatted = formatKeyboardEvent(e);
    if (formatted) {
      onAssign(formatted);
    }
  };

  return (
    <div className="shortcut-recorder-wrap">
      <button
        type="button"
        data-shortcut-recorder="true"
        className={`btn-shortcut-input ${isRecording ? "recording" : ""} ${value ? "assigned" : "empty"}`}
        onClick={() => (isRecording ? onCancelRecord() : onStartRecord(id))}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (isRecording) onCancelRecord();
        }}
        title={
          isRecording
            ? "Tekan tombol keyboard atau kombinasi (Ctrl/Alt/Shift + tombol). Tekan Esc untuk batal."
            : "Klik lalu tekan tombol shortcut baru"
        }
      >
        {isRecording ? "Tekan tombol... (Esc batal)" : value || "Kosong"}
      </button>

      <button
        type="button"
        className="btn-shortcut-clear"
        disabled={!value}
        onClick={() => onAssign("")}
        title="Kosongkan shortcut"
        aria-label="Kosongkan shortcut"
      >
        ✕
      </button>
    </div>
  );
}

export function SettingsView({
  config,
  onUpdateConfig,
  onBack,
  countdownRuntime,
  onStartTimer,
  onPauseTimer,
  onResetTimer
}) {
  const [activeTab, setActiveTab] = useState("connection");
  const [recordingId, setRecordingId] = useState(null);
  const [notice, setNotice] = useState("");

  // Connection & Auto-Discovery State
  const [discoveredDevices, setDiscoveredDevices] = useState([]);
  const [manualHost, setManualHost] = useState(config.proHost || "127.0.0.1");
  const [manualPort, setManualPort] = useState(config.proPort || 50001);
  const [connectionTestStatus, setConnectionTestStatus] = useState(null);
  const [isTestingConn, setIsTestingConn] = useState(false);

  // Custom Presets State
  const [customAnims, setCustomAnims] = useState(() => getCustomAnimationPresets());
  const [customEffects, setCustomEffects] = useState(() => getCustomTextEffectPresets());

  // Font input state for Countdown/Ticker
  const [customFontInput, setCustomFontInput] = useState("");
  const [isCustomFont, setIsCustomFont] = useState(false);

  const ov = config.countdownOverlay || {};

  // Maximum allowed font size based on format: 260px for hours, 380px for minutes
  // Ensures countdown never exceeds screen boundaries!
  const isHoursFormat =
    ov.timerType === "target" ||
    (Number(ov.durationHours) || 0) > 0 ||
    (Number(ov.durationMinutes) || 0) >= 60 ||
    Boolean(countdownRuntime?.remainingSeconds >= 3600);
  const maxAllowedFontSize = isHoursFormat ? 260 : 380;

  useEffect(() => {
    if (Number(ov.numberFontSize) > maxAllowedFontSize) {
      updateOverlay({ numberFontSize: maxAllowedFontSize });
    }
  }, [maxAllowedFontSize, ov.numberFontSize]);

  useEffect(() => {
    if (!ov.fontFamily) return;
    const match = DEVICE_FONT_OPTIONS.find((f) => f.value === ov.fontFamily);
    if (!match) {
      setIsCustomFont(true);
      setCustomFontInput(ov.fontFamily);
    } else {
      setIsCustomFont(false);
    }
  }, [ov.fontFamily]);

  const shortcuts = config.shortcuts || DEFAULT_SHORTCUTS;
  const quickPresets = config.quickPresets || DEFAULT_QUICK_PRESETS;

  // Auto-discovery scanner lifecycle
  useEffect(() => {
    if (window.electronAPI?.startDiscovery) {
      window.electronAPI.startDiscovery();
      window.electronAPI.getDiscoveredDevices?.().then((list) => {
        if (Array.isArray(list)) setDiscoveredDevices(list);
      });
    }

    const unsubDiscovery = window.electronAPI?.onDiscoveredDevicesChange?.((list) => {
      if (Array.isArray(list)) setDiscoveredDevices(list);
    });

    const refreshPresets = () => {
      setCustomAnims(getCustomAnimationPresets());
      setCustomEffects(getCustomTextEffectPresets());
    };
    window.addEventListener("propresenter_presets_updated", refreshPresets);

    return () => {
      if (unsubDiscovery) unsubDiscovery();
      window.removeEventListener("propresenter_presets_updated", refreshPresets);
      if (window.electronAPI?.stopDiscovery) {
        window.electronAPI.stopDiscovery();
      }
    };
  }, []);

  const updateOverlay = (patch) => {
    onUpdateConfig({
      ...config,
      countdownOverlay: {
        ...(config.countdownOverlay || {}),
        ...patch
      }
    });
  };

  const handleApplyDiscoveredDevice = (dev) => {
    setManualHost(dev.host);
    setManualPort(dev.port);
    onUpdateConfig({
      ...config,
      proHost: dev.host,
      proPort: dev.port
    });
    setNotice(`Koneksi ProPresenter dialihkan ke: ${dev.name} (${dev.host}:${dev.port})`);
    setConnectionTestStatus({
      success: true,
      message: `Terhubung ke ${dev.name} (v${dev.version || "7.x"})`
    });
  };

  const handleTestAndSaveConnection = async () => {
    setIsTestingConn(true);
    setConnectionTestStatus(null);
    try {
      const res = await window.electronAPI?.testProPresenterConnection?.({
        host: manualHost,
        port: Number(manualPort)
      });
      if (res && res.online) {
        onUpdateConfig({
          ...config,
          proHost: manualHost,
          proPort: Number(manualPort)
        });
        setConnectionTestStatus({
          success: true,
          message: `✅ Berhasil terhubung ke ${res.name || "ProPresenter"} (Port ${manualPort})`
        });
        setNotice(`Koneksi disimpan: ${manualHost}:${manualPort}`);
      } else {
        setConnectionTestStatus({
          success: false,
          message: `❌ Tidak dapat terhubung ke ${manualHost}:${manualPort}. Pastikan OpenAPI aktif di Preferences ProPresenter.`
        });
      }
    } catch (err) {
      setConnectionTestStatus({
        success: false,
        message: `❌ Error: ${err.message}`
      });
    } finally {
      setIsTestingConn(false);
    }
  };

  const assignUniqueShortcut = (targetType, targetKeyOrId, nextShortcut) => {
    const nextShortcuts = { ...shortcuts };
    const nextQuickPresets = quickPresets.map((item) => ({ ...item }));
    let movedFrom = "";

    if (nextShortcut) {
      for (const item of MAIN_SHORTCUT_ITEMS) {
        const isSelf = targetType === "main" && targetKeyOrId === item.key;
        if (!isSelf && nextShortcuts[item.key] === nextShortcut) {
          nextShortcuts[item.key] = "";
          movedFrom = item.label;
        }
      }
      for (const qp of nextQuickPresets) {
        const isSelf = targetType === "quick" && targetKeyOrId === qp.id;
        if (!isSelf && qp.shortcut === nextShortcut) {
          qp.shortcut = "";
          movedFrom = `Preset Cepat "${qp.label}"`;
        }
      }
    }

    if (targetType === "main") {
      nextShortcuts[targetKeyOrId] = nextShortcut;
    } else {
      const idx = nextQuickPresets.findIndex((qp) => qp.id === targetKeyOrId);
      if (idx >= 0) nextQuickPresets[idx].shortcut = nextShortcut;
    }

    onUpdateConfig({
      ...config,
      shortcuts: nextShortcuts,
      quickPresets: nextQuickPresets
    });
    setRecordingId(null);
    setNotice(
      nextShortcut && movedFrom
        ? `Shortcut "${nextShortcut}" dipindahkan dari ${movedFrom}.`
        : ""
    );
  };

  const handleUpdateQuickPreset = (id, patch) => {
    const next = quickPresets.map((qp) => (qp.id === id ? { ...qp, ...patch } : qp));
    onUpdateConfig({ ...config, quickPresets: next });
  };

  const handleAddQuickPreset = () => {
    if (quickPresets.length >= 6) return;
    const newId = `quick-${Date.now()}`;
    const next = [
      ...quickPresets,
      {
        id: newId,
        label: `Preset ${quickPresets.length + 1}`,
        presetId: "cinematic-blur",
        durationSeconds: 1.0,
        animationEnabled: true,
        shortcut: ""
      }
    ];
    onUpdateConfig({ ...config, quickPresets: next });
  };

  const handleRemoveQuickPreset = (id) => {
    if (quickPresets.length <= 1) return;
    onUpdateConfig({
      ...config,
      quickPresets: quickPresets.filter((qp) => qp.id !== id)
    });
  };

  const handleResetDefaults = () => {
    onUpdateConfig({
      ...config,
      shortcuts: { ...DEFAULT_SHORTCUTS },
      quickPresets: DEFAULT_QUICK_PRESETS.map((qp) => ({ ...qp }))
    });
    setRecordingId(null);
    setNotice("Pengaturan shortcut & tombol cepat dikembalikan ke bawaan.");
  };

  const animList = Object.values(customAnims);
  const effectList = Object.values(customEffects);

  return (
    <div className="settings-page">
      {/* Top Bar with Clean Header & Return Button */}
      <div className="settings-topbar">
        <div>
          <h2 className="settings-title">⚙️ Pengaturan Aplikasi</h2>
        </div>
        <div className="settings-topbar-actions">
          {activeTab === "shortcuts" && (
            <button type="button" className="btn-secondary" onClick={handleResetDefaults}>
              ↺ Reset Bawaan
            </button>
          )}
          <button type="button" className="btn-primary" onClick={onBack}>
            ← Kembali ke Live
          </button>
        </div>
      </div>

      {notice && <div className="settings-notice">{notice}</div>}

      {/* Sub-Menu Tabs Navigation (1 Fungsi 1 Menu di Bagian Atas) */}
      <nav className="settings-tabs-nav" aria-label="Menu Pengaturan">
        {SETTINGS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`settings-tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => {
              setActiveTab(tab.id);
              setNotice("");
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content Area per Tab */}
      <div className="settings-tab-content">
        {/* =========================================================
            TAB 1: 📡 Koneksi & Port
            ========================================================= */}
        {activeTab === "connection" && (
          <section className="card settings-card">
            <div className="settings-card-head">
              <h3 className="card-title" style={{ margin: 0 }}>
                Koneksi Jaringan &amp; Port OpenAPI ProPresenter 7
              </h3>
              <span className="current-conn-text">
                Aktif: <b>{config.proHost || "127.0.0.1"}:{config.proPort || 50001}</b>
              </span>
            </div>

            <div className="connection-settings-grid">
              {/* Manual Input IP & Port */}
              <div className="conn-col manual-input-box">
                <span className="col-title">✍️ Atur Manual IP &amp; Port</span>
                <p className="col-desc">
                  Masukkan IP laptop ProPresenter dan port OpenAPI jika berada di jaringan Wi-Fi/LAN lokal:
                </p>

                <div className="manual-form-row">
                  <div className="form-group flex-2">
                    <label>Host / Alamat IP</label>
                    <input
                      type="text"
                      value={manualHost}
                      onChange={(e) => setManualHost(e.target.value)}
                      placeholder="127.0.0.1 atau 192.168.1.xxx"
                      className="input-text"
                    />
                  </div>

                  <div className="form-group flex-1">
                    <label>Port OpenAPI</label>
                    <input
                      type="number"
                      value={manualPort}
                      onChange={(e) => setManualPort(parseInt(e.target.value, 10) || 50001)}
                      placeholder="50001"
                      className="input-text"
                    />
                  </div>
                </div>

                <div className="manual-actions-row">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleTestAndSaveConnection}
                    disabled={isTestingConn}
                  >
                    {isTestingConn ? "Menguji..." : "Simpan &amp; Uji Koneksi"}
                  </button>
                </div>

                {connectionTestStatus && (
                  <div className={`conn-status-banner ${connectionTestStatus.success ? "success" : "error"}`}>
                    {connectionTestStatus.message}
                  </div>
                )}
              </div>

              {/* Auto-Discovery List */}
              <div className="conn-col auto-discovery-box">
                <div className="col-header-row">
                  <span className="col-title">🔍 Deteksi Otomatis (mDNS / Wi-Fi)</span>
                  <button
                    type="button"
                    className="btn-tiny"
                    onClick={() => {
                      if (window.electronAPI?.startDiscovery) {
                        window.electronAPI.startDiscovery();
                        setNotice("Memindai perangkat ProPresenter di jaringan...");
                      }
                    }}
                  >
                    🔄 Scan Ulang
                  </button>
                </div>

                {discoveredDevices.length === 0 ? (
                  <div className="empty-discovery-notice">
                    <span className="spinner-dot">●</span> Memindai jaringan lokal...
                    <p className="subtext">
                      Pastikan kedua komputer terhubung ke jaringan Wi-Fi / LAN yang sama dan OpenAPI aktif.
                    </p>
                  </div>
                ) : (
                  <div className="discovered-list">
                    {discoveredDevices.map((dev) => {
                      const isSelected =
                        (config.proHost || "127.0.0.1") === dev.host &&
                        Number(config.proPort || 50001) === Number(dev.port);
                      return (
                        <div key={dev.id} className={`discovered-device-item ${isSelected ? "selected" : ""}`}>
                          <div className="dev-meta">
                            <div className="dev-name">{dev.name}</div>
                            <div className="dev-addr">
                              {dev.host}:{dev.port} {dev.version ? `(v${dev.version})` : ""}
                            </div>
                          </div>
                          <button
                            type="button"
                            className={`btn-dev-connect ${isSelected ? "active" : ""}`}
                            onClick={() => handleApplyDiscoveredDevice(dev)}
                            disabled={isSelected}
                          >
                            {isSelected ? "Terhubung" : "Gunakan"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* =========================================================
            TAB 2: ⏱ Hitung Mundur & Teks (Independen & Berbarengan)
            ========================================================= */}
        {activeTab === "overlay" && (
          <div className="overlay-settings-layout">
            {/* Master Toggles (Keduanya bisa aktif berbarengan) */}
            <div className="overlay-switches-bar">
              <div className="switch-card">
                <div className="switch-info">
                  <span className="switch-title">Hitung Mundur (Countdown)</span>
                </div>
                <div className="switch-control-wrap">
                  <button
                    type="button"
                    className={`btn-tally-toggle ${ov.countdownEnabled ? "on" : "off"}`}
                    onClick={() => updateOverlay({ countdownEnabled: !ov.countdownEnabled })}
                  >
                    {ov.countdownEnabled ? "ON" : "OFF"}
                  </button>
                </div>
              </div>

              <div className="switch-card">
                <div className="switch-info">
                  <span className="switch-title">Teks Berjalan (Running Text)</span>
                </div>
                <div className="switch-control-wrap">
                  <button
                    type="button"
                    className={`btn-tally-toggle ${ov.tickerEnabled ? "on" : "off"}`}
                    onClick={() =>
                      updateOverlay({
                        tickerEnabled: !ov.tickerEnabled,
                        tickerStartedAt: !ov.tickerEnabled ? Date.now() : 0
                      })
                    }
                  >
                    {ov.tickerEnabled ? "ON" : "OFF"}
                  </button>
                </div>
              </div>
            </div>

            {/* Dedicated 16:9 Preview Monitor Card (Countdown & Running Text) */}
            <div className="card settings-preview-card">
              <div className="settings-preview-header">
                <div className="preview-header-left">
                  <h3 className="card-title" style={{ margin: 0 }}>
                    📺 Preview Layar Tampilan (16:9)
                  </h3>
                </div>
                <div className="preview-badges-wrap">
                  <div className={`pro-status-indicator ${ov.countdownEnabled ? "connected" : ""}`}>
                    <span className="status-dot" />
                    <span>Countdown: {ov.countdownEnabled ? "Aktif" : "Off"}</span>
                  </div>
                  <div className={`pro-status-indicator ${ov.tickerEnabled ? "connected" : ""}`}>
                    <span className="status-dot" />
                    <span>Ticker: {ov.tickerEnabled ? "Aktif" : "Off"}</span>
                  </div>
                </div>
              </div>

              <SettingsOverlayPreview
                config={ov}
                countdownRuntime={countdownRuntime}
                onPositionChange={(pos) => updateOverlay({ position: pos, presetPosition: "custom" })}
                onFontSizeChange={(size) => updateOverlay({ numberFontSize: size })}
              />
            </div>

            {/* Grid 2 Kolom: Kiri Countdown, Kanan Running Text */}
            <div className="overlay-config-columns">
              {/* Kolom 1: Konfigurasi Countdown */}
              <section className="card settings-card">
                <h3 className="card-title">⏱ Pengaturan Countdown</h3>

                {/* Mode Timer: Durasi vs Target Jam */}
                <div className="form-group">
                  <label>Pilihan Mode Hitung Mundur</label>
                  <div className="segmented-control">
                    <button
                      type="button"
                      className={`seg-btn ${ov.timerType !== "target" ? "active" : ""}`}
                      onClick={() => updateOverlay({ timerType: "duration" })}
                    >
                      Durasi Manual (HH:MM:SS)
                    </button>
                    <button
                      type="button"
                      className={`seg-btn ${ov.timerType === "target" ? "active" : ""}`}
                      onClick={() => updateOverlay({ timerType: "target" })}
                    >
                      Target Jam (HH:MM:SS)
                    </button>
                  </div>
                </div>

                {ov.timerType !== "target" ? (
                  <div className="timer-inputs-pair">
                    <div className="form-group flex-1">
                      <label>Jam (j)</label>
                      <VMixStepper
                        value={ov.durationHours ?? 0}
                        min={0}
                        max={99}
                        step={1}
                        title="Durasi jam countdown"
                        onChange={(val) => updateOverlay({ durationHours: val })}
                      />
                    </div>
                    <div className="form-group flex-1">
                      <label>Menit (m)</label>
                      <VMixStepper
                        value={ov.durationMinutes ?? 5}
                        min={0}
                        max={59}
                        step={1}
                        title="Durasi menit countdown"
                        onChange={(val) => updateOverlay({ durationMinutes: val })}
                      />
                    </div>
                    <div className="form-group flex-1">
                      <label>Detik (s)</label>
                      <VMixStepper
                        value={ov.durationSeconds ?? 0}
                        min={0}
                        max={59}
                        step={5}
                        title="Durasi detik countdown"
                        onChange={(val) => updateOverlay({ durationSeconds: val })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Target Waktu (Format 24 Jam: HH:mm:ss)</label>
                    <div className="timepicker-custom-container">
                      <TimePicker
                        onChange={(val) => updateOverlay({ targetTime: val || "09:00:00" })}
                        value={ov.targetTime || "09:00:00"}
                        format="HH:mm:ss"
                        disableClock={true}
                        clearIcon={null}
                        className="custom-time-picker"
                      />
                    </div>
                  </div>
                )}

                {/* Kontrol Timer Live */}
                <div className="timer-action-buttons">
                  {!countdownRuntime?.isRunning || countdownRuntime?.isPaused ? (
                    <button type="button" className="btn-timer play" onClick={onStartTimer}>
                      ▶ Mulai
                    </button>
                  ) : (
                    <button type="button" className="btn-timer pause" onClick={onPauseTimer}>
                      ⏸ Jeda
                    </button>
                  )}
                  <button type="button" className="btn-timer reset" onClick={onResetTimer}>
                    ⏹ Reset
                  </button>
                  <div className="timer-live-label">
                    Sisa: <b>{formatCountdownTime(countdownRuntime?.remainingSeconds || 0)}</b>
                  </div>
                </div>

                {/* Aksi Saat Selesai */}
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label>Aksi Saat Waktu Habis (00:00)</label>
                  <select
                    value={ov.finishAction || "auto-hide"}
                    onChange={(e) => updateOverlay({ finishAction: e.target.value })}
                    className="select-dropdown"
                  >
                    <option value="auto-hide">Sembunyikan Otomatis (Fade Out)</option>
                    <option value="custom-text">Tampilkan Pesan Selesai (Tampil 3 Detik lalu Fade Out)</option>
                    <option value="hold">Tetap Tampil di 00:00 (Hold)</option>
                  </select>
                  {ov.finishAction === "custom-text" && (
                    <input
                      type="text"
                      placeholder="Pesan selesai (misal: Selamat Beribadah!)"
                      value={ov.finishText || ""}
                      onChange={(e) => updateOverlay({ finishText: e.target.value })}
                      className="input-text"
                      style={{ marginTop: 8 }}
                    />
                  )}
                </div>

                {/* Tampilan & Warna Angka */}
                <div className="form-group-row" style={{ marginTop: 12 }}>
                  <div className="form-group flex-1">
                    <label>Ukuran Angka (px) — Maks {maxAllowedFontSize}px</label>
                    <VMixStepper
                      value={Math.min(maxAllowedFontSize, Math.max(12, Number(ov.numberFontSize) || 48))}
                      min={12}
                      max={maxAllowedFontSize}
                      step={2}
                      title={`Ukuran font angka countdown (Maksimum ${maxAllowedFontSize}px agar tidak melebihi layar)`}
                      onChange={(val) => updateOverlay({ numberFontSize: Math.min(maxAllowedFontSize, val) })}
                    />
                  </div>
                  <div className="form-group" style={{ width: 110 }}>
                    <label>Warna Angka</label>
                    <div className="color-input-wrap">
                      <input
                        type="color"
                        value={ov.highlightColor || "#fbbf24"}
                        onChange={(e) => updateOverlay({ highlightColor: e.target.value })}
                        className="input-color"
                      />
                      <span>{ov.highlightColor || "#fbbf24"}</span>
                    </div>
                  </div>
                </div>

                <p className="field-hint">
                  💡 Angka countdown ditampilkan <b>hanya angkanya saja</b> tanpa latar belakang kotak dan posisinya dapat digeser bebas (*drag &amp; drop*) langsung di layar Live Program Preview.
                </p>
              </section>

              {/* Kolom 2: Konfigurasi Running Text (Full-Width, Kotak Biasa Bisa Diatur Warna) */}
              <section className="card settings-card">
                <h3 className="card-title">💬 Pengaturan Running Text (Full-Width)</h3>

                <div className="form-group">
                  <label>Teks Pengumuman</label>
                  <textarea
                    rows="3"
                    placeholder="Ketik teks pengumuman yang akan berjalan selebar layar..."
                    value={ov.tickerText || ""}
                    onChange={(e) => updateOverlay({ tickerText: e.target.value })}
                    className="input-textarea input-textarea-static"
                  />
                </div>

                <div className="form-group-row">
                  <div className="form-group flex-1">
                    <label>Posisi di Layar</label>
                    <select
                      value={ov.tickerPosition || "bottom"}
                      onChange={(e) => updateOverlay({ tickerPosition: e.target.value })}
                      className="select-dropdown"
                    >
                      <option value="bottom">Bawah Layar (Bottom)</option>
                      <option value="top">Atas Layar (Top)</option>
                    </select>
                  </div>

                  <div className="form-group flex-1">
                    <label>Kecepatan Berjalan (detik)</label>
                    <VMixStepper
                      value={ov.tickerSpeed || 28}
                      min={5}
                      max={120}
                      step={1}
                      title="Durasi waktu scroll teks (semakin kecil nilainya, semakin cepat gerakannya)"
                      onChange={(val) => updateOverlay({ tickerSpeed: val })}
                    />
                  </div>
                </div>

                {/* Warna Latar Kotak & Opacity */}
                <div className="form-group-row" style={{ marginTop: 12 }}>
                  <div className="form-group flex-1">
                    <label>Warna Latar Kotak</label>
                    <div className="color-input-wrap">
                      <input
                        type="color"
                        value={ov.tickerBgColor || "#000000"}
                        onChange={(e) => updateOverlay({ tickerBgColor: e.target.value })}
                        className="input-color"
                      />
                      <span>{ov.tickerBgColor || "#000000"}</span>
                    </div>
                  </div>

                  <div className="form-group flex-1">
                    <label>Transparansi Latar (%)</label>
                    <VMixStepper
                      value={Math.round((ov.tickerBgOpacity ?? 0.8) * 100)}
                      min={0}
                      max={100}
                      step={5}
                      title="Transparansi warna latar kotak running text"
                      onChange={(val) => updateOverlay({ tickerBgOpacity: val / 100 })}
                    />
                  </div>
                </div>

                <div className="form-group-row" style={{ marginTop: 12 }}>
                  <div className="form-group flex-1">
                    <label>Ukuran Teks (px)</label>
                    <VMixStepper
                      value={ov.textFontSize || 24}
                      min={12}
                      max={90}
                      step={1}
                      title="Ukuran font teks berjalan"
                      onChange={(val) => updateOverlay({ textFontSize: val })}
                    />
                  </div>

                  <div className="form-group" style={{ width: 110 }}>
                    <label>Warna Teks</label>
                    <div className="color-input-wrap">
                      <input
                        type="color"
                        value={ov.textColor || "#ffffff"}
                        onChange={(e) => updateOverlay({ textColor: e.target.value })}
                        className="input-color"
                      />
                      <span>{ov.textColor || "#ffffff"}</span>
                    </div>
                  </div>
                </div>

                {/* Pilihan Font Sesuai Device */}
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label>Jenis Font Device</label>
                  <select
                    value={isCustomFont ? "custom" : ov.fontFamily || "'Segoe UI', sans-serif"}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "custom") {
                        setIsCustomFont(true);
                      } else {
                        setIsCustomFont(false);
                        updateOverlay({ fontFamily: val });
                      }
                    }}
                    className="select-dropdown"
                  >
                    {DEVICE_FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  {isCustomFont && (
                    <input
                      type="text"
                      placeholder="Ketik nama font komputer Anda..."
                      value={customFontInput}
                      onChange={(e) => {
                        setCustomFontInput(e.target.value);
                        updateOverlay({ fontFamily: e.target.value });
                      }}
                      className="input-text"
                      style={{ marginTop: 8 }}
                    />
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 3: ⌨️ Shortcut Keyboard
            ========================================================= */}
        {activeTab === "shortcuts" && (
          <section className="card settings-card">
            <h3 className="card-title">⌨️ Shortcut Utama</h3>
            <p className="card-desc">
              Klik kotak shortcut lalu tekan tombol keyboard yang diinginkan (atau klik ✕ untuk mengosongkan).
            </p>
            <div className="shortcut-list">
              {MAIN_SHORTCUT_ITEMS.map((item) => {
                const recId = `main:${item.key}`;
                return (
                  <div key={item.key} className="shortcut-row">
                    <div className="shortcut-meta">
                      <div className="shortcut-name">{item.label}</div>
                      <div className="shortcut-desc">{item.desc}</div>
                    </div>
                    <ShortcutRecorder
                      id={recId}
                      value={shortcuts[item.key] || ""}
                      isRecording={recordingId === recId}
                      onStartRecord={setRecordingId}
                      onCancelRecord={() => setRecordingId(null)}
                      onAssign={(val) => assignUniqueShortcut("main", item.key, val)}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* =========================================================
            TAB 4: ⚡ Tombol Cepat Suasana Lagu
            ========================================================= */}
        {activeTab === "quickPresets" && (
          <section className="card settings-card">
            <div className="settings-card-head">
              <h3 className="card-title" style={{ margin: 0 }}>
                ⚡ Tombol Cepat Suasana Lagu
              </h3>
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={quickPresets.length >= 6}
                onClick={handleAddQuickPreset}
              >
                + Tambah
              </button>
            </div>

            <div className="quick-preset-editor-list">
              {quickPresets.map((qp) => {
                const recId = `quick:${qp.id}`;
                return (
                  <div key={qp.id} className="quick-preset-editor-item">
                    <div className="qp-row-top">
                      <input
                        type="text"
                        className="qp-name-input"
                        value={qp.label}
                        maxLength={24}
                        onChange={(e) => handleUpdateQuickPreset(qp.id, { label: e.target.value })}
                        placeholder="Nama tombol (mis. Worship)"
                      />

                      <select
                        className="qp-mode-select"
                        value={qp.animationEnabled ? "on" : "off"}
                        onChange={(e) =>
                          handleUpdateQuickPreset(qp.id, {
                            animationEnabled: e.target.value === "on"
                          })
                        }
                      >
                        <option value="on">Animasi Aktif</option>
                        <option value="off">Nonaktif (Ikut ProPresenter)</option>
                      </select>

                      <ShortcutRecorder
                        id={recId}
                        value={qp.shortcut || ""}
                        isRecording={recordingId === recId}
                        onStartRecord={setRecordingId}
                        onCancelRecord={() => setRecordingId(null)}
                        onAssign={(val) => assignUniqueShortcut("quick", qp.id, val)}
                      />

                      {quickPresets.length > 1 && (
                        <button
                          type="button"
                          className="btn-shortcut-clear"
                          onClick={() => handleRemoveQuickPreset(qp.id)}
                          title="Hapus tombol cepat ini"
                          aria-label={`Hapus ${qp.label}`}
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {qp.animationEnabled && (
                      <div className="qp-row-bottom">
                        <FavoriteSelect
                          className="qp-preset-select"
                          value={qp.presetId}
                          onChange={(nextId) => handleUpdateQuickPreset(qp.id, { presetId: nextId })}
                          categories={ANIMATION_CATEGORIES}
                          itemsById={ANIMATION_PRESETS}
                          favoriteIds={Array.isArray(config.favoritePresets) ? config.favoritePresets : []}
                          onToggleFavorite={(id) =>
                            onUpdateConfig((prev) => {
                              const list = Array.isArray(prev.favoritePresets) ? prev.favoritePresets : [];
                              const exists = list.includes(id);
                              return {
                                ...prev,
                                favoritePresets: exists ? list.filter((item) => item !== id) : [...list, id]
                              };
                            })
                          }
                          ariaLabel={`Preset animasi untuk ${qp.label}`}
                        />

                        <div className="qp-duration-wrap">
                          <Slider
                            min={0.5}
                            max={5.0}
                            step={0.1}
                            value={qp.durationSeconds}
                            onChange={(val) =>
                              handleUpdateQuickPreset(qp.id, {
                                durationSeconds: val
                              })
                            }
                            aria-label={`Durasi ${qp.label}`}
                          />
                          <span className="value-tag">{Number(qp.durationSeconds).toFixed(1)}s</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* =========================================================
            TAB 5: ✨ Preset Kustom (Impor & Ekspor Drag & Drop)
            ========================================================= */}
        {activeTab === "customPresets" && (
          <section className="card settings-card">
            <div className="settings-card-head">
              <h3 className="card-title" style={{ margin: 0 }}>
                ✨ Preset Kustom (Impor &amp; Ekspor)
              </h3>
              <span className="current-conn-text">
                {animList.length} Animasi • {effectList.length} Efek
              </span>
            </div>

            <p className="card-desc">
              Anda dapat menambahkan animasi atau efek baru kapan saja cukup dengan <b>menyeret dan melepaskan (drag &amp; drop)</b> file <code>.json</code> ke jendela aplikasi.
            </p>

            <div className="custom-presets-table-wrap">
              {animList.length === 0 && effectList.length === 0 ? (
                <div className="empty-presets-hint">
                  Belum ada preset kustom yang diimpor. Seret file <code>.json</code> preset animasi atau efek ke aplikasi untuk menambahkan.
                </div>
              ) : (
                <div className="custom-items-grid">
                  {animList.map((item) => (
                    <div key={item.id} className="custom-preset-card">
                      <div className="cp-header">
                        <span className="cp-type-label">Animasi</span>
                        <span className="cp-target-label">{item.target}</span>
                      </div>
                      <div className="cp-name">{item.name}</div>
                      <div className="cp-actions">
                        <button
                          type="button"
                          className="btn-tiny"
                          onClick={() => exportPresetToFile(item, `${item.id}.json`)}
                        >
                          📤 Ekspor
                        </button>
                        <button
                          type="button"
                          className="btn-tiny delete"
                          onClick={() => {
                            deleteCustomPreset(item.id, "animation");
                            setCustomAnims(getCustomAnimationPresets());
                          }}
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  ))}

                  {effectList.map((item) => (
                    <div key={item.id} className="custom-preset-card">
                      <div className="cp-header">
                        <span className="cp-type-label">Efek Teks</span>
                        <span className="cp-target-label">{item.target}</span>
                      </div>
                      <div className="cp-name">{item.name}</div>
                      <div className="cp-actions">
                        <button
                          type="button"
                          className="btn-tiny"
                          onClick={() => exportPresetToFile(item, `${item.id}.json`)}
                        >
                          📤 Ekspor
                        </button>
                        <button
                          type="button"
                          className="btn-tiny delete"
                          onClick={() => {
                            deleteCustomPreset(item.id, "effect");
                            setCustomEffects(getCustomTextEffectPresets());
                          }}
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
