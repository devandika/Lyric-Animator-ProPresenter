const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

/**
 * Zero-dependency Protobuf wire parser for ProPresenter 7 / 20.x:
 * - Auto-discovers ProPresenter workspace paths from PathSettings.proPaths on any Windows account/PC
 * - Extracts exact Theme & Slide layouts (bounds, z-order, fills, blur, gradients, PNGs, paths, fonts, RTF)
 * - Extracts Media Actions inside .pro cues and Media Bin items from Playlists/Media
 */

const {
  isVideoExtension,
  resolvePlayableVideoSync,
  prewarmVideoAsync
} = require("./videoCache.cjs");

function readVarint(buf, pos) {
  let result = 0n;
  let shift = 0n;
  while (pos < buf.length) {
    const b = BigInt(buf[pos++]);
    result |= (b & 0x7fn) << shift;
    if ((b & 0x80n) === 0n) {
      return { value: Number(result), nextPos: pos };
    }
    shift += 7n;
    if (shift > 70n) throw new Error("Varint too long");
  }
  throw new Error("Truncated varint");
}

function parseProtoFields(buf) {
  const fields = [];
  let pos = 0;
  while (pos < buf.length) {
    const { value: tag, nextPos } = readVarint(buf, pos);
    pos = nextPos;
    const fieldNumber = tag >>> 3;
    const wireType = tag & 7;

    if (wireType === 0) {
      const v = readVarint(buf, pos);
      pos = v.nextPos;
      fields.push({ fn: fieldNumber, wt: 0, val: v.value });
    } else if (wireType === 1) {
      if (pos + 8 > buf.length) throw new Error("Truncated fixed64");
      const val = buf.readDoubleLE(pos);
      pos += 8;
      fields.push({ fn: fieldNumber, wt: 1, val });
    } else if (wireType === 2) {
      const ln = readVarint(buf, pos);
      pos = ln.nextPos;
      if (pos + ln.value > buf.length) throw new Error("Truncated length-delimited");
      const sub = buf.subarray(pos, pos + ln.value);
      pos += ln.value;
      fields.push({ fn: fieldNumber, wt: 2, val: sub });
    } else if (wireType === 5) {
      if (pos + 4 > buf.length) throw new Error("Truncated fixed32");
      const val = buf.readFloatLE(pos);
      pos += 4;
      fields.push({ fn: fieldNumber, wt: 5, val });
    } else {
      throw new Error(`Unsupported wire type ${wireType}`);
    }
  }
  return fields;
}

function getField(fields, fn) {
  for (let i = fields.length - 1; i >= 0; i--) {
    if (fields[i].fn === fn) return fields[i];
  }
  return null;
}

function getAllFields(fields, fn) {
  return fields.filter((f) => f.fn === fn);
}

function normalizeUuid(uuid) {
  return String(uuid || "").replace(/^[\s$]+/, "").trim().toLowerCase();
}

function decodeUuid(buf) {
  if (!buf || buf.length === 0) return "";
  try {
    const inner = parseProtoFields(buf);
    const strField = getField(inner, 1);
    if (strField && strField.wt === 2) {
      return normalizeUuid(strField.val.toString("utf8"));
    }
  } catch (_) {}
  return buf.toString("utf8").replace(/^[\x00-\x1f$]+/, "").trim().toLowerCase();
}

function decodeColor(buf) {
  if (!buf) return { r: 0, g: 0, b: 0, a: 0, css: "rgba(0,0,0,0)" };
  const fields = parseProtoFields(buf);
  const r = getField(fields, 1)?.val ?? 0;
  const g = getField(fields, 2)?.val ?? 0;
  const b = getField(fields, 3)?.val ?? 0;
  const a = getField(fields, 4)?.val ?? 0;
  const r255 = Math.max(0, Math.min(255, Math.round(r * 255)));
  const g255 = Math.max(0, Math.min(255, Math.round(g * 255)));
  const b255 = Math.max(0, Math.min(255, Math.round(b * 255)));
  const aClamped = Math.max(0, Math.min(1, Number(a)));
  return {
    r: r255,
    g: g255,
    b: b255,
    a: aClamped,
    css: `rgba(${r255}, ${g255}, ${b255}, ${aClamped})`
  };
}

function decodePoint(buf) {
  if (!buf) return { x: 0, y: 0 };
  const fields = parseProtoFields(buf);
  return {
    x: getField(fields, 1)?.val ?? 0,
    y: getField(fields, 2)?.val ?? 0
  };
}

function decodeSize(buf) {
  if (!buf) return { width: 0, height: 0 };
  const fields = parseProtoFields(buf);
  return {
    width: getField(fields, 1)?.val ?? 0,
    height: getField(fields, 2)?.val ?? 0
  };
}

function decodeRect(buf) {
  if (!buf) return { x: 0, y: 0, width: 1920, height: 1080 };
  const fields = parseProtoFields(buf);
  const origin = decodePoint(getField(fields, 1)?.val);
  const size = decodeSize(getField(fields, 2)?.val);
  return {
    x: origin.x,
    y: origin.y,
    width: size.width,
    height: size.height
  };
}

function decodeShadow(buf) {
  if (!buf) return null;
  const fields = parseProtoFields(buf);
  const enabled = Boolean(getField(fields, 7)?.val);
  const angle = getField(fields, 2)?.val ?? 315;
  const offset = getField(fields, 3)?.val ?? 5;
  const radius = getField(fields, 4)?.val ?? 5;
  const color = getField(fields, 5)
    ? decodeColor(getField(fields, 5).val)
    : { r: 0, g: 0, b: 0, a: 1, css: "rgba(0,0,0,1)" };
  const opacity = getField(fields, 6)?.val ?? 0.75;
  return { enabled, angle, offset, radius, color, opacity };
}

function decodeTextShape(buf) {
  if (!buf || !Buffer.isBuffer(buf) || buf.length === 0) return { enabled: false };
  try {
    const tsFields = parseProtoFields(buf);
    const tsEnabled = Boolean(getField(tsFields, 1)?.val ?? 0);
    if (!tsEnabled) return { enabled: false };

    const rawRadius = getField(tsFields, 2)?.val;
    const cornerRadius = typeof rawRadius === "number" && rawRadius > 0 ? rawRadius : 0;
    const mode = getField(tsFields, 4)?.val ?? 1;
    const padding = getField(tsFields, 5)?.val ?? 24;
    const offsetY = getField(tsFields, 3)?.val ?? (typeof rawRadius === "number" && rawRadius < 0 ? rawRadius : 0);

    return {
      enabled: true,
      mode,
      cornerRadius,
      padding,
      offsetY
    };
  } catch (_) {
    return { enabled: false };
  }
}

function decodePath(buf) {
  if (!buf) return null;
  const fields = parseProtoFields(buf);
  const closed = Boolean(getField(fields, 1)?.val ?? 1);
  const pointMsgs = getAllFields(fields, 2);
  const shapeMsg = getField(fields, 3);
  let shapeType = 1;
  if (shapeMsg) {
    const sf = parseProtoFields(shapeMsg.val);
    shapeType = getField(sf, 1)?.val ?? 1;
  }

  const points = pointMsgs.map((pm) => {
    const pf = parseProtoFields(pm.val);
    const q0 = getField(pf, 2) ? decodePoint(getField(pf, 2).val) : null;
    const pt = getField(pf, 1) ? decodePoint(getField(pf, 1).val) : { x: 0, y: 0 };
    const q1 = getField(pf, 3) ? decodePoint(getField(pf, 3).val) : null;
    const curved = Boolean(getField(pf, 4)?.val);
    return {
      point: pt,
      q0: q0 || pt,
      q1: q1 || pt,
      curved
    };
  });

  const isRect =
    shapeType === 1 &&
    points.length === 4 &&
    !points.some((p) => p.curved) &&
    Math.abs(points[0].point.x - 0) < 1e-4 &&
    Math.abs(points[0].point.y - 0) < 1e-4 &&
    Math.abs(points[1].point.x - 1) < 1e-4 &&
    Math.abs(points[1].point.y - 0) < 1e-4 &&
    Math.abs(points[2].point.x - 1) < 1e-4 &&
    Math.abs(points[2].point.y - 1) < 1e-4 &&
    Math.abs(points[3].point.x - 0) < 1e-4 &&
    Math.abs(points[3].point.y - 1) < 1e-4;

  return { closed, shapeType, points, isRect };
}

function getProPresenterAppDataDirs() {
  const dirs = [];
  const pushDir = (p) => {
    if (p && !dirs.includes(p)) dirs.push(p);
  };

  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    pushDir(path.join(appData, "RenewedVision", "ProPresenter"));
  } else if (process.platform === "darwin") {
    pushDir(path.join(os.homedir(), "Library", "Application Support", "RenewedVision", "ProPresenter"));
  } else {
    const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
    const xdgData = process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
    pushDir(path.join(xdgConfig, "RenewedVision", "ProPresenter"));
    pushDir(path.join(xdgData, "RenewedVision", "ProPresenter"));
  }
  return dirs;
}

const workspaceDirsCache = new Map();
const WORKSPACE_CACHE_TTL_MS = 3000;

// Discover ProPresenter workspace folders from PathSettings.proPaths on Windows / macOS / Linux
function getProPresenterWorkspaces(presentationPath = "", customWorkspaceDir = "") {
  const cacheKey = `${presentationPath}::${customWorkspaceDir}`;
  const now = Date.now();
  const cached = workspaceDirsCache.get(cacheKey);
  if (cached && now - cached.ts < WORKSPACE_CACHE_TTL_MS) {
    return cached.dirs;
  }

  const dirs = [];
  const pushUnique = (p) => {
    if (!p) return;
    const clean = path.normalize(p.replace(/[\\/]+$/, ""));
    if (clean && !dirs.includes(clean) && fs.existsSync(clean)) {
      dirs.push(clean);
    }
  };

  pushUnique(customWorkspaceDir);

  if (presentationPath) {
    const normalizedPres = String(presentationPath).replace(/\\/g, "/");
    const idx = normalizedPres.indexOf("/Libraries/");
    if (idx !== -1) {
      pushUnique(presentationPath.slice(0, idx));
    }
  }

  for (const appDir of getProPresenterAppDataDirs()) {
    try {
      const proPathsFile = path.join(appDir, "PathSettings.proPaths");
      if (fs.existsSync(proPathsFile)) {
        const content = fs.readFileSync(proPathsFile, "utf8");
        const match = content.match(/Workspaces=(\[.*?\]);/s);
        if (match) {
          const arr = JSON.parse(match[1]);
          for (const itemStr of arr) {
            try {
              const obj = typeof itemStr === "string" ? JSON.parse(itemStr) : itemStr;
              if (obj?.Path) pushUnique(obj.Path);
            } catch (_) {}
          }
        }
      }
    } catch (_) {}
  }

  pushUnique(path.join(os.homedir(), "Documents", "ProPresenter"));
  workspaceDirsCache.set(cacheKey, { ts: now, dirs });
  return dirs;
}

function getAppPreferencesFile() {
  for (const appDir of getProPresenterAppDataDirs()) {
    const pref = path.join(appDir, "Preferences", "AppPreferences.proPref");
    if (fs.existsSync(pref)) return pref;
  }
  const fallbackBase = getProPresenterAppDataDirs()[0] || path.join(os.homedir(), "Documents", "ProPresenter");
  return path.join(fallbackBase, "Preferences", "AppPreferences.proPref");
}

function parsePrefMap(content) {
  const map = new Map();
  for (const rawLine of String(content || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || !line.includes("=")) continue;
    const eq = line.indexOf("=");
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).replace(/;\s*$/, "").trim();
    map.set(key, val);
  }
  return map;
}

const appPrefsCache = { mtimeMs: -1, map: new Map(), transitions: null };

function readAppPreferencesCached() {
  try {
    const prefFile = getAppPreferencesFile();
    if (!fs.existsSync(prefFile)) return null;
    const stat = fs.statSync(prefFile);
    if (appPrefsCache.mtimeMs !== stat.mtimeMs) {
      const content = fs.readFileSync(prefFile, "utf8");
      appPrefsCache.map = parsePrefMap(content);
      appPrefsCache.mtimeMs = stat.mtimeMs;
      appPrefsCache.transitions = null;
    }
    return appPrefsCache;
  } catch (_) {
    return null;
  }
}

function normalizeTransitionEffectType(name = "") {
  const lower = String(name || "").trim().toLowerCase();
  if (!lower || lower === "none" || /\bcut\b/.test(lower)) return "cut";
  if (/push/.test(lower)) return "push";
  if (/slide|reveal|swap|move/.test(lower)) return "slide";
  if (/wipe|barn/.test(lower)) return "wipe";
  if (/iris|circle/.test(lower)) return "iris";
  if (/zoom|scale|drop/.test(lower)) return "zoom";
  if (/blur|defocus/.test(lower)) return "blur";
  if (/fade\s*(to|through)?\s*(black|white|color)|film\s*burn|dip/.test(lower)) return "fade-color";
  return "dissolve";
}

function decodeTransitionMessage(buf) {
  if (!buf || !Buffer.isBuffer(buf) || buf.length === 0) return null;
  const fields = parseProtoFields(buf);
  const durField = getField(fields, 1);
  const effectField = getField(fields, 3);
  if (!durField && !effectField) return null;

  let effectName = "";
  let direction = "left";

  if (effectField) {
    const ef = parseProtoFields(effectField.val);
    effectName =
      getField(ef, 3)?.val?.toString("utf8") ||
      getField(ef, 5)?.val?.toString("utf8") ||
      "";
    for (const vf of getAllFields(ef, 7)) {
      const vFields = parseProtoFields(vf.val);
      const varName = (getField(vFields, 1)?.val?.toString("utf8") || "").toLowerCase();
      if (/direction/.test(varName)) {
        const valMsg = getField(vFields, 4)?.val;
        if (valMsg) {
          const vp = parseProtoFields(valMsg);
          const dirIdx = getField(vp, 1)?.val;
          if (dirIdx === 0) direction = "left";
          else if (dirIdx === 1) direction = "right";
          else if (dirIdx === 2) direction = "up";
          else if (dirIdx === 3) direction = "down";
        }
      }
    }
  }

  const type = normalizeTransitionEffectType(effectName || "Dissolve");
  const rawDur = typeof durField?.val === "number" ? durField.val : type === "cut" ? 0 : 0.6;
  const durationSeconds = type === "cut" ? 0 : Math.max(0, Math.min(10, Number(rawDur) || 0));
  if (durationSeconds <= 0.01) {
    return { type: "cut", name: effectName || "Cut", durationSeconds: 0, direction };
  }
  return {
    type,
    name: effectName || "Dissolve",
    durationSeconds,
    direction
  };
}

function resolveLayerTransitionFromMap(map, prefix, sourceTag) {
  const typeCode = Number(map.get(`${prefix}TransitionType`) ?? "1");
  const autoDurRaw = Number(map.get(`${prefix}AutoTransitionDuration`) ?? "0.5");
  const advB64 = map.get(`${prefix}AdvancedTransition`) || "";

  if (typeCode === 0) {
    return {
      type: "cut",
      name: "Cut",
      durationSeconds: 0,
      direction: "left",
      source: sourceTag
    };
  }

  if (typeCode >= 2 && advB64) {
    let decoded = null;
    try {
      decoded = decodeTransitionMessage(Buffer.from(advB64, "base64"));
    } catch (_) {}
    if (decoded) {
      return { ...decoded, source: `${sourceTag}-advanced` };
    }
  }

  const dur = Number.isFinite(autoDurRaw) ? Math.max(0, Math.min(10, autoDurRaw)) : 0.5;
  return {
    type: dur <= 0.01 ? "cut" : "dissolve",
    name: dur <= 0.01 ? "Cut" : "Dissolve",
    durationSeconds: dur <= 0.01 ? 0 : dur,
    direction: "left",
    source: sourceTag
  };
}

function getLayerTransitions() {
  const defaultTransition = {
    type: "dissolve",
    name: "Dissolve",
    durationSeconds: 0.5,
    direction: "left",
    source: "default"
  };

  const cached = readAppPreferencesCached();
  if (!cached) {
    return { media: defaultTransition, slide: defaultTransition };
  }
  if (cached.transitions) return cached.transitions;

  const resolved = {
    media: resolveLayerTransitionFromMap(cached.map, "GlobalBackground", "global-background"),
    slide: resolveLayerTransitionFromMap(cached.map, "GlobalForeground", "global-foreground")
  };

  cached.transitions = resolved;
  return resolved;
}

function getMediaTransition() {
  return getLayerTransitions().media;
}

function getDefaultScreenUuid() {
  try {
    const cached = readAppPreferencesCached();
    if (cached) {
      const id = cached.map.get("SelectedPreviewScreenID") || "";
      if (id) return id.toLowerCase();
    }
  } catch (_) {}
  return "";
}

const imageDataUrlCache = new Map();

function loadImageDataUrl(filePath) {
  if (!filePath) return null;
  try {
    if (!fs.existsSync(filePath)) return null;
    const ext = path.extname(filePath).toLowerCase();
    if (isVideoExtension(ext)) return null; // Never load video into base64 data URL!

    const stat = fs.statSync(filePath);
    const cached = imageDataUrlCache.get(filePath);
    if (cached && cached.mtimeMs === stat.mtimeMs) {
      return cached.dataUrl;
    }
    const cleanExt = ext.replace(".", "");
    const mime =
      cleanExt === "jpg" || cleanExt === "jpeg"
        ? "image/jpeg"
        : cleanExt === "webp"
        ? "image/webp"
        : cleanExt === "svg"
        ? "image/svg+xml"
        : "image/png";
    const b64 = fs.readFileSync(filePath).toString("base64");
    const dataUrl = `data:${mime};base64,${b64}`;
    imageDataUrlCache.set(filePath, { mtimeMs: stat.mtimeMs, dataUrl });
    return dataUrl;
  } catch (_) {
    return null;
  }
}

function extractUrlFields(urlBuf) {
  if (!urlBuf) return { absolutePath: "", relativePath: "" };
  const fields = parseProtoFields(urlBuf);
  const absolutePath = getField(fields, 1)?.val?.toString("utf8") || "";
  const localMsg = getField(fields, 4);
  let relativePath = "";
  if (localMsg) {
    const lf = parseProtoFields(localMsg.val);
    relativePath = getField(lf, 2)?.val?.toString("utf8") || "";
  }
  return { absolutePath, relativePath };
}

function resolveExistingFile(absolutePath, relativePath, extraSearchDirs = []) {
  const candidates = [];
  const normRel = relativePath ? String(relativePath).replace(/[\\/]+/g, path.sep) : "";
  const normAbs = absolutePath ? String(absolutePath).replace(/[\\/]+/g, path.sep) : "";

  for (const dir of extraSearchDirs) {
    if (dir && normRel) {
      candidates.push(path.join(dir, normRel));
    }
  }
  if (normAbs) {
    candidates.push(normAbs);
  }
  for (const cand of candidates) {
    if (cand && fs.existsSync(cand)) return cand;
  }
  return null;
}

function resolveMediaUrl(urlBuf, baseFolders) {
  const { absolutePath, relativePath } = extractUrlFields(urlBuf);
  const found = resolveExistingFile(absolutePath, relativePath, baseFolders);
  return found ? loadImageDataUrl(found) : null;
}

function resolveMediaFill(urlBuf, baseFolders) {
  const { absolutePath, relativePath } = extractUrlFields(urlBuf);
  const found = resolveExistingFile(absolutePath, relativePath, baseFolders);
  if (!found) return null;

  const ext = path.extname(found).toLowerCase();
  if (isVideoExtension(ext)) {
    const playable = resolvePlayableVideoSync(found);
    return {
      enabled: true,
      type: "media",
      mediaType: "video",
      filePath: playable?.filePath || found,
      fileUrl: playable?.fileUrl || pathToFileURL(found).href,
      isTranscoded: Boolean(playable?.isTranscoded),
      isPendingTranscode: Boolean(playable?.isPendingTranscode)
    };
  }

  const dataUrl = loadImageDataUrl(found);
  return {
    enabled: true,
    type: "media",
    mediaType: "image",
    dataUrl,
    filePath: found,
    fileUrl: pathToFileURL(found).href
  };
}

function decodeFill(buf, baseFolders) {
  if (!buf) return { enabled: false };
  const fields = parseProtoFields(buf);
  const enabled = Boolean(getField(fields, 4)?.val);
  if (!enabled) return { enabled: false };

  const colorField = getField(fields, 1);
  const gradField = getField(fields, 2);
  const mediaField = getField(fields, 3);
  const bgEffectField = getField(fields, 5);

  if (bgEffectField) {
    const bf = parseProtoFields(bgEffectField.val);
    const blurField = getField(bf, 2);
    let saturation = 1.0;
    let blurAmount = 1.0;
    if (blurField) {
      const blf = parseProtoFields(blurField.val);
      saturation = getField(blf, 1)?.val ?? 1.0;
      blurAmount = getField(blf, 2)?.val ?? 1.0;
    }
    return {
      enabled: true,
      type: "blur",
      blurPx: Math.max(8, Math.round(blurAmount * 28)),
      saturation
    };
  }

  if (mediaField) {
    const mf = parseProtoFields(mediaField.val);
    const urlField = getField(mf, 2);
    const mediaFill = resolveMediaFill(urlField?.val, baseFolders);
    if (mediaFill) {
      return mediaFill;
    }
  }

  if (gradField) {
    const gf = parseProtoFields(gradField.val);
    const gradType = getField(gf, 1)?.val ?? 0;
    const angle = getField(gf, 2)?.val ?? 0;
    const stops = getAllFields(gf, 4).map((sf, idx, arr) => {
      const stFields = parseProtoFields(sf.val);
      const color = getField(stFields, 1)
        ? decodeColor(getField(stFields, 1).val)
        : { css: "rgba(0,0,0,1)" };
      const pos = getField(stFields, 2)?.val;
      const position = pos !== undefined ? pos : arr.length > 1 ? idx / (arr.length - 1) : 0;
      return { color: color.css, position };
    });
    return {
      enabled: true,
      type: "gradient",
      gradType: gradType === 1 ? "radial" : "linear",
      angle,
      stops
    };
  }

  if (colorField) {
    return {
      enabled: true,
      type: "color",
      color: decodeColor(colorField.val)
    };
  }

  return { enabled: false };
}

const WIN1252_EXTRA = {
  0x80: "\u20ac", 0x82: "\u201a", 0x83: "\u0192", 0x84: "\u201e", 0x85: "\u2026",
  0x86: "\u2020", 0x87: "\u2021", 0x88: "\u02c6", 0x89: "\u2030", 0x8a: "\u0160",
  0x8b: "\u2039", 0x8c: "\u0152", 0x8e: "\u017d", 0x91: "\u2018", 0x92: "\u2019",
  0x93: "\u201c", 0x94: "\u201d", 0x95: "\u2022", 0x96: "\u2013", 0x97: "\u2014",
  0x98: "\u02dc", 0x99: "\u2122", 0x9a: "\u0161", 0x9b: "\u203a", 0x9c: "\u0153",
  0x9e: "\u017e", 0x9f: "\u0178"
};

function decodeRtfPlainText(rtfStr) {
  const stripped = rtfStr
    .replace(/\{\\fonttbl[^}]*\}/g, "")
    .replace(/\{\\colortbl[^}]*\}/g, "")
    .replace(/\{\\\*\\[^}]*\}/g, "");

  let out = "";
  let uc = 1;
  let i = 0;
  while (i < stripped.length) {
    const ch = stripped[i];
    if (ch === "{" || ch === "}") {
      i++;
      continue;
    }
    if (ch !== "\\") {
      out += ch;
      i++;
      continue;
    }

    const next = stripped[i + 1];
    if (next === undefined) break;
    if (next === "\\" || next === "{" || next === "}") {
      out += next;
      i += 2;
      continue;
    }
    if (next === "~") {
      out += "\u00a0";
      i += 2;
      continue;
    }
    if (next === "-" || next === "_") {
      out += next === "_" ? "-" : "";
      i += 2;
      continue;
    }
    if (next === "\r" || next === "\n") {
      out += "\n";
      i += next === "\r" && stripped[i + 2] === "\n" ? 3 : 2;
      continue;
    }
    if (next === "'") {
      const hex = stripped.slice(i + 2, i + 4);
      if (/^[0-9a-fA-F]{2}$/.test(hex)) {
        const code = parseInt(hex, 16);
        out += WIN1252_EXTRA[code] || String.fromCharCode(code);
        i += 4;
        continue;
      }
    }

    const m = stripped.slice(i).match(/^\\([a-zA-Z]+)(-?\d+)? ?/);
    if (m) {
      const word = m[1];
      const param = m[2] !== undefined ? Number(m[2]) : null;
      i += m[0].length;
      if (word === "uc" && param !== null) {
        uc = Math.max(0, param);
      } else if (word === "u" && param !== null) {
        const code = param < 0 ? param + 65536 : param;
        out += String.fromCharCode(code);
        // Skip uc fallback characters (typically '?')
        let skipped = 0;
        while (skipped < uc && i < stripped.length && stripped[i] !== "\\" && stripped[i] !== "{" && stripped[i] !== "}") {
          i++;
          skipped++;
        }
      } else if (word === "par" || word === "line") {
        out += "\n";
      } else if (word === "tab") {
        out += "\t";
      } else if (word === "endash") {
        out += "\u2013";
      } else if (word === "emdash") {
        out += "\u2014";
      } else if (word === "lquote") {
        out += "\u2018";
      } else if (word === "rquote") {
        out += "\u2019";
      } else if (word === "ldblquote") {
        out += "\u201c";
      } else if (word === "rdblquote") {
        out += "\u201d";
      } else if (word === "bullet") {
        out += "\u2022";
      }
      continue;
    }

    i += 2;
  }
  return out.trim();
}

function parseRtfMetadata(rtfStr) {
  if (!rtfStr) return {};
  const meta = {};

  const fontMatch = rtfStr.match(/\\fonttbl\\f0\\f\w+\s+([^;{}]+);/);
  if (fontMatch) {
    meta.fontPostscript = fontMatch[1].trim();
  }

  const fsMatches = [...rtfStr.matchAll(/\\fs(\d+)/g)];
  if (fsMatches.length > 0) {
    meta.fontSize = Number(fsMatches[fsMatches.length - 1][1]) / 2;
  }

  if (rtfStr.includes("\\qc")) meta.textAlign = "center";
  else if (rtfStr.includes("\\qr")) meta.textAlign = "right";
  else if (rtfStr.includes("\\qj")) meta.textAlign = "justify";
  else if (rtfStr.includes("\\ql")) meta.textAlign = "left";

  if (/\\b(?![0-9a-zA-Z])/.test(rtfStr)) meta.bold = true;
  if (/\\i(?![0-9a-zA-Z])/.test(rtfStr)) meta.italic = true;

  const colortblMatch = rtfStr.match(/\{\\colortbl;([^}]*)\}/);
  if (colortblMatch) {
    const entries = colortblMatch[1].split(";").filter((s) => s.includes("\\red"));
    const cfMatch = rtfStr.match(/\\cf(\d+)/);
    const cfIdx = cfMatch ? Number(cfMatch[1]) - 1 : 0;
    const entry = entries[cfIdx] || entries[0];
    if (entry) {
      const r = Number(entry.match(/\\red(\d+)/)?.[1] ?? 255);
      const g = Number(entry.match(/\\green(\d+)/)?.[1] ?? 255);
      const b = Number(entry.match(/\\blue(\d+)/)?.[1] ?? 255);
      meta.textColor = { r, g, b, a: 1, css: `rgba(${r}, ${g}, ${b}, 1)` };
    }
  }

  meta.plainText = decodeRtfPlainText(rtfStr);

  return meta;
}

function mapFontWeight(styleName, boldFlag, postscript) {
  const s = `${styleName || ""} ${postscript || ""}`.toLowerCase();
  if (s.includes("black") || s.includes("heavy")) return 900;
  if (s.includes("extrabold") || s.includes("ultrabold")) return 800;
  if (s.includes("semibold") || s.includes("demibold")) return 600;
  if (s.includes("bold")) return 700;
  if (s.includes("medium")) return 500;
  if (s.includes("light")) return 300;
  if (s.includes("thin") || s.includes("hairline")) return 100;
  return boldFlag ? 700 : 400;
}

function buildFontFamilyStack(fontFamily, fontPostscript) {
  const candidates = [];
  const add = (name) => {
    const clean = String(name || "").trim();
    if (clean && !candidates.includes(clean)) candidates.push(clean);
  };

  // Strip -Bold / -Regular / -BoldItalic / MT suffixes for base PostScript name
  const psNoSuffix = (fontPostscript || "")
    .replace(/-(Regular|Bold|ExtraBold|Black|SemiBold|Medium|Light|Thin|Italic|BoldItalic|Oblique)$/i, "")
    .replace(/MT$/i, "");

  // Convert camelCase -> spaced Windows DirectWrite name (e.g. TitanOne -> Titan One, PalatinoLinotype -> Palatino Linotype)
  const splitCamel = (s) => s.replace(/([a-z])([A-Z])/g, "$1 $2").trim();

  add(fontFamily);
  add(splitCamel(fontFamily || ""));
  add(fontPostscript);
  add(psNoSuffix);
  add(splitCamel(psNoSuffix));
  add((fontFamily || "").replace(/\s+(ExtraBold|Black|SemiBold|Bold|Light|Medium|Regular)$/i, ""));

  return candidates.map((f) => `"${f}"`).join(", ") + ", sans-serif";
}

function decodeTextElement(buf) {
  if (!buf) return null;
  const fields = parseProtoFields(buf);
  const rtfStr = getField(fields, 5)?.val?.toString("utf8") || "";
  const rtfMeta = parseRtfMetadata(rtfStr);

  const vaRaw = getField(fields, 6)?.val ?? 0;
  const verticalAlignment = vaRaw === 1 ? "middle" : vaRaw === 2 ? "bottom" : "top";

  const marginsField = getField(fields, 14);
  let margins = { left: 0, right: 0, top: 0, bottom: 0 };
  if (marginsField) {
    const mf = parseProtoFields(marginsField.val);
    margins = {
      left: getField(mf, 1)?.val ?? 0,
      right: getField(mf, 2)?.val ?? 0,
      top: getField(mf, 3)?.val ?? 0,
      bottom: getField(mf, 4)?.val ?? 0
    };
  }

  const textShadow = getField(fields, 4) ? decodeShadow(getField(fields, 4).val) : null;

  let fontPostscript = rtfMeta.fontPostscript || "ArialMT";
  let fontFamily = rtfMeta.fontPostscript || "Arial";
  let fontStyleName = "";
  let fontSize = rtfMeta.fontSize || 64;
  let boldFlag = Boolean(rtfMeta.bold);
  let italicFlag = Boolean(rtfMeta.italic);
  let capitalization = "none";
  let textColor = rtfMeta.textColor || { r: 255, g: 255, b: 255, a: 1, css: "rgba(255,255,255,1)" };
  let textAlign = rtfMeta.textAlign || "center";
  let lineHeightMultiple = 1.0;
  let letterSpacing = 0;
  let textStrokeWidth = 0;
  let textStrokeColor = null;

  const attrField = getField(fields, 3);
  if (attrField) {
    const af = parseProtoFields(attrField.val);
    const fontField = getField(af, 1);
    if (fontField) {
      const ff = parseProtoFields(fontField.val);
      const ps = getField(ff, 1)?.val?.toString("utf8");
      const sz = getField(ff, 2)?.val;
      const italic = getField(ff, 4)?.val;
      const bold = getField(ff, 8)?.val;
      const fam = getField(ff, 9)?.val?.toString("utf8");
      const sty = getField(ff, 10)?.val?.toString("utf8");
      if (ps) fontPostscript = ps;
      if (fam) fontFamily = fam;
      else if (ps) fontFamily = ps;
      if (sty) fontStyleName = sty;
      if (sz && sz > 0) fontSize = sz;
      if (bold !== undefined) boldFlag = Boolean(bold);
      if (italic !== undefined) italicFlag = Boolean(italic);
    }

    const capRaw = getField(af, 2)?.val ?? 0;
    if (capRaw === 1) capitalization = "uppercase";
    else if (capRaw === 2) capitalization = "lowercase";
    else if (capRaw === 3) capitalization = "capitalize";

    const fgColorField = getField(af, 3);
    if (fgColorField) {
      textColor = decodeColor(fgColorField.val);
    }

    const paraField = getField(af, 6);
    if (paraField) {
      const pf = parseProtoFields(paraField.val);
      const alignRaw = getField(pf, 1)?.val ?? 0;
      textAlign = alignRaw === 1 ? "right" : alignRaw === 2 ? "center" : alignRaw === 3 ? "justify" : "left";
      const lhm = getField(pf, 5)?.val;
      if (lhm && lhm > 0) lineHeightMultiple = lhm;
    }

    const kerning = getField(af, 10)?.val;
    if (typeof kerning === "number") letterSpacing = kerning;

    const strokeW = getField(af, 11)?.val;
    const strokeCol = getField(af, 12) ? decodeColor(getField(af, 12).val) : null;
    if (typeof strokeW === "number" && strokeW !== 0) {
      textStrokeWidth = Math.abs(strokeW);
      textStrokeColor = strokeCol;
    }
  }

  const fontWeight = mapFontWeight(fontStyleName, boldFlag, fontPostscript);
  const fontItalic = italicFlag || /italic|oblique/i.test(`${fontStyleName} ${fontPostscript}`);

  return {
    plainText: rtfMeta.plainText || "",
    verticalAlignment,
    margins,
    fontFamily: buildFontFamilyStack(fontFamily, fontPostscript),
    fontSize,
    fontWeight,
    fontItalic,
    capitalization,
    textColor,
    textAlign,
    lineHeightMultiple,
    letterSpacing,
    textStrokeWidth,
    textStrokeColor,
    textShadow
  };
}

function decodeSlide(slideBuf, baseFolders) {
  const fields = parseProtoFields(slideBuf);
  const uuid = decodeUuid(getField(fields, 7)?.val);
  const size = getField(fields, 6) ? decodeSize(getField(fields, 6).val) : { width: 1920, height: 1080 };
  const rawElements = getAllFields(fields, 1);

  const parsed = [];
  for (let i = 0; i < rawElements.length; i++) {
    const seFields = parseProtoFields(rawElements[i].val);
    const geField = getField(seFields, 1);
    if (!geField) continue;

    const info = getField(seFields, 4)?.val ?? 0;
    const isTextBox = (info & 2) !== 0;
    const geFields = parseProtoFields(geField.val);

    const id = decodeUuid(getField(geFields, 1)?.val);
    const name = getField(geFields, 2)?.val?.toString("utf8") || "";
    const bounds = decodeRect(getField(geFields, 3)?.val);
    const rotation = getField(geFields, 4)?.val ?? 0;
    const opacity = getField(geFields, 5)?.val ?? 1.0;
    const pathData = getField(geFields, 8) ? decodePath(getField(geFields, 8).val) : null;
    const fill = decodeFill(getField(geFields, 9)?.val, baseFolders);

    const strokeField = getField(geFields, 10);
    let stroke = { enabled: false };
    if (strokeField) {
      const sf = parseProtoFields(strokeField.val);
      if (getField(sf, 5)?.val) {
        stroke = {
          enabled: true,
          width: getField(sf, 2)?.val ?? 1,
          color: getField(sf, 3) ? decodeColor(getField(sf, 3).val) : { css: "rgba(255,255,255,1)" }
        };
      }
    }

    const shadow = getField(geFields, 11) ? decodeShadow(getField(geFields, 11).val) : null;

    const featherField = getField(geFields, 12);
    let feather = { enabled: false, amount: 0 };
    if (featherField) {
      const ff = parseProtoFields(featherField.val);
      if (getField(ff, 3)?.val) {
        feather = { enabled: true, amount: getField(ff, 2)?.val ?? 0.05 };
      }
    }

    const textField = getField(geFields, 13);
    const text = isTextBox && textField ? decodeTextElement(textField.val) : null;
    const textShapeField = getField(geFields, 14);
    const textShape = isTextBox ? decodeTextShape(textShapeField?.val) : { enabled: false };

    parsed.push({
      id,
      name,
      info,
      isTextBox,
      zIndex: rawElements.length - i,
      bounds,
      rotation,
      opacity,
      path: pathData,
      fill,
      stroke,
      shadow,
      feather,
      textShape,
      text
    });
  }

  parsed.reverse();

  return {
    uuid,
    canvasWidth: size.width || 1920,
    canvasHeight: size.height || 1080,
    elements: parsed
  };
}

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg"]);
const VIDEO_EXTS = new Set([".mp4", ".m4v", ".webm", ".mov", ".mkv", ".avi"]);

function classifyMediaFile(filePath, codec = "") {
  const ext = path.extname(filePath || "").toLowerCase();
  if (IMAGE_EXTS.has(ext) || /^(png|jpeg|jpg|webp|gif)$/i.test(codec)) return "image";
  if (VIDEO_EXTS.has(ext) || /^(h264|hevc|vp8|vp9|av1|prores|mp4)$/i.test(codec)) return "video";
  return "video";
}

function decodeMediaAction(actionBuf, searchDirs) {
  const af = parseProtoFields(actionBuf);
  const mediaAction = getField(af, 20);
  if (!mediaAction) return null;
  const maf = parseProtoFields(mediaAction.val);
  const mediaMsg = getField(maf, 5);
  if (!mediaMsg) return null;

  const mf = parseProtoFields(mediaMsg.val);
  const uuid = decodeUuid(getField(mf, 1)?.val);
  const urlField = getField(mf, 2);
  const { absolutePath, relativePath } = extractUrlFields(urlField?.val);
  const metadataMsg = getField(mf, 3);
  let codec = "";
  if (metadataMsg) {
    const mdf = parseProtoFields(metadataMsg.val);
    codec = getField(mdf, 5)?.val?.toString("utf8") || "";
  }

  const found = resolveExistingFile(absolutePath, relativePath, searchDirs);
  if (!found) return null;

  const transitionField = getField(maf, 7) || getField(af, 7);
  let transition = null;
  if (transitionField?.val && Buffer.isBuffer(transitionField.val) && transitionField.val.length > 0) {
    try {
      const parsed = decodeTransitionMessage(transitionField.val);
      if (parsed) transition = { ...parsed, source: "action" };
    } catch (_) {}
  }

  const mediaType = classifyMediaFile(found, codec);
  let fileUrl = pathToFileURL(found).href;
  if (mediaType === "video") {
    const playable = resolvePlayableVideoSync(found);
    if (playable?.fileUrl) {
      fileUrl = playable.fileUrl;
    }
  }

  return {
    uuid,
    name: path.basename(found),
    filePath: found,
    fileUrl,
    mediaType,
    transition
  };
}

const themeFileCache = new Map();
const presentationCache = new Map();
const mediaPlaylistCache = new Map();

function collectThemeFiles(dir, out = []) {
  if (!dir || !fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectThemeFiles(full, out);
    } else if (entry.isFile() && entry.name === "Theme") {
      out.push(full);
    }
  }
  return out;
}

function parseThemeFile(themeFilePath, workspaceDirs) {
  const stat = fs.statSync(themeFilePath);
  const cached = themeFileCache.get(themeFilePath);
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return cached;
  }

  const themeDir = path.dirname(themeFilePath);
  const themeName = path.basename(themeDir);
  const buf = fs.readFileSync(themeFilePath);
  const rootFields = parseProtoFields(buf);
  const slidesByUuid = new Map();

  for (const tsField of getAllFields(rootFields, 3)) {
    const tsFields = parseProtoFields(tsField.val);
    const slideName = getField(tsFields, 2)?.val?.toString("utf8") || "";
    const slideField = getField(tsFields, 1);
    if (!slideField) continue;
    const layout = decodeSlide(slideField.val, [themeDir, ...workspaceDirs]);
    if (layout.uuid) {
      slidesByUuid.set(layout.uuid, {
        themeName,
        slideName,
        mtimeMs: stat.mtimeMs,
        layout
      });
    }
  }

  const entry = { mtimeMs: stat.mtimeMs, themeName, slidesByUuid };
  themeFileCache.set(themeFilePath, entry);
  return entry;
}

function sanitizeDisplaySlideName(rawName = "") {
  const clean = String(rawName || "").trim();
  if (!clean) return "";
  // Ignore ProPresenter's auto-generated duplicate cue numbers like "1", "1 1", "1 1 1 1..."
  if (/^(\d+\s*)+$/.test(clean)) return "";
  return clean.replace(/(?:\s+1)+\s*$/, "").trim();
}

function rectsMatchClose(a, b, tol = 2.5) {
  if (!a || !b) return false;
  return (
    Math.abs((a.x || 0) - (b.x || 0)) <= tol &&
    Math.abs((a.y || 0) - (b.y || 0)) <= tol &&
    Math.abs((a.width || 0) - (b.width || 0)) <= tol &&
    Math.abs((a.height || 0) - (b.height || 0)) <= tol
  );
}

function findMatchingThemeByLayout(slideLayout, workspaceDirs) {
  const slideTbs = (slideLayout?.elements || []).filter((el) => el.isTextBox && el.text);
  if (slideTbs.length === 0) return null;

  let best = null;
  let bestScore = -1;

  for (const ws of workspaceDirs) {
    const themesDir = path.join(ws, "Themes");
    const files = collectThemeFiles(themesDir);
    for (const file of files) {
      try {
        const parsed = parseThemeFile(file, workspaceDirs);
        for (const entry of parsed.slidesByUuid.values()) {
          const allThemeTbs = (entry.layout?.elements || []).filter((el) => el.isTextBox && el.text);
          const nonEmptyThemeTbs = allThemeTbs.filter(
            (el) => String(el.text?.plainText || "").trim() !== ""
          );
          const candidateTbs =
            allThemeTbs.length === slideTbs.length
              ? allThemeTbs
              : nonEmptyThemeTbs.length === slideTbs.length
              ? nonEmptyThemeTbs
              : null;
          if (!candidateTbs) continue;

          const used = new Set();
          let allMatched = true;
          let score = candidateTbs.length * 10;

          for (const stb of slideTbs) {
            let foundIdx = -1;
            for (let i = 0; i < candidateTbs.length; i++) {
              if (used.has(i)) continue;
              if (rectsMatchClose(stb.bounds, candidateTbs[i].bounds, 2.5)) {
                foundIdx = i;
                break;
              }
            }
            if (foundIdx === -1) {
              allMatched = false;
              break;
            }
            used.add(foundIdx);
            const ttb = candidateTbs[foundIdx];
            const fillMatch = Boolean(stb.fill?.enabled) === Boolean(ttb.fill?.enabled);
            const sizeDiff = Math.abs((stb.text?.fontSize || 0) - (ttb.text?.fontSize || 0));
            if (slideTbs.length === 1 && (!fillMatch || sizeDiff > 4)) {
              allMatched = false;
              break;
            }
            if (fillMatch) score += 3;
            if (sizeDiff <= 1) score += 2;
            if (stb.text?.fontFamily && stb.text.fontFamily === ttb.text?.fontFamily) score += 2;
          }

          if (allMatched && score > bestScore) {
            bestScore = score;
            best = {
              themeName: entry.themeName,
              slideName: sanitizeDisplaySlideName(entry.slideName)
            };
          }
        }
      } catch (_) {}
    }
  }

  return best;
}

function findThemeSlideByUuid(themeSlideUuid, workspaceDirs) {
  const target = normalizeUuid(themeSlideUuid);
  if (!target) return null;

  for (const ws of workspaceDirs) {
    const themesDir = path.join(ws, "Themes");
    const files = collectThemeFiles(themesDir);
    for (const file of files) {
      try {
        const parsed = parseThemeFile(file, workspaceDirs);
        if (parsed.slidesByUuid.has(target)) {
          return parsed.slidesByUuid.get(target);
        }
      } catch (_) {}
    }
  }
  return null;
}

function findPresentationCueData(presentationPath, cueUuid, workspaceDirs) {
  const target = normalizeUuid(cueUuid);
  if (!presentationPath || !target || !fs.existsSync(presentationPath)) return null;

  const stat = fs.statSync(presentationPath);
  let cached = presentationCache.get(presentationPath);
  if (!cached || cached.mtimeMs !== stat.mtimeMs) {
    const buf = fs.readFileSync(presentationPath);
    const presFields = parseProtoFields(buf);
    const presDir = path.dirname(presentationPath);
    const cuesByUuid = new Map();

    for (const cueField of getAllFields(presFields, 13)) {
      const cf = parseProtoFields(cueField.val);
      const uuid = decodeUuid(getField(cf, 1)?.val);
      const name = getField(cf, 2)?.val?.toString("utf8") || "";
      if (!uuid) continue;

      let layout = null;
      let cueMedia = null;
      let cueSlideTransition = null;

      for (const actField of getAllFields(cf, 10)) {
        const af = parseProtoFields(actField.val);
        const atype = getField(af, 9)?.val;
        const slideAct = getField(af, 23);
        if (slideAct) {
          const saf = parseProtoFields(slideAct.val);
          const presSlide = getField(saf, 2);
          if (presSlide) {
            const psf = parseProtoFields(presSlide.val);
            const baseSlide = getField(psf, 1);
            if (baseSlide) {
              layout = decodeSlide(baseSlide.val, [presDir, ...workspaceDirs]);
              if (layout?.elements) {
                for (const el of layout.elements) {
                  if (el.fill?.type === "media" && el.fill.mediaType === "video" && el.fill.filePath) {
                    prewarmVideoAsync(el.fill.filePath);
                  }
                }
              }
            }
            const trField = getField(psf, 4);
            if (trField?.val && Buffer.isBuffer(trField.val) && trField.val.length > 0) {
              try {
                const parsedTr = decodeTransitionMessage(trField.val);
                if (parsedTr) cueSlideTransition = { ...parsedTr, source: "cue-slide" };
              } catch (_) {}
            }
          }
        } else if (atype === 2 && !cueMedia) {
          cueMedia = decodeMediaAction(actField.val, [presDir, ...workspaceDirs]);
          if (cueMedia?.filePath) {
            prewarmVideoAsync(cueMedia.filePath);
          }
        }
      }

      if (layout || cueMedia || cueSlideTransition) {
        cuesByUuid.set(uuid, { name, layout, cueMedia, cueSlideTransition });
      }
    }

    cached = { mtimeMs: stat.mtimeMs, cuesByUuid };
    presentationCache.set(presentationPath, cached);
  }

  const found = cached.cuesByUuid.get(target);
  if (!found) return null;
  return { ...found, mtimeMs: cached.mtimeMs };
}

function parseMediaPlaylistsFile(mediaFilePath, workspaceDirs) {
  const stat = fs.statSync(mediaFilePath);
  const cached = mediaPlaylistCache.get(mediaFilePath);
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return cached;
  }

  const byUuid = new Map();
  const byName = new Map();

  const walkPlaylistNode = (buf) => {
    const pf = parseProtoFields(buf);
    // Child groups/playlists (field 12 wraps field 1, or direct field 12)
    for (const child of getAllFields(pf, 12)) {
      const cf = parseProtoFields(child.val);
      const innerNodes = getAllFields(cf, 1);
      if (innerNodes.length > 0) {
        for (const n of innerNodes) walkPlaylistNode(n.val);
      } else {
        walkPlaylistNode(child.val);
      }
    }
    // Playlist items (field 13 wraps field 1 -> item)
    for (const itemContainer of getAllFields(pf, 13)) {
      const icf = parseProtoFields(itemContainer.val);
      const itemNodes = getAllFields(icf, 1);
      const list = itemNodes.length > 0 ? itemNodes : [itemContainer];
      for (const itemWrap of list) {
        const iwf = parseProtoFields(itemWrap.val);
        const itemUuid = decodeUuid(getField(iwf, 1)?.val);
        const itemName = getField(iwf, 2)?.val?.toString("utf8") || "";
        const innerItem = getField(iwf, 5);
        if (!innerItem) continue;
        const iif = parseProtoFields(innerItem.val);
        const innerUuid = decodeUuid(getField(iif, 1)?.val) || itemUuid;
        const innerName = getField(iif, 2)?.val?.toString("utf8") || itemName;
        const action = getField(iif, 10);
        if (!action) continue;
        const resolved = decodeMediaAction(action.val, workspaceDirs);
        if (resolved) {
          const entry = {
            ...resolved,
            uuid: innerUuid || resolved.uuid,
            name: innerName || resolved.name
          };
          if (itemUuid) byUuid.set(itemUuid, entry);
          if (innerUuid) byUuid.set(innerUuid, entry);
          if (entry.uuid) byUuid.set(entry.uuid, entry);
          if (innerName) byName.set(innerName.toLowerCase(), entry);
        }
      }
    }
  };

  const buf = fs.readFileSync(mediaFilePath);
  const rootFields = parseProtoFields(buf);
  for (const rootGroup of getAllFields(rootFields, 3)) {
    walkPlaylistNode(rootGroup.val);
  }

  const entry = { mtimeMs: stat.mtimeMs, byUuid, byName };
  mediaPlaylistCache.set(mediaFilePath, entry);
  return entry;
}

function resolveMediaItem({ mediaUuid = "", mediaName = "", presentationPath = "", customWorkspaceDir = "" } = {}) {
  const workspaceDirs = getProPresenterWorkspaces(presentationPath, customWorkspaceDir);
  const normUuid = normalizeUuid(mediaUuid);
  const normName = String(mediaName || "").trim().toLowerCase();

  for (const ws of workspaceDirs) {
    const mediaPlaylistPath = path.join(ws, "Playlists", "Media");
    if (!fs.existsSync(mediaPlaylistPath)) continue;
    try {
      const parsed = parseMediaPlaylistsFile(mediaPlaylistPath, workspaceDirs);
      if (normUuid && parsed.byUuid.has(normUuid)) {
        return parsed.byUuid.get(normUuid);
      }
      if (normName && parsed.byName.has(normName)) {
        return parsed.byName.get(normName);
      }
    } catch (_) {}
  }
  return null;
}

function getMediaCatalog({ presentationPath = "", customWorkspaceDir = "" } = {}) {
  const workspaceDirs = getProPresenterWorkspaces(presentationPath, customWorkspaceDir);
  const seen = new Set();
  const items = [];

  for (const ws of workspaceDirs) {
    const mediaPlaylistPath = path.join(ws, "Playlists", "Media");
    if (!fs.existsSync(mediaPlaylistPath)) continue;
    try {
      const parsed = parseMediaPlaylistsFile(mediaPlaylistPath, workspaceDirs);
      for (const item of parsed.byUuid.values()) {
        if (!item?.fileUrl || seen.has(item.fileUrl)) continue;
        seen.add(item.fileUrl);
        items.push(item);
        if (items.length >= 500) return items;
      }
    } catch (_) {}
  }

  return items;
}

function resolveSlideTheme({
  presentationPath = "",
  cueUuid = "",
  themeSlideUuid = "",
  customWorkspaceDir = ""
} = {}) {
  const workspaceDirs = getProPresenterWorkspaces(presentationPath, customWorkspaceDir);

  let cueData = null;
  if (presentationPath && cueUuid) {
    cueData = findPresentationCueData(presentationPath, cueUuid, workspaceDirs);
  }

  const cueTextBoxes = (cueData?.layout?.elements || [])
    .filter((el) => el.isTextBox && el.text)
    .map((el) => ({
      id: el.id,
      name: el.name,
      zIndex: el.zIndex,
      bounds: el.bounds,
      rotation: el.rotation,
      opacity: el.opacity,
      path: el.path,
      fill: el.fill,
      stroke: el.stroke,
      shadow: el.shadow,
      feather: el.feather,
      textShape: el.textShape,
      text: el.text
    }));

  const cueMediaElements = (cueData?.layout?.elements || [])
    .filter((el) => el.fill?.type === "media")
    .map((el) => ({
      id: el.id,
      name: el.name,
      zIndex: el.zIndex,
      bounds: el.bounds,
      rotation: el.rotation,
      opacity: el.opacity,
      path: el.path,
      fill: el.fill,
      stroke: el.stroke,
      shadow: el.shadow,
      feather: el.feather
    }));

  if (themeSlideUuid) {
    const themeMatch = findThemeSlideByUuid(themeSlideUuid, workspaceDirs);
    if (themeMatch) {
      const multiCueKey = cueTextBoxes.length > 1 ? `${cueUuid}:${cueData?.mtimeMs || 0}` : "";
      const mediaKey = cueMediaElements.map((e) => e.fill?.fileUrl || e.fill?.dataUrl || "").join(",");
      return {
        source: "look-theme",
        themeName: themeMatch.themeName,
        slideName: sanitizeDisplaySlideName(themeMatch.slideName),
        versionKey: `look:${themeMatch.layout.uuid}:${themeMatch.mtimeMs}:${cueData?.cueMedia?.filePath || ""}:${mediaKey}:${multiCueKey}`,
        layout: themeMatch.layout,
        cueTextBoxes,
        cueMediaElements,
        cueMedia: cueData?.cueMedia || null,
        cueSlideTransition: cueData?.cueSlideTransition || null
      };
    }
  }

  if (cueData?.layout) {
    const matchedTheme = findMatchingThemeByLayout(cueData.layout, workspaceDirs);
    const mediaKey = (cueData.layout.elements || [])
      .map((e) => e.fill?.fileUrl || e.fill?.dataUrl || "")
      .join(",");
    return {
      source: "presentation-slide",
      themeName: matchedTheme ? matchedTheme.themeName : "Layout Bawaan Slide",
      slideName: matchedTheme
        ? matchedTheme.slideName
        : sanitizeDisplaySlideName(cueData.name),
      matchedByLayout: Boolean(matchedTheme),
      versionKey: `cue:${cueUuid}:${cueData.mtimeMs}:${mediaKey}`,
      layout: cueData.layout,
      cueTextBoxes,
      cueMediaElements,
      cueMedia: cueData.cueMedia || null,
      cueSlideTransition: cueData?.cueSlideTransition || null
    };
  }

  return null;
}

module.exports = {
  resolveSlideTheme,
  resolveMediaItem,
  getDefaultScreenUuid,
  getMediaTransition,
  getLayerTransitions,
  getMediaCatalog,
  findPresentationCueData,
  parseProtoFields,
  getAllFields,
  getField,
  decodeUuid
};
