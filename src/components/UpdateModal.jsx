import { formatBytes, formatReleaseNotesText, normalizeVersion } from "../lib/updateManager";

/**
 * Startup Auto-Update Modal (GitHub Releases via electron-updater)
 * Options: Update (Download -> Restart & Pasang), Skip This Version, Close.
 */
export function UpdateModal({
  isOpen,
  updateState,
  onUpdate,
  onQuitAndInstall,
  onSkipVersion,
  onClose
}) {
  if (!isOpen || !updateState) return null;

  const { status, currentVersion, version, releaseNotes, progress, error } = updateState;
  const isDownloading = status === "downloading";
  const isDownloaded = status === "downloaded";
  const isError = status === "error";
  const percent = Math.max(0, Math.min(100, Math.round(Number(progress?.percent) || 0)));
  const cleanNotes = formatReleaseNotesText(releaseNotes);
  const displayVersion = normalizeVersion(version);
  const displayCurrent = normalizeVersion(currentVersion);

  return (
    <div
      className="update-modal-backdrop"
      onClick={() => {
        if (!isDownloading) onClose?.();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-modal-title"
    >
      <div className="update-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="update-modal-header">
          <div>
            <h3 id="update-modal-title" className="update-modal-title">
              Pembaruan Aplikasi Tersedia
            </h3>
            <div className="update-version-row">
              {displayCurrent && (
                <span className="update-version-pill current">v{displayCurrent}</span>
              )}
              {displayCurrent && displayVersion && (
                <span className="update-version-arrow">→</span>
              )}
              {displayVersion && (
                <span className="update-version-pill latest">v{displayVersion}</span>
              )}
            </div>
          </div>

          <button
            type="button"
            className="update-modal-close-icon"
            onClick={onClose}
            disabled={isDownloading}
            aria-label="Tutup jendela update"
            title="Tutup"
          >
            ✕
          </button>
        </div>

        <div className="update-notes-section">
          <div className="update-notes-label">Catatan Update</div>
          <div className="update-notes-box">
            {cleanNotes ? (
              <pre className="update-notes-pre">{cleanNotes}</pre>
            ) : (
              <p className="update-notes-empty">
                Versi terbaru membawa perbaikan bug dan peningkatan performa aplikasi.
              </p>
            )}
          </div>
        </div>

        {(isDownloading || isDownloaded) && (
          <div className="update-progress-wrap">
            <div className="update-progress-meta">
              <span>
                {isDownloaded
                  ? "Unduhan selesai — siap dipasang!"
                  : `Mengunduh pembaruan... ${percent}%`}
              </span>
              {isDownloading && progress?.total > 0 && (
                <span className="update-progress-bytes">
                  {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
                  {progress.bytesPerSecond > 0
                    ? ` (${formatBytes(progress.bytesPerSecond)}/s)`
                    : ""}
                </span>
              )}
            </div>
            <div className="update-progress-track">
              <div
                className={`update-progress-fill ${isDownloaded ? "done" : ""}`}
                style={{ width: `${isDownloaded ? 100 : percent}%` }}
              />
            </div>
          </div>
        )}

        {isError && error && (
          <div className="update-error-box">
            <strong>Gagal:</strong> {error}
          </div>
        )}

        <div className="update-modal-actions">
          <button
            type="button"
            className="btn-secondary update-btn-skip"
            onClick={() => onSkipVersion?.(displayVersion)}
            disabled={isDownloading}
            title="Jangan tampilkan notifikasi startup untuk versi ini lagi"
          >
            Skip This Version
          </button>

          <div className="update-modal-actions-right">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isDownloading}
            >
              Close
            </button>

            {isDownloaded ? (
              <button
                type="button"
                className="btn-primary update-btn-install"
                onClick={onQuitAndInstall}
              >
                Restart &amp; Pasang
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary update-btn-download"
                onClick={onUpdate}
                disabled={isDownloading}
              >
                {isDownloading ? `Mengunduh... ${percent}%` : "Update"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
