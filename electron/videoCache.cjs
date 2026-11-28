const fs = require("fs");
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
let resolvedFfmpegBin = undefined;

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
    let bundled = require("ffmpeg-static");
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
 * (ProRes, QuickTime Animation/qtrle, HEVC/H.265, WMV, AVI) that Chromium may fail to decode.
 */
function needsAlphaTranscode(filePath) {
  const ext = path.extname(filePath || "").toLowerCase();
  if (ext === ".webm") return false;
  if (ext === ".wmv") return true;

  if (ext === ".mp4" || ext === ".m4v") {
    try {
      const str = readHeadAndTailLatin1(filePath);
      // HEVC / H.265 in MP4 often fails on Windows PCs without Microsoft HEVC Video Extension
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

/**
 * Get cached WebM or transcode to WebM with alpha
 */
async function resolvePlayableVideo(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;

  const ext = path.extname(filePath).toLowerCase();
  const needsTranscode = needsAlphaTranscode(filePath);

  if (!needsTranscode) {
    return {
      filePath,
      fileUrl: pathToFileURL(filePath).href,
      isTranscoded: false
    };
  }

  const stat = fs.statSync(filePath);
  const hash = crypto
    .createHash("md5")
    .update(`${filePath}:${stat.size}:${stat.mtimeMs}`)
    .digest("hex");
  const cachedPath = path.join(CACHE_DIR, `${hash}.webm`);

  if (fs.existsSync(cachedPath)) {
    try {
      const cStat = fs.statSync(cachedPath);
      if (cStat.size > 1024) {
        return {
          filePath: cachedPath,
          fileUrl: pathToFileURL(cachedPath).href,
          isTranscoded: true
        };
      }
    } catch (_) {}
  }

  // Check if transcode is already running
  if (inProgressTranscodes.has(hash)) {
    try {
      const resultPath = await inProgressTranscodes.get(hash);
      return {
        filePath: resultPath,
        fileUrl: pathToFileURL(resultPath).href,
        isTranscoded: true
      };
    } catch (_) {
      // Fallback
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

  // Start transcode with crisp VP9 + alpha (yuva420p) and row-multithreading
  const transcodePromise = new Promise((resolve, reject) => {
    const tempPath = path.join(CACHE_DIR, `${hash}_tmp.webm`);
    const args = [
      "-y",
      "-i",
      filePath,
      "-c:v",
      "libvpx-vp9",
      "-pix_fmt",
      "yuva420p",
      "-b:v",
      "0",
      "-crf",
      "22",
      "-deadline",
      "realtime",
      "-cpu-used",
      "6",
      "-row-mt",
      "1",
      "-auto-alt-ref",
      "0",
      "-an",
      tempPath
    ];

    const child = spawn(ffmpegBin, args, {
      windowsHide: true,
      stdio: ["ignore", "ignore", "ignore"]
    });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code) => {
      if (code === 0 && fs.existsSync(tempPath)) {
        try {
          fs.renameSync(tempPath, cachedPath);
          resolve(cachedPath);
        } catch (e) {
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

/**
 * Background pre-warmer: triggers transcoding without blocking
 */
function prewarmVideoAsync(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  if (!needsAlphaTranscode(filePath)) return;
  if (!isFfmpegAvailable()) return;

  const stat = fs.statSync(filePath);
  const hash = crypto
    .createHash("md5")
    .update(`${filePath}:${stat.size}:${stat.mtimeMs}`)
    .digest("hex");
  const cachedPath = path.join(CACHE_DIR, `${hash}.webm`);
  if (fs.existsSync(cachedPath)) return; // already cached!

  resolvePlayableVideo(filePath).catch(() => {});
}

/**
 * Synchronous resolver if already cached, otherwise returns original and prewarms in background
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
  const hash = crypto
    .createHash("md5")
    .update(`${filePath}:${stat.size}:${stat.mtimeMs}`)
    .digest("hex");
  const cachedPath = path.join(CACHE_DIR, `${hash}.webm`);

  if (fs.existsSync(cachedPath)) {
    try {
      const cStat = fs.statSync(cachedPath);
      if (cStat.size > 1024) {
        return {
          filePath: cachedPath,
          fileUrl: pathToFileURL(cachedPath).href,
          isTranscoded: true
        };
      }
    } catch (_) {}
  }

  if (!isFfmpegAvailable()) {
    return {
      filePath,
      fileUrl: pathToFileURL(filePath).href,
      isTranscoded: false
    };
  }

  // Not yet cached -> trigger background transcode immediately!
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
