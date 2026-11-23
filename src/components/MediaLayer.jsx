import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  buildProTransitionEnterFrames,
  buildProTransitionExitFrames,
  DEFAULT_PROPRESENTER_TRANSITION,
  isCutTransition
} from "../lib/propresenterTransitions";

const TRANSITION_EASING = "cubic-bezier(0.37, 0, 0.63, 1)";
const RAPID_SWITCH_WINDOW_MS = 750;
const RAPID_SWITCH_MAX_DURATION_SEC = 0.14;
const COLD_READY_TIMEOUT_MS = 260;

function getMediaKey(media) {
  if (!media || !media.url) return "";
  return `${media.url}::${media.mediaType || "video"}`;
}

function getSlotWillChange(transition) {
  const type = transition?.type || "dissolve";
  if (type === "dissolve" || type === "cut") return "opacity";
  if (type === "blur" || type === "fade-color") return "opacity, filter";
  if (type === "wipe" || type === "iris") return "opacity, clip-path";
  return "opacity, transform";
}

function releaseVideoElement(videoEl) {
  if (!videoEl) return;
  try {
    videoEl.pause();
    videoEl.removeAttribute("src");
    videoEl.load();
  } catch (_) {}
}

function MediaSlotItem({ slot, onReady, onSettled }) {
  const slotRef = useRef(null);
  const mediaElRef = useRef(null);
  const activeAnimRef = useRef(null);
  const [fallbackToThumb, setFallbackToThumb] = useState(false);
  const animPhaseStartedRef = useRef("");
  const transitionRef = useRef(slot.transition);
  const hasIncomingOverlayRef = useRef(slot.hasIncomingOverlay);
  transitionRef.current = slot.transition;
  hasIncomingOverlayRef.current = slot.hasIncomingOverlay;

  // Reset thumbnail fallback whenever the source media URL changes
  useEffect(() => {
    setFallbackToThumb(false);
  }, [slot.media.url]);

  const effectiveUrl =
    fallbackToThumb && slot.media.thumbUrl ? slot.media.thumbUrl : slot.media.url;
  const effectiveType =
    fallbackToThumb && slot.media.thumbUrl ? "image" : slot.media.mediaType || "video";

  const cancelActiveAnim = useCallback(() => {
    if (activeAnimRef.current) {
      try {
        activeAnimRef.current.cancel();
      } catch (_) {}
      activeAnimRef.current = null;
    }
  }, []);

  // Explicitly release Chromium's media decoder pipeline only when slot unmounts or switches to thumb
  useEffect(() => {
    if (effectiveType !== "video") return undefined;
    const videoEl = mediaElRef.current;
    return () => {
      releaseVideoElement(videoEl);
    };
  }, [effectiveUrl, effectiveType]);

  // Control play/pause and gently recover if a video fails to start playback on another GPU/driver
  useEffect(() => {
    if (effectiveType !== "video") return undefined;
    const videoEl = mediaElRef.current;
    if (!videoEl) return undefined;

    const tryPlay = () => {
      try {
        if (videoEl.paused) {
          const p = videoEl.play();
          if (p && typeof p.catch === "function") p.catch(() => {});
        }
      } catch (_) {}
    };

    tryPlay();
    const watchdog = setTimeout(() => {
      if (videoEl.isConnected && videoEl.paused && videoEl.readyState >= 2) {
        tryPlay();
      }
    }, 320);

    return () => clearTimeout(watchdog);
  }, [slot.phase, effectiveType, effectiveUrl]);

  // Strict readiness check: only mark ready when image is complete OR video readyState >= 2
  useLayoutEffect(() => {
    if (slot.ready) return undefined;
    const node = mediaElRef.current;
    if (!node) return undefined;

    if (effectiveType === "image") {
      if (node.complete && node.naturalWidth > 0) {
        onReady(slot.id);
      }
      return undefined;
    }

    if (effectiveType === "video" && node.readyState >= 2) {
      if (slot.phase === "warm") {
        onReady(slot.id);
        return undefined;
      }
      const isUnfocused = typeof document !== "undefined" && (!document.hasFocus() || document.hidden);
      if (isUnfocused) {
        onReady(slot.id);
        return undefined;
      }
      if (typeof node.requestVideoFrameCallback === "function") {
        let canceled = false;
        const handle = node.requestVideoFrameCallback(() => {
          if (!canceled && node.readyState >= 2) {
            onReady(slot.id);
          }
        });
        return () => {
          canceled = true;
          try {
            node.cancelVideoFrameCallback?.(handle);
          } catch (_) {}
        };
      }
      onReady(slot.id);
    }
    return undefined;
  }, [slot.id, slot.phase, slot.ready, effectiveType, onReady]);

  // Safety fallback cap ONLY when actively entering a cold un-warmed media
  useEffect(() => {
    if (slot.phase !== "entering" || slot.ready) return undefined;
    const capMs = slot.hasIncomingOverlay ? COLD_READY_TIMEOUT_MS : 90;
    const timer = setTimeout(() => onReady(slot.id), capMs);
    return () => clearTimeout(timer);
  }, [slot.id, slot.phase, slot.ready, slot.hasIncomingOverlay, onReady]);

  // Layout-synchronized style & WAAPI transition lifecycle
  useLayoutEffect(() => {
    const el = slotRef.current;
    if (!el) return undefined;

    if (slot.phase === "warm") {
      cancelActiveAnim();
      animPhaseStartedRef.current = "warm";
      el.style.visibility = "";
      el.style.opacity = "0";
      el.style.transform = "translateZ(0)";
      el.style.filter = "";
      el.style.clipPath = "";
      return undefined;
    }

    if (slot.phase === "settled") {
      cancelActiveAnim();
      animPhaseStartedRef.current = "settled";
      el.style.visibility = "";
      el.style.opacity = "1";
      el.style.transform = "translateZ(0)";
      el.style.filter = "";
      el.style.clipPath = "";
      return undefined;
    }

    if (slot.phase === "entering") {
      if (!slot.ready) {
        cancelActiveAnim();
        animPhaseStartedRef.current = "pre-enter";
        el.style.visibility = "";
        el.style.opacity = "0.001";
        return undefined;
      }
      if (animPhaseStartedRef.current === "entering") return undefined;
      cancelActiveAnim();
      animPhaseStartedRef.current = "entering";

      const tr = transitionRef.current;
      const ms = Math.max(16, Math.round((tr?.durationSeconds || 0.5) * 1000));
      const frames = buildProTransitionEnterFrames(tr);
      el.style.visibility = "";
      el.style.opacity = "";
      const anim = el.animate(frames, {
        duration: ms,
        easing: TRANSITION_EASING,
        fill: "forwards"
      });
      activeAnimRef.current = anim;

      let canceled = false;
      let finished = false;
      const done = () => {
        if (canceled || finished) return;
        finished = true;
        // Preserve hardware compositor layer with steady translateZ(0) BEFORE cancelling WAAPI fill
        el.style.opacity = "1";
        el.style.transform = "translateZ(0)";
        el.style.filter = "";
        el.style.clipPath = "";
        cancelActiveAnim();
        onSettled(slot.id, "entered");
      };

      const fallback = setTimeout(done, ms + 35);
      anim.finished
        .then(() => {
          clearTimeout(fallback);
          done();
        })
        .catch(() => {
          clearTimeout(fallback);
          if (!canceled) done();
        });
      return () => {
        canceled = true;
        clearTimeout(fallback);
        cancelActiveAnim();
      };
    }

    if (slot.phase === "exiting") {
      if (slot.waitForIncomingReady) {
        cancelActiveAnim();
        animPhaseStartedRef.current = "exiting-wait";
        el.style.visibility = "";
        el.style.opacity = "1";
        el.style.transform = "translateZ(0)";
        el.style.filter = "";
        el.style.clipPath = "";
        return undefined;
      }
      if (animPhaseStartedRef.current === "exiting") return undefined;
      cancelActiveAnim();
      animPhaseStartedRef.current = "exiting";

      const tr = transitionRef.current;
      const ms = Math.max(16, Math.round((tr?.durationSeconds || 0.5) * 1000));
      const hasUnderlayLock = Boolean(hasIncomingOverlayRef.current);
      const frames = buildProTransitionExitFrames(tr, {
        keepOpaqueUnderlay: hasUnderlayLock
      });
      el.style.visibility = "";
      const anim = el.animate(frames, {
        duration: ms,
        easing: TRANSITION_EASING,
        fill: "forwards"
      });
      activeAnimRef.current = anim;

      let canceled = false;
      let finished = false;
      const done = () => {
        if (canceled || finished) return;
        finished = true;
        if (!hasUnderlayLock) {
          el.style.opacity = "0";
        }
        cancelActiveAnim();
        onSettled(slot.id, "exited");
      };

      const fallback = setTimeout(done, ms + 35);
      anim.finished
        .then(() => {
          clearTimeout(fallback);
          done();
        })
        .catch(() => {
          clearTimeout(fallback);
          if (!canceled) done();
        });
      return () => {
        canceled = true;
        clearTimeout(fallback);
        cancelActiveAnim();
      };
    }

    return undefined;
  }, [slot.id, slot.phase, slot.ready, slot.waitForIncomingReady, onSettled, cancelActiveAnim]);

  const zIndex = slot.phase === "warm" ? 0 : slot.phase === "exiting" ? 1 : 2;
  const posterUrl =
    !slot.hasIncomingOverlay && slot.phase !== "warm" && slot.media.thumbUrl
      ? slot.media.thumbUrl
      : undefined;

  return (
    <div
      ref={slotRef}
      className={`pro-media-slot phase-${slot.phase}`}
      style={{
        position: "absolute",
        inset: 0,
        zIndex,
        transform: "translateZ(0)",
        backfaceVisibility: "hidden",
        pointerEvents: "none",
        willChange: slot.phase === "warm" ? "auto" : getSlotWillChange(slot.transition)
      }}
    >
      {effectiveType === "image" ? (
        <img
          ref={mediaElRef}
          className="pro-media-layer"
          src={effectiveUrl}
          alt=""
          onLoad={() => onReady(slot.id)}
          onError={() => onReady(slot.id)}
        />
      ) : (
        <video
          ref={mediaElRef}
          key={effectiveUrl}
          className="pro-media-layer"
          src={effectiveUrl}
          poster={posterUrl}
          autoPlay={slot.phase !== "warm"}
          preload="auto"
          loop
          muted
          playsInline
          onLoadedData={() => {
            const node = mediaElRef.current;
            if (!node || node.readyState < 2) return;
            if (slot.phase === "warm") {
              try {
                if (!node.paused) node.pause();
              } catch (_) {}
              onReady(slot.id);
              return;
            }
            try {
              if (node.paused) {
                const p = node.play();
                if (p && typeof p.catch === "function") p.catch(() => {});
              }
            } catch (_) {}
            const isUnfocused = typeof document !== "undefined" && (!document.hasFocus() || document.hidden);
            if (isUnfocused) {
              onReady(slot.id);
              return;
            }
            if (typeof node.requestVideoFrameCallback === "function") {
              node.requestVideoFrameCallback(() => {
                if (node.readyState >= 2) onReady(slot.id);
              });
            } else {
              onReady(slot.id);
            }
          }}
          onCanPlay={() => {
            const node = mediaElRef.current;
            if (node && node.readyState >= 2) {
              if (slot.phase !== "warm" && node.paused) {
                try {
                  const p = node.play();
                  if (p && typeof p.catch === "function") p.catch(() => {});
                } catch (_) {}
              }
              onReady(slot.id);
            }
          }}
          onStalled={() => {
            const node = mediaElRef.current;
            if (node && slot.phase !== "warm" && node.paused) {
              try {
                const p = node.play();
                if (p && typeof p.catch === "function") p.catch(() => {});
              } catch (_) {}
            }
          }}
          onError={() => {
            if (slot.media.thumbUrl && !fallbackToThumb) {
              setFallbackToThumb(true);
            } else {
              onReady(slot.id);
            }
          }}
        />
      )}
    </div>
  );
}

/**
 * Dual-slot Media Layer compositor reproducing ProPresenter's Background transition.
 * Releases inactive video decoders immediately on exit so laptops/iGPUs never exhaust
 * concurrent hardware video decode sessions (preventing frame-0 video freezes).
 */
export function MediaLayer({ media = null, transition = null }) {
  const [slots, setSlots] = useState([]);
  const seqRef = useRef(0);
  const useOrderRef = useRef(0);
  const lastKeyRef = useRef("");
  const lastSwitchAtRef = useRef(0);

  useEffect(() => {
    const nextKey = getMediaKey(media);
    if (nextKey === lastKeyRef.current) return;
    lastKeyRef.current = nextKey;

    const now = performance.now();
    const isRapidSwitch =
      lastSwitchAtRef.current > 0 && now - lastSwitchAtRef.current < RAPID_SWITCH_WINDOW_MS;
    lastSwitchAtRef.current = now;

    const baseEff = media?.transition || transition || DEFAULT_PROPRESENTER_TRANSITION;
    const eff =
      isRapidSwitch && !isCutTransition(baseEff)
        ? {
            ...baseEff,
            durationSeconds: Math.min(
              Number(baseEff.durationSeconds) || 0.5,
              RAPID_SWITCH_MAX_DURATION_SEC
            )
          }
        : baseEff;

    const cutMode = isCutTransition(eff);

    setSlots((prev) => {
      const stamp = ++useOrderRef.current;

      // Pick the most visually solid outgoing slot (excluding the target if already active)
      const others = prev.filter((s) => s.mediaKey !== nextKey);
      const settledPrev = others.filter((s) => s.ready && s.phase === "settled");
      const exitingPrev = others.filter((s) => s.ready && s.phase === "exiting");
      const readyActivePrev = others.filter((s) => s.ready);
      const pool =
        settledPrev.length > 0
          ? settledPrev
          : exitingPrev.length > 0
          ? exitingPrev
          : readyActivePrev;
      const outgoing = pool.length > 0 ? pool[pool.length - 1] : null;

      if (!nextKey) {
        if (cutMode || !outgoing) {
          return [];
        }
        return [
          {
            ...outgoing,
            phase: "exiting",
            waitForIncomingReady: false,
            hasIncomingOverlay: false,
            transition: eff
          }
        ];
      }

      const existingTarget = prev.find((s) => s.mediaKey === nextKey);
      const incomingReady = cutMode ? true : Boolean(existingTarget?.ready);
      const incomingPhase = cutMode ? "settled" : "entering";

      const nextTargetSlot = existingTarget
        ? {
            ...existingTarget,
            media,
            phase: incomingPhase,
            ready: incomingReady,
            waitForIncomingReady: false,
            hasIncomingOverlay: Boolean(outgoing) && !cutMode,
            transition: eff,
            lastUsedAt: stamp
          }
        : {
            id: ++seqRef.current,
            mediaKey: nextKey,
            media,
            phase: incomingPhase,
            ready: incomingReady,
            waitForIncomingReady: false,
            hasIncomingOverlay: Boolean(outgoing) && !cutMode,
            transition: eff,
            lastUsedAt: stamp
          };

      if (!cutMode && outgoing) {
        return [
          {
            ...outgoing,
            phase: "exiting",
            waitForIncomingReady: !incomingReady,
            hasIncomingOverlay: true,
            transition: eff
          },
          nextTargetSlot
        ];
      }

      return [nextTargetSlot];
    });
  }, [media, transition]);

  const handleSlotReady = useCallback((slotId) => {
    setSlots((prev) => {
      let changed = false;
      const target = prev.find((p) => p.id === slotId);
      if (!target) return prev;
      const isTargetEntering = target.phase === "entering";

      const next = prev.map((s) => {
        if (s.id === slotId && !s.ready) {
          changed = true;
          return { ...s, ready: true };
        }
        if (s.phase === "exiting" && s.waitForIncomingReady && isTargetEntering) {
          changed = true;
          return { ...s, waitForIncomingReady: false };
        }
        return s;
      });
      return changed ? next : prev;
    });
  }, []);

  const handleSlotSettled = useCallback((slotId, kind) => {
    setSlots((prev) => {
      if (kind === "exited") {
        const target = prev.find((s) => s.id === slotId);
        if (target?.hasIncomingOverlay && prev.some((s) => s.phase === "entering")) {
          return prev;
        }
        return prev.filter((s) => s.id !== slotId);
      }
      if (kind === "entered") {
        const target = prev.find((s) => s.id === slotId);
        if (!target || target.phase !== "entering") {
          return prev;
        }
        return prev
          .filter((s) => s.phase !== "exiting")
          .map((s) =>
            s.id === slotId ? { ...s, phase: "settled", hasIncomingOverlay: false } : s
          );
      }
      return prev;
    });
  }, []);

  if (slots.length === 0) return null;

  return (
    <div
      className="pro-media-stack"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        zIndex: 2,
        pointerEvents: "none"
      }}
    >
      {slots.map((slot) => (
        <MediaSlotItem
          key={slot.mediaKey}
          slot={slot}
          onReady={handleSlotReady}
          onSettled={handleSlotSettled}
        />
      ))}
    </div>
  );
}
