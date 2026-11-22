import { useState, useEffect, useRef } from "react";

/**
 * Lightweight modal for OBS-style Profile actions: New, Duplicate, Rename, Delete.
 */
export function ProfileActionModal({
  modalState,
  activeProfileName,
  onClose,
  onConfirm
}) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!modalState?.isOpen) return;
    setInputValue(modalState.initialValue || "");
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 30);
    return () => clearTimeout(timer);
  }, [modalState]);

  if (!modalState?.isOpen) return null;

  const { mode } = modalState;
  const isDelete = mode === "delete";

  const titles = {
    save: "Simpan Profil",
    rename: "Ganti Nama Profil",
    delete: "Hapus Profil"
  };

  const descriptions = {
    save: "Simpan seluruh pengaturan saat ini sebagai profil baru.",
    rename: `Masukkan nama baru untuk profil "${activeProfileName}".`,
    delete: `Apakah Anda yakin ingin menghapus profil "${activeProfileName}"? Tindakan ini tidak dapat dibatalkan.`
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isDelete) {
      onConfirm();
      return;
    }
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999
      }}
    >
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#161920",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "12px",
          padding: "20px",
          width: "100%",
          maxWidth: "400px",
          boxShadow: "0 18px 40px rgba(0, 0, 0, 0.55)",
          color: "#f3f4f6"
        }}
      >
        <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: 600 }}>
          {titles[mode] || "Profil Acara"}
        </h3>
        <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#9ca3af", lineHeight: 1.45 }}>
          {descriptions[mode]}
        </p>

        <form onSubmit={handleSubmit}>
          {!isDelete && (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Contoh: Ibadah Youth / Natal"
              maxLength={48}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.18)",
                background: "#0d0f12",
                color: "#ffffff",
                fontSize: "14px",
                marginBottom: "16px",
                outline: "none"
              }}
            />
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "7px 14px",
                borderRadius: "7px",
                border: "1px solid rgba(255, 255, 255, 0.14)",
                background: "transparent",
                color: "#d1d5db",
                fontSize: "13px",
                cursor: "pointer"
              }}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!isDelete && !inputValue.trim()}
              style={{
                padding: "7px 16px",
                borderRadius: "7px",
                border: "none",
                background: isDelete ? "#dc2626" : "#2563eb",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: 600,
                cursor: !isDelete && !inputValue.trim() ? "not-allowed" : "pointer",
                opacity: !isDelete && !inputValue.trim() ? 0.5 : 1
              }}
            >
              {isDelete ? "Hapus" : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
