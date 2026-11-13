import { useState } from "react";
import { ANIMATION_CATEGORIES, ANIMATION_PRESETS } from "../lib/animationPresets";
import { FavoriteSelect } from "./FavoriteSelect";
import {
  DEFAULT_QUICK_PRESETS,
  DEFAULT_SHORTCUTS,
  formatKeyboardEvent
} from "../lib/shortcutConfig";

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

export function SettingsView({ config, onUpdateConfig, onBack }) {
  const [recordingId, setRecordingId] = useState(null);
  const [notice, setNotice] = useState("");

  const shortcuts = config.shortcuts || DEFAULT_SHORTCUTS;
  const quickPresets = config.quickPresets || DEFAULT_QUICK_PRESETS;

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
    onUpdateConfig({
      ...config,
      quickPresets: [
        ...quickPresets,
        {
          id: newId,
          label: `Preset ${quickPresets.length + 1}`,
          animationEnabled: true,
          presetId: "smooth-fade-slide",
          durationSeconds: 1.0,
          shortcut: ""
        }
      ]
    });
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

  return (
    <div className="settings-page">
      <div className="settings-topbar">
        <div>
          <h2 className="settings-title">⚙️ Pengaturan Shortcut &amp; Tombol Cepat</h2>
          <p className="settings-subtitle">
            Klik kotak shortcut lalu tekan tombol keyboard (atau klik ✕ untuk mengosongkan).
          </p>
        </div>
        <div className="settings-topbar-actions">
          <button type="button" className="btn-secondary" onClick={handleResetDefaults}>
            ↺ Reset Bawaan
          </button>
          <button type="button" className="btn-primary" onClick={onBack}>
            ← Kembali ke Live
          </button>
        </div>
      </div>

      {notice && <div className="settings-notice">{notice}</div>}

      <div className="settings-grid">
        {/* Card 1: Main Shortcut Keys */}
        <section className="card settings-card">
          <h3 className="card-title">⌨️ Shortcut Utama</h3>
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

        {/* Card 2: Quick Preset Slots (Idea #2) */}
        <section className="card settings-card">
          <div className="settings-card-head">
            <h3 className="card-title" style={{ margin: 0 }}>
              ⚡ Tombol Cepat Suasana Lagu
            </h3>
            <button
              type="button"
              className="btn-sm"
              disabled={quickPresets.length >= 6}
              onClick={handleAddQuickPreset}
              title={quickPresets.length >= 6 ? "Maksimal 6 tombol cepat" : "Tambah tombol cepat"}
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
                        🗑️
                      </button>
                    )}
                  </div>

                  {qp.animationEnabled && (
                    <div className="qp-row-bottom">
                      <FavoriteSelect
                        className="qp-preset-select"
                        value={qp.presetId}
                        onChange={(nextId) =>
                          handleUpdateQuickPreset(qp.id, { presetId: nextId })
                        }
                        categories={ANIMATION_CATEGORIES}
                        itemsById={ANIMATION_PRESETS}
                        favoriteIds={Array.isArray(config.favoritePresets) ? config.favoritePresets : []}
                        onToggleFavorite={(id) =>
                          onUpdateConfig((prev) => {
                            const list = Array.isArray(prev.favoritePresets)
                              ? prev.favoritePresets
                              : [];
                            const exists = list.includes(id);
                            return {
                              ...prev,
                              favoritePresets: exists
                                ? list.filter((item) => item !== id)
                                : [...list, id]
                            };
                          })
                        }
                        ariaLabel={`Preset animasi untuk ${qp.label}`}
                      />

                      <div className="qp-duration-wrap">
                        <input
                          type="range"
                          min="0.5"
                          max="5.0"
                          step="0.1"
                          value={qp.durationSeconds}
                          onChange={(e) =>
                            handleUpdateQuickPreset(qp.id, {
                              durationSeconds: parseFloat(e.target.value)
                            })
                          }
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
      </div>
    </div>
  );
}
