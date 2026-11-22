import { describe, it, expect } from "vitest";
import { formatCountdownTime } from "../../components/CountdownOverlay.jsx";

describe("formatCountdownTime", () => {
  it("formats zero and negative seconds safely", () => {
    expect(formatCountdownTime(0)).toBe("00:00");
    expect(formatCountdownTime(-15)).toBe("00:00");
    expect(formatCountdownTime(0, true)).toBe("00:00:00");
  });

  it("formats minutes and seconds as MM:SS", () => {
    expect(formatCountdownTime(5)).toBe("00:05");
    expect(formatCountdownTime(65)).toBe("01:05");
    expect(formatCountdownTime(600)).toBe("10:00");
  });

  it("formats hours as HH:MM:SS when >= 3600 or forceHours is true", () => {
    expect(formatCountdownTime(3661)).toBe("01:01:01");
    expect(formatCountdownTime(125, true)).toBe("00:02:05");
  });
});
