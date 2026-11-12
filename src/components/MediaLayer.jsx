import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  buildProTransitionEnterFrames,
  buildProTransitionExitFrames,
  DEFAULT_PROPRESENTER_TRANSITION,
  isCutTransition
} from "../lib/propresenterTransitions";

const TRANSITION_EASING = "cubic-bezier(0.37, 0, 0.63, 1)";

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

function MediaSlotItem({ slot, onReady, onSettled }) {
  const slotRef = useRef(null);
  const mediaElRef = useRef(null);
  const [fallbackToThumb, setFallbackToThumb] = useState(false);
  const animPhaseStartedRef = useRef("");
  const transitionRef = useRef(slot.transition);
  const hasIncomingOverlayRef = useRef(slot.hasIncomingOverlay);
  transitionRef.current = slot.transition;
  hasIncomingOverlayRef.current = slot.hasIncomingOverlay;

  const effectiveUrl =
    fallbackToThumb && slot.media.thumbUrl ? slot.media.thumbUrl : slot.media.url;
  const effectiveType =
    fallbackToThumb && slot.media.thumbUrl ? "image" : slot.media.mediaType;

  // Immediate readiness check for already-cached images or already-decoded videos
  useLayoutEffect(() => {
    if (slot.phase !== "entering" || slot.ready) return undefined;
    const node = mediaElRef.current;
    if (!node) return undefined;

    if (effectiveType === "image" && node.complete) {
      onReady(slot.id);
      return undefined;
    }

    if (effectiveType === "video") {
      if (typeof node.requestVideoFrameCallback === "function") {
        let canceled = false;
        const handle = node.requestVideoFrameCallback(() => {
          if (!canceled) onReady(slot.id);
        });
        return () => {
          canceled = true;
          try {
            node.cancelVideoFrameCallback?.(handle);
          } catch (_) {}
        };
      }
      if (node.readyState >= 2) {
        onReady(slot.id);
      }
    }
    return undefined;
  }, [slot.id, slot.phase, slot.ready, effectiveType, onReady]);

  useEffect(() => {
    if (slot.phase !== "entering" || slot.ready) return undefined;
    // Wait up to 240ms when crossfading over live media (prevents black mid-fade pop),
    // and up to 70ms when starting from black so initial trigger remains snappy.
    const capMs = slot.hasIncomingOverlay ? 240 : 70;
    const timer = setTimeout(() => onReady(slot.id), capMs);
    return () => clearTimeout(timer);
  }, [slot.id, slot.phase, slot.ready, slot.hasIncomingOverlay, onReady]);

  useEffect(() => {
    const el = slotRef.current;
    if (!el) return undefined;

    if (slot.phase === "settled") {
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
        el.style.opacity = "0";
        return undefined;
      }
      if (animPhaseStartedRef.current === "entering") return undefined;
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

      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        // Preserve hardware compositor layer with steady translateZ(0) BEFORE cancelling WAAPI fill
        el.style.opacity = "1";
        el.style.transform = "translateZ(0)";
        el.style.filter = "";
        el.style.clipPath = "";
        try {
          anim.cancel();
        } catch (_) {}
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
          done();
        });
      return () => {
        clearTimeout(fallback);
      };
    }

    if (slot.phase === "exiting") {
      if (slot.waitForIncomingReady) return undefined;
      if (animPhaseStartedRef.current === "exiting") return undefined;
      animPhaseStartedRef.current = "exiting";

      const tr = transitionRef.current;
      const ms = Math.max(16, Math.round((tr?.durationSeconds || 0.5) * 1000));
      const hasUnderlayLock = Boolean(hasIncomingOverlayRef.current);
      const frames = buildProTransitionExitFrames(tr, {
        keepOpaqueUnderlay: hasUnderlayLock
      });
      const anim = el.animate(frames, {
        duration: ms,
        easing: TRANSITION_EASING,
        fill: "forwards"
      });

      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        // Lock hidden state BEFORE cancelling WAAPI fill so fading-to-black never flashes visible on final frame
        if (!hasUnderlayLock) {
          el.style.opacity = "0";
          el.style.visibility = "hidden";
        }
        try {
          anim.cancel();
        } catch (_) {}
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
          done();
        });
      return () => {
        clearTimeout(fallback);
      };
    }

    return undefined;
  }, [slot.id, slot.phase, slot.ready, slot.waitForIncomingReady, onSettled]);

  const zIndex = slot.phase === "exiting" ? 1 : 2;
  const posterUrl =
    !slot.hasIncomingOverlay && slot.media.thumbUrl ? slot.media.thumbUrl : undefined;

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
        willChange: getSlotWillChange(slot.transition)
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
          autoPlay
          loop
          muted
          playsInline
          onLoadedData={() => {
            if (typeof mediaElRef.current?.requestVideoFrameCallback !== "function") {
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
 * Dual-slot Media Layer compositor reproducing ProPresenter's configured Background transition.
 */
export function MediaLayer({ media = null, transition = null }) {
  const [slots, setSlots] = useState([]);
  const seqRef = useRef(0);
  const lastKeyRef = useRef("");

  useEffect(() => {
    const nextKey = getMediaKey(media);
    if (nextKey === lastKeyRef.current) return;
    lastKeyRef.current = nextKey;

    const eff = media?.transition || transition || DEFAULT_PROPRESENTER_TRANSITION;
    if (isCutTransition(eff)) {
      if (!nextKey) {
        setSlots([]);
      } else {
        const id = ++seqRef.current;
        setSlots([
          {
            id,
            mediaKey: nextKey,
            media,
            phase: "settled",
            ready: true,
            waitForIncomingReady: false,
            hasIncomingOverlay: false,
            transition: eff
          }
        ]);
      }
      return;
    }

    setSlots((prev) => {
      const readyPrev = prev.filter((s) => s.ready && s.phase !== "exiting");
      const activePrev = readyPrev.length > 0 ? readyPrev : prev.filter((s) => s.ready);
      const outgoing = activePrev.length > 0 ? activePrev[activePrev.length - 1] : null;

      if (!nextKey) {
        if (!outgoing) return [];
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

      const incomingId = ++seqRef.current;
      const incomingSlot = {
        id: incomingId,
        mediaKey: nextKey,
        media,
        phase: "entering",
        ready: false,
        waitForIncomingReady: false,
        hasIncomingOverlay: Boolean(outgoing),
        transition: eff
      };

      if (!outgoing) {
        return [incomingSlot];
      }

      const outgoingSlot = {
        ...outgoing,
        phase: "exiting",
        waitForIncomingReady: true,
        hasIncomingOverlay: true,
        transition: eff
      };

      return [outgoingSlot, incomingSlot];
    });
  }, [media, transition]);

  const handleSlotReady = useCallback((slotId) => {
    setSlots((prev) => {
      let changed = false;
      const next = prev.map((s) => {
        if (s.id === slotId && !s.ready) {
          changed = true;
          return { ...s, ready: true };
        }
        if (
          s.phase === "exiting" &&
          s.waitForIncomingReady &&
          prev.some((p) => p.id === slotId && p.phase === "entering")
        ) {
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
        // Keep underlay slot mounted until the incoming overlay settles cleanly
        const target = prev.find((s) => s.id === slotId);
        if (target?.hasIncomingOverlay && prev.some((s) => s.phase === "entering")) {
          return prev;
        }
        return prev.filter((s) => s.id !== slotId);
      }
      if (kind === "entered") {
        return prev
          .filter((s) => s.phase !== "exiting")
          .map((s) => (s.id === slotId ? { ...s, phase: "settled" } : s));
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
          key={slot.id}
          slot={slot}
          onReady={handleSlotReady}
          onSettled={handleSlotSettled}
        />
      ))}
    </div>
  );
}
