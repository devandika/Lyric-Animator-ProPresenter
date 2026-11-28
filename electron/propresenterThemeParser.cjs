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

function isLocalProPresenterHost(host = "") {
  const clean = String(host || "").trim().toLowerCase();
  if (!clean || clean === "127.0.0.1" || clean === "localhost" || clean === "::1" || clean === "0.0.0.0") {
    return true;
  }
  try {
    const ifaces = os.networkInterfaces();
    for (const list of Object.values(ifaces)) {
      if (!Array.isArray(list)) continue;
      for (const iface of list) {
        if (iface?.address && String(iface.address).toLowerCase() === clean) {
          return true;
        }
      }
    }
  } catch (_) {}
  return false;
}

function getKnownDocumentsDirs() {
  const dirs = [];
  const push = (p) => {
    if (!p) return;
    const norm = path.normalize(p);
    if (!dirs.includes(norm)) dirs.push(norm);
  };
  const home = os.homedir();
  push(path.join(home, "Documents"));
  push(path.join(home, "OneDrive", "Documents"));
  if (process.env.OneDrive) push(path.join(process.env.OneDrive, "Documents"));
  if (process.env.OneDriveCommercial) push(path.join(process.env.OneDriveCommercial, "Documents"));
  if (process.env.OneDriveConsumer) push(path.join(process.env.OneDriveConsumer, "Documents"));
  return dirs;
}

function scanRenewedVisionProductDirs(parentDir, pushDir) {
  if (!parentDir) return;
  // Always prioritize canonical "ProPresenter" folder first
  const canonical = path.join(parentDir, "ProPresenter");
  if (fs.existsSync(canonical)) {
    pushDir(canonical);
  }
  // Future-proof: detect any versioned or updated folder (e.g. ProPresenter7, ProPresenter 8, ProPresenter21, etc.)
  try {
    if (!fs.existsSync(parentDir)) return;
    const entries = fs.readdirSync(parentDir, { withFileTypes: true });
    const candidates = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!/^propresenter/i.test(entry.name)) continue;
      const full = path.join(parentDir, entry.name);
      let mtimeMs = 0;
      try {
        mtimeMs = fs.statSync(full).mtimeMs || 0;
      } catch (_) {}
      candidates.push({ full, name: entry.name, mtimeMs });
    }
    candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
    for (const c of candidates) {
      pushDir(c.full);
    }
  } catch (_) {}
}

function getProPresenterAppDataDirs() {
  const dirs = [];
  const pushDir = (p) => {
    if (p && !dirs.includes(p)) dirs.push(p);
  };

  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    const programData = process.env.PROGRAMDATA || "C:\\ProgramData";
    scanRenewedVisionProductDirs(path.join(appData, "RenewedVision"), pushDir);
    scanRenewedVisionProductDirs(path.join(localAppData, "RenewedVision"), pushDir);
    scanRenewedVisionProductDirs(path.join(programData, "RenewedVision"), pushDir);
    // Keep canonical default even if directory doesn't exist yet
    pushDir(path.join(appData, "RenewedVision", "ProPresenter"));
  } else if (process.platform === "darwin") {
    const appSupport = path.join(os.homedir(), "Library", "Application Support", "RenewedVision");
    scanRenewedVisionProductDirs(appSupport, pushDir);
    pushDir(path.join(appSupport, "ProPresenter"));
  } else {
    const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
    const xdgData = process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
    scanRenewedVisionProductDirs(path.join(xdgConfig, "RenewedVision"), pushDir);
    scanRenewedVisionProductDirs(path.join(xdgData, "RenewedVision"), pushDir);
    pushDir(path.join(xdgConfig, "RenewedVision", "ProPresenter"));
    pushDir(path.join(xdgData, "RenewedVision", "ProPresenter"));
  }
  return dirs;
}

/**
 * Version-agnostic PathSettings.proPaths parser:
 * Supports classic ProPresenter 7 keys (Base=, Media=, SupportFiles=),
 * modern Workspaces=[...] JSON arrays (ProPresenter 17/18/19/20+),
 * SelectedWorkspace / ActiveWorkspace prioritization, and future path keys.
 */
function parseProPathsContent(content) {
  const workspaces = [];
  const mediaDirs = [];
  const text = String(content || "");
  if (!text) return { workspaces, mediaDirs };

  const pushUnique = (list, rawPath) => {
    if (!rawPath || typeof rawPath !== "string") return;
    let clean = rawPath.trim().replace(/^["']|["']$/g, "");
    if (!clean) return;
    clean = clean.replace(/\\\\/g, "\\");
    if (clean && !list.includes(clean)) {
      list.push(clean);
    }
  };

  // Extract selected/active workspace name or path if present
  let selectedHint = "";
  const selMatch = text.match(/(?:SelectedWorkspace|ActiveWorkspace|CurrentWorkspace)=([^;\r\n]+);?/i);
  if (selMatch) {
    selectedHint = selMatch[1].trim().replace(/^["']|["']$/g, "");
  }

  // 1. JSON array format: Workspaces=[...]; (supports any nested JSON objects or raw strings)
  const wsMatch = text.match(/Workspaces=(\[[\s\S]*?\]);?/i);
  if (wsMatch) {
    try {
      const arr = JSON.parse(wsMatch[1]);
      if (Array.isArray(arr)) {
        const prioritized = [];
        const rest = [];
        for (const item of arr) {
          try {
            const obj = typeof item === "string" && item.trim().startsWith("{") ? JSON.parse(item) : item;
            const p = typeof obj === "string" ? obj : obj?.Path || obj?.path || obj?.BasePath || obj?.Directory;
            if (!p) continue;
            const isSelected =
              Boolean(obj?.IsSelected || obj?.Selected || obj?.Active) ||
              (selectedHint &&
                (String(obj?.Name || "").toLowerCase() === selectedHint.toLowerCase() ||
                  String(obj?.Id || obj?.UUID || "").toLowerCase() === selectedHint.toLowerCase() ||
                  String(p).toLowerCase() === selectedHint.toLowerCase()));
            if (isSelected) prioritized.push(p);
            else rest.push(p);
          } catch (_) {}
        }
        for (const p of [...prioritized, ...rest]) {
          pushUnique(workspaces, p);
        }
      }
    } catch (_) {}
  }

  // 2. Classic & future key=value; path entries (Base=, BasePath=, SupportFiles=, Media=, etc.)
  const map = parsePrefMap(text);
  for (const [key, rawVal] of map.entries()) {
    if (!rawVal || /^Workspaces$/i.test(key)) continue;
    const val = rawVal.trim().replace(/^["']|["']$/g, "");
    if (!val || val.startsWith("[") || val.startsWith("{")) continue;
    const looksLikeFsPath = /^[a-zA-Z]:[\\/]/.test(val) || val.startsWith("/") || val.startsWith("\\\\");
    if (!looksLikeFsPath) continue;

    if (/media/i.test(key)) {
      pushUnique(mediaDirs, val);
    } else if (/^(base|basepath|supportfiles|supportfilespath|workspace|currentworkspace|activeworkspace|root|path|librarybase|propresenterpath)/i.test(key)) {
      pushUnique(workspaces, val);
    } else if (/librar/i.test(key)) {
      const parent = val.replace(/[\\/]+Libraries[\\/]*$/i, "");
      if (parent && parent !== val) pushUnique(workspaces, parent);
    }
  }

  return { workspaces, mediaDirs };
}

const workspaceDirsCache = new Map();
const WORKSPACE_CACHE_TTL_MS = 3000;

function deriveWorkspaceFromPresentationPath(presentationPath) {
  if (!presentationPath) return "";
  const normalizedPres = String(presentationPath).replace(/\\/g, "/");
  for (const marker of ["/Libraries/", "/Playlists/", "/Themes/"]) {
    const idx = normalizedPres.lastIndexOf(marker);
    if (idx > 0) {
      return presentationPath.slice(0, idx);
    }
  }
  return "";
}

// Discover ProPresenter workspace & media folders across all ProPresenter versions on Windows / macOS / Linux
function getProPresenterPathsInfo(presentationPath = "", customWorkspaceDir = "", proHost = "") {
  const isLocal = isLocalProPresenterHost(proHost);
  const cacheKey = `${isLocal ? "local" : "remote"}::${presentationPath}::${customWorkspaceDir}`;
  const now = Date.now();
  const cached = workspaceDirsCache.get(cacheKey);
  if (cached && now - cached.ts < WORKSPACE_CACHE_TTL_MS) {
    return cached.info;
  }

  const dirs = [];
  const mediaDirs = [];
  const pushUniqueExisting = (list, p) => {
    if (!p) return;
    const clean = path.normalize(String(p).trim().replace(/[\\/]+$/, ""));
    if (clean && !list.includes(clean) && fs.existsSync(clean)) {
      list.push(clean);
    }
  };

  // User-configured folder (works for both local custom drives and remote UNC network shares)
  pushUniqueExisting(dirs, customWorkspaceDir);

  // Derive directly from active presentation path if accessible on this OS
  const derivedWs = deriveWorkspaceFromPresentationPath(presentationPath);
  if (derivedWs) {
    pushUniqueExisting(dirs, derivedWs);
  }

  // Only inspect local machine's ProPresenter install when connected to local ProPresenter
  if (isLocal) {
    for (const appDir of getProPresenterAppDataDirs()) {
      try {
        const proPathsFile = path.join(appDir, "PathSettings.proPaths");
        if (fs.existsSync(proPathsFile)) {
          const content = fs.readFileSync(proPathsFile, "utf8");
          const parsed = parseProPathsContent(content);
          for (const ws of parsed.workspaces) pushUniqueExisting(dirs, ws);
          for (const md of parsed.mediaDirs) pushUniqueExisting(mediaDirs, md);
        }
      } catch (_) {}
    }

    for (const docDir of getKnownDocumentsDirs()) {
      pushUniqueExisting(dirs, path.join(docDir, "ProPresenter"));
    }
  }

  const info = { dirs, mediaDirs, isLocal };
  workspaceDirsCache.set(cacheKey, { ts: now, info });
  return info;
}

function getAppPreferencesFile() {
  for (const appDir of getProPresenterAppDataDirs()) {
    const pref = path.join(appDir, "Preferences", "AppPreferences.proPref");
    if (fs.existsSync(pref)) return pref;
  }
  const fallbackBase = getProPresenterAppDataDirs()[0] || path.join(os.homedir(), "Documents", "ProPresenter");
  return path.join(fallbackBase, "Preferences", "AppPreferences.proPref");
}

function getBiblePreferencesFile() {
  for (const appDir of getProPresenterAppDataDirs()) {
    const pref = path.join(appDir, "Preferences", "Bible.proPref");
    if (fs.existsSync(pref)) return pref;
  }
  const fallbackBase = getProPresenterAppDataDirs()[0] || path.join(os.homedir(), "Documents", "ProPresenter");
  return path.join(fallbackBase, "Preferences", "Bible.proPref");
}

const biblePrefsCache = { mtimeMs: -1, data: null };

function getBibleThemePreferences() {
  try {
    const prefFile = getBiblePreferencesFile();
    if (!fs.existsSync(prefFile)) return null;
    const stat = fs.statSync(prefFile);
    if (biblePrefsCache.mtimeMs === stat.mtimeMs && biblePrefsCache.data) {
      return biblePrefsCache.data;
    }
    const content = fs.readFileSync(prefFile, "utf8");
    const map = parsePrefMap(content);
    const templateUuid = normalizeUuid(map.get("SelectedTemplateID") || "");
    const primaryParts = String(map.get("PrimaryTranslation") || "").split("|");
    const data = {
      mtimeMs: stat.mtimeMs,
      templateUuid,
      translation: (primaryParts[0] || "").trim(),
      verseBoxName: (primaryParts[1] || "").trim(),
      referenceBoxName: (primaryParts[2] || "").trim(),
      verseBoxUuid: normalizeUuid(primaryParts[3] || ""),
      referenceBoxUuid: normalizeUuid(primaryParts[4] || ""),
      showVerseNumbers: String(map.get("ShowVerseNumbers") || "true").toLowerCase() !== "false",
      referenceType: Number(map.get("ReferenceType") || 1)
    };
    biblePrefsCache.mtimeMs = stat.mtimeMs;
    biblePrefsCache.data = data;
    return data;
  } catch (_) {
    return null;
  }
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

function getLayerTransitions(opts = {}) {
  const defaultTransition = {
    type: "dissolve",
    name: "Dissolve",
    durationSeconds: 0.5,
    direction: "left",
    source: "default"
  };

  if (opts?.proHost && !isLocalProPresenterHost(opts.proHost)) {
    return { media: defaultTransition, slide: defaultTransition };
  }

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

function getMediaTransition(opts = {}) {
  return getLayerTransitions(opts).media;
}

function getDefaultScreenUuid(opts = {}) {
  if (opts?.proHost && !isLocalProPresenterHost(opts.proHost)) {
    return "";
  }
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

function getLocalRootBaseDirs(localRoot, extraSearchDirs = []) {
  const home = os.homedir();
  const oneDrives = [
    path.join(home, "OneDrive"),
    process.env.OneDrive,
    process.env.OneDriveCommercial,
    process.env.OneDriveConsumer
  ].filter(Boolean);

  switch (Number(localRoot) || 0) {
    case 2: // USER_HOME
      return [home];
    case 3: // USER_DOCUMENTS
      return getKnownDocumentsDirs();
    case 4: // USER_DOWNLOADS
      return [path.join(home, "Downloads")];
    case 5: // USER_MUSIC
      return [path.join(home, "Music"), ...oneDrives.map((d) => path.join(d, "Music"))];
    case 6: // USER_PICTURES
      return [path.join(home, "Pictures"), ...oneDrives.map((d) => path.join(d, "Pictures"))];
    case 7: // USER_VIDEOS
      return [path.join(home, "Videos"), ...oneDrives.map((d) => path.join(d, "Videos"))];
    case 11: // USER_DESKTOP
      return [path.join(home, "Desktop"), ...oneDrives.map((d) => path.join(d, "Desktop"))];
    case 12: // USER_APP_SUPPORT
      return getProPresenterAppDataDirs();
    case 1: // BOOT_VOLUME
      return [process.platform === "win32" ? "C:\\" : "/"];
    default:
      return extraSearchDirs;
  }
}

function extractUrlFields(urlBuf) {
  if (!urlBuf) return { absolutePath: "", relativePath: "", localRoot: 0 };
  const fields = parseProtoFields(urlBuf);
  const absolutePath = getField(fields, 1)?.val?.toString("utf8") || "";
  const directRelative = getField(fields, 2)?.val?.toString("utf8") || "";
  const localMsg = getField(fields, 4);
  let relativePath = directRelative;
  let localRoot = 0;
  if (localMsg) {
    const lf = parseProtoFields(localMsg.val);
    localRoot = Number(getField(lf, 1)?.val ?? 0);
    const localPath = getField(lf, 2)?.val?.toString("utf8") || "";
    if (localPath) relativePath = localPath;
  }
  return { absolutePath, relativePath, localRoot };
}

function normalizeFsCandidate(rawPath) {
  if (!rawPath) return "";
  let s = String(rawPath).trim();
  if (/^file:\/\//i.test(s)) {
    try {
      s = decodeURIComponent(s.replace(/^file:\/\/\/?/i, ""));
      if (process.platform === "win32" && /^\/[a-zA-Z]:/.test(s)) {
        s = s.slice(1);
      }
    } catch (_) {}
  } else if (/%[0-9a-fA-F]{2}/.test(s)) {
    try {
      s = decodeURIComponent(s);
    } catch (_) {}
  }
  return s.replace(/[\\/]+/g, path.sep);
}

function resolveExistingFile(absolutePath, relativePath, extraSearchDirs = [], localRoot = 0) {
  const candidates = [];
  const pushCand = (p) => {
    if (p && !candidates.includes(p)) candidates.push(p);
  };
  const normRel = normalizeFsCandidate(relativePath).replace(/^[\\/]+/, "");
  const normAbs = normalizeFsCandidate(absolutePath);

  if (normRel) {
    const rootDirs = localRoot ? getLocalRootBaseDirs(localRoot, extraSearchDirs) : [];
    for (const dir of [...extraSearchDirs, ...rootDirs]) {
      if (dir) {
        pushCand(path.join(dir, normRel));
      }
    }
  }
  if (normAbs) {
    pushCand(normAbs);
  }
  // Last-resort basename match inside workspace Media/Assets if absolutePath came from another machine
  if (normAbs || normRel) {
    const baseName = path.basename(normRel || normAbs);
    if (baseName) {
      for (const dir of extraSearchDirs) {
        if (!dir) continue;
        pushCand(path.join(dir, "Media", "Assets", baseName));
        pushCand(path.join(dir, "Media", baseName));
      }
    }
  }
  for (const cand of candidates) {
    if (cand && fs.existsSync(cand)) return cand;
  }
  return null;
}

function decodeMediaVideoProperties(mfFields) {
  let objectFit = "contain";
  let loop = false;
  let clearOnEnd = false;

  // Graphics.Media: field 4 = ImageTypeProperties, field 6 (or 5) = VideoTypeProperties
  const imagePropsField = getField(mfFields, 4);
  const videoPropsField = getField(mfFields, 6) || getField(mfFields, 5);
  const propsBuf = videoPropsField?.val || imagePropsField?.val;

  if (propsBuf && Buffer.isBuffer(propsBuf)) {
    try {
      const vpf = parseProtoFields(propsBuf);
      // field 1 = DrawingProperties (field 1 = scale_behavior: 0=FIT/contain, 1=FILL/cover, 2=STRETCH/fill)
      const drawingField = getField(vpf, 1);
      if (drawingField?.val && Buffer.isBuffer(drawingField.val)) {
        const df = parseProtoFields(drawingField.val);
        const sb = Number(getField(df, 1)?.val ?? 0);
        if (sb === 1) objectFit = "cover";
        else if (sb === 2) objectFit = "fill";
        else objectFit = "contain";
      }

      // field 3 = TransportProperties (field 15 = end_behavior: 0=STOP, 1=LOOP, 2=STOP_ON_BLACK, 3=STOP_ON_CLEAR, 4=FADE_TO_BLACK, 5=FADE_TO_CLEAR)
      const transportField = getField(vpf, 3);
      if (transportField?.val && Buffer.isBuffer(transportField.val)) {
        const tf = parseProtoFields(transportField.val);
        const endBehavior = getField(tf, 15)?.val;
        if (endBehavior !== undefined) {
          const eb = Number(endBehavior);
          loop = eb === 1;
          clearOnEnd = eb === 3 || eb === 5;
        }
      }
    } catch (_) {}
  }

  return { objectFit, loop, clearOnEnd };
}

function resolveMediaFill(urlBuf, baseFolders, mediaProps = {}) {
  const { absolutePath, relativePath, localRoot } = extractUrlFields(urlBuf);
  const found = resolveExistingFile(absolutePath, relativePath, baseFolders, localRoot);
  if (!found) return null;

  const ext = path.extname(found).toLowerCase();
  if (isVideoExtension(ext)) {
    const playable = resolvePlayableVideoSync(found);
    return {
      enabled: true,
      type: "media",
      mediaType: "video",
      sourceFilePath: found,
      filePath: playable?.filePath || found,
      fileUrl: playable?.fileUrl || pathToFileURL(found).href,
      isTranscoded: Boolean(playable?.isTranscoded),
      isPendingTranscode: Boolean(playable?.isPendingTranscode),
      objectFit: mediaProps.objectFit || "contain",
      loop: Boolean(mediaProps.loop),
      clearOnEnd: Boolean(mediaProps.clearOnEnd)
    };
  }

  const dataUrl = loadImageDataUrl(found);
  return {
    enabled: true,
    type: "media",
    mediaType: "image",
    dataUrl,
    sourceFilePath: found,
    filePath: found,
    fileUrl: pathToFileURL(found).href,
    objectFit: mediaProps.objectFit || "contain"
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
    const mediaProps = decodeMediaVideoProperties(mf);
    const mediaFill = resolveMediaFill(urlField?.val, baseFolders, mediaProps);
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
    const color = decodeColor(colorField.val);
    if (color.a <= 0.001) {
      return { enabled: false };
    }
    return {
      enabled: true,
      type: "color",
      color
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

const RTF_SUPERSCRIPT_DIGITS = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹"
};

function decodeRtfPlainText(rtfStr, rawLineDomFs = null) {
  const stripped = rtfStr
    .replace(/\{\\fonttbl[\s\S]*?\}/g, "")
    .replace(/\{\\colortbl[\s\S]*?\}/g, "")
    .replace(/\{\\\*\\[^}]*\}/g, "");

  let out = "";
  let uc = 1;
  let i = 0;
  let rawLineIdx = 0;
  const runStack = [];
  let run = { super: false, up: 0, fontSize: null };

  const emitText = (txt) => {
    if (!txt) return;
    const lineDom = Array.isArray(rawLineDomFs) ? rawLineDomFs[rawLineIdx] : null;
    const isSmallerInlineRun =
      Boolean(lineDom && lineDom > 0 && run.fontSize && run.fontSize > 0 && run.fontSize <= lineDom * 0.82);
    const shouldSuperscriptDigits = Boolean(run.super || run.up >= 3 || isSmallerInlineRun);
    if (!shouldSuperscriptDigits) {
      out += txt;
      return;
    }
    for (const c of txt) {
      out += RTF_SUPERSCRIPT_DIGITS[c] || c;
    }
  };

  while (i < stripped.length) {
    const ch = stripped[i];
    if (ch === "{") {
      runStack.push({ ...run });
      i++;
      continue;
    }
    if (ch === "}") {
      if (runStack.length > 0) run = runStack.pop();
      i++;
      continue;
    }
    if (ch !== "\\") {
      emitText(ch);
      i++;
      continue;
    }

    const next = stripped[i + 1];
    if (next === undefined) break;
    if (next === "\\" || next === "{" || next === "}") {
      emitText(next);
      i += 2;
      continue;
    }
    if (next === "~") {
      out += "\u00a0";
      i += 2;
      continue;
    }
    if (next === "-" || next === "_") {
      emitText(next === "_" ? "-" : "");
      i += 2;
      continue;
    }
    if (next === "\r" || next === "\n") {
      out += "\n";
      rawLineIdx++;
      i += next === "\r" && stripped[i + 2] === "\n" ? 3 : 2;
      continue;
    }
    if (next === "'") {
      const hex = stripped.slice(i + 2, i + 4);
      if (/^[0-9a-fA-F]{2}$/.test(hex)) {
        const code = parseInt(hex, 16);
        emitText(WIN1252_EXTRA[code] || String.fromCharCode(code));
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
      } else if (word === "fs" && param && param > 0) {
        run.fontSize = param / 2;
      } else if (word === "super") {
        run.super = param === null ? true : param !== 0;
      } else if (word === "nosupersub" || word === "sub" || word === "plain") {
        run.super = false;
        run.up = 0;
      } else if (word === "up") {
        run.up = param !== null ? param : 6;
      } else if (word === "dn") {
        run.up = 0;
      } else if (word === "u" && param !== null) {
        const code = param < 0 ? param + 65536 : param;
        emitText(String.fromCharCode(code));
        // Skip uc fallback characters (typically '?')
        let skipped = 0;
        while (skipped < uc && i < stripped.length && stripped[i] !== "\\" && stripped[i] !== "{" && stripped[i] !== "}") {
          i++;
          skipped++;
        }
      } else if (word === "par" || word === "line") {
        out += "\n";
        rawLineIdx++;
      } else if (word === "tab") {
        out += "\t";
      } else if (word === "endash") {
        emitText("\u2013");
      } else if (word === "emdash") {
        emitText("\u2014");
      } else if (word === "lquote") {
        emitText("\u2018");
      } else if (word === "rquote") {
        emitText("\u2019");
      } else if (word === "ldblquote") {
        emitText("\u201c");
      } else if (word === "rdblquote") {
        emitText("\u201d");
      } else if (word === "bullet") {
        emitText("\u2022");
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

  // Parse font table entries (\f0, \f1, ...)
  const fontTable = new Map();
  const fontTblBlock = rtfStr.match(/\{\\fonttbl([\s\S]*?)\}(?=\s*[\{\\]|$)/);
  if (fontTblBlock) {
    const fontEntries = fontTblBlock[1].matchAll(/\\f(\d+)(?:\\f\w+)?(?:\s*|\\[a-zA-Z]+-?\d*\s*)*([^;{}]+);/g);
    for (const m of fontEntries) {
      fontTable.set(Number(m[1]), m[2].trim());
    }
  }
  if (fontTable.size === 0) {
    const fontMatch = rtfStr.match(/\\fonttbl\\f0\\f\w+\s+([^;{}]+);/);
    if (fontMatch) fontTable.set(0, fontMatch[1].trim());
  }
  if (fontTable.has(0)) {
    meta.fontPostscript = fontTable.get(0);
  }

  // Parse color table entries (\cf1 -> index 0, \cf2 -> index 1, ...)
  const colorTable = [];
  const colortblMatch = rtfStr.match(/\{\\colortbl;([^}]*)\}/);
  if (colortblMatch) {
    const rawEntries = colortblMatch[1].split(";");
    for (const entry of rawEntries) {
      if (!entry.includes("\\red")) continue;
      const r = Number(entry.match(/\\red(\d+)/)?.[1] ?? 255);
      const g = Number(entry.match(/\\green(\d+)/)?.[1] ?? 255);
      const b = Number(entry.match(/\\blue(\d+)/)?.[1] ?? 255);
      colorTable.push({ r, g, b, a: 1, css: `rgba(${r}, ${g}, ${b}, 1)` });
    }
  }

  // Walk visible text runs to measure dominant (most non-whitespace characters) font size, font, color, bold, italic, alignment
  const stripped = rtfStr
    .replace(/\{\\fonttbl[\s\S]*?\}/g, "")
    .replace(/\{\\colortbl[\s\S]*?\}/g, "")
    .replace(/\{\\\*\\[^}]*\}/g, "");

  const stateStack = [];
  let state = {
    fontIdx: 0,
    fontSize: null,
    bold: false,
    italic: false,
    colorIdx: null,
    align: null,
    sl: null,
    slmult: 0,
    slleading: null,
    sa: null,
    sb: null,
    super: false,
    up: 0
  };

  const fsWeights = new Map();
  const rawLineFsWeights = [new Map()];
  const rawLineHasVisible = [false];
  let rawLineIdx = 0;
  const fontWeights = new Map();
  const colorWeights = new Map();
  const alignWeights = new Map();
  const lhmWeights = new Map();
  const exactLhWeights = new Map();
  const minLhWeights = new Map();
  const lineSpacingWeights = new Map();
  const paraAfterWeights = new Map();
  const paraBeforeWeights = new Map();
  let boldWeight = 0;
  let nonBoldWeight = 0;
  let italicWeight = 0;
  let nonItalicWeight = 0;
  let visibleCharCount = 0;
  let sawAnyFs = null;
  let sawAnyAlign = null;
  let sawAnyCf = null;

  const advanceRawLine = () => {
    rawLineIdx++;
    if (!rawLineFsWeights[rawLineIdx]) {
      rawLineFsWeights[rawLineIdx] = new Map();
      rawLineHasVisible[rawLineIdx] = false;
    }
  };

  const tallyVisibleChar = (ch) => {
    if (!ch || /\s/.test(ch)) return;
    visibleCharCount++;
    rawLineHasVisible[rawLineIdx] = true;
    const isSuperRun = Boolean(state.super || state.up >= 3);
    if (!isSuperRun && state.fontSize && state.fontSize > 0) {
      fsWeights.set(state.fontSize, (fsWeights.get(state.fontSize) || 0) + 1);
      const lm = rawLineFsWeights[rawLineIdx];
      lm.set(state.fontSize, (lm.get(state.fontSize) || 0) + 1);
    }
    const fName = fontTable.get(state.fontIdx);
    if (fName) {
      fontWeights.set(fName, (fontWeights.get(fName) || 0) + 1);
    }
    if (state.colorIdx !== null && colorTable[state.colorIdx]) {
      colorWeights.set(state.colorIdx, (colorWeights.get(state.colorIdx) || 0) + 1);
    }
    if (state.align) {
      alignWeights.set(state.align, (alignWeights.get(state.align) || 0) + 1);
    }
    if (state.sl !== null && state.sl > 0 && state.slmult === 1) {
      const multVal = Number((state.sl / 240).toFixed(4));
      lhmWeights.set(multVal, (lhmWeights.get(multVal) || 0) + 1);
    } else if (state.sl !== null && state.sl < 0 && state.slmult !== 1) {
      const exactVal = Number((Math.abs(state.sl) / 20).toFixed(3));
      exactLhWeights.set(exactVal, (exactLhWeights.get(exactVal) || 0) + 1);
    } else if (state.sl !== null && state.sl > 20 && state.slmult !== 1) {
      const minVal = Number((state.sl / 20).toFixed(3));
      minLhWeights.set(minVal, (minLhWeights.get(minVal) || 0) + 1);
    }
    if (state.slleading !== null) {
      const lsVal = Number((state.slleading / 20).toFixed(3));
      lineSpacingWeights.set(lsVal, (lineSpacingWeights.get(lsVal) || 0) + 1);
    }
    if (state.sa !== null) {
      const saVal = Number((state.sa / 20).toFixed(3));
      paraAfterWeights.set(saVal, (paraAfterWeights.get(saVal) || 0) + 1);
    }
    if (state.sb !== null) {
      const sbVal = Number((state.sb / 20).toFixed(3));
      paraBeforeWeights.set(sbVal, (paraBeforeWeights.get(sbVal) || 0) + 1);
    }
    if (state.bold) boldWeight++;
    else nonBoldWeight++;
    if (state.italic) italicWeight++;
    else nonItalicWeight++;
  };

  let uc = 1;
  let i = 0;
  while (i < stripped.length) {
    const ch = stripped[i];
    if (ch === "{") {
      stateStack.push({ ...state });
      i++;
      continue;
    }
    if (ch === "}") {
      if (stateStack.length > 0) state = stateStack.pop();
      i++;
      continue;
    }
    if (ch !== "\\") {
      tallyVisibleChar(ch);
      i++;
      continue;
    }
    const next = stripped[i + 1];
    if (next === undefined) break;
    if (next === "\\" || next === "{" || next === "}") {
      tallyVisibleChar(next);
      i += 2;
      continue;
    }
    if (next === "'" && /^[0-9a-fA-F]{2}$/.test(stripped.slice(i + 2, i + 4))) {
      tallyVisibleChar("x");
      i += 4;
      continue;
    }
    if (next === "\r" || next === "\n" || next === "~" || next === "-" || next === "_") {
      if (next === "\r" || next === "\n") advanceRawLine();
      i += next === "\r" && stripped[i + 2] === "\n" ? 3 : 2;
      continue;
    }
    const m = stripped.slice(i).match(/^\\([a-zA-Z]+)(-?\d+)? ?/);
    if (m) {
      const word = m[1];
      const param = m[2] !== undefined ? Number(m[2]) : null;
      i += m[0].length;
      if (word === "fs" && param && param > 0) {
        state.fontSize = param / 2;
        sawAnyFs = state.fontSize;
      } else if (word === "f" && param !== null) {
        state.fontIdx = param;
      } else if (word === "b") {
        state.bold = param === null ? true : param !== 0;
      } else if (word === "i") {
        state.italic = param === null ? true : param !== 0;
      } else if (word === "super") {
        state.super = param === null ? true : param !== 0;
      } else if (word === "nosupersub" || word === "sub") {
        state.super = false;
        state.up = 0;
      } else if (word === "up") {
        state.up = param !== null ? param : 6;
      } else if (word === "dn") {
        state.up = 0;
      } else if (word === "plain") {
        state.bold = false;
        state.italic = false;
        state.super = false;
        state.up = 0;
      } else if (word === "par" || word === "line") {
        advanceRawLine();
      } else if (word === "pard") {
        state.align = null;
        state.sl = null;
        state.slmult = 0;
        state.slleading = null;
        state.sa = null;
        state.sb = null;
      } else if (word === "sl" && param !== null) {
        state.sl = param;
      } else if (word === "slmult") {
        state.slmult = param === null ? 1 : param;
      } else if (word === "slleading" && param !== null) {
        state.slleading = param;
      } else if (word === "sa" && param !== null) {
        state.sa = param;
      } else if (word === "sb" && param !== null) {
        state.sb = param;
      } else if (word === "cf" && param !== null && param > 0) {
        state.colorIdx = param - 1;
        sawAnyCf = param - 1;
      } else if (word === "qc") {
        state.align = "center";
        sawAnyAlign = "center";
      } else if (word === "qr") {
        state.align = "right";
        sawAnyAlign = "right";
      } else if (word === "qj") {
        state.align = "justify";
        sawAnyAlign = "justify";
      } else if (word === "ql") {
        state.align = "left";
        sawAnyAlign = "left";
      } else if (word === "uc" && param !== null) {
        uc = Math.max(0, param);
      } else if (word === "u" && param !== null) {
        tallyVisibleChar("x");
        let skipped = 0;
        while (skipped < uc && i < stripped.length && stripped[i] !== "\\" && stripped[i] !== "{" && stripped[i] !== "}") {
          i++;
          skipped++;
        }
      }
      continue;
    }
    i += 2;
  }

  const pickTop = (weightsMap) => {
    let bestKey = null;
    let bestCount = -1;
    for (const [k, c] of weightsMap.entries()) {
      if (c > bestCount) {
        bestCount = c;
        bestKey = k;
      }
    }
    return bestKey;
  };

  const domFs = pickTop(fsWeights);
  if (domFs && domFs > 0) {
    meta.fontSize = domFs;
    meta.hasDominantFontSize = true;
  } else if (sawAnyFs && sawAnyFs > 0) {
    meta.fontSize = sawAnyFs;
  }

  const domFont = pickTop(fontWeights);
  if (domFont) {
    meta.fontPostscript = domFont;
    meta.hasDominantFont = true;
  }

  const domAlign = pickTop(alignWeights) || sawAnyAlign;
  if (domAlign) {
    meta.textAlign = domAlign;
    meta.hasDominantAlign = alignWeights.size > 0;
  }

  if (visibleCharCount > 0) {
    meta.bold = boldWeight > nonBoldWeight;
    meta.hasDominantBold = true;
    meta.italic = italicWeight > nonItalicWeight;
    meta.hasDominantItalic = true;
  } else {
    if (/\\b(?![0-9a-zA-Z])/.test(rtfStr)) meta.bold = true;
    if (/\\i(?![0-9a-zA-Z])/.test(rtfStr)) meta.italic = true;
  }

  const domColorIdx = pickTop(colorWeights);
  const chosenColor =
    domColorIdx !== null
      ? colorTable[domColorIdx]
      : sawAnyCf !== null
      ? colorTable[sawAnyCf]
      : colorTable[0];
  if (chosenColor) {
    meta.textColor = chosenColor;
    meta.hasDominantColor = domColorIdx !== null;
  }

  const domLhm = pickTop(lhmWeights);
  if (domLhm !== null && domLhm > 0) meta.lineHeightMultiple = domLhm;
  const domExactLh = pickTop(exactLhWeights);
  if (domExactLh !== null && domExactLh > 0) meta.exactLineHeight = domExactLh;
  const domMinLh = pickTop(minLhWeights);
  if (domMinLh !== null && domMinLh > 1) meta.minimumLineHeight = domMinLh;
  const domLineSpacing = pickTop(lineSpacingWeights);
  if (domLineSpacing !== null) meta.lineSpacing = domLineSpacing;
  const domParaAfter = pickTop(paraAfterWeights);
  if (domParaAfter !== null && domParaAfter >= 0) meta.paragraphSpacing = domParaAfter;
  const domParaBefore = pickTop(paraBeforeWeights);
  if (domParaBefore !== null && domParaBefore >= 0) meta.paragraphSpacingBefore = domParaBefore;

  const rawLineDomFs = rawLineFsWeights.map((m) => pickTop(m));
  meta.plainText = decodeRtfPlainText(rtfStr, rawLineDomFs);
  meta.hasVisibleText = visibleCharCount > 0;

  if (meta.fontSize && meta.fontSize > 0 && meta.plainText) {
    let firstVis = 0;
    while (firstVis < rawLineHasVisible.length && !rawLineHasVisible[firstVis]) firstVis++;
    let lastVis = rawLineHasVisible.length - 1;
    while (lastVis >= firstVis && !rawLineHasVisible[lastVis]) lastVis--;
    const trimmedLineDomFs = rawLineDomFs.slice(firstVis, lastVis + 1);
    const plainLines = meta.plainText.split("\n");
    if (trimmedLineDomFs.length > 1 && trimmedLineDomFs.length === plainLines.length) {
      const scales = trimmedLineDomFs.map((lfs) =>
        lfs && lfs > 0 ? Number((lfs / meta.fontSize).toFixed(4)) : 1
      );
      if (scales.some((s) => Math.abs(s - 1) >= 0.03)) {
        meta.lineFontScales = scales;
      }
    }
  }

  return meta;
}

function mapFontWeight(styleName, boldFlag, postscript) {
  const sty = String(styleName || "").trim().toLowerCase();
  if (sty) {
    if (sty.includes("black") || sty.includes("heavy")) return 900;
    if (sty.includes("extrabold") || sty.includes("ultrabold")) return 800;
    if (sty.includes("semibold") || sty.includes("demibold")) return 600;
    if (sty.includes("bold")) return 700;
    if (sty.includes("medium")) return 500;
    if (sty.includes("light")) return 300;
    if (sty.includes("thin") || sty.includes("hairline")) return 100;
    if (
      sty.includes("regular") ||
      sty.includes("normal") ||
      sty.includes("book") ||
      sty.includes("roman") ||
      sty === "italic" ||
      sty === "oblique"
    ) {
      return boldFlag ? 700 : 400;
    }
  }

  const ps = String(postscript || "").toLowerCase();
  if (ps.includes("black") || ps.includes("heavy")) return 900;
  if (ps.includes("extrabold") || ps.includes("ultrabold")) return 800;
  if (ps.includes("semibold") || ps.includes("demibold")) return 600;
  if (ps.includes("bold")) return 700;
  if (ps.includes("medium")) return 500;
  if (ps.includes("light")) return 300;
  if (ps.includes("thin") || ps.includes("hairline")) return 100;
  return boldFlag ? 700 : 400;
}

function buildFontFamilyStack(fontFamily, fontPostscript) {
  const candidates = [];
  const add = (name) => {
    const clean = String(name || "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
    if (clean && !candidates.includes(clean)) candidates.push(clean);
  };

  const stripStyleSuffix = (s) =>
    String(s || "")
      .replace(/_/g, "-")
      .replace(
        /-(Regular|Bold|ExtraBold|UltraBold|Black|Heavy|SemiBold|DemiBold|Medium|Light|ExtraLight|UltraLight|Thin|Italic|BoldItalic|Oblique|Book|Roman|CondBold|Cond|Condensed|Narrow|Extended)$/i,
        ""
      )
      .replace(/MT$/i, "")
      .trim();

  // Convert PostScript / camelCase names into spaced Windows DirectWrite / macOS family names
  // e.g. "BerlinSansFBDemi" -> "Berlin Sans FB Demi", "BritannicBold" -> "Britannic Bold"
  const splitCamel = (s) =>
    String(s || "")
      .replace(/_/g, " ")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim();

  const famNoSuffix = stripStyleSuffix(fontFamily);
  const psNoSuffix = stripStyleSuffix(fontPostscript);
  const spacedFam = splitCamel(famNoSuffix);
  const spacedPs = splitCamel(psNoSuffix);
  const stripTrailingWeight = (s) =>
    String(s || "")
      .replace(
        /\s+(Extra\s*Bold|Ultra\s*Bold|Semi\s*Bold|Demi\s*Bold|Extra\s*Light|Ultra\s*Light|ExtraBold|UltraBold|Black|Heavy|SemiBold|DemiBold|Demi|Bold|Light|Medium|Thin|Regular|Book|Roman|Italic|Oblique)$/i,
        ""
      )
      .trim();

  // Prioritize spaced family names first (matches Windows DirectWrite & macOS CoreText reliably)
  add(spacedFam);
  add(spacedPs);
  add(fontFamily);
  add(splitCamel(fontFamily));
  add(famNoSuffix);
  add(psNoSuffix);
  add(fontPostscript);
  add(stripTrailingWeight(spacedFam));
  add(stripTrailingWeight(spacedPs));

  return candidates.map((f) => `"${f}"`).join(", ") + ", sans-serif";
}

function normalizeFontCompareKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "")
    .replace(/(mt|regular|bold|italic|oblique|semibold|demibold|extrabold|ultrabold|black|heavy|medium|light|thin)$/g, "");
}

function decodeScaleBehavior(rawVal) {
  const num = Number(rawVal ?? 0);
  if (num === 1) return "adjust-container-height";
  if (num === 2) return "scale-down";
  if (num === 3) return "scale-up";
  if (num === 4) return "scale-up-down";
  return "none";
}

function decodeTextElement(buf) {
  if (!buf) return null;
  const fields = parseProtoFields(buf);
  const rtfStr = getField(fields, 5)?.val?.toString("utf8") || "";
  const rtfMeta = parseRtfMetadata(rtfStr);

  const vaRaw = getField(fields, 6)?.val ?? 0;
  const verticalAlignment = vaRaw === 1 ? "middle" : vaRaw === 2 ? "bottom" : "top";
  const scaleBehavior = decodeScaleBehavior(getField(fields, 7)?.val ?? 0);

  const marginsField = getField(fields, 14) || getField(fields, 8);
  let margins = { left: 0, right: 0, top: 0, bottom: 0 };
  if (marginsField && marginsField.wt === 2) {
    try {
      const mf = parseProtoFields(marginsField.val);
      margins = {
        left: getField(mf, 1)?.val ?? 0,
        right: getField(mf, 2)?.val ?? 0,
        top: getField(mf, 3)?.val ?? 0,
        bottom: getField(mf, 4)?.val ?? 0
      };
    } catch (_) {}
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
  let lineSpacing = 0;
  let minimumLineHeight = 0;
  let maximumLineHeight = 0;
  let exactLineHeight = 0;
  let paragraphSpacing = 0;
  let paragraphSpacingBefore = 0;
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

      // Prefer dominant RTF formatting when RTF has actual styled text, because ProPresenter's editor
      // updates rtf_data (\fs, \f, \cf, \b, \i) while attrField often retains stale template defaults.
      const rtfHasDifferentFont =
        rtfMeta.hasDominantFont &&
        rtfMeta.fontPostscript &&
        (fam || ps) &&
        normalizeFontCompareKey(rtfMeta.fontPostscript) !== normalizeFontCompareKey(fam || ps);

      if (!rtfHasDifferentFont) {
        if (ps) fontPostscript = ps;
        if (fam) fontFamily = fam;
        else if (ps) fontFamily = ps;
        if (sty) fontStyleName = sty;
      }

      if (!rtfMeta.hasDominantFontSize && sz && sz > 0) {
        fontSize = sz;
      }
      if (!rtfMeta.hasDominantBold && bold !== undefined) {
        boldFlag = Boolean(bold);
      }
      if (!rtfMeta.hasDominantItalic && italic !== undefined) {
        italicFlag = Boolean(italic);
      }
    }

    const capRaw = getField(af, 2)?.val ?? 0;
    if (capRaw === 1) capitalization = "uppercase";
    else if (capRaw === 2) capitalization = "lowercase";
    else if (capRaw === 3) capitalization = "capitalize";

    const fgColorField = getField(af, 3);
    if (fgColorField && !rtfMeta.hasDominantColor) {
      textColor = decodeColor(fgColorField.val);
    }

    const paraField = getField(af, 6);
    if (paraField) {
      const pf = parseProtoFields(paraField.val);
      if (!rtfMeta.hasDominantAlign) {
        const alignRaw = getField(pf, 1)?.val ?? 0;
        textAlign = alignRaw === 1 ? "right" : alignRaw === 2 ? "center" : alignRaw === 3 ? "justify" : "left";
      }
      const lhm = getField(pf, 5)?.val;
      if (typeof lhm === "number" && lhm > 0) lineHeightMultiple = lhm;
      const maxLh = getField(pf, 6)?.val;
      if (typeof maxLh === "number" && maxLh > 0) maximumLineHeight = maxLh;
      const minLh = getField(pf, 7)?.val;
      if (typeof minLh === "number" && minLh > 1) minimumLineHeight = minLh;
      const ls = getField(pf, 8)?.val;
      if (typeof ls === "number" && Number.isFinite(ls)) lineSpacing = ls;
      const pAfter = getField(pf, 9)?.val;
      if (typeof pAfter === "number" && pAfter > 0) paragraphSpacing = pAfter;
      const pBefore = getField(pf, 10)?.val;
      if (typeof pBefore === "number" && pBefore > 0) paragraphSpacingBefore = pBefore;
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

  if (rtfMeta.hasVisibleText || !attrField) {
    if (
      typeof rtfMeta.lineHeightMultiple === "number" &&
      rtfMeta.lineHeightMultiple > 0 &&
      Math.abs(rtfMeta.lineHeightMultiple - 1) > 0.001
    ) {
      lineHeightMultiple = rtfMeta.lineHeightMultiple;
    }
    if (typeof rtfMeta.exactLineHeight === "number" && rtfMeta.exactLineHeight > 0) {
      exactLineHeight = rtfMeta.exactLineHeight;
    }
    if (
      typeof rtfMeta.minimumLineHeight === "number" &&
      rtfMeta.minimumLineHeight > 1 &&
      minimumLineHeight <= 0
    ) {
      minimumLineHeight = rtfMeta.minimumLineHeight;
    }
    if (typeof rtfMeta.lineSpacing === "number" && Number.isFinite(rtfMeta.lineSpacing)) {
      lineSpacing = rtfMeta.lineSpacing;
    }
    if (typeof rtfMeta.paragraphSpacing === "number" && rtfMeta.paragraphSpacing > 0) {
      paragraphSpacing = rtfMeta.paragraphSpacing;
    }
    if (typeof rtfMeta.paragraphSpacingBefore === "number" && rtfMeta.paragraphSpacingBefore > 0) {
      paragraphSpacingBefore = rtfMeta.paragraphSpacingBefore;
    }
  }

  const fontWeight = mapFontWeight(fontStyleName, boldFlag, fontPostscript);
  const fontItalic = italicFlag || /italic|oblique/i.test(`${fontStyleName} ${fontPostscript}`);

  return {
    plainText: rtfMeta.plainText || "",
    verticalAlignment,
    scaleBehavior,
    margins,
    fontFamily: buildFontFamilyStack(fontFamily, fontPostscript),
    fontSize,
    fontWeight,
    fontItalic,
    capitalization,
    textColor,
    textAlign,
    lineHeightMultiple,
    lineSpacing,
    minimumLineHeight,
    maximumLineHeight,
    exactLineHeight,
    paragraphSpacing,
    paragraphSpacingBefore,
    lineFontScales: rtfMeta.lineFontScales || null,
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
const VIDEO_EXTS = new Set([".mp4", ".m4v", ".webm", ".mov", ".mkv", ".avi", ".wmv"]);

function classifyMediaFile(filePath, codec = "") {
  const ext = path.extname(filePath || "").toLowerCase();
  if (IMAGE_EXTS.has(ext) || /^(png|jpeg|jpg|webp|gif)$/i.test(codec)) return "image";
  if (VIDEO_EXTS.has(ext) || /^(h264|hevc|h265|vp8|vp9|av1|prores|mp4|wmv)$/i.test(codec)) return "video";
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
  const { absolutePath, relativePath, localRoot } = extractUrlFields(urlField?.val);
  const metadataMsg = getField(mf, 3);
  let codec = "";
  if (metadataMsg) {
    const mdf = parseProtoFields(metadataMsg.val);
    codec = getField(mdf, 5)?.val?.toString("utf8") || "";
  }

  const found = resolveExistingFile(absolutePath, relativePath, searchDirs, localRoot);
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
const themesCatalogCache = new Map();
const layoutMatchCache = new Map();
const presentationCache = new Map();
const mediaPlaylistCache = new Map();

const THEME_CATALOG_TTL_MS = 1800;
const PRES_STAT_TTL_MS = 350;

const NON_THEME_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".svg",
  ".mp4", ".m4v", ".webm", ".mov", ".mkv", ".avi", ".wmv",
  ".mp3", ".wav", ".aac", ".flac", ".json", ".txt", ".xml", ".plist", ".ds_store"
]);

function collectThemeFiles(dir, out = []) {
  if (!dir || !fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectThemeFiles(full, out);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      // Support both folder-based "Themes/<Name>/Theme" and single-file "Themes/<Name>" or ".proTheme"
      if (entry.name === "Theme" || ext === ".protheme" || (ext === "" && !NON_THEME_EXTS.has(ext))) {
        out.push(full);
      }
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

function getWorkspaceThemesCatalog(workspaceDirs) {
  const key = (workspaceDirs || []).join("|");
  const now = Date.now();
  const cached = themesCatalogCache.get(key);
  if (cached && now - cached.ts < THEME_CATALOG_TTL_MS) {
    return cached;
  }

  const slidesByUuid = new Map();
  const allSlides = [];
  let stampParts = [];

  for (const ws of workspaceDirs || []) {
    const themesDir = path.join(ws, "Themes");
    const files = collectThemeFiles(themesDir);
    for (const file of files) {
      try {
        const parsed = parseThemeFile(file, workspaceDirs);
        stampParts.push(`${file}:${parsed.mtimeMs}`);
        for (const [uuid, entry] of parsed.slidesByUuid.entries()) {
          if (!slidesByUuid.has(uuid)) {
            slidesByUuid.set(uuid, entry);
          }
          allSlides.push(entry);
        }
      } catch (_) {}
    }
  }

  const versionStamp = stampParts.join(";");
  if (cached && cached.versionStamp !== versionStamp) {
    layoutMatchCache.clear();
  }

  const catalog = {
    ts: now,
    versionStamp,
    slidesByUuid,
    allSlides
  };
  themesCatalogCache.set(key, catalog);
  return catalog;
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

function buildLayoutSignature(slideTbs) {
  return slideTbs
    .map((stb) => {
      const b = stb.bounds || {};
      return `${Math.round(b.x || 0)},${Math.round(b.y || 0)},${Math.round(b.width || 0)},${Math.round(b.height || 0)},${stb.fill?.enabled ? 1 : 0},${Math.round(stb.text?.fontSize || 0)},${stb.text?.fontFamily || ""}`;
    })
    .join("|");
}

function findMatchingThemeByLayout(slideLayout, workspaceDirs) {
  const slideTbs = (slideLayout?.elements || []).filter((el) => el.isTextBox && el.text);
  if (slideTbs.length === 0) return null;

  const catalog = getWorkspaceThemesCatalog(workspaceDirs);
  const cacheKey = `${catalog.versionStamp}::${buildLayoutSignature(slideTbs)}`;
  if (layoutMatchCache.has(cacheKey)) {
    return layoutMatchCache.get(cacheKey);
  }

  let best = null;
  let bestScore = -1;

  for (const entry of catalog.allSlides) {
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

  if (layoutMatchCache.size > 512) layoutMatchCache.clear();
  layoutMatchCache.set(cacheKey, best);
  return best;
}

function findThemeSlideByUuid(themeSlideUuid, workspaceDirs) {
  const target = normalizeUuid(themeSlideUuid);
  if (!target) return null;
  const catalog = getWorkspaceThemesCatalog(workspaceDirs);
  return catalog.slidesByUuid.get(target) || null;
}

function decodeSinglePresentationCue(cf, presDir, workspaceDirs) {
  const name = getField(cf, 2)?.val?.toString("utf8") || "";
  let layout = null;
  let cueMedia = null;
  let cueSlideTransition = null;
  const videosToPrewarm = [];

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
                videosToPrewarm.push(el.fill.filePath);
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
        videosToPrewarm.push(cueMedia.filePath);
      }
    }
  }

  if (videosToPrewarm.length > 0) {
    setImmediate(() => {
      for (const vp of videosToPrewarm) {
        prewarmVideoAsync(vp);
      }
    });
  }

  if (!layout && !cueMedia && !cueSlideTransition) return null;
  return { name, layout, cueMedia, cueSlideTransition };
}

function findPresentationCueData(presentationPath, cueUuid, workspaceDirs) {
  const target = normalizeUuid(cueUuid);
  if (!presentationPath || !target) return null;

  const now = Date.now();
  let cached = presentationCache.get(presentationPath);

  if (!cached || now - cached.lastStatAt >= PRES_STAT_TTL_MS) {
    if (!fs.existsSync(presentationPath)) return null;
    const stat = fs.statSync(presentationPath);
    if (!cached || cached.mtimeMs !== stat.mtimeMs) {
      const buf = fs.readFileSync(presentationPath);
      const presFields = parseProtoFields(buf);
      const presDir = path.dirname(presentationPath);
      const rawCuesByUuid = new Map();

      for (const cueField of getAllFields(presFields, 13)) {
        try {
          const cf = parseProtoFields(cueField.val);
          const uuid = decodeUuid(getField(cf, 1)?.val);
          if (uuid) {
            rawCuesByUuid.set(uuid, cf);
          }
        } catch (_) {}
      }

      cached = {
        mtimeMs: stat.mtimeMs,
        lastStatAt: now,
        presDir,
        rawCuesByUuid,
        decodedCuesByUuid: new Map()
      };
      presentationCache.set(presentationPath, cached);
    } else {
      cached.lastStatAt = now;
    }
  }

  if (!cached.decodedCuesByUuid.has(target)) {
    const rawCf = cached.rawCuesByUuid.get(target);
    const decoded = rawCf
      ? decodeSinglePresentationCue(rawCf, cached.presDir, workspaceDirs)
      : null;
    cached.decodedCuesByUuid.set(target, decoded);
  }

  const found = cached.decodedCuesByUuid.get(target);
  if (!found) return null;
  return { ...found, mtimeMs: cached.mtimeMs };
}

function refreshPlayableMediaEntry(entry) {
  if (!entry || !entry.filePath) return entry;
  if (entry.mediaType === "video") {
    const playable = resolvePlayableVideoSync(entry.filePath);
    if (playable?.fileUrl) {
      return { ...entry, fileUrl: playable.fileUrl };
    }
  }
  return entry;
}

function stripFileExtension(name) {
  const s = String(name || "").trim();
  const ext = path.extname(s);
  return ext ? s.slice(0, -ext.length) : s;
}

function parseMediaPlaylistsFile(mediaFilePath, searchDirs) {
  const stat = fs.statSync(mediaFilePath);
  const cached = mediaPlaylistCache.get(mediaFilePath);
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return cached;
  }

  const byUuid = new Map();
  const byName = new Map();

  const indexEntry = (entry, ...extraNames) => {
    for (const raw of [entry.name, path.basename(entry.filePath || ""), ...extraNames]) {
      const full = String(raw || "").trim().toLowerCase();
      if (full && !byName.has(full)) byName.set(full, entry);
      const noExt = stripFileExtension(full);
      if (noExt && !byName.has(noExt)) byName.set(noExt, entry);
    }
  };

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
        const resolved = decodeMediaAction(action.val, searchDirs);
        if (resolved) {
          const entry = {
            ...resolved,
            uuid: innerUuid || resolved.uuid,
            name: innerName || resolved.name
          };
          if (itemUuid) byUuid.set(itemUuid, entry);
          if (innerUuid) byUuid.set(innerUuid, entry);
          if (entry.uuid) byUuid.set(entry.uuid, entry);
          indexEntry(entry, itemName, innerName);
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

function searchMediaAssetFileByName(targetName, searchDirs, maxDepth = 3) {
  const normTarget = String(targetName || "").trim().toLowerCase();
  const normNoExt = stripFileExtension(normTarget);
  if (!normTarget && !normNoExt) return null;

  const visit = (dir, depth) => {
    if (!dir || depth > maxDepth || !fs.existsSync(dir)) return null;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return null;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        const sub = visit(full, depth + 1);
        if (sub) return sub;
      } else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (!IMAGE_EXTS.has(ext) && !VIDEO_EXTS.has(ext)) continue;
        const lower = e.name.toLowerCase();
        const lowerNoExt = stripFileExtension(lower);
        if (lower === normTarget || lowerNoExt === normNoExt) {
          return full;
        }
      }
    }
    return null;
  };

  for (const base of searchDirs) {
    for (const sub of [path.join(base, "Media", "Assets"), path.join(base, "Media"), base]) {
      const hit = visit(sub, 0);
      if (hit) return hit;
    }
  }
  return null;
}

function resolveMediaItem({
  mediaUuid = "",
  mediaName = "",
  presentationPath = "",
  customWorkspaceDir = "",
  proHost = ""
} = {}) {
  const { dirs: workspaceDirs, mediaDirs } = getProPresenterPathsInfo(
    presentationPath,
    customWorkspaceDir,
    proHost
  );
  const allSearchDirs = [...workspaceDirs, ...mediaDirs];
  const normUuid = normalizeUuid(mediaUuid);
  const normName = String(mediaName || "").trim().toLowerCase();
  const normNameNoExt = stripFileExtension(normName);

  for (const ws of workspaceDirs) {
    const mediaPlaylistPath = path.join(ws, "Playlists", "Media");
    if (!fs.existsSync(mediaPlaylistPath)) continue;
    try {
      const parsed = parseMediaPlaylistsFile(mediaPlaylistPath, allSearchDirs);
      if (normUuid && parsed.byUuid.has(normUuid)) {
        return refreshPlayableMediaEntry(parsed.byUuid.get(normUuid));
      }
      if (normName && parsed.byName.has(normName)) {
        return refreshPlayableMediaEntry(parsed.byName.get(normName));
      }
      if (normNameNoExt && parsed.byName.has(normNameNoExt)) {
        return refreshPlayableMediaEntry(parsed.byName.get(normNameNoExt));
      }
    } catch (_) {}
  }

  // Fallback: locate media file directly inside ProPresenter's Media/Assets or custom Media directory
  if (normName) {
    const found = searchMediaAssetFileByName(normName, allSearchDirs);
    if (found) {
      const mediaType = classifyMediaFile(found);
      const entry = {
        uuid: normUuid,
        name: path.basename(found),
        filePath: found,
        fileUrl: pathToFileURL(found).href,
        mediaType,
        transition: null
      };
      return refreshPlayableMediaEntry(entry);
    }
  }

  return null;
}

function getMediaCatalog({ presentationPath = "", customWorkspaceDir = "", proHost = "" } = {}) {
  const { dirs: workspaceDirs, mediaDirs } = getProPresenterPathsInfo(
    presentationPath,
    customWorkspaceDir,
    proHost
  );
  const allSearchDirs = [...workspaceDirs, ...mediaDirs];
  const seen = new Set();
  const items = [];

  for (const ws of workspaceDirs) {
    const mediaPlaylistPath = path.join(ws, "Playlists", "Media");
    if (!fs.existsSync(mediaPlaylistPath)) continue;
    try {
      const parsed = parseMediaPlaylistsFile(mediaPlaylistPath, allSearchDirs);
      for (const rawItem of parsed.byUuid.values()) {
        const item = refreshPlayableMediaEntry(rawItem);
        if (!item?.fileUrl || seen.has(item.fileUrl)) continue;
        seen.add(item.fileUrl);
        items.push(item);
        if (items.length >= 500) return items;
      }
    } catch (_) {}
  }

  return items;
}

function buildBibleThemeInfo(workspaceDirs, isLocal = true) {
  if (!isLocal) return null;
  const biblePrefs = getBibleThemePreferences();
  if (!biblePrefs?.templateUuid) return null;
  const bibleThemeMatch = findThemeSlideByUuid(biblePrefs.templateUuid, workspaceDirs);
  if (!bibleThemeMatch) return null;
  const vKey = `bible:${bibleThemeMatch.layout.uuid}:${bibleThemeMatch.mtimeMs}:${biblePrefs.mtimeMs}`;
  return {
    source: "bible-theme",
    themeName: bibleThemeMatch.themeName,
    slideName: sanitizeDisplaySlideName(bibleThemeMatch.slideName),
    versionKey: vKey,
    layoutVisualKey: vKey,
    layout: bibleThemeMatch.layout,
    biblePrefs: {
      verseBoxUuid: biblePrefs.verseBoxUuid,
      referenceBoxUuid: biblePrefs.referenceBoxUuid,
      verseBoxName: biblePrefs.verseBoxName,
      referenceBoxName: biblePrefs.referenceBoxName,
      showVerseNumbers: biblePrefs.showVerseNumbers,
      referenceType: biblePrefs.referenceType
    },
    cueTextBoxes: [],
    cueMediaElements: [],
    cueMedia: null,
    cueSlideTransition: null
  };
}

function looksLikeBibleText(liveText) {
  const lines = String(liveText || "")
    .replace(/\u001F/g, "\n")
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return false;
  const refPattern = /\p{L}{2,}.*\d{1,3}\s*:\s*\d{1,3}/u;
  return refPattern.test(lines[0]) || refPattern.test(lines[lines.length - 1]);
}

// ProPresenter Bible slides: dynamic (empty presentation path), first or last line is a reference like "Matius 1:1-25"
function looksLikeBibleSlide(presentationPath, liveText) {
  if (presentationPath) return false;
  return looksLikeBibleText(liveText);
}

function refreshLayoutMediaFills(layout) {
  if (!layout || !Array.isArray(layout.elements)) return layout;
  let changed = false;
  const nextElements = layout.elements.map((el) => {
    if (el?.fill?.type === "media" && el.fill.mediaType === "video") {
      const srcPath = el.fill.sourceFilePath || el.fill.filePath;
      if (srcPath) {
        const playable = resolvePlayableVideoSync(srcPath);
        if (
          playable &&
          (playable.fileUrl !== el.fill.fileUrl ||
            Boolean(playable.isPendingTranscode) !== Boolean(el.fill.isPendingTranscode))
        ) {
          changed = true;
          return {
            ...el,
            fill: {
              ...el.fill,
              filePath: playable.filePath || srcPath,
              fileUrl: playable.fileUrl || el.fill.fileUrl,
              isTranscoded: Boolean(playable.isTranscoded),
              isPendingTranscode: Boolean(playable.isPendingTranscode)
            }
          };
        }
      }
    }
    return el;
  });
  return changed ? { ...layout, elements: nextElements } : layout;
}

function resolveSlideTheme({
  presentationPath = "",
  cueUuid = "",
  themeSlideUuid = "",
  customWorkspaceDir = "",
  proHost = "",
  liveText = ""
} = {}) {
  const { dirs: workspaceDirs, mediaDirs, isLocal } = getProPresenterPathsInfo(
    presentationPath,
    customWorkspaceDir,
    proHost
  );
  const allSearchDirs = [...workspaceDirs, ...mediaDirs];

  if (looksLikeBibleSlide(presentationPath, liveText)) {
    const bibleInfo = buildBibleThemeInfo(workspaceDirs, isLocal);
    if (bibleInfo) return bibleInfo;
  }

  let cueData = null;
  if (presentationPath && cueUuid) {
    cueData = findPresentationCueData(presentationPath, cueUuid, allSearchDirs);
  }

  // If the live text is a Bible verse and its cue is NOT part of the stale active .pro presentation,
  // resolve the Bible theme immediately on first click without waiting for presentation_path to clear.
  if (!cueData && looksLikeBibleText(liveText)) {
    const bibleInfo = buildBibleThemeInfo(workspaceDirs, isLocal);
    if (bibleInfo) return bibleInfo;
  }

  const refreshedCueLayout = cueData?.layout ? refreshLayoutMediaFills(cueData.layout) : null;

  const cueTextBoxes = (refreshedCueLayout?.elements || [])
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

  const cueMediaElements = (refreshedCueLayout?.elements || [])
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

  const refreshedCueMedia = cueData?.cueMedia ? refreshPlayableMediaEntry(cueData.cueMedia) : null;

  if (themeSlideUuid) {
    const themeMatch = findThemeSlideByUuid(themeSlideUuid, workspaceDirs);
    if (themeMatch) {
      const refreshedThemeLayout = refreshLayoutMediaFills(themeMatch.layout);
      const multiCueKey = cueTextBoxes.length > 1 ? `${cueUuid}:${cueData?.mtimeMs || 0}` : "";
      const mediaKey = cueMediaElements
        .map((e) => `${e.fill?.fileUrl || e.fill?.dataUrl || ""}:${e.fill?.isPendingTranscode ? 1 : 0}`)
        .join(",");
      const hasPerCueExtras =
        cueTextBoxes.length > 1 ||
        cueMediaElements.length > 0 ||
        Boolean(refreshedCueMedia?.filePath) ||
        Boolean(cueData?.cueSlideTransition);
      const layoutVisualKey = `look:${refreshedThemeLayout.uuid}:${themeMatch.mtimeMs}:${mediaKey}:${multiCueKey}`;
      const versionKey = hasPerCueExtras
        ? `look:${refreshedThemeLayout.uuid}:${themeMatch.mtimeMs}:${cueUuid}:${refreshedCueMedia?.filePath || ""}:${mediaKey}:${multiCueKey}`
        : layoutVisualKey;
      return {
        source: "look-theme",
        themeName: themeMatch.themeName,
        slideName: sanitizeDisplaySlideName(themeMatch.slideName),
        versionKey,
        layoutVisualKey,
        layout: refreshedThemeLayout,
        cueTextBoxes,
        cueMediaElements,
        cueMedia: refreshedCueMedia,
        cueSlideTransition: cueData?.cueSlideTransition || null
      };
    }
  }

  if (refreshedCueLayout) {
    const matchedTheme = findMatchingThemeByLayout(refreshedCueLayout, workspaceDirs);
    const mediaKey = (refreshedCueLayout.elements || [])
      .map((e) => `${e.fill?.fileUrl || e.fill?.dataUrl || ""}:${e.fill?.isPendingTranscode ? 1 : 0}`)
      .join(",");
    const layoutVisualKey = `pres-vis:${buildLayoutSignature(cueTextBoxes)}:${mediaKey}:${cueTextBoxes.length}`;
    return {
      source: "presentation-slide",
      themeName: matchedTheme ? matchedTheme.themeName : "Layout Bawaan Slide",
      slideName: matchedTheme
        ? matchedTheme.slideName
        : sanitizeDisplaySlideName(cueData.name),
      matchedByLayout: Boolean(matchedTheme),
      versionKey: `cue:${cueUuid}:${cueData.mtimeMs}:${mediaKey}`,
      layoutVisualKey,
      layout: refreshedCueLayout,
      cueTextBoxes,
      cueMediaElements,
      cueMedia: refreshedCueMedia,
      cueSlideTransition: cueData?.cueSlideTransition || null
    };
  }

  return null;
}

module.exports = {
  resolveSlideTheme,
  getBibleThemePreferences,
  buildFontFamilyStack,
  mapFontWeight,
  looksLikeBibleSlide,
  resolveMediaItem,
  getDefaultScreenUuid,
  getMediaTransition,
  getLayerTransitions,
  getMediaCatalog,
  findPresentationCueData,
  parseProPathsContent,
  parseRtfMetadata,
  decodeTextElement,
  decodeMediaVideoProperties,
  refreshLayoutMediaFills,
  extractUrlFields,
  isLocalProPresenterHost,
  parseProtoFields,
  getAllFields,
  getField,
  decodeUuid
};
