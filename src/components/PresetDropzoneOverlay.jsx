import { useState, useEffect, useRef } from "react";
import { importPresetsFromJsonString } from "../lib/customPresetManager";

export function PresetDropzoneOverlay({ onPresetImported }) {
  const [isDragging, setIsDragging] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const dragCounterRef = useRef(0);
  const toastTimeoutRef = useRef(null);

  const showToast = (text, isError = false) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage({ text, isError });
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  useEffect(() => {
    const handleDragEnter = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current += 1;
      if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes("Files")) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDragging(false);
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isDragging) {
        setIsDragging(true);
      }
    };

    const handleDrop = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      let totalSuccess = 0;
      let lastResult = null;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.endsWith(".json") || file.type === "application/json") {
          try {
            const text = await file.text();
            const res = importPresetsFromJsonString(text);
            if (res.success) {
              totalSuccess += res.count;
              lastResult = res;
            } else {
              showToast(`Gagal mengimpor "${file.name}": ${res.error}`, true);
              return;
            }
          } catch (err) {
            showToast(`Gagal membaca file "${file.name}": ${err.message}`, true);
            return;
          }
        } else {
          showToast(`File "${file.name}" dilewati. Harap gunakan file berformat .json`, true);
        }
      }

      if (totalSuccess > 0 && lastResult) {
        showToast(`🎉 Sukses! Menambahkan ${totalSuccess} preset ke daftar pilihan.`, false);
        if (onPresetImported && lastResult.firstId) {
          onPresetImported({ id: lastResult.firstId, type: lastResult.firstType });
        }
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [onPresetImported]);

  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`preset-drop-toast ${toastMessage.isError ? "error" : "success"}`}
          role="alert"
        >
          <span className="toast-icon">{toastMessage.isError ? "⚠️" : "✨"}</span>
          <span className="toast-text">{toastMessage.text}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => setToastMessage(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="preset-dropzone-overlay">
          <div className="preset-dropzone-box">
            <div className="dropzone-icon">📥</div>
            <h2 className="dropzone-title">Lepaskan File Preset (.json) di Sini</h2>
            <p className="dropzone-subtitle">
              File preset animasi transisi atau efek teks akan otomatis ditambahkan ke daftar pilihan <b>Kustom</b>
            </p>
            <div className="dropzone-tags">
              <span>✓ Preset Animasi (In/Out)</span>
              <span>✓ Preset Wiggle & Efek Teks</span>
              <span>✓ Batch Pack (.json)</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
