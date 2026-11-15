import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
export function formatCountdownTime(totalSeconds, forceHours = false) {
  if (totalSeconds <= 0) return forceHours ? "00:00:00" : "00:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (hours > 0 || forceHours) {
    const hh = String(hours).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export function CountdownOverlay({
  config,
  runtime,
  isInteractive = false,
  forceVisible = false,
  canvasWidth = 1920,
  canvasHeight = 1080,
  onPositionChange,
  onFontSizeChange
}) {
  const [remainingSec, setRemainingSec] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [customTextDismissed, setCustomTextDismissed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef(null);
  const countdownBoxRef = useRef(null);
  const dismissTimerRef = useRef(null);

  // Compute configured duration in seconds to strictly cap countdown time (prevents +1 second clock-skew glitch)
  const configuredTotalSec =
    config?.timerType === "target"
      ? Infinity
      : (Number(config?.durationHours) || 0) * 3600 +
        (Number(config?.durationMinutes) || 0) * 60 +
        (Number(config?.durationSeconds) || 0);

  const maxAllowedSec =
    runtime?.initialTotalSeconds ||
    (configuredTotalSec > 0 ? configuredTotalSec : Infinity);

  // Sync remaining seconds with runtime.targetEndTimeMs or runtime.remainingSeconds
  useEffect(() => {
    if (!config?.countdownEnabled || !runtime?.isRunning) {
      const fallbackSec = runtime?.remainingSeconds ?? 0;
      setRemainingSec(Math.min(maxAllowedSec, fallbackSec));
      setIsFinished(Boolean(runtime?.isFinished));
      return;
    }

    if (runtime?.isPaused) {
      setRemainingSec(Math.min(maxAllowedSec, runtime.remainingSeconds || 0));
      return;
    }

    const updateTimer = () => {
      if (runtime?.targetEndTimeMs) {
        const now = Date.now();
        const diffMs = runtime.targetEndTimeMs - now;
        // Strictly bound by maxAllowedSec so seconds NEVER overshoot (+1s) due to millisecond rounding
        const sec = Math.max(0, Math.min(maxAllowedSec, Math.ceil(diffMs / 1000)));
        setRemainingSec(sec);

        if (sec <= 0) {
          setIsFinished(true);
        } else {
          setIsFinished(false);
        }
      } else if (typeof runtime?.remainingSeconds === "number") {
        setRemainingSec(Math.min(maxAllowedSec, runtime.remainingSeconds));
        setIsFinished(Boolean(runtime?.isFinished));
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 250);
    return () => clearInterval(interval);
  }, [
    config?.countdownEnabled,
    runtime?.isRunning,
    runtime?.isPaused,
    runtime?.targetEndTimeMs,
    runtime?.remainingSeconds,
    runtime?.initialTotalSeconds,
    runtime?.isFinished,
    maxAllowedSec
  ]);

  // Handle 3-second delay on finish message display, then smoothly fade out
  useEffect(() => {
    // Reset dismissed state ONLY when a timer is actively reset or running with time remaining
    if (!isFinished && !runtime?.isFinished) {
      setCustomTextDismissed(false);
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
      return;
    }

    if ((isFinished || runtime?.isFinished) && config?.finishAction === "custom-text") {
      if (!dismissTimerRef.current && !customTextDismissed) {
        dismissTimerRef.current = setTimeout(() => {
          setCustomTextDismissed(true);
          dismissTimerRef.current = null;
        }, 3000); // 3 seconds display before permanent fade out
      }
    }

    return () => {
      if (!isFinished && !runtime?.isFinished) {
        if (dismissTimerRef.current) {
          clearTimeout(dismissTimerRef.current);
          dismissTimerRef.current = null;
        }
      }
    };
  }, [isFinished, runtime?.isFinished, config?.finishAction, customTextDismissed]);

  const showCountdown = forceVisible || Boolean(config?.countdownEnabled);
  const showTicker = forceVisible || Boolean(config?.tickerEnabled && config?.tickerText?.trim());

  // Check if countdown format contains hours (HH:MM:SS) or only minutes (MM:SS)
  const isHoursFormat =
    config?.timerType === "target" ||
    (Number(config?.durationHours) || 0) > 0 ||
    (Number(config?.durationMinutes) || 0) >= 60 ||
    Boolean(remainingSec >= 3600);

  // Maximum allowed font size: 260px for hours (HH:MM:SS), 380px for minutes (MM:SS)
  // This guarantees that countdown NEVER exceeds the screen boundaries!
  const maxAllowedFontSize = isHoursFormat ? 260 : 380;
  const rawNumberFontSize = Number(config?.numberFontSize) || 48;
  const numberFontSize = Math.min(maxAllowedFontSize, Math.max(12, rawNumberFontSize));
  const textFontSize = config?.textFontSize || 24;

  // Countdown time string calculation
  let displaySec = 0;
  if (remainingSec > 0) {
    displaySec = Math.min(maxAllowedSec, remainingSec);
  } else if (!runtime?.isRunning || runtime?.isPaused) {
    if (runtime?.remainingSeconds > 0) {
      displaySec = Math.min(maxAllowedSec, runtime.remainingSeconds);
    } else if (config?.timerType === "target" && config?.targetTime) {
      const parts = String(config.targetTime).split(":");
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      const s = parseInt(parts[2], 10) || 0;
      const now = new Date();
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, s);
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }
      displaySec = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 1000));
    } else {
      displaySec = configuredTotalSec > 0 ? configuredTotalSec : 0;
    }
  }

  let timeString = formatCountdownTime(displaySec, isHoursFormat);
  let hideCountdown = false;

  if (isFinished && !forceVisible) {
    if (config?.finishAction === "auto-hide") {
      hideCountdown = true;
    } else if (config?.finishAction === "custom-text") {
      if (customTextDismissed || (!runtime?.isRunning && !runtime?.targetEndTimeMs)) {
        hideCountdown = true;
      } else {
        timeString = config?.finishText || "Selamat Beribadah!";
      }
    }
  } else if (isFinished && forceVisible) {
    if (config?.finishAction === "custom-text") {
      timeString = config?.finishText || "Selamat Beribadah!";
    }
  }

  // Boundary calculations to ensure the text NEVER exceeds canvas edges (1920x1080)
  const charCount = (timeString || "00:00").length;
  const estTextWidth = numberFontSize * (charCount * 0.62);
  const estTextHeight = numberFontSize * 1.1;

  const halfWidthPercent = ((estTextWidth / 2) / canvasWidth) * 100;
  const halfHeightPercent = ((estTextHeight / 2) / canvasHeight) * 100;

  // Clamping margins so text is 100% inside the screen at all times
  const minX = Math.max(2, Math.ceil(halfWidthPercent));
  const maxX = Math.min(98, Math.floor(100 - halfWidthPercent));
  const minY = Math.max(3, Math.ceil(halfHeightPercent));
  const maxY = Math.min(97, Math.floor(100 - halfHeightPercent));

  // Current clamped positions
  const rawXPercent = typeof config?.position?.x === "number" ? config.position.x : 50;
  const rawYPercent = typeof config?.position?.y === "number" ? config.position.y : 85;
  const xPercent = Math.max(minX, Math.min(maxX, rawXPercent));
  const yPercent = Math.max(minY, Math.min(maxY, rawYPercent));

  // Drag handling in Live Preview for countdown
  const handleMouseDown = (e) => {
    if (!isInteractive || e.button !== 0) return;
    if (e.target.closest(".countdown-interactive-toolbar") || e.target.closest(".countdown-resize-corner")) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: xPercent,
      initY: yPercent
    };

    const handleMouseMove = (moveEvent) => {
      if (!dragStartRef.current) return;
      const deltaX = moveEvent.clientX - dragStartRef.current.startX;
      const deltaY = moveEvent.clientY - dragStartRef.current.startY;

      const stageRect = countdownBoxRef.current?.parentElement?.getBoundingClientRect();
      const scaleX = stageRect?.width ? canvasWidth / stageRect.width : 1;
      const scaleY = stageRect?.height ? canvasHeight / stageRect.height : 1;

      const deltaPercentX = (deltaX * scaleX / canvasWidth) * 100;
      const deltaPercentY = (deltaY * scaleY / canvasHeight) * 100;

      let nextX = Math.round((dragStartRef.current.initX + deltaPercentX) * 10) / 10;
      let nextY = Math.round((dragStartRef.current.initY + deltaPercentY) * 10) / 10;

      // Snapping to horizontal center (50%)
      if (Math.abs(nextX - 50) < 1.5) nextX = 50;
      // Snapping to vertical bounds
      if (Math.abs(nextY - 8) < 1.5) nextY = 8;
      if (Math.abs(nextY - 85) < 1.5) nextY = 85;

      // Strictly clamp within boundaries so countdown never leaves screen
      nextX = Math.max(minX, Math.min(maxX, nextX));
      nextY = Math.max(minY, Math.min(maxY, nextY));

      if (onPositionChange) {
        onPositionChange({ x: nextX, y: nextY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const fontFamily = config?.fontFamily || "'Segoe UI', sans-serif";
  const highlightColor = config?.highlightColor || "#fbbf24";
  const textColor = config?.textColor || "#ffffff";

  // On-Screen Font Size Adjustment via Mouse Wheel (Bounded to prevent screen overflow)
  useEffect(() => {
    const el = countdownBoxRef.current;
    if (!el || !isInteractive || !onFontSizeChange) return;

    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY < 0 ? 2 : -2;
      const step = e.shiftKey ? 10 : 2;
      const targetSize = numberFontSize + (delta > 0 ? step : -step);
      const nextSize = Math.max(12, Math.min(maxAllowedFontSize, targetSize));
      onFontSizeChange(nextSize);
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, [isInteractive, numberFontSize, maxAllowedFontSize, onFontSizeChange]);

  // On-Screen Font Size Adjustment via Drag Corner Handle (Bounded to prevent screen overflow)
  const handleResizeMouseDown = (e) => {
    if (!isInteractive || e.button !== 0 || !onFontSizeChange) return;
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startSize = numberFontSize;
    const stageRect = countdownBoxRef.current?.parentElement?.getBoundingClientRect();
    const scale = stageRect?.width ? stageRect.width / canvasWidth : 1;

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const effectiveDelta = ((deltaX + deltaY) / 2) / Math.max(0.1, scale);
      const targetSize = Math.round(startSize + effectiveDelta * 0.4);
      const nextSize = Math.max(12, Math.min(maxAllowedFontSize, targetSize));
      onFontSizeChange(nextSize);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Running text background bar (Kotak biasa, bisa diatur warna & opacity)
  const tickerBg = config?.tickerBgColor || "#000000";
  const tickerOpacity = typeof config?.tickerBgOpacity === "number" ? config.tickerBgOpacity : 0.8;
  const r = parseInt(tickerBg.slice(1, 3), 16) || 0;
  const g = parseInt(tickerBg.slice(3, 5), 16) || 0;
  const b = parseInt(tickerBg.slice(5, 7), 16) || 0;
  const tickerRgba = `rgba(${r}, ${g}, ${b}, ${tickerOpacity})`;

  const tickerPosition = config?.tickerPosition || "bottom"; // "bottom" or "top"

  const tickerSpeed = Math.max(5, Math.min(120, Number(config?.tickerSpeed) || 28));
  const rawTickerText = config?.tickerText?.trim() || "";
  const cleanTickerText =
    rawTickerText ||
    (forceVisible ? "Selamat Datang di Ibadah Raya • Mohon Mengkondisikan HP ke Mode Senyap" : "");
  const repeatCount = Math.max(4, Math.ceil(140 / Math.max(1, cleanTickerText.length)));
  const introTime = Math.max(4, Math.round(tickerSpeed * 0.45));

  const tickerStartedAt = Number(config?.tickerStartedAt) || 0;
  const elapsedSec = tickerStartedAt > 0 ? Math.max(0, (Date.now() - tickerStartedAt) / 1000) : 0;
  const isEntranceDone = elapsedSec >= introTime;

  const trackAnimation = isEntranceDone
    ? `fullwidthTickerLoop ${tickerSpeed}s linear infinite -${((elapsedSec - introTime) % tickerSpeed).toFixed(2)}s`
    : `fullwidthTickerEntrance ${introTime}s linear 1 -${elapsedSec.toFixed(2)}s forwards, fullwidthTickerLoop ${tickerSpeed}s linear infinite ${(introTime - elapsedSec).toFixed(2)}s`;

  return (
    <>
      {/* 1. Full-Width Running Text (Kotak biasa dari kanan ke kiri selebar layar) dengan Fade Smooth */}
      <AnimatePresence>
        {showTicker && (
          <motion.div
            key="running-ticker-bar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeInOut" }}
            className={`fullwidth-ticker-bar ${tickerPosition}`}
            style={{
              backgroundColor: tickerRgba,
              color: textColor,
              fontFamily,
              fontSize: `${textFontSize}px`
            }}
          >
            <div
              className="fullwidth-ticker-track"
              style={{
                animation: trackAnimation
              }}
            >
              {/* Stream 1 */}
              <div className="ticker-stream">
                {Array.from({ length: repeatCount }).map((_, i) => (
                  <span key={`s1-${i}`} className="ticker-text-item">
                    {cleanTickerText}&nbsp;&nbsp;&nbsp;&nbsp;✦&nbsp;&nbsp;&nbsp;&nbsp;
                  </span>
                ))}
              </div>
              {/* Stream 2 (Duplikasi untuk Seamless Infinite Loop Tanpa Jeda) */}
              <div className="ticker-stream" aria-hidden="true">
                {Array.from({ length: repeatCount }).map((_, i) => (
                  <span key={`s2-${i}`} className="ticker-text-item">
                    {cleanTickerText}&nbsp;&nbsp;&nbsp;&nbsp;✦&nbsp;&nbsp;&nbsp;&nbsp;
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Pure Countdown (Hanya Angka Murni, Tanpa Kotak & Tanpa Tulisan Geser) dengan Fade Smooth */}
      <AnimatePresence>
        {showCountdown && !hideCountdown && (
          <motion.div
            key="countdown-pure-digits"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            ref={countdownBoxRef}
            onMouseDown={handleMouseDown}
            className={`countdown-pure-text ${isInteractive ? "interactive-drag" : ""} ${isDragging ? "dragging" : ""} ${isResizing ? "resizing" : ""}`}
            style={{
              position: "absolute",
              left: `${xPercent}%`,
              top: `${yPercent}%`,
              transform: "translate(-50%, -50%)",
              color: highlightColor,
              fontFamily,
              fontSize: `${numberFontSize}px`,
              cursor: isInteractive ? (isDragging ? "grabbing" : "grab") : "default",
              userSelect: "none",
              zIndex: 96,
              pointerEvents: isInteractive ? "auto" : "none"
            }}
            title={
              isInteractive
                ? "Klik dan geser (drag) untuk memindahkan • Scroll mouse / klik ± untuk atur ukuran angka"
                : undefined
            }
          >
            {/* Floating on-hover toolbar in interactive preview */}
            {isInteractive && (
              <div
                className="countdown-interactive-toolbar"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="btn-size-mini"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFontSizeChange?.(Math.max(1, numberFontSize - (e.shiftKey ? 10 : 2)));
                  }}
                  title="Perkecil font (-2px, Shift: -10px)"
                  aria-label="Perkecil font countdown"
                >
                  –
                </button>
                <span className="size-badge-text" title="Ukuran Font">{numberFontSize}px</span>
                <button
                  type="button"
                  className="btn-size-mini"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFontSizeChange?.(numberFontSize + (e.shiftKey ? 10 : 2));
                  }}
                  title="Perbesar font (+2px, Shift: +10px)"
                  aria-label="Perbesar font countdown"
                >
                  +
                </button>
              </div>
            )}

            <div className={`countdown-digits ${isFinished && config?.finishAction === "hold" ? "blinking-hold" : ""}`}>
              <span className="digits-val">{timeString}</span>
            </div>

            {/* Resize Corner Handle in interactive preview */}
            {isInteractive && (
              <div
                className="countdown-resize-corner"
                onMouseDown={handleResizeMouseDown}
                title="Tarik untuk memperbesar / memperkecil ukuran countdown"
              >
                <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor">
                  <path
                    d="M14 14H10V12H12V10H14V14ZM14 6H12V8H14V6ZM6 14H8V12H6V14ZM14 2H12V4H14V2ZM2 14H4V12H2V14Z"
                    opacity="0.85"
                  />
                </svg>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
