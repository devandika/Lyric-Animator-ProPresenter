import { describe, it, expect } from "vitest";
import {
  clearSkippedUpdateVersion,
  formatBytes,
  formatReleaseNotesText,
  getSkippedUpdateVersions,
  isVersionSkipped,
  normalizeVersion,
  shouldShowStartupUpdateModal,
  skipUpdateVersion
} from "../updateManager";

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
}

describe("updateManager", () => {
  it("normalizes versions and tracks skipped versions cleanly", () => {
    const storage = createMemoryStorage();
    expect(normalizeVersion("v2.2.0")).toBe("2.2.0");
    expect(isVersionSkipped("2.2.0", storage)).toBe(false);

    skipUpdateVersion("v2.2.0", storage);
    expect(isVersionSkipped("2.2.0", storage)).toBe(true);
    expect(isVersionSkipped("2.3.0", storage)).toBe(false);
    expect(getSkippedUpdateVersions(storage)).toEqual(["2.2.0"]);

    clearSkippedUpdateVersion("2.2.0", storage);
    expect(isVersionSkipped("2.2.0", storage)).toBe(false);
  });

  it("controls startup update modal visibility based on skipped versions and check source", () => {
    const storage = createMemoryStorage();

    expect(
      shouldShowStartupUpdateModal(
        { status: "available", version: "2.2.0", source: "startup" },
        storage
      )
    ).toBe(true);

    // Manual checks from Settings should not trigger the startup popup
    expect(
      shouldShowStartupUpdateModal(
        { status: "available", version: "2.2.0", source: "manual" },
        storage
      )
    ).toBe(false);

    // After skipping v2.2.0, startup modal stays hidden for v2.2.0, but shows for v2.3.0
    skipUpdateVersion("2.2.0", storage);
    expect(
      shouldShowStartupUpdateModal(
        { status: "available", version: "2.2.0", source: "startup" },
        storage
      )
    ).toBe(false);
    expect(
      shouldShowStartupUpdateModal(
        { status: "available", version: "2.3.0", source: "startup" },
        storage
      )
    ).toBe(true);
  });

  it("formats HTML and array release notes into readable plain text", () => {
    const html = "<h3>What's New</h3><ul><li>Auto-update</li><li>Fix &amp; polish</li></ul>";
    expect(formatReleaseNotesText(html)).toBe("What's New\n• Auto-update\n• Fix & polish");

    const arr = [{ version: "2.2.0", note: "<p>Improved Bible mode</p>" }];
    expect(formatReleaseNotesText(arr)).toBe("v2.2.0\nImproved Bible mode");
  });

  it("formats byte sizes cleanly", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
