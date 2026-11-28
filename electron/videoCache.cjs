const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn, spawnSync } = require("child_process");
const { pathToFileURL } = require("url");

const CACHE_DIR = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
  "ProPresenterLyricAnimator",
  "video_cache"
);

try {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
} catch (_) {}

const inProgressTranscodes = new Map();
const prewarmQueue = [];
const queuedHashes = new Set();
let isRunningPrewarm = false;
let activeLiveStreamsCount = 0;

let resolvedFfmpegBin = undefined;
let liveStreamServer = null;
let liveStreamPort = 0;
const activeLiveBroadcasters = new Map();

const ALL_VIDEO_EXTS = new Set([".mp4", ".m4v", ".webm", ".mov", ".mkv", ".avi", ".wmv"]);

function isVideoExtension(ext) {
  return ALL_VIDEO_EXTS.has(String(ext || "").toLowerCase());
}

/**
 * Resolves a working ffmpeg executable path across any device:
 * 1. Bundled ffmpeg-static (handling Electron app.asar -> app.asar.unpacked automatically)
 * 2. System ffmpeg in PATH as fallback
 */
function getFfmpegPath() {
  if (resolvedFfmpegBin !== undefined) return resolvedFfmpegBin;

  try {
    const bundled = require("ffmpeg-static");
    if (bundled && typeof bundled === "string") {
      const unpacked = bundled.replace(/([\\/])app\.asar([\\/])/i, "$1app.asar.unpacked$2");
      if (fs.existsSync(unpacked)) {
        resolvedFfmpegBin = unpacked;
        return resolvedFfmpegBin;
      }
      if (fs.existsSync(bundled)) {
        resolvedFfmpegBin = bundled;
        return resolvedFfmpegBin;
      }
    }
  } catch (_) {}

  try {
    const res = spawnSync("ffmpeg", ["-version"], {
      windowsHide: true,
      timeout: 1500,
      stdio: "ignore"
    });
    if (!res.error && res.status === 0) {
      resolvedFfmpegBin = "ffmpeg";
      return resolvedFfmpegBin;
    }
  } catch (_) {}

  resolvedFfmpegBin = null;
  return null;
}

function isFfmpegAvailable() {
  return Boolean(getFfmpegPath());
}

function computeVideoHash(filePath, stat) {
  return crypto
    .createHash("md5")
    .update(`${filePath}:${stat.size}:${stat.mtimeMs}`)
    .digest("hex");
}

function isCachedWebmValid(cachedPath) {
  if (!fs.existsSync(cachedPath)) return false;
  try {
    return fs.statSync(cachedPath).size > 1024;
  } catch (_) {
    return false;
  }
}

function readHeadAndTailLatin1(filePath) {
  const fd = fs.openSync(filePath, "r");
  try {
    const fileSize = fs.fstatSync(fd).size;
    const headSize = Math.min(65536, fileSize);
    const headBuf = Buffer.alloc(headSize);
    fs.readSync(fd, headBuf, 0, headSize, 0);
    let str = headBuf.toString("latin1");
    if (fileSize > headSize) {
      const tailSize = Math.min(65536, fileSize - headSize);
      const tailBuf = Buffer.alloc(tailSize);
      fs.readSync(fd, tailBuf, 0, tailSize, fileSize - tailSize);
      str += tailBuf.toString("latin1");
    }
    return str;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Fast inspection of header + tail atoms to check if file uses exotic/unsupported codecs
 * (ProRes, QuickTime Animation/qtrle, HEVC/H.265, WMV, AVI) that Chromium cannot decode natively.
 */
function needsAlphaTranscode(filePath) {
  const ext = path.extname(filePath || "").toLowerCase();
  if (ext === ".webm") return false;
  if (ext === ".wmv") return true;

  if (ext === ".mp4" || ext === ".m4v") {
    try {
      const str = readHeadAndTailLatin1(filePath);
      if ((str.includes("hvc1") || str.includes("hev1")) && !str.includes("avc1")) {
        return true;
      }
    } catch (_) {}
    return false;
  }

  if (ext === ".mov" || ext === ".avi" || ext === ".mkv") {
    try {
      const str = readHeadAndTailLatin1(filePath);
      if (
        str.includes("rle ") ||
        str.includes("Animation") ||
        str.includes("qtrle") ||
        str.includes("ap4h") || // ProRes 4444
        str.includes("ap4x") || // ProRes 4444 XQ
        str.includes("apch") || // ProRes 422 HQ
        str.includes("apcn") || // ProRes 422
        str.includes("hvc1") || // HEVC in MOV
        str.includes("hev1")
      ) {
        return true;
      }
      if (str.includes("avc1") || str.includes("h264") || str.includes("mp4v")) {
        return false;
      }
    } catch (_) {}
    return true;
  }

  return false;
}

function buildVp9AlphaArgs(filePath, outputTarget, isPipe = false) {
  const threads = String(Math.max(2, Math.min(6, os.cpus()?.length || 4)));
  const args = [
    "-y",
    "-i",
    filePath,
    "-vf",
    "scale=trunc(iw/2)*2:trunc(ih/2)*2",
    "-c:v",
    "libvpx-vp9",
    "-pix_fmt",
    "yuva420p",
    "-b:v",
    "0",
    "-crf",
    "24",
    "-deadline",
    "realtime",
    "-cpu-used",
    "8",
    "-row-mt",
    "1",
    "-tile-columns",
    "2",
    "-threads",
    threads,
    "-auto-alt-ref",
    "0",
    "-an"
  ];
  if (isPipe) {
    args.push("-f", "webm", "pipe:1");
  } else {
    args.push(outputTarget);
  }
  return args;
}

/**
 * Local loopback (127.0.0.1) live WebM alpha streamer:
 * Streams uncached .mov alpha videos in ~0.3s on first click (even 700MB+ ProRes 4444 files)
 * while simultaneously saving the completed .webm into CACHE_DIR for 0ms future playback.
 * Multicasts a single ffmpeg process if Main Preview + Projector request the same video simultaneously.
 */
function ensureLiveStreamServer() {
  if (liveStreamServer) return liveStreamPort;
  try {
    const server = http.createServer((req, res) => {
      try {
        const u = new URL(req.url, "http://127.0.0.1");
        if (u.pathname !== "/live-alpha") {
          res.writeHead(404);
          res.end();
          return;
        }
        const filePath = u.searchParams.get("file") || "";
        if (!filePath || !fs.existsSync(filePath)) {
          res.writeHead(404);
          res.end();
          return;
        }

        const stat = fs.statSync(filePath);
        const hash = computeVideoHash(filePath, stat);
        const cachedPath = path.join(CACHE_DIR, `${hash}.webm`);

        // If already cached by the time the request arrives, serve file directly
        if (isCachedWebmValid(cachedPath)) {
          const fileStat = fs.statSync(cachedPath);
          res.writeHead(200, {
            "Content-Type": "video/webm",
            "Content-Length": fileStat.size,
            "Cache-Control": "no-cache"
          });
          fs.createReadStream(cachedPath).pipe(res);
          return;
        }

        const ffmpegBin = getFfmpegPath();
        if (!ffmpegBin) {
          res.writeHead(500);
          res.end();
          return;
        }

        res.writeHead(200, {
          "Content-Type": "video/webm",
          "Cache-Control": "no-store",
          Connection: "keep-alive"
        });

        let broadcaster = activeLiveBroadcasters.get(hash);
        if (!broadcaster) {
          activeLiveStreamsCount++;
          const tempStreamPath = path.join(CACHE_DIR, `${hash}_live_${ process.pid }.webm`);
          const fileOut = fs.createWriteStream(tempStreamPath);
          const child = spawn(ffmpegBin, buildVp9AlphaArgs(filePath, "pipe:1", true), {
            windowsHide: true,
            stdio: ["ignore", "pipe", "ignore"]
          });

          broadcaster = {
            hash,
            child,
            headerChunks: [],
            headerBytes: 0,
            clients: new Set(),
            killTimer: null
          };
          activeLiveBroadcasters.set(hash, broadcaster);

          child.stdout.on("data", (chunk) => {
            try {
              fileOut.write(chunk);
            } catch (_) {}
            // Buffer initial 256KB header/cluster so a 2nd window (Projector) joining milliseconds later can attach cleanly
            if (broadcaster.headerBytes < 262144) {
              broadcaster.headerChunks.push(chunk);
              broadcaster.headerBytes += chunk.length;
            }
            for (const clientRes of broadcaster.clients) {
              try {
                clientRes.write(chunk);
              } catch (_) {}
            }
          });

          const cleanupBroadcaster = (code) => {
            activeLiveBroadcasters.delete(hash);
            activeLiveStreamsCount = Math.max(0, activeLiveStreamsCount - 1);
            if (broadcaster.killTimer) {
              clearTimeout(broadcaster.killTimer);
              broadcaster.killTimer = null;
            }
            fileOut.end(() => {
              if (code === 0 && fs.existsSync(tempStreamPath)) {
                try {
                  if (fs.statSync(tempStreamPath).size > 1024) {
                    fs.renameSync(tempStreamPath, cachedPath);
                  } else {
                    fs.unlinkSync(tempStreamPath);
                  }
                } catch (_) {
                  try {
                    if (fs.existsSync(tempStreamPath)) fs.unlinkSync(tempStreamPath);
                  } catch (__) {}
                }
              } else {
                try {
                  if (fs.existsSync(tempStreamPath)) fs.unlinkSync(tempStreamPath);
                } catch (_) {}
              }
              drainPrewarmQueue();
            });
            for (const clientRes of broadcaster.clients) {
              try {
                clientRes.end();
              } catch (_) {}
            }
            broadcaster.clients.clear();
          };

          child.on("close", cleanupBroadcaster);
          child.on("error", () => cleanupBroadcaster(1));
        } else {
          if (broadcaster.killTimer) {
            clearTimeout(broadcaster.killTimer);
            broadcaster.killTimer = null;
          }
          for (const hc of broadcaster.headerChunks) {
            try {
              res.write(hc);
            } catch (_) {}
          }
        }

        broadcaster.clients.add(res);

        req.on("close", () => {
          broadcaster.clients.delete(res);
          // If all video elements closed before EOF, allow a brief 1.5s grace window; if still 0 clients, stop live ffmpeg
          if (broadcaster.clients.size === 0 && !broadcaster.killTimer) {
            broadcaster.killTimer = setTimeout(() => {
              if (broadcaster.clients.size === 0) {
                try {
                  broadcaster.child.kill();
                } catch (_) {}
              }
            }, 1500);
          }
        });
      } catch (_) {
        try {
          res.writeHead(500);
          res.end();
        } catch (__) {}
      }
    });

    server.on("error", () => {});
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        liveStreamPort = addr.port;
      }
    });
    server.unref?.();
    liveStreamServer = server;
  } catch (_) {}
  return liveStreamPort;
}

// Initialize loopback streamer eagerly in Electron main process so port is ready in 0ms
ensureLiveStreamServer();

/**
 * Get cached WebM or transcode to WebM with alpha
 */
async function resolvePlayableVideo(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;

  const needsTranscode = needsAlphaTranscode(filePath);
  if (!needsTranscode) {
    return {
      filePath,
      fileUrl: pathToFileURL(filePath).href,
      isTranscoded: false
    };
  }

  const stat = fs.statSync(filePath);
  const hash = computeVideoHash(filePath, stat);
  const cachedPath = path.join(CACHE_DIR, `${hash}.webm`);

  if (isCachedWebmValid(cachedPath)) {
    return {
      filePath: cachedPath,
      fileUrl: pathToFileURL(cachedPath).href,
      isTranscoded: true
    };
  }

  if (activeLiveBroadcasters.has(hash)) {
    return {
      filePath,
      fileUrl: pathToFileURL(filePath).href,
      isTranscoded: false
    };
  }

  if (inProgressTranscodes.has(hash)) {
    try {
      const resultPath = await inProgressTranscodes.get(hash);
      return {
        filePath: resultPath,
        fileUrl: pathToFileURL(resultPath).href,
        isTranscoded: true
      };
    } catch (_) {
      return {
        filePath,
        fileUrl: pathToFileURL(filePath).href,
        isTranscoded: false
      };
    }
  }

  const ffmpegBin = getFfmpegPath();
  if (!ffmpegBin) {
    return {
      filePath,
      fileUrl: pathToFileURL(filePath).href,
      isTranscoded: false
    };
  }

  const transcodePromise = new Promise((resolve, reject) => {
    const tempPath = path.join(CACHE_DIR, `${hash}_tmp.webm`);
    const child = spawn(ffmpegBin, buildVp9AlphaArgs(filePath, tempPath, false), {
      windowsHide: true,
      stdio: ["ignore", "ignore", "ignore"]
    });

    child.on("error", (err) => reject(err));

    child.on("close", (code) => {
      if (code === 0 && fs.existsSync(tempPath)) {
        try {
          fs.renameSync(tempPath, cachedPath);
          resolve(cachedPath);
        } catch (_) {
          if (fs.existsSync(cachedPath)) resolve(cachedPath);
          else resolve(tempPath);
        }
      } else {
        try {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch (_) {}
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });

  inProgressTranscodes.set(hash, transcodePromise);

  try {
    const resultPath = await transcodePromise;
    return {
      filePath: resultPath,
      fileUrl: pathToFileURL(resultPath).href,
      isTranscoded: true
    };
  } catch (err) {
    console.warn("[VideoCache] Transcode failed, falling back to original:", err.message);
    return {
      filePath,
      fileUrl: pathToFileURL(filePath).href,
      isTranscoded: false
    };
  } finally {
    inProgressTranscodes.delete(hash);
  }
}

function drainPrewarmQueue() {
  if (isRunningPrewarm || activeLiveStreamsCount > 0 || prewarmQueue.length === 0) {
    return;
  }
  const next = prewarmQueue.shift();
  if (!next) return;
  queuedHashes.delete(next.hash);

  if (isCachedWebmValid(next.cachedPath) || activeLiveBroadcasters.has(next.hash)) {
    drainPrewarmQueue();
    return;
  }

  isRunningPrewarm = true;
  resolvePlayableVideo(next.filePath)
    .catch(() => {})
    .finally(() => {
      isRunningPrewarm = false;
      setTimeout(drainPrewarmQueue, 80);
    });
}

/**
 * Serialized 1-at-a-time background pre-warmer: never chokes CPU with 10 simultaneous ffmpeg spawns,
 * and yields whenever a live slide video stream is actively playing.
 */
function prewarmVideoAsync(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  if (!needsAlphaTranscode(filePath)) return;
  if (!isFfmpegAvailable()) return;

  try {
    const stat = fs.statSync(filePath);
    const hash = computeVideoHash(filePath, stat);
    const cachedPath = path.join(CACHE_DIR, `${hash}.webm`);
    if (isCachedWebmValid(cachedPath) || queuedHashes.has(hash) || inProgressTranscodes.has(hash)) {
      return;
    }
    queuedHashes.add(hash);
    prewarmQueue.push({ filePath, hash, cachedPath });
    drainPrewarmQueue();
  } catch (_) {}
}

/**
 * Synchronous resolver:
 * 1. Native video (.mp4 H.264 / .webm) -> direct fileUrl (0ms)
 * 2. Cached .webm -> direct cached fileUrl (0ms)
 * 3. Uncached .mov alpha -> instant live loopback WebM stream (~0.3s to first frame!) + queued cache
 */
function resolvePlayableVideoSync(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;

  const needsTranscode = needsAlphaTranscode(filePath);
  if (!needsTranscode) {
    return {
      filePath,
      fileUrl: pathToFileURL(filePath).href,
      isTranscoded: false
    };
  }

  const stat = fs.statSync(filePath);
  const hash = computeVideoHash(filePath, stat);
  const cachedPath = path.join(CACHE_DIR, `${hash}.webm`);

  if (isCachedWebmValid(cachedPath)) {
    return {
      filePath: cachedPath,
      fileUrl: pathToFileURL(cachedPath).href,
      isTranscoded: true
    };
  }

  if (!isFfmpegAvailable()) {
    return {
      filePath,
      fileUrl: pathToFileURL(filePath).href,
      isTranscoded: false
    };
  }

  const port = ensureLiveStreamServer();
  if (port > 0) {
    const streamUrl = `http://127.0.0.1:${port}/live-alpha?file=${encodeURIComponent(filePath)}&h=${hash}`;
    return {
      filePath,
      fileUrl: streamUrl,
      isTranscoded: false,
      isPendingTranscode: true
    };
  }

  prewarmVideoAsync(filePath);

  return {
    filePath,
    fileUrl: pathToFileURL(filePath).href,
    isTranscoded: false,
    isPendingTranscode: true
  };
}

module.exports = {
  CACHE_DIR,
  isVideoExtension,
  needsAlphaTranscode,
  resolvePlayableVideo,
  resolvePlayableVideoSync,
  prewarmVideoAsync
};
