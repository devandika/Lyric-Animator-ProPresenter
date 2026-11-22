/**
 * Renderer-side helper for Auto-Update state, Skip This Version persistence,
 * release notes formatting, and byte/progress formatting.
 */

export const SKIPPED_VERSIONS_STORAGE_KEY = "pro_lyric_skipped_update_versions";

export function normalizeVersion(version) {
  return String(version || "")
    .trim()
    .replace(/^v/i, "");
}

export function getSkippedUpdateVersions(storage = globalThis?.localStorage) {
  try {
    const raw = storage?.getItem?.(SKIPPED_VERSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(parsed.map((v) => normalizeVersion(v)).filter(Boolean))
    );
  } catch (_) {
    return [];
  }
}

export function isVersionSkipped(version, storage = globalThis?.localStorage) {
  const norm = normalizeVersion(version);
  if (!norm) return false;
  return getSkippedUpdateVersions(storage).includes(norm);
}

export function skipUpdateVersion(version, storage = globalThis?.localStorage) {
  const norm = normalizeVersion(version);
  if (!norm) return getSkippedUpdateVersions(storage);
  const current = getSkippedUpdateVersions(storage);
  const next = current.includes(norm) ? current : [...current, norm];
  try {
    storage?.setItem?.(SKIPPED_VERSIONS_STORAGE_KEY, JSON.stringify(next));
  } catch (_) {}
  return next;
}

export function clearSkippedUpdateVersion(version, storage = globalThis?.localStorage) {
  const norm = normalizeVersion(version);
  const next = getSkippedUpdateVersions(storage).filter((v) => v !== norm);
  try {
    storage?.setItem?.(SKIPPED_VERSIONS_STORAGE_KEY, JSON.stringify(next));
  } catch (_) {}
  return next;
}

export function shouldShowStartupUpdateModal(updateState, storage = globalThis?.localStorage) {
  if (!updateState || updateState.status !== "available") return false;
  if (updateState.source && updateState.source !== "startup") return false;
  const ver = normalizeVersion(updateState.version);
  if (!ver) return false;
  return !isVersionSkipped(ver, storage);
}

export function formatReleaseNotesText(rawNotes) {
  if (!rawNotes) return "";
  if (Array.isArray(rawNotes)) {
    return rawNotes
      .map((entry) => {
        if (!entry) return "";
        const head = entry.version ? `v${normalizeVersion(entry.version)}\n` : "";
        return `${head}${formatReleaseNotesText(entry.note || "")}`.trim();
      })
      .filter(Boolean)
      .join("\n\n");
  }
  return String(rawNotes)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatBytes(bytes) {
  const num = Number(bytes) || 0;
  if (num <= 0) return "0 B";
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}
