import { useState, useEffect, useCallback } from "react";

export function RemoteQrModal({ isOpen, onClose, connectedClients = 0 }) {
  const [remoteInfo, setRemoteInfo] = useState(null);
  const [selectedIp, setSelectedIp] = useState("");
  const [currentQr, setCurrentQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchInfo = useCallback(async () => {
    if (!window.electronAPI?.getRemoteInfo) return;
    setLoading(true);
    try {
      const info = await window.electronAPI.getRemoteInfo();
      if (info) {
        setRemoteInfo(info);
        const ip = info.primaryIp || "127.0.0.1";
        setSelectedIp(ip);
        setCurrentQr(info.qrDataUrl || "");
      }
    } catch (err) {
      console.warn("Failed to fetch remote info:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchInfo();
    }
  }, [isOpen, fetchInfo]);

  const handleIpChange = async (e) => {
    const newIp = e.target.value;
    setSelectedIp(newIp);
    if (!remoteInfo) return;

    const newUrl = `http://${newIp}:${remoteInfo.port}/#/remote`;
    if (window.electronAPI?.getQrForUrl) {
      const qr = await window.electronAPI.getQrForUrl(newUrl);
      setCurrentQr(qr);
    }
  };

  const currentUrl = remoteInfo && selectedIp
    ? `http://${selectedIp}:${remoteInfo.port}/#/remote`
    : "";

  const handleCopyLink = async () => {
    if (!currentUrl) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(currentUrl);
      } else {
        const input = document.createElement("input");
        input.value = currentUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="qr-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="qr-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="qr-modal-header">
          <div className="qr-modal-title-group">
            <span className="qr-modal-icon">📱</span>
            <div>
              <h3 className="qr-modal-title">Web Remote Control Smartphone</h3>
              <p className="qr-modal-subtitle">
                Scan QR Code lewat kamera HP untuk mengontrol animasi dan efek lirik
              </p>
            </div>
          </div>
          <button type="button" className="btn-modal-close" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>

        <div className="qr-modal-body">
          {/* Connection Status Indicator */}
          <div className="qr-status-row">
            <div
              className={`pro-status-indicator ${connectedClients > 0 ? "connected" : ""}`}
            >
              <span className="status-dot" />
              <span>
                {connectedClients > 0
                  ? `${connectedClients} Smartphone Terhubung`
                  : "Menunggu smartphone scan QR..."}
              </span>
            </div>
          </div>

          {/* QR Display */}
          <div className="qr-code-box">
            {loading ? (
              <div className="qr-loading">Menyiapkan QR Code...</div>
            ) : currentQr ? (
              <img
                src={currentQr}
                alt="Scan QR untuk Web Remote"
                className="qr-image"
              />
            ) : (
              <div className="qr-fallback">Gagal memuat QR Code</div>
            )}
          </div>

          {/* IP Interface Selector if multiple exist */}
          {remoteInfo?.addresses && remoteInfo.addresses.length > 1 && (
            <div className="qr-ip-select-group">
              <label htmlFor="qr-ip-select">Pilih Jaringan IP Laptop:</label>
              <select
                id="qr-ip-select"
                className="qr-ip-select"
                value={selectedIp}
                onChange={handleIpChange}
              >
                {remoteInfo.addresses.map((addr) => (
                  <option key={addr.address} value={addr.address}>
                    {addr.name} — {addr.address}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* URL with Copy Button */}
          <div className="qr-url-group">
            <input
              type="text"
              readOnly
              value={currentUrl}
              className="qr-url-input"
              onClick={(e) => e.target.select()}
            />
            <button
              type="button"
              className={`btn-copy-url ${copied ? "copied" : ""}`}
              onClick={handleCopyLink}
              title="Salin link ke clipboard"
            >
              {copied ? "✓ Disalin" : "📋 Salin Link"}
            </button>
          </div>

          <div className="qr-note-box">
            <p>
              💡 <strong>Tips:</strong> Pastikan smartphone dan laptop ini terhubung ke jaringan{" "}
              <strong>Wi-Fi / Hotspot yang sama</strong>. Tidak perlu install aplikasi tambahan di HP.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
