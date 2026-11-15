const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { WebSocketServer, WebSocket } = require("ws");
const QRCode = require("qrcode");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json"
};

function getLanIpv4Addresses() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, ifaceList] of Object.entries(interfaces)) {
    if (!Array.isArray(ifaceList)) continue;
    const lowerName = name.toLowerCase();

    // Skip virtual or tunnel adapters
    const isVirtual =
      lowerName.includes("vethernet") ||
      lowerName.includes("virtualbox") ||
      lowerName.includes("vmware") ||
      lowerName.includes("wsl") ||
      lowerName.includes("tailscale") ||
      lowerName.includes("zerotier") ||
      lowerName.includes("docker") ||
      lowerName.includes("loopback");

    for (const iface of ifaceList) {
      if (iface.family === "IPv4" && !iface.internal && iface.address) {
        let score = 10;
        if (lowerName.includes("wi-fi") || lowerName.includes("wifi") || lowerName.includes("wlan")) {
          score += 30;
        } else if (lowerName.includes("ethernet") || lowerName.includes("lan")) {
          score += 20;
        }
        if (iface.address.startsWith("192.168.")) score += 15;
        else if (iface.address.startsWith("10.")) score += 10;
        else if (iface.address.startsWith("172.")) score += 5;

        if (isVirtual) score -= 50;

        candidates.push({
          name,
          address: iface.address,
          score
        });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    return [{ name: "Localhost", address: "127.0.0.1", score: 0 }];
  }

  return candidates.map((c) => ({ name: c.name, address: c.address }));
}

class RemoteControlServer {
  constructor() {
    this.httpServer = null;
    this.wss = null;
    this.port = 4989;
    this.clients = new Set();
    this.currentRemoteState = {
      config: null,
      countdownRuntime: null,
      slideSummary: {
        text: "",
        group: "",
        position: null,
        themeName: ""
      }
    };
    this.onConfigUpdateCallback = null;
    this.onActionCallback = null;
    this.onClientCountChangeCallback = null;
    this.qrCache = new Map();
  }

  init({ onConfigUpdate, onAction, onClientCountChange }) {
    this.onConfigUpdateCallback = onConfigUpdate;
    this.onActionCallback = onAction;
    this.onClientCountChangeCallback = onClientCountChange;

    return this.startServerWithFallback(this.port);
  }

  startServerWithFallback(startPort, maxAttempts = 5) {
    return new Promise((resolve, reject) => {
      let currentAttempt = 0;

      const tryBind = (port) => {
        const server = http.createServer((req, res) => this.handleHttpRequest(req, res));

        server.once("error", (err) => {
          if (err.code === "EADDRINUSE" && currentAttempt < maxAttempts) {
            currentAttempt++;
            tryBind(port + 1);
          } else {
            reject(err);
          }
        });

        server.once("listening", () => {
          this.httpServer = server;
          this.port = port;
          this.initWebSocketServer();
          resolve({ port: this.port });
        });

        server.listen(port, "0.0.0.0");
      };

      tryBind(startPort);
    });
  }

  initWebSocketServer() {
    if (!this.httpServer) return;

    this.wss = new WebSocketServer({ server: this.httpServer });

    this.wss.on("connection", (ws, req) => {
      this.clients.add(ws);
      this.notifyClientCount();

      // Send initial state to newly connected smartphone
      if (this.currentRemoteState) {
        try {
          ws.send(
            JSON.stringify({
              type: "INIT_STATE",
              payload: this.currentRemoteState
            })
          );
        } catch (_) {}
      }

      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString("utf-8"));
          if (!msg || typeof msg !== "object") return;

          if (msg.type === "UPDATE_CONFIG" && msg.payload) {
            // Update local memory with deep merge for countdownOverlay if present
            if (this.currentRemoteState.config) {
              const prevOverlay = this.currentRemoteState.config.countdownOverlay || {};
              const nextOverlay = msg.payload.countdownOverlay
                ? { ...prevOverlay, ...msg.payload.countdownOverlay }
                : prevOverlay;

              this.currentRemoteState.config = {
                ...this.currentRemoteState.config,
                ...msg.payload,
                countdownOverlay: nextOverlay
              };
            }
            // Broadcast changes to other connected clients except sender
            this.broadcastToClients(
              {
                type: "SYNC_CONFIG",
                payload: msg.payload
              },
              ws
            );
            // Notify electron desktop renderer
            if (typeof this.onConfigUpdateCallback === "function") {
              this.onConfigUpdateCallback(msg.payload);
            }
          } else if (msg.type === "TRIGGER_ACTION" && msg.action) {
            if (typeof this.onActionCallback === "function") {
              this.onActionCallback(msg.action, msg.payload);
            }
          }
        } catch (e) {
          console.warn("[RemoteServer] Failed to handle client message:", e);
        }
      });

      const handleClose = () => {
        this.clients.delete(ws);
        this.notifyClientCount();
      };

      ws.on("close", handleClose);
      ws.on("error", handleClose);
    });
  }

  notifyClientCount() {
    const count = this.clients.size;
    if (typeof this.onClientCountChangeCallback === "function") {
      this.onClientCountChangeCallback(count);
    }
  }

  broadcastToClients(data, senderWs = null) {
    const jsonStr = JSON.stringify(data);
    for (const client of this.clients) {
      if (client !== senderWs && client.readyState === WebSocket.OPEN) {
        try {
          client.send(jsonStr);
        } catch (_) {}
      }
    }
  }

  updateDesktopState(partialState) {
    if (!partialState) return;

    if (partialState.config) {
      const prevOverlay = this.currentRemoteState.config?.countdownOverlay || {};
      const nextOverlay = partialState.config.countdownOverlay
        ? { ...prevOverlay, ...partialState.config.countdownOverlay }
        : prevOverlay;

      this.currentRemoteState.config = {
        ...(this.currentRemoteState.config || {}),
        ...partialState.config,
        ...(partialState.config.countdownOverlay ? { countdownOverlay: nextOverlay } : {})
      };
    }

    if (partialState.countdownRuntime !== undefined) {
      this.currentRemoteState.countdownRuntime = partialState.countdownRuntime;
    }

    if (partialState.slideSummary) {
      this.currentRemoteState.slideSummary = {
        ...(this.currentRemoteState.slideSummary || {}),
        ...partialState.slideSummary
      };
    }

    this.broadcastToClients({
      type: "SYNC_STATE",
      payload: this.currentRemoteState
    });
  }

  async getRemoteInfo() {
    const addresses = getLanIpv4Addresses();
    const primaryIp = addresses[0]?.address || "127.0.0.1";
    const remoteUrl = `http://${primaryIp}:${this.port}/#/remote`;

    let qrDataUrl = this.qrCache.get(remoteUrl);
    if (!qrDataUrl) {
      try {
        qrDataUrl = await QRCode.toDataURL(remoteUrl, {
          margin: 2,
          scale: 7,
          color: {
            dark: "#000000",
            light: "#ffffff"
          }
        });
        this.qrCache.set(remoteUrl, qrDataUrl);
      } catch (err) {
        console.warn("[RemoteServer] Failed to generate QR code:", err);
        qrDataUrl = "";
      }
    }

    return {
      port: this.port,
      addresses,
      primaryIp,
      remoteUrl,
      qrDataUrl,
      connectedClients: this.clients.size
    };
  }

  async getQrForUrl(targetUrl) {
    if (this.qrCache.has(targetUrl)) {
      return this.qrCache.get(targetUrl);
    }
    try {
      const qrDataUrl = await QRCode.toDataURL(targetUrl, {
        margin: 2,
        scale: 7,
        color: {
          dark: "#000000",
          light: "#ffffff"
        }
      });
      this.qrCache.set(targetUrl, qrDataUrl);
      return qrDataUrl;
    } catch (_) {
      return "";
    }
  }

  handleHttpRequest(req, res) {
    // Add CORS headers for web development and cross-origin mobile access
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { "Content-Type": "text/plain" });
      res.end("Method Not Allowed");
      return;
    }

    const distPath = path.join(__dirname, "../dist");
    let reqUrlPath = req.url.split("?")[0];
    if (reqUrlPath === "/" || reqUrlPath === "/remote") {
      reqUrlPath = "/index.html";
    }

    const safeSuffix = path.normalize(reqUrlPath).replace(/^(\.\.[\/\\])+/, "");
    let filePath = path.join(distPath, safeSuffix);

    // If file doesn't exist, SPA fallback to index.html
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distPath, "index.html");
    }

    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("App distribution files not found. Please build the Vite app first.");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": ext === ".html" ? "no-cache" : "max-age=31536000, immutable"
    });

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on("error", () => {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain" });
      }
      res.end("Internal Server Error");
    });
    stream.pipe(res);
  }

  close() {
    if (this.wss) {
      try {
        this.wss.close();
      } catch (_) {}
      this.wss = null;
    }
    if (this.httpServer) {
      try {
        this.httpServer.close();
      } catch (_) {}
      this.httpServer = null;
    }
    this.clients.clear();
  }
}

const remoteControlServer = new RemoteControlServer();

module.exports = {
  remoteControlServer,
  getLanIpv4Addresses
};
