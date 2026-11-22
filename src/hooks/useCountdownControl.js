import { useState, useEffect, useRef, useCallback } from "react";

const INITIAL_COUNTDOWN_RUNTIME = {
  isRunning: false,
  isPaused: false,
  targetEndTimeMs: 0,
  remainingSeconds: 0,
  isFinished: false
};

/**
 * Manages countdown timer runtime, ticker overlay toggles, and BroadcastChannel sync.
 */
export function useCountdownControl({ config, setConfig, safeBroadcast }) {
  const [countdownRuntime, setCountdownRuntime] = useState(() => ({ ...INITIAL_COUNTDOWN_RUNTIME }));
  const countdownRuntimeRef = useRef(countdownRuntime);
  countdownRuntimeRef.current = countdownRuntime;

  const handleStartCountdown = useCallback(() => {
    // If paused with remaining seconds, continue from the last remaining second!
    if (countdownRuntime.isPaused && countdownRuntime.remainingSeconds > 0) {
      const rem = countdownRuntime.remainingSeconds;
      const endMs = Date.now() + rem * 1000;
      const nextRuntime = {
        isRunning: true,
        isPaused: false,
        initialTotalSeconds: countdownRuntime.initialTotalSeconds || rem,
        targetEndTimeMs: endMs,
        remainingSeconds: rem,
        isFinished: false
      };
      setCountdownRuntime(nextRuntime);
      safeBroadcast({
        type: "COUNTDOWN_RUNTIME_UPDATE",
        runtime: nextRuntime
      });
      return;
    }

    const ov = config.countdownOverlay;
    let totalSeconds = 0;

    if (ov?.timerType === "target" && ov?.targetTime) {
      const parts = String(ov.targetTime).split(":");
      const targetDate = new Date();
      targetDate.setHours(
        parseInt(parts[0], 10) || 0,
        parseInt(parts[1], 10) || 0,
        parseInt(parts[2], 10) || 0,
        0
      );
      let diffMs = targetDate.getTime() - Date.now();
      if (diffMs < 0) {
        diffMs += 24 * 60 * 60 * 1000;
      }
      totalSeconds = Math.max(1, Math.floor(diffMs / 1000));
    } else {
      const hrs = Number(ov?.durationHours) || 0;
      const mins = Number(ov?.durationMinutes) || 0;
      const secs = Number(ov?.durationSeconds) || 0;
      totalSeconds = hrs * 3600 + mins * 60 + secs;
      if (totalSeconds <= 0) totalSeconds = 300;
    }

    const endMs = Date.now() + totalSeconds * 1000;
    const nextRuntime = {
      isRunning: true,
      isPaused: false,
      initialTotalSeconds: totalSeconds,
      targetEndTimeMs: endMs,
      remainingSeconds: totalSeconds,
      isFinished: false
    };
    setCountdownRuntime(nextRuntime);
    safeBroadcast({
      type: "COUNTDOWN_RUNTIME_UPDATE",
      runtime: nextRuntime
    });
  }, [config.countdownOverlay, countdownRuntime, safeBroadcast]);

  const handlePauseCountdown = useCallback(() => {
    setCountdownRuntime((prev) => {
      const now = Date.now();
      const maxSec = prev.initialTotalSeconds || Infinity;
      const rem = Math.max(0, Math.min(maxSec, Math.ceil((prev.targetEndTimeMs - now) / 1000)));
      const nextRuntime = {
        ...prev,
        isPaused: true,
        remainingSeconds: rem
      };
      safeBroadcast({
        type: "COUNTDOWN_RUNTIME_UPDATE",
        runtime: nextRuntime
      });
      return nextRuntime;
    });
  }, [safeBroadcast]);

  const handleResetCountdown = useCallback(() => {
    const nextRuntime = {
      isRunning: false,
      isPaused: false,
      initialTotalSeconds: 0,
      targetEndTimeMs: 0,
      remainingSeconds: 0,
      isFinished: false
    };
    setCountdownRuntime(nextRuntime);
    safeBroadcast({
      type: "COUNTDOWN_RUNTIME_UPDATE",
      runtime: nextRuntime
    });
  }, [safeBroadcast]);

  const handleCountdownPositionChange = useCallback(
    (newPos) => {
      setConfig((prev) => ({
        ...prev,
        countdownOverlay: {
          ...(prev.countdownOverlay || {}),
          position: newPos,
          presetPosition: "custom"
        }
      }));
    },
    [setConfig]
  );

  const handleCountdownFontSizeChange = useCallback(
    (newSize) => {
      const safeSize = Math.max(1, Math.round(Number(newSize) || 48));
      setConfig((prev) => ({
        ...prev,
        countdownOverlay: {
          ...(prev.countdownOverlay || {}),
          numberFontSize: safeSize
        }
      }));
    },
    [setConfig]
  );

  const handleToggleCountdownOverlay = useCallback(() => {
    setConfig((prev) => {
      const ov = prev.countdownOverlay || {};
      const nextEnabled = !ov.countdownEnabled;
      return {
        ...prev,
        countdownOverlay: {
          ...ov,
          countdownEnabled: nextEnabled
        }
      };
    });
  }, [setConfig]);

  const handleToggleTickerOverlay = useCallback(() => {
    setConfig((prev) => {
      const ov = prev.countdownOverlay || {};
      const nextEnabled = !ov.tickerEnabled;
      return {
        ...prev,
        countdownOverlay: {
          ...ov,
          tickerEnabled: nextEnabled,
          tickerStartedAt: nextEnabled ? Date.now() : 0
        }
      };
    });
  }, [setConfig]);

  // Master countdown timer ticker
  useEffect(() => {
    if (!countdownRuntime.isRunning || countdownRuntime.isPaused) return;

    const scheduleHideCountdown = (delayMs) => {
      setTimeout(() => {
        setConfig((prev) => ({
          ...prev,
          countdownOverlay: {
            ...(prev.countdownOverlay || {}),
            countdownEnabled: false
          }
        }));
        setCountdownRuntime((prev) => {
          const finishedState = {
            ...prev,
            isRunning: false,
            isPaused: false,
            isFinished: false
          };
          safeBroadcast({
            type: "COUNTDOWN_RUNTIME_UPDATE",
            runtime: finishedState
          });
          return finishedState;
        });
      }, delayMs);
    };

    const timer = setInterval(() => {
      const now = Date.now();
      const diffMs = countdownRuntime.targetEndTimeMs - now;
      const maxSec = countdownRuntime.initialTotalSeconds || Infinity;
      const rem = Math.max(0, Math.min(maxSec, Math.ceil(diffMs / 1000)));

      if (rem <= 0) {
        setCountdownRuntime((prev) => {
          const next = {
            ...prev,
            remainingSeconds: 0,
            isFinished: true
          };
          safeBroadcast({
            type: "COUNTDOWN_RUNTIME_UPDATE",
            runtime: next
          });
          return next;
        });
        clearInterval(timer);

        // If finishAction is "custom-text", wait 3.6s (3s display message + 0.6s smooth fade out) before cleanly turning off countdown
        const finishAction = config.countdownOverlay?.finishAction;
        if (finishAction === "custom-text") {
          scheduleHideCountdown(3600);
        } else if (finishAction === "auto-hide") {
          scheduleHideCountdown(600);
        }
      } else {
        setCountdownRuntime((prev) => ({
          ...prev,
          remainingSeconds: rem
        }));
      }
    }, 500);

    return () => clearInterval(timer);
  }, [
    countdownRuntime.isRunning,
    countdownRuntime.isPaused,
    countdownRuntime.targetEndTimeMs,
    countdownRuntime.initialTotalSeconds,
    config.countdownOverlay?.finishAction,
    setConfig,
    safeBroadcast
  ]);

  return {
    countdownRuntime,
    countdownRuntimeRef,
    handleStartCountdown,
    handlePauseCountdown,
    handleResetCountdown,
    handleCountdownPositionChange,
    handleCountdownFontSizeChange,
    handleToggleCountdownOverlay,
    handleToggleTickerOverlay
  };
}
