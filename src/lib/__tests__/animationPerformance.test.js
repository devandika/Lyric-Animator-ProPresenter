import { describe, it, expect } from "vitest";
import { ANIMATION_PRESETS, runLyricAnimation } from "../animationPresets.js";

function createFakeUnit() {
  let recordedKeyframes = null;
  let recordedOpts = null;
  let cancelled = false;

  const unit = {
    style: {},
    classList: { contains: () => false },
    contains: () => false,
    animate(keyframes, opts) {
      recordedKeyframes = keyframes;
      recordedOpts = opts;
      let resolveFinished;
      const finished = new Promise((resolve) => {
        resolveFinished = resolve;
      });
      const timer = setTimeout(() => resolveFinished(), Math.min(40, opts?.duration || 16));
      return {
        finished,
        cancel() {
          cancelled = true;
          clearTimeout(timer);
          resolveFinished();
        },
        finish() {
          clearTimeout(timer);
          resolveFinished();
        }
      };
    },
    getRecorded: () => ({ recordedKeyframes, recordedOpts, cancelled })
  };
  return unit;
}

describe("Lyric Animation Performance & Responsiveness", () => {
  it("omits filter keyframes when preset has zero blur and clears willChange after enter", async () => {
    const unit = createFakeUnit();
    await runLyricAnimation({
      units: [unit],
      phase: "enter",
      preset: ANIMATION_PRESETS["smooth-fade-slide"],
      durationSeconds: 0.5
    });

    const { recordedKeyframes, cancelled } = unit.getRecorded();
    expect(recordedKeyframes).toBeTruthy();
    expect("filter" in recordedKeyframes).toBe(false);
    expect(unit.style.willChange).toBe("");
    expect(unit.style.filter).toBe("");
    expect(cancelled).toBe(true);
  });

  it("caps live exit duration and aborts in-flight animation immediately on abortSignal", async () => {
    const unit = createFakeUnit();
    const ac = new AbortController();

    let finished = false;
    const promise = runLyricAnimation({
      units: [unit],
      phase: "exit",
      preset: ANIMATION_PRESETS["cinematic-blur"],
      durationSeconds: 2.5,
      fastExit: true,
      abortSignal: ac.signal,
      onFinished: () => {
        finished = true;
      }
    });

    const { recordedOpts } = unit.getRecorded();
    // fastExit caps exit at 220ms even when durationSeconds is 2.5s
    expect(recordedOpts.duration).toBeLessThanOrEqual(220);

    ac.abort();
    await promise;
    expect(finished).toBe(true);
  });
});
