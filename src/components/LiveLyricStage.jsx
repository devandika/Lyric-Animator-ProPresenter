import { useEffect, useId, useRef } from "react";
import {
  ANIMATION_PRESETS,
  buildLyricDOM,
  runLyricAnimation
} from "../lib/animationPresets";
import {
  getAllAnimationPresets,
  getAllTextEffectPresets
} from "../lib/customPresetManager";
import {
  DEFAULT_PROPRESENTER_TRANSITION,
  isCutTransition
} from "../lib/propresenterTransitions";
import {
  TEXT_EFFECT_PRESETS,
  startTextEffectLoop
} from "../lib/textEffectEngine";

const naturalLineHeightCache = new Map();

function getNaturalFontLineHeightRatio(
  fontFamily,
  fontWeight = 700,
  fontStyle = "normal"
) {
  const key = `${fontFamily || "sans-serif"}__${fontWeight}__${fontStyle}`;
  const cached = naturalLineHeightCache.get(key);
  if (cached !== undefined) return cached;

  let ratio = 1.21;
  let measuredRealDom = false;
  if (typeof document !== "undefined" && document.body) {
    try {
      const probe = document.createElement("span");
      probe.textContent = "Hg";
      probe.style.cssText =
        "position:fixed;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;white-space:nowrap;padding:0;margin:0;border:0;line-height:normal;font-synthesis:none;font-size:200px;";
      probe.style.fontFamily = fontFamily || "sans-serif";
      probe.style.fontWeight = String(fontWeight || 700);
      probe.style.fontStyle = fontStyle || "normal";
      document.body.appendChild(probe);
      const h = probe.getBoundingClientRect().height;
      probe.remove();
      if (Number.isFinite(h) && h > 100 && h < 500) {
        ratio = Number((h / 200).toFixed(4));
        measuredRealDom = true;
      }
    } catch (_) {}
  }

  if (measuredRealDom && naturalLineHeightCache.size < 256) {
    naturalLineHeightCache.set(key, ratio);
  }
  return ratio;
}

export function computeProPresenterLineHeight({
  fontSize = 64,
  fontFamily = "Inter, sans-serif",
  fontWeight = 700,
  fontStyle = "normal",
  lineHeight = 1.2,
  lineHeightMultiple = null,
  lineSpacing = 0,
  minimumLineHeight = 0,
  maximumLineHeight = 0,
  exactLineHeight = 0
}) {
  const baseSize = Math.max(8, Number(fontSize) || 64);
  const hasProMetrics =
    lineHeightMultiple !== null ||
    Number(exactLineHeight) > 0 ||
    Boolean(Number(lineSpacing)) ||
    Number(minimumLineHeight) > 0 ||
    Number(maximumLineHeight) > 0;

  if (!hasProMetrics) {
    return Number(lineHeight) || 1.2;
  }

  const naturalRatio = getNaturalFontLineHeightRatio(fontFamily, fontWeight, fontStyle);
  const mult = Number(lineHeightMultiple) > 0 ? Number(lineHeightMultiple) : 1.0;
  let linePx =
    Number(exactLineHeight) > 0
      ? Number(exactLineHeight)
      : baseSize * naturalRatio * mult;

  if (!(Number(exactLineHeight) > 0)) {
    if (Number(minimumLineHeight) > 0) {
      linePx = Math.max(linePx, Number(minimumLineHeight));
    }
    if (Number(maximumLineHeight) > 0) {
      linePx = Math.min(linePx, Number(maximumLineHeight));
    }
  }

  linePx += Number(lineSpacing) || 0;
  const minAllowedPx = baseSize * 0.55;
  return Number((Math.max(minAllowedPx, linePx) / baseSize).toFixed(4));
}

function applyStyleVarsToElement(el, styleVars) {
  if (!el || !styleVars) return;
  for (const [prop, val] of Object.entries(styleVars)) {
    if (prop.startsWith("--") && val !== undefined && val !== null) {
      el.style.setProperty(prop, String(val));
    }
  }
  const rows = el.querySelectorAll?.(".lyric-line-row");
  if (rows && rows.length > 0) {
    const scales = styleVars._lineFontScales;
    const valid = Array.isArray(scales) && scales.length === rows.length;
    rows.forEach((row, idx) => {
      const s = valid ? Number(scales[idx]) : 1;
      if (valid && Number.isFinite(s) && s > 0 && Math.abs(s - 1) >= 0.02) {
        row.style.setProperty("--lyric-line-scale", String(s));
      } else {
        row.style.removeProperty("--lyric-line-scale");
      }
    });
  }
}

function startSmoothFade(el, fromOpacity, toOpacity, durationSeconds, onDone) {
  if (!el) {
    onDone?.();
    return null;
  }
  const ms = Math.max(16, Math.round((Number(durationSeconds) || 0.5) * 1000));
  el.style.willChange = "opacity";
  el.style.opacity = String(fromOpacity);
  const anim = el.animate([{ opacity: fromOpacity }, { opacity: toOpacity }], {
    duration: ms,
    easing: "cubic-bezier(0.25, 0.1, 0.25, 1)",
    fill: "forwards"
  });

  let settled = false;
  const finish = (canceled = false) => {
    if (settled) return;
    settled = true;
    onDone?.(canceled, anim);
  };
  const fallback = setTimeout(() => finish(false), ms + 40);
  anim.finished
    .then(() => {
      clearTimeout(fallback);
      finish(false);
    })
    .catch(() => {
      clearTimeout(fallback);
      finish(true);
    });
  return anim;
}

export function LiveLyricStage({
  text = "",
  presetId = "cinematic-blur",
  durationSeconds = 1.0,
  animationEnabled = true,
  textEffectEnabled = false,
  textEffectId = "ae-wiggle-pos",
  textEffectIntensity = 1.0,
  textEffectSpeed = 1.0,
  proSlideTransition = null,
  hasPendingThemeChangeRef = null,
  fontSize = 64,
  fontFamily = "Inter, sans-serif",
  fontWeight = 700,
  fontStyle = "normal",
  textColor = "#ffffff",
  textShadow = "0 4px 24px rgba(0,0,0,0.85), 0 2px 8px rgba(0,0,0,0.9)",
  textAlign = "center", // "left" | "center" | "right" | "justify"
  verticalAlign = "center", // "top" | "center" | "middle" | "bottom"
  scaleBehavior = "none", // "none" | "adjust-container-height" | "scale-down" | "scale-up" | "scale-up-down"
  textTransform = "none",
  lineHeight = 1.2,
  lineHeightMultiple = null,
  lineSpacing = 0,
  minimumLineHeight = 0,
  maximumLineHeight = 0,
  exactLineHeight = 0,
  paragraphSpacing = 0,
  lineFontScales = null,
  letterSpacing = 0,
  textStrokeWidth = 0,
  textStrokeColor = "transparent",
  padding = "48px",
  lineBackground = null,
  className = "",
  onBeforeEnter = null
}) {
  const reactId = useId();
  const svgFilterId = `lyric-fx-turb-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const containerRef = useRef(null);
  const svgTurbulenceRef = useRef(null);
  const svgDisplacementRef = useRef(null);
  const currentDOMRef = useRef(null);
  const fxControllerRef = useRef(null);
  const fxDomOwnerRef = useRef(null);
  const runIdRef = useRef(0);
  const queueRef = useRef(Promise.resolve());
  const isExitingRef = useRef(false);
  const animationEnabledRef = useRef(animationEnabled);
  animationEnabledRef.current = animationEnabled;
  const textEffectRef = useRef({
    enabled: Boolean(textEffectEnabled),
    effectId: textEffectId,
    intensity: textEffectIntensity,
    speed: textEffectSpeed
  });
  textEffectRef.current = {
    enabled: Boolean(textEffectEnabled),
    effectId: textEffectId,
    intensity: textEffectIntensity,
    speed: textEffectSpeed
  };
  const proSlideTransitionRef = useRef(proSlideTransition);
  proSlideTransitionRef.current = proSlideTransition;
  const onBeforeEnterRef = useRef(onBeforeEnter);
  onBeforeEnterRef.current = onBeforeEnter;

  const justifyContent =
    verticalAlign === "bottom"
      ? "flex-end"
      : verticalAlign === "top"
      ? "flex-start"
      : "center";

  const alignItems =
    textAlign === "left"
      ? "flex-start"
      : textAlign === "right"
      ? "flex-end"
      : "center";

  const hasLineBg = Boolean(lineBackground?.enabled);
  const lineBgFill =
    lineBackground?.fillBg?.backgroundColor ||
    lineBackground?.fillBg?.backgroundImage ||
    lineBackground?.fillBg?.background ||
    "transparent";

  const effectiveLineHeight = computeProPresenterLineHeight({
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle,
    lineHeight,
    lineHeightMultiple,
    lineSpacing,
    minimumLineHeight,
    maximumLineHeight,
    exactLineHeight
  });

  const baseSizePx = Math.max(8, Number(fontSize) || 64);
  const paraGapPx = Math.max(0, Number(paragraphSpacing) || 0);
  const paragraphSpacingCss =
    paraGapPx > 0
      ? `calc(var(--lyric-font-size, ${baseSizePx}px) * ${Number((paraGapPx / baseSizePx).toFixed(4))})`
      : "0px";

  const styleVars = {
    "--lyric-font-size": `${fontSize}px`,
    "--lyric-font-family": fontFamily,
    "--lyric-font-weight": fontWeight,
    "--lyric-font-style": fontStyle,
    "--lyric-color": textColor,
    "--lyric-shadow": textShadow,
    "--lyric-text-align": textAlign,
    "--lyric-text-transform": textTransform,
    "--lyric-line-height": effectiveLineHeight,
    "--lyric-paragraph-spacing": paragraphSpacingCss,
    "--lyric-letter-spacing": `${letterSpacing}px`,
    "--lyric-stroke-width": textStrokeWidth > 0 ? `${textStrokeWidth}px` : "0px",
    "--lyric-stroke-color": textStrokeColor || "transparent",
    "--stage-justify": justifyContent,
    "--stage-align": alignItems,
    "--stage-padding": padding,
    "--lyric-line-bg": hasLineBg ? lineBgFill : "transparent",
    "--lyric-line-radius": hasLineBg ? `${lineBackground.cornerRadius ?? 8}px` : "0px",
    "--lyric-line-pad-x": hasLineBg ? `${lineBackground.paddingX ?? 24}px` : "0px",
    "--lyric-line-pad-y": hasLineBg ? `${lineBackground.paddingY ?? 6}px` : "0px",
    "--lyric-line-margin-y": hasLineBg ? "6px" : "0px",
    "--lyric-line-offset-y": hasLineBg ? `${lineBackground.offsetY || 0}px` : "0px",
    "--lyric-line-border": hasLineBg && lineBackground.strokeCss ? lineBackground.strokeCss : "none",
    "--lyric-line-shadow": hasLineBg && lineBackground.shadowCss ? lineBackground.shadowCss : "none"
  };

  const domStyleVars = {
    ...styleVars,
    _lineFontScales: lineFontScales
  };

  const styleVarsRef = useRef(domStyleVars);
  styleVarsRef.current = domStyleVars;
  const fontFitRef = useRef({ baseFontSize: fontSize, scaleBehavior });
  fontFitRef.current = { baseFontSize: fontSize, scaleBehavior };

  const fitPhraseToStageBox = (phraseEl) => {
    const stage = containerRef.current;
    if (!stage || !phraseEl || !phraseEl.isConnected) return;
    const { baseFontSize, scaleBehavior: behavior } = fontFitRef.current;
    const numericBase = Math.max(8, Number(baseFontSize) || 64);
    phraseEl.style.setProperty("--lyric-font-size", `${numericBase}px`);

    const shouldScaleDown =
      behavior === "scale-down" || behavior === "scale-up-down";
    // Match ProPresenter 1:1: never shrink font size when Scale Behavior is "none"!
    if (!shouldScaleDown) return;

    const stageStyle = getComputedStyle(stage);
    const padTop = parseFloat(stageStyle.paddingTop) || 0;
    const padBottom = parseFloat(stageStyle.paddingBottom) || 0;
    const availH = stage.clientHeight - padTop - padBottom;
    if (availH <= 24) return;

    if (phraseEl.scrollHeight <= availH * 1.01) return;

    let lo = Math.max(10, Math.floor(numericBase * 0.35));
    let hi = numericBase;
    let best = lo;
    for (let iter = 0; iter < 8; iter++) {
      const mid = Math.floor((lo + hi) / 2);
      phraseEl.style.setProperty("--lyric-font-size", `${mid}px`);
      if (phraseEl.scrollHeight <= availH * 1.01) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    phraseEl.style.setProperty("--lyric-font-size", `${best}px`);
  };

  // Keep active phrase synchronized if theme properties change live on the same slide
  // Never overwrite styles while clearing (text === "") or exiting, to avoid mid-fade geometry/font jumps.
  useEffect(() => {
    if (
      String(text || "").trim() &&
      !isExitingRef.current &&
      currentDOMRef.current &&
      !currentDOMRef.current.exiting &&
      currentDOMRef.current.container?.isConnected
    ) {
      applyStyleVarsToElement(currentDOMRef.current.container, styleVarsRef.current);
      fitPhraseToStageBox(currentDOMRef.current.container);
      currentDOMRef.current.styleVars = { ...styleVarsRef.current };
      currentDOMRef.current.hasLineBg = hasLineBg;
      const pills = currentDOMRef.current.container.querySelectorAll(".lyric-line-pill");
      pills.forEach((p) => p.classList.toggle("has-line-bg", hasLineBg));
    }
  }, [
    text,
    lineBackground,
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle,
    textColor,
    textAlign,
    verticalAlign,
    scaleBehavior,
    textTransform,
    lineHeight,
    lineHeightMultiple,
    lineSpacing,
    minimumLineHeight,
    maximumLineHeight,
    exactLineHeight,
    paragraphSpacing,
    lineFontScales,
    letterSpacing,
    textStrokeWidth,
    textStrokeColor,
    textShadow,
    padding
  ]);

  const getDesiredEffectTarget = () => {
    const fx = textEffectRef.current;
    if (!fx.enabled) return "whole";
    const allEffects = getAllTextEffectPresets();
    const fxPreset = allEffects[fx.effectId] || allEffects["ae-wiggle-pos"] || TEXT_EFFECT_PRESETS["ae-wiggle-pos"];
    return fxPreset.target || "whole";
  };

  const stopTextEffect = () => {
    if (fxControllerRef.current) {
      fxControllerRef.current.stop();
      fxControllerRef.current = null;
    }
    fxDomOwnerRef.current = null;
  };

  const syncTextEffect = (domArg = currentDOMRef.current) => {
    const fx = textEffectRef.current;
    const stage = containerRef.current;
    let dom = domArg;

    if (!fx.enabled || !dom || !dom.container?.isConnected) {
      stopTextEffect();
      return;
    }

    const neededTarget = getDesiredEffectTarget();
    if (dom.effectTarget !== neededTarget && !isExitingRef.current && stage) {
      const rebuilt = buildLyricDOM(dom.text, dom.animTarget || "whole", "active-lyric-phrase", {
        maskClip: dom.maskClip || false,
        effectTarget: neededTarget,
        hasLineBg
      });
      applyStyleVarsToElement(rebuilt.container, styleVarsRef.current);
      rebuilt.preset = dom.preset;
      rebuilt.text = dom.text;
      rebuilt.maskClip = dom.maskClip || false;
      rebuilt.styleVars = { ...styleVarsRef.current };
      rebuilt.hasLineBg = hasLineBg;
      stopTextEffect();
      dom.container.replaceWith(rebuilt.container);
      currentDOMRef.current = rebuilt;
      dom = rebuilt;
    }

    if (fxControllerRef.current && fxDomOwnerRef.current === dom.fxWhole) {
      fxControllerRef.current.updateParams({
        effectId: fx.effectId,
        intensity: fx.intensity,
        speed: fx.speed
      });
      return;
    }

    stopTextEffect();
    fxDomOwnerRef.current = dom.fxWhole;
    fxControllerRef.current = startTextEffectLoop({
      dom,
      effectId: fx.effectId,
      intensity: fx.intensity,
      speed: fx.speed,
      svgTurbulenceEl: svgTurbulenceRef.current,
      svgDisplacementEl: svgDisplacementRef.current,
      svgFilterId
    });
  };

  // Update continuous text effect live without re-running enter/exit animations
  useEffect(() => {
    syncTextEffect(currentDOMRef.current);
  }, [textEffectEnabled, textEffectId, textEffectIntensity, textEffectSpeed]);

  useEffect(() => {
    return () => {
      stopTextEffect();
    };
  }, []);

  useEffect(() => {
    const stage = containerRef.current;
    if (!stage) return;

    const myRunId = ++runIdRef.current;
    const allPresets = getAllAnimationPresets();
    const preset = allPresets[presetId] || allPresets["cinematic-blur"] || ANIMATION_PRESETS["cinematic-blur"];
    const targetMode = preset.target || "per-word";
    const trimmed = String(text || "").trim();

    queueRef.current = queueRef.current.then(async () => {
      // Skip intermediate stale slide updates if a newer one is already queued
      if (myRunId !== runIdRef.current) return;

      const isAnimEnabled = animationEnabledRef.current !== false;
      const proTr = proSlideTransitionRef.current || DEFAULT_PROPRESENTER_TRANSITION;
      const prev = currentDOMRef.current;

      if (prev && prev.container.isConnected && prev.text === trimmed) {
        // If a theme/layout change is pending on the same text, flush it so parent never gets stuck in transitioning-out state.
        if (hasPendingThemeChangeRef?.current?.() && onBeforeEnterRef.current) {
          await onBeforeEnterRef.current(trimmed);
          if (myRunId !== runIdRef.current) return;
        }
        // Text is already active on screen.
        // Synchronize updated style vars (e.g. lineBackground fill, font metrics) live without restarting enter/exit animation.
        applyStyleVarsToElement(prev.container, styleVarsRef.current);
        prev.styleVars = { ...styleVarsRef.current };
        prev.hasLineBg = hasLineBg;
        const pills = prev.container.querySelectorAll(".lyric-line-pill");
        pills.forEach((p) => p.classList.toggle("has-line-bg", hasLineBg));
        return;
      }

      // If Animasi button is OFF, follow user-selected offTransitionMode (Fade crossfade or Cut)
      if (!isAnimEnabled) {
        const isCut = isCutTransition(proTr);
        const prevConnected = Boolean(prev && prev.container.isConnected);

        // If transitioning directly from an animated song slide to a non-animated slide (e.g. Bible verse),
        // finish the song's exit animation first before switching theme and fading in the new slide.
        if (prevConnected && !prev.enteredWithoutAnim) {
          isExitingRef.current = true;
          const exitPreset = prev.preset || preset;
          const exitTarget = exitPreset.target || "per-word";
          const exitMaskClip = exitPreset.maskClip || false;
          let exitDom = prev;

          if (prev.animTarget !== exitTarget || (prev.maskClip || false) !== exitMaskClip) {
            stopTextEffect();
            const rebuilt = buildLyricDOM(prev.text, exitTarget, "active-lyric-phrase", {
              maskClip: exitMaskClip,
              effectTarget: "whole",
              hasLineBg: prev.hasLineBg ?? hasLineBg
            });
            applyStyleVarsToElement(rebuilt.container, prev.styleVars || styleVarsRef.current);
            prev.container.replaceWith(rebuilt.container);
            exitDom = rebuilt;
          }

          await new Promise((resolve) => {
            runLyricAnimation({
              container: exitDom.container,
              units: exitDom.units,
              phase: "exit",
              preset: exitPreset,
              durationSeconds,
              onFinished: () => {
                stopTextEffect();
                exitDom.container.remove();
                resolve();
              }
            });
          });
          isExitingRef.current = false;
          currentDOMRef.current = null;
          if (myRunId !== runIdRef.current) return;

          if (onBeforeEnterRef.current) {
            await onBeforeEnterRef.current(trimmed);
            if (myRunId !== runIdRef.current) return;
          }
          if (!trimmed) {
            stopTextEffect();
            return;
          }

          const next = buildLyricDOM(trimmed, "whole", "active-lyric-phrase", {
            maskClip: false,
            effectTarget: getDesiredEffectTarget(),
            hasLineBg
          });
          applyStyleVarsToElement(next.container, styleVarsRef.current);
          next.preset = preset;
          next.text = trimmed;
          next.maskClip = false;
          next.styleVars = { ...styleVarsRef.current };
          next.hasLineBg = hasLineBg;
          next.enteredWithoutAnim = true;

          if (isCut) {
            stage.appendChild(next.container);
            fitPhraseToStageBox(next.container);
            currentDOMRef.current = next;
            syncTextEffect(next);
            return;
          }

          next.container.style.opacity = "0";
          stage.appendChild(next.container);
          fitPhraseToStageBox(next.container);
          currentDOMRef.current = next;
          syncTextEffect(next);
          startSmoothFade(next.container, 0, 1, proTr.durationSeconds, (canceled, anim) => {
            if (canceled || next.exiting) return;
            next.container.style.opacity = "1";
            next.container.style.willChange = "";
            try {
              anim?.cancel();
            } catch (_) {}
          });
          return;
        }

        if (isCut) {
          stopTextEffect();
          stage.replaceChildren();
          currentDOMRef.current = null;
          if (onBeforeEnterRef.current) {
            await onBeforeEnterRef.current(trimmed);
            if (myRunId !== runIdRef.current) return;
          }
          if (!trimmed) {
            return;
          }

          const next = buildLyricDOM(trimmed, "whole", "active-lyric-phrase", {
            maskClip: false,
            effectTarget: getDesiredEffectTarget(),
            hasLineBg
          });
          applyStyleVarsToElement(next.container, styleVarsRef.current);
          next.preset = preset;
          next.text = trimmed;
          next.maskClip = false;
          next.styleVars = { ...styleVarsRef.current };
          next.hasLineBg = hasLineBg;
          next.enteredWithoutAnim = true;
          stage.appendChild(next.container);
          fitPhraseToStageBox(next.container);
          currentDOMRef.current = next;
          syncTextEffect(next);
          return;
        }

        // Fade mode: fade out on Clear, or non-blocking simultaneous crossfade between slides
        if (prevConnected && !trimmed) {
          isExitingRef.current = true;
          prev.exiting = true;
          const startOp = parseFloat(getComputedStyle(prev.container).opacity);
          const fromOp = Number.isFinite(startOp) ? startOp : 1;
          prev.container.getAnimations?.().forEach((a) => {
            try {
              a.cancel();
            } catch (_) {}
          });
          await new Promise((resolve) => {
            startSmoothFade(prev.container, fromOp, 0, proTr.durationSeconds, () => {
              stopTextEffect();
              prev.container.remove();
              resolve();
            });
          });
          isExitingRef.current = false;
          currentDOMRef.current = null;
          if (myRunId !== runIdRef.current) return;
          if (onBeforeEnterRef.current) {
            await onBeforeEnterRef.current(trimmed);
          }
          return;
        }

        let prevSnapshot = null;
        if (prevConnected) {
          // Measure geometry & current opacity BEFORE setting position:absolute so flex alignment doesn't jump
          const startOp = parseFloat(getComputedStyle(prev.container).opacity);
          prevSnapshot = {
            left: prev.container.offsetLeft,
            top: prev.container.offsetTop,
            width: prev.container.offsetWidth,
            height: prev.container.offsetHeight,
            fromOpacity: Number.isFinite(startOp) ? startOp : 1
          };
          prev.exiting = true;
          prev.container.getAnimations?.().forEach((a) => {
            try {
              a.cancel();
            } catch (_) {}
          });
          prev.container.style.position = "absolute";
          prev.container.style.left = `${prevSnapshot.left}px`;
          prev.container.style.top = `${prevSnapshot.top}px`;
          prev.container.style.width = `${prevSnapshot.width}px`;
          prev.container.style.height = `${prevSnapshot.height}px`;
          prev.container.style.pointerEvents = "none";
          prev.container.style.opacity = String(prevSnapshot.fromOpacity);
        }

        if (onBeforeEnterRef.current) {
          await onBeforeEnterRef.current(trimmed);
          if (myRunId !== runIdRef.current) return;
        }

        if (!trimmed) {
          stopTextEffect();
          return;
        }

        const next = buildLyricDOM(trimmed, "whole", "active-lyric-phrase", {
          maskClip: false,
          effectTarget: getDesiredEffectTarget(),
          hasLineBg
        });
        applyStyleVarsToElement(next.container, styleVarsRef.current);
        next.preset = preset;
        next.text = trimmed;
        next.maskClip = false;
        next.styleVars = { ...styleVarsRef.current };
        next.hasLineBg = hasLineBg;
        next.enteredWithoutAnim = true;
        next.container.style.opacity = "0";

        stage.appendChild(next.container);
        fitPhraseToStageBox(next.container);
        currentDOMRef.current = next;
        syncTextEffect(next);

        if (prevSnapshot && prev.container.isConnected) {
          startSmoothFade(prev.container, prevSnapshot.fromOpacity, 0, proTr.durationSeconds, () => {
            prev.container.remove();
          });
        }

        startSmoothFade(next.container, 0, 1, proTr.durationSeconds, (canceled, anim) => {
          if (canceled || next.exiting) return;
          next.container.style.opacity = "1";
          next.container.style.willChange = "";
          try {
            anim?.cancel();
          } catch (_) {}
        });
        return;
      }

      // Animasi button is ON: animate OUT previous phrase using the currently selected preset
      // (while preserving the previous slide's snapshotted theme/styles).
      // Exception: if the previous phrase entered without animation (e.g. Bible verse / Liturgi mode),
      // fade it out smoothly in place without rebuilding DOM or playing a song exit animation.
      if (prev && prev.container.isConnected) {
        isExitingRef.current = true;
        if (prev.enteredWithoutAnim) {
          prev.exiting = true;
          const startOp = parseFloat(getComputedStyle(prev.container).opacity);
          const fromOp = Number.isFinite(startOp) ? startOp : 1;
          prev.container.getAnimations?.().forEach((a) => {
            try {
              a.cancel();
            } catch (_) {}
          });
          await new Promise((resolve) => {
            startSmoothFade(prev.container, fromOp, 0, Math.max(0.15, Number(proTr?.durationSeconds) || 0.5), () => {
              stopTextEffect();
              prev.container.remove();
              resolve();
            });
          });
          isExitingRef.current = false;
          currentDOMRef.current = null;
        } else {
          const exitPreset = preset;
          const exitTarget = exitPreset.target || "per-word";
          const exitMaskClip = exitPreset.maskClip || false;
          let exitDom = prev;

          if (prev.animTarget !== exitTarget || (prev.maskClip || false) !== exitMaskClip) {
            stopTextEffect();
            const rebuilt = buildLyricDOM(prev.text, exitTarget, "active-lyric-phrase", {
              maskClip: exitMaskClip,
              effectTarget: "whole",
              hasLineBg: prev.hasLineBg ?? hasLineBg
            });
            applyStyleVarsToElement(rebuilt.container, prev.styleVars || styleVarsRef.current);
            prev.container.replaceWith(rebuilt.container);
            exitDom = rebuilt;
          }

          await new Promise((resolve) => {
            runLyricAnimation({
              container: exitDom.container,
              units: exitDom.units,
              phase: "exit",
              preset: exitPreset,
              durationSeconds,
              onFinished: () => {
                stopTextEffect();
                exitDom.container.remove();
                resolve();
              }
            });
          });
          isExitingRef.current = false;
          currentDOMRef.current = null;
        }
      }

      if (myRunId !== runIdRef.current) return;

      // Allow parent theme container to commit next slide's theme right after exit finishes
      if (onBeforeEnterRef.current) {
        await onBeforeEnterRef.current(trimmed);
        if (myRunId !== runIdRef.current) return;
      }

      if (!trimmed) {
        stopTextEffect();
        return;
      }

      const next = buildLyricDOM(trimmed, targetMode, "active-lyric-phrase", {
        maskClip: preset.maskClip || false,
        effectTarget: getDesiredEffectTarget(),
        hasLineBg
      });
      applyStyleVarsToElement(next.container, styleVarsRef.current);
      next.preset = preset;
      next.text = trimmed;
      next.maskClip = preset.maskClip || false;
      next.styleVars = { ...styleVarsRef.current };
      next.hasLineBg = hasLineBg;
      stage.appendChild(next.container);
      fitPhraseToStageBox(next.container);
      currentDOMRef.current = next;
      syncTextEffect(next);

      runLyricAnimation({
        container: next.container,
        units: next.units,
        phase: "enter",
        preset,
        durationSeconds
      });
    })
      .catch((err) => {
        isExitingRef.current = false;
        console.warn("LiveLyricStage transition error:", err);
      });
  }, [text, presetId, durationSeconds, lineBackground]);

  return (
    <>
      <svg
        width="0"
        height="0"
        aria-hidden="true"
        style={{
          position: "absolute",
          width: 0,
          height: 0,
          overflow: "hidden",
          pointerEvents: "none"
        }}
      >
        <defs>
          <filter
            id={svgFilterId}
            x="-15%"
            y="-25%"
            width="130%"
            height="150%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              ref={svgTurbulenceRef}
              type="turbulence"
              baseFrequency="0.015 0.025"
              numOctaves="2"
              seed="2"
              result="noise"
            />
            <feDisplacementMap
              ref={svgDisplacementRef}
              in="SourceGraphic"
              in2="noise"
              scale="14"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>
      <div
        ref={containerRef}
        className={`live-lyric-stage ${className}`}
        style={styleVars}
        aria-live="polite"
      />
    </>
  );
}
