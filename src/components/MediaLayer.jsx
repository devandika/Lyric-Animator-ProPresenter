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
const MAX_WARM_SLOTS = 2;
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

function evictOverflowWarmSlots(list) {
  if (list.length <= MAX_WARM_SLOTS) return list;
  const warmCandidates = list
    .filter((s) => s.phase === "warm")
    .sort((a, b) => (a.lastUsedAt || 0) - (b.lastUsedAt || 0));
  const excess = list.length - MAX_WARM_SLOTS;
  if (excess <= 0 || warmCandidates.length === 0) return list;
  const dropIds = new Set(warmCandidates.slice(0, excess).map((s) => s.id));
  return list.filter((s) => !dropIds.has(s.id));
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

  // Control play/pause based on whether this slot is active vs warm-cached
  useEffect(() => {
    if (effectiveType !== "video") return;
    const videoEl = mediaElRef.current;
    if (!videoEl) return;

    if (slot.phase === "warm") {
      try {
        if (!videoEl.paused) videoEl.pause();
      } catch (_) {}
    } else if (slot.phase === "entering" || slot.phase === "settled" || slot.phase === "exiting") {
      try {
        if (videoEl.paused) {
          const p = videoEl.play();
          if (p && typeof p.catch === "function") p.catch(() => {});
        }
      } catch (_) {}
    }
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
          preload="auto"
          loop
          muted
          playsInline
          onLoadedData={() => {
            const node = mediaElRef.current;
            if (!node || node.readyState < 2) return;
            if (slot.phase === "warm") {
              onReady(slot.id);
              return;
            }
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
              onReady(slot.id);
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
 * Dual-slot + Warm-Pool Media Layer compositor reproducing ProPresenter's Background transition
 * with instant switching across recently played & preloaded media.
 */
export function MediaLayer({ media = null, transition = null, preloadMedia = [] }) {
  const [slots, setSlots] = useState([]);
  const seqRef = useRef(0);
  const useOrderRef = useRef(0);
  const lastKeyRef = useRef("");
  const lastSwitchAtRef = useRef(0);

  // Pre-warm top catalog media items inside the persistent MediaLayer pool
  useEffect(() => {
    if (!Array.isArray(preloadMedia) || preloadMedia.length === 0) return;
    setSlots((prev) => {
      const existingKeys = new Set(prev.map((s) => s.mediaKey));
      const additions = [];
      for (const item of preloadMedia) {
        if (prev.length + additions.length >= MAX_WARM_SLOTS) break;
        const url = item?.url || item?.fileUrl;
        if (!url) continue;
        const mediaObj = {
          url,
          thumbUrl: item.thumbUrl || "",
          mediaType: item.mediaType || "video",
          name: item.name || "Media",
          transition: item.transition || null
        };
        const key = getMediaKey(mediaObj);
        if (!key || existingKeys.has(key)) continue;
        existingKeys.add(key);
        additions.push({
          id: ++seqRef.current,
          mediaKey: key,
          media: mediaObj,
          phase: "warm",
          ready: false,
          waitForIncomingReady: false,
          hasIncomingOverlay: false,
          transition: null,
          lastUsedAt: 0
        });
      }
      return additions.length > 0 ? [...prev, ...additions] : prev;
    });
  }, [preloadMedia]);

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

      // Pick the most visually solid outgoing slot (excluding the target if already in pool)
      const others = prev.filter((s) => s.mediaKey !== nextKey);
      const settledPrev = others.filter((s) => s.ready && s.phase === "settled");
      const exitingPrev = others.filter((s) => s.ready && s.phase === "exiting");
      const readyActivePrev = others.filter((s) => s.ready && s.phase !== "warm");
      const pool =
        settledPrev.length > 0
          ? settledPrev
          : exitingPrev.length > 0
          ? exitingPrev
          : readyActivePrev;
      const outgoing = pool.length > 0 ? pool[pool.length - 1] : null;

      if (!nextKey) {
        if (cutMode || !outgoing) {
          return prev.map((s) =>
            s.phase === "warm"
              ? s
              : { ...s, phase: "warm", waitForIncomingReady: false, hasIncomingOverlay: false }
          );
        }
        return prev.map((s) => {
          if (s.id === outgoing.id) {
            return {
              ...s,
              phase: "exiting",
              waitForIncomingReady: false,
              hasIncomingOverlay: false,
              transition: eff
            };
          }
          return s.phase === "warm"
            ? s
            : { ...s, phase: "warm", waitForIncomingReady: false, hasIncomingOverlay: false };
        });
      }

      const existingTarget = prev.find((s) => s.mediaKey === nextKey);
      const incomingReady = cutMode ? true : Boolean(existingTarget?.ready);
      const incomingPhase = cutMode ? "settled" : "entering";

      let nextList;
      if (existingTarget) {
        nextList = prev.map((s) => {
          if (s.id === existingTarget.id) {
            return {
              ...s,
              media,
              phase: incomingPhase,
              ready: incomingReady,
              waitForIncomingReady: false,
              hasIncomingOverlay: Boolean(outgoing) && !cutMode,
              transition: eff,
              lastUsedAt: stamp
            };
          }
          if (!cutMode && outgoing && s.id === outgoing.id) {
            return {
              ...s,
              phase: "exiting",
              waitForIncomingReady: !incomingReady,
              hasIncomingOverlay: true,
              transition: eff
            };
          }
          return s.phase === "warm"
            ? s
            : { ...s, phase: "warm", waitForIncomingReady: false, hasIncomingOverlay: false };
        });
      } else {
        const incomingSlot = {
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
        const updatedPrev = prev.map((s) => {
          if (!cutMode && outgoing && s.id === outgoing.id) {
            return {
              ...s,
              phase: "exiting",
              waitForIncomingReady: !incomingReady,
              hasIncomingOverlay: true,
              transition: eff
            };
          }
          return s.phase === "warm"
            ? s
            : { ...s, phase: "warm", waitForIncomingReady: false, hasIncomingOverlay: false };
        });
        nextList = [...updatedPrev, incomingSlot];
      }

      return evictOverflowWarmSlots(nextList);
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
        const next = prev.map((s) =>
          s.id === slotId
            ? { ...s, phase: "warm", waitForIncomingReady: false, hasIncomingOverlay: false }
            : s
        );
        return evictOverflowWarmSlots(next);
      }
      if (kind === "entered") {
        const target = prev.find((s) => s.id === slotId);
        if (!target || target.phase !== "entering") {
          return prev;
        }
        const next = prev.map((s) => {
          if (s.id === slotId) return { ...s, phase: "settled", hasIncomingOverlay: false };
          if (s.phase === "exiting") {
            return { ...s, phase: "warm", waitForIncomingReady: false, hasIncomingOverlay: false };
          }
          return s;
        });
        return evictOverflowWarmSlots(next);
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
