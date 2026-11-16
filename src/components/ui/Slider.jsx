import { useRef, useCallback } from "react";

/**
 * Shadcn-styled Slider component
 * Follows Radix UI Slider specification with clean pointer-drag support
 */
export function Slider({
  value = 0,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  className = "",
  "aria-label": ariaLabel = "Slider"
}) {
  const trackRef = useRef(null);

  const numVal = typeof value === "number" && !isNaN(value) ? value : parseFloat(value) || 0;
  const clampedVal = Math.max(min, Math.min(max, numVal));
  const percentage = max > min ? Math.max(0, Math.min(100, ((clampedVal - min) / (max - min)) * 100)) : 0;

  const updateFromPointer = useCallback(
    (clientX) => {
      if (!trackRef.current || disabled) return;
      const rect = trackRef.current.getBoundingClientRect();
      const rawPct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const rawVal = min + rawPct * (max - min);

      // Snap to step
      const stepCount = Math.round((rawVal - min) / step);
      const steppedVal = Math.max(min, Math.min(max, min + stepCount * step));
      // Round to prevent floating point imprecision
      const precision = step.toString().split(".")[1]?.length || 0;
      const finalVal = Number(steppedVal.toFixed(precision));

      if (onChange && finalVal !== clampedVal) {
        onChange(finalVal);
      }
    },
    [min, max, step, disabled, clampedVal, onChange]
  );

  const handlePointerDown = (e) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromPointer(e.clientX);
  };

  const handlePointerMove = (e) => {
    if (disabled || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    updateFromPointer(e.clientX);
  };

  const handlePointerUp = (e) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    let nextVal = clampedVal;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      nextVal = Math.min(max, clampedVal + step);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      nextVal = Math.max(min, clampedVal - step);
    } else if (e.key === "Home") {
      nextVal = min;
    } else if (e.key === "End") {
      nextVal = max;
    } else {
      return;
    }
    e.preventDefault();
    const precision = step.toString().split(".")[1]?.length || 0;
    onChange?.(Number(nextVal.toFixed(precision)));
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={clampedVal}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      className={`shadcn-slider-root ${disabled ? "disabled" : ""} ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
    >
      <div className="shadcn-slider-track">
        <div
          className="shadcn-slider-range"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div
        className="shadcn-slider-thumb"
        style={{ left: `${percentage}%` }}
      />
    </div>
  );
}
