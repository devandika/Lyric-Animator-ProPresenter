import { useEffect, useId, useRef } from "react";
import {
  ANIMATION_PRESETS,
  buildLyricDOM,
  runLyricAnimation
} from "../lib/animationPresets";
import {
  buildProTransitionEnterFrames,
  buildProTransitionExitFrames,
  DEFAULT_PROPRESENTER_TRANSITION,
  isCutTransition,
  runElementTransition
} from "../lib/propresenterTransitions";
import {
  TEXT_EFFECT_PRESETS,
  startTextEffectLoop
} from "../lib/textEffectEngine";

function applyStyleVarsToElement(el, styleVars) {
  if (!el || !styleVars) return;
  for (const [prop, val] of Object.entries(styleVars)) {
    if (prop.startsWith("--") && val !== undefined && val !== null) {
      el.style.setProperty(prop, String(val));
    }
  }
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
  textTransform = "none",
  lineHeight = 1.28,
  letterSpacing = 0,
  textStrokeWidth = 0,
  textStrokeColor = "transparent",
  padding = "48px",
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

  const styleVars = {
    "--lyric-font-size": `${fontSize}px`,
    "--lyric-font-family": fontFamily,
    "--lyric-font-weight": fontWeight,
    "--lyric-font-style": fontStyle,
    "--lyric-color": textColor,
    "--lyric-shadow": textShadow,
    "--lyric-text-align": textAlign,
    "--lyric-text-transform": textTransform,
    "--lyric-line-height": lineHeight,
    "--lyric-letter-spacing": `${letterSpacing}px`,
    "--lyric-stroke-width": textStrokeWidth > 0 ? `${textStrokeWidth}px` : "0px",
    "--lyric-stroke-color": textStrokeColor || "transparent",
    "--stage-justify": justifyContent,
    "--stage-align": alignItems,
    "--stage-padding": padding
  };

  const styleVarsRef = useRef(styleVars);
  styleVarsRef.current = styleVars;

  // Keep active phrase synchronized if theme properties change live on the same slide
  useEffect(() => {
    if (!isExitingRef.current && currentDOMRef.current?.container?.isConnected) {
      applyStyleVarsToElement(currentDOMRef.current.container, styleVarsRef.current);
    }
  });

  const getDesiredEffectTarget = () => {
    const fx = textEffectRef.current;
    if (!fx.enabled) return "whole";
    const fxPreset = TEXT_EFFECT_PRESETS[fx.effectId] || TEXT_EFFECT_PRESETS["ae-wiggle-pos"];
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
        maskClip: Boolean(dom.maskClip),
        effectTarget: neededTarget
      });
      applyStyleVarsToElement(rebuilt.container, styleVarsRef.current);
      rebuilt.preset = dom.preset;
      rebuilt.text = dom.text;
      rebuilt.maskClip = dom.maskClip;
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
    const preset = ANIMATION_PRESETS[presetId] || ANIMATION_PRESETS["cinematic-blur"];
    const targetMode = preset.target || "per-word";
    const trimmed = String(text || "").trim();

    queueRef.current = queueRef.current.then(async () => {
      // Skip intermediate stale slide updates if a newer one is already queued
      if (myRunId !== runIdRef.current) return;

      const isAnimEnabled = animationEnabledRef.current !== false;
      const proTr = proSlideTransitionRef.current || DEFAULT_PROPRESENTER_TRANSITION;
      const prev = currentDOMRef.current;

      if (!isAnimEnabled && prev && prev.container.isConnected && prev.text === trimmed) {
        return;
      }

      // If Animasi button is OFF, follow ProPresenter's configured Slide/Foreground transition directly
      if (!isAnimEnabled) {
        const isCut = isCutTransition(proTr);
        const themeChanging = Boolean(hasPendingThemeChangeRef?.current?.());

        if (isCut) {
          if (prev && prev.container.isConnected) {
            stopTextEffect();
            prev.container.remove();
            currentDOMRef.current = null;
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
            effectTarget: getDesiredEffectTarget()
          });
          applyStyleVarsToElement(next.container, styleVarsRef.current);
          next.preset = preset;
          next.text = trimmed;
          next.maskClip = false;
          stage.appendChild(next.container);
          currentDOMRef.current = next;
          syncTextEffect(next);
          return;
        }

        // ProPresenter non-cut transition (Dissolve / Push / Wipe / etc.)
        const prevConnected = Boolean(prev && prev.container.isConnected);
        if (prevConnected && (!trimmed || themeChanging)) {
          // Sequential exit first when clearing or switching to a different theme
          isExitingRef.current = true;
          await runElementTransition(
            prev.container,
            buildProTransitionExitFrames(proTr, { keepOpaqueUnderlay: false }),
            proTr.durationSeconds
          );
          stopTextEffect();
          prev.container.remove();
          isExitingRef.current = false;
          currentDOMRef.current = null;
          if (myRunId !== runIdRef.current) return;
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
          effectTarget: getDesiredEffectTarget()
        });
        applyStyleVarsToElement(next.container, styleVarsRef.current);
        next.preset = preset;
        next.text = trimmed;
        next.maskClip = false;

        if (prevConnected && !themeChanging && prev.container.isConnected) {
          // True simultaneous ProPresenter crossfade / transition on same theme
          prev.container.style.position = "absolute";
          prev.container.style.left = `${prev.container.offsetLeft}px`;
          prev.container.style.top = `${prev.container.offsetTop}px`;
          prev.container.style.width = `${prev.container.offsetWidth}px`;
          prev.container.style.height = `${prev.container.offsetHeight}px`;
          stage.appendChild(next.container);
          currentDOMRef.current = next;
          syncTextEffect(next);

          await Promise.all([
            runElementTransition(
              prev.container,
              buildProTransitionExitFrames(proTr, { keepOpaqueUnderlay: false }),
              proTr.durationSeconds
            ).then(() => {
              prev.container.remove();
            }),
            runElementTransition(
              next.container,
              buildProTransitionEnterFrames(proTr),
              proTr.durationSeconds,
              { resetAfter: true }
            )
          ]);
          return;
        }

        stage.appendChild(next.container);
        currentDOMRef.current = next;
        syncTextEffect(next);
        await runElementTransition(
          next.container,
          buildProTransitionEnterFrames(proTr),
          proTr.durationSeconds,
          { resetAfter: true }
        );
        return;
      }

      // Animasi button is ON: animate OUT previous phrase completely with its own snapshotted theme
      if (prev && prev.container.isConnected) {
        isExitingRef.current = true;
        const prevPreset = prev.preset || preset;
        await new Promise((resolve) => {
          runLyricAnimation({
            container: prev.container,
            units: prev.units,
            phase: "exit",
            preset: prevPreset,
            durationSeconds,
            onFinished: () => {
              stopTextEffect();
              prev.container.remove();
              resolve();
            }
          });
        });
        isExitingRef.current = false;
        currentDOMRef.current = null;
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
        maskClip: preset.maskClip,
        effectTarget: getDesiredEffectTarget()
      });
      applyStyleVarsToElement(next.container, styleVarsRef.current);
      next.preset = preset;
      next.text = trimmed;
      next.maskClip = Boolean(preset.maskClip);
      stage.appendChild(next.container);
      currentDOMRef.current = next;
      syncTextEffect(next);

      runLyricAnimation({
        container: next.container,
        units: next.units,
        phase: "enter",
        preset,
        durationSeconds
      });
    });
  }, [text, presetId, durationSeconds]);

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
