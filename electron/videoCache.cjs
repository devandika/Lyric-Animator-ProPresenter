const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { exec, spawn } = require("child_process");
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
const knownCodecs = new Map();

const NATIVE_VIDEO_EXTS = new Set([".mp4", ".m4v", ".webm"]);
const ALL_VIDEO_EXTS = new Set([".mp4", ".m4v", ".webm", ".mov", ".mkv", ".avi", ".wmv"]);

function isVideoExtension(ext) {
  return ALL_VIDEO_EXTS.has(String(ext || "").toLowerCase());
}

/**
 * Fast inspection of header or ffprobe to check if file needs transcoding
 */
function needsAlphaTranscode(filePath) {
  const ext = path.extname(filePath || "").toLowerCase();
  if (ext === ".webm") return false;
  if (ext === ".mp4" || ext === ".m4v") return false;

  if (ext === ".mov" || ext === ".avi" || ext === ".mkv") {
    // Quick scan first 64KB for known exotic codecs
    try {
      const fd = fs.openSync(filePath, "r");
      const buf = Buffer.alloc(Math.min(65536, fs.fstatSync(fd).size));
      fs.readSync(fd, buf, 0, buf.length, 0);
      fs.closeSync(fd);

      const str = buf.toString("latin1");
      if (
        str.includes("rle ") ||
        str.includes("Animation") ||
        str.includes("qtrle") ||
        str.includes("ap4h") || // ProRes 4444
        str.includes("ap4x") || // ProRes 4444 XQ
        str.includes("apch") || // ProRes 422 HQ
        str.includes("apcn")    // ProRes 422
      ) {
        return true;
      }
      if (str.includes("avc1") || str.includes("h264")) {
        return false;
      }
    } catch (_) {}
    return true; // default to transcode for non-standard .mov
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

  // Start transcode with realtime deadline and multithreading
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
      "-deadline",
      "realtime",
      "-cpu-used",
      "8",
      "-b:v",
      "2M",
      "-an",
      tempPath
    ];

    const child = spawn("ffmpeg", args, {
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
