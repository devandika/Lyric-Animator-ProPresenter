import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LiveLyricStage } from "./LiveLyricStage";
import {
  DEFAULT_PROPRESENTER_TRANSITION,
  isCutTransition
} from "../lib/propresenterTransitions";

function computeLayerOpacityTransition(animationEnabled, visible, slideTransition) {
  if (animationEnabled) {
    return visible ? "opacity 0.2s ease" : "opacity 0.35s ease 0.2s";
  }
  if (isCutTransition(slideTransition)) {
    return "none";
  }
  const ms = Math.max(16, Math.round((Number(slideTransition?.durationSeconds) || 0.35) * 1000));
  return `opacity ${ms}ms ease`;
}

function buildCssShadow(shadow) {
  if (!shadow || !shadow.enabled) return null;
  const rad = ((shadow.angle ?? 315) * Math.PI) / 180;
  const offset = shadow.offset ?? 5;
  const dx = Math.cos(rad) * offset;
  const dy = -Math.sin(rad) * offset;
  const blur = shadow.radius ?? 5;
  const c = shadow.color || { r: 0, g: 0, b: 0, a: 1 };
  const alpha = Math.max(0, Math.min(1, (c.a ?? 1) * (shadow.opacity ?? 0.75)));
  return `${dx.toFixed(2)}px ${dy.toFixed(2)}px ${blur}px rgba(${c.r ?? 0}, ${c.g ?? 0}, ${c.b ?? 0}, ${alpha})`;
}

function buildCssBackground(fill) {
  if (!fill || !fill.enabled) return {};
  if (fill.type === "color") {
    return { backgroundColor: fill.color?.css || "transparent" };
  }
  if (fill.type === "gradient" && Array.isArray(fill.stops) && fill.stops.length > 0) {
    const stopsCss = fill.stops
      .map((s) => `${s.color} ${Math.round((s.position ?? 0) * 100)}%`)
      .join(", ");
    if (fill.gradType === "radial") {
      return { backgroundImage: `radial-gradient(circle, ${stopsCss})` };
    }
    const cssDeg = 90 - (fill.angle ?? 0);
    return { backgroundImage: `linear-gradient(${cssDeg}deg, ${stopsCss})` };
  }
  if (fill.type === "blur") {
    const blurPx = fill.blurPx || 24;
    const sat = fill.saturation ?? 1;
    return {
      backgroundColor: "rgba(10, 12, 18, 0.22)",
      backdropFilter: `blur(${blurPx}px) saturate(${sat})`,
      WebkitBackdropFilter: `blur(${blurPx}px) saturate(${sat})`
    };
  }
  return {};
}

function buildSvgPathD(pathData, w, h) {
  if (!pathData || !Array.isArray(pathData.points) || pathData.points.length === 0) return "";
  const pts = pathData.points;
  const commands = [`M ${(pts[0].point.x * w).toFixed(2)} ${(pts[0].point.y * h).toFixed(2)}`];

  const count = pathData.closed ? pts.length : pts.length - 1;
  for (let i = 0; i < count; i++) {
    const curr = pts[i];
    const next = pts[(i + 1) % pts.length];
    if (curr.curved || next.curved) {
      commands.push(
        `C ${(curr.q1.x * w).toFixed(2)} ${(curr.q1.y * h).toFixed(2)}, ${(next.q0.x * w).toFixed(2)} ${(next.q0.y * h).toFixed(2)}, ${(next.point.x * w).toFixed(2)} ${(next.point.y * h).toFixed(2)}`
      );
    } else {
      commands.push(`L ${(next.point.x * w).toFixed(2)} ${(next.point.y * h).toFixed(2)}`);
    }
  }
  if (pathData.closed) commands.push("Z");
  return commands.join(" ");
}

function pickPrimaryTextElement(elements, themeSource, currentText) {
  const textEls = elements.filter((el) => el.isTextBox && el.text);
  if (textEls.length === 0) return null;
  if (textEls.length === 1) return textEls[0];

  const normalizedLive = String(currentText || "").trim();
  if (themeSource === "presentation-slide" && normalizedLive) {
    const exact = textEls.find((el) => el.text.plainText && normalizedLive.includes(el.text.plainText));
    if (exact) return exact;
    const nonEmpty = textEls.find((el) => Boolean(el.text.plainText));
    if (nonEmpty) return nonEmpty;
  }

  const named = textEls.find((el) => /lyric|text|verse/i.test(el.name || ""));
  if (named) return named;

  // Fallback to largest text box area
  return [...textEls].sort(
    (a, b) => (b.bounds.width * b.bounds.height) - (a.bounds.width * a.bounds.height)
  )[0];
}

function ProPresenterShapeLayer({ element, visible, animationEnabled = true, slideTransition = null }) {
  const { bounds, rotation, opacity, path: pathData, fill, stroke, shadow, feather } = element;
  const w = Math.max(1, bounds.width);
  const h = Math.max(1, bounds.height);
  const isCustomPath = pathData && !pathData.isRect && pathData.points?.length > 0;
  const boxShadowCss = buildCssShadow(shadow);

  const wrapperStyle = {
    position: "absolute",
    left: `${bounds.x}px`,
    top: `${bounds.y}px`,
    width: `${w}px`,
    height: `${h}px`,
    opacity: visible ? (opacity ?? 1) : 0,
    transform: rotation ? `rotate(${rotation}deg)` : undefined,
    transition: computeLayerOpacityTransition(animationEnabled, visible, slideTransition),
    pointerEvents: "none",
    zIndex: element.zIndex
  };

  if (fill?.type === "media" && fill.dataUrl) {
    return (
      <div style={wrapperStyle}>
        <img
          src={fill.dataUrl}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "fill",
            display: "block"
          }}
        />
      </div>
    );
  }

  if (isCustomPath) {
    const d = buildSvgPathD(pathData, w, h);
    const svgFill =
      fill?.enabled && fill.type === "color"
        ? fill.color?.css || "transparent"
        : fill?.enabled && fill.type === "gradient"
        ? `url(#grad-${element.id})`
        : "none";
    const svgStroke = stroke?.enabled ? stroke.color?.css || "#ffffff" : "none";
    const svgStrokeWidth = stroke?.enabled ? stroke.width || 1 : 0;

    return (
      <div style={wrapperStyle}>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible", display: "block" }}>
          {fill?.enabled && fill.type === "gradient" && Array.isArray(fill.stops) && (
            <defs>
              <linearGradient
                id={`grad-${element.id}`}
                gradientTransform={`rotate(${90 - (fill.angle ?? 0)}, 0.5, 0.5)`}
              >
                {fill.stops.map((st, idx) => (
                  <stop key={idx} offset={`${Math.round((st.position ?? 0) * 100)}%`} stopColor={st.color} />
                ))}
              </linearGradient>
            </defs>
          )}
          <path
            d={d}
            fill={svgFill}
            stroke={svgStroke}
            strokeWidth={svgStrokeWidth}
            style={boxShadowCss ? { filter: `drop-shadow(${boxShadowCss})` } : undefined}
          />
        </svg>
      </div>
    );
  }

  const bgStyle = buildCssBackground(fill);
  const featherRadius = feather?.enabled ? Math.round(Math.min(w, h) * Math.min(0.25, feather.amount || 0.05)) : 0;

  return (
    <div
      style={{
        ...wrapperStyle,
        ...bgStyle,
        border: stroke?.enabled ? `${stroke.width || 1}px solid ${stroke.color?.css || "#fff"}` : undefined,
        boxShadow: boxShadowCss || undefined,
        WebkitMaskImage:
          featherRadius > 0
            ? `linear-gradient(to right, transparent, black ${featherRadius}px, black calc(100% - ${featherRadius}px), transparent), linear-gradient(to bottom, transparent, black ${featherRadius}px, black calc(100% - ${featherRadius}px), transparent)`
            : undefined,
        WebkitMaskComposite: featherRadius > 0 ? "source-in" : undefined,
        maskComposite: featherRadius > 0 ? "intersect" : undefined
      }}
    />
  );
}

export function ThemedLyricStage({
  text = "",
  themeInfo = null, // { source, themeName, slideName, layout }
  presetId = "cinematic-blur",
  durationSeconds = 1.0,
  animationEnabled = true,
  textEffectEnabled = false,
  textEffectId = "ae-wiggle-pos",
  textEffectIntensity = 1.0,
  textEffectSpeed = 1.0,
  slideTransition = null
}) {
  const wrapperRef = useRef(null);
  const [scale, setScale] = useState(1);

  const trimmed = String(text || "").trim();
  const hasVisibleSlide = Boolean(trimmed);
  const effectiveSlideTransition =
    themeInfo?.cueSlideTransition || slideTransition || DEFAULT_PROPRESENTER_TRANSITION;
  const shouldWaitForExit =
    animationEnabled !== false || !isCutTransition(effectiveSlideTransition);

  // Hold the active slide's theme frozen until the previous slide finishes animating OUT
  const [displayedThemeInfo, setDisplayedThemeInfo] = useState(themeInfo);
  const [displayedBoxText, setDisplayedBoxText] = useState(trimmed);

  const latestThemeInfoRef = useRef(themeInfo);
  latestThemeInfoRef.current = themeInfo;
  const displayedThemeInfoRef = useRef(displayedThemeInfo);
  displayedThemeInfoRef.current = displayedThemeInfo;

  const latestTrimmedRef = useRef(trimmed);
  latestTrimmedRef.current = trimmed;
  const displayedBoxTextRef = useRef(displayedBoxText);
  displayedBoxTextRef.current = displayedBoxText;

  const isExitingRef = useRef(false);
  const prevTrimmedForLockRef = useRef(trimmed);
  const themeFlushResolverRef = useRef(null);

  if (trimmed !== prevTrimmedForLockRef.current) {
    if (shouldWaitForExit && prevTrimmedForLockRef.current !== "") {
      isExitingRef.current = true;
    }
    prevTrimmedForLockRef.current = trimmed;
  }

  useLayoutEffect(() => {
    if (themeFlushResolverRef.current) {
      const resolve = themeFlushResolverRef.current;
      themeFlushResolverRef.current = null;
      resolve();
    }
  }, [displayedThemeInfo, displayedBoxText]);

  useEffect(() => {
    if (!shouldWaitForExit) {
      isExitingRef.current = false;
    }
    if (!isExitingRef.current) {
      setDisplayedThemeInfo(themeInfo);
      setDisplayedBoxText(trimmed);
    }
  }, [themeInfo, trimmed, shouldWaitForExit]);

  const hasPendingThemeChangeRef = useRef(null);
  hasPendingThemeChangeRef.current = () => {
    const nextTheme = latestThemeInfoRef.current;
    const prevKey = displayedThemeInfoRef.current?.versionKey || "";
    const nextKey = nextTheme?.versionKey || "";
    return prevKey !== nextKey || !Object.is(displayedThemeInfoRef.current, nextTheme);
  };

  const handleBeforeEnter = useCallback((nextText) => {
    isExitingRef.current = false;
    const nextTheme = latestThemeInfoRef.current;
    const targetBoxText = nextText ?? latestTrimmedRef.current;
    const prevThemeKey = displayedThemeInfoRef.current?.versionKey || "";
    const nextThemeKey = nextTheme?.versionKey || "";
    const themeChanged =
      prevThemeKey !== nextThemeKey || !Object.is(displayedThemeInfoRef.current, nextTheme);
    const boxTextChanged =
      nextTheme?.source === "presentation-slide" && displayedBoxTextRef.current !== targetBoxText;

    if (!themeChanged && !boxTextChanged) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let settled = false;
      let fallbackTimer = null;
      const done = () => {
        if (settled) return;
        settled = true;
        if (fallbackTimer) clearTimeout(fallbackTimer);
        themeFlushResolverRef.current = null;
        resolve();
      };
      themeFlushResolverRef.current = done;
      fallbackTimer = setTimeout(done, 50);
      setDisplayedThemeInfo(nextTheme);
      setDisplayedBoxText(targetBoxText);
    });
  }, []);

  const layout = displayedThemeInfo?.layout || null;
  const canvasWidth = layout?.canvasWidth || 1920;
  const canvasHeight = layout?.canvasHeight || 1080;

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const updateScale = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setScale(Math.min(rect.width / canvasWidth, rect.height / canvasHeight));
      }
    };

    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(el);
    return () => ro.disconnect();
  }, [canvasWidth, canvasHeight]);

  const elements = layout?.elements || [];
  const primaryTextEl = useMemo(
    () => pickPrimaryTextElement(elements, displayedThemeInfo?.source, displayedBoxText),
    [elements, displayedThemeInfo?.source, displayedBoxText]
  );

  // Decorative/background layers (non-text elements, plus any secondary text box that only draws a box)
  const backdropElements = useMemo(() => {
    return elements.filter((el) => {
      if (primaryTextEl && el.id === primaryTextEl.id) return false;
      if (el.isTextBox) {
        return Boolean(el.fill?.enabled || el.stroke?.enabled);
      }
      return Boolean(el.fill?.enabled || el.stroke?.enabled || el.shadow?.enabled);
    });
  }, [elements, primaryTextEl]);

  const primaryTextStyle = primaryTextEl?.text || null;
  const primaryFillBg = primaryTextEl ? buildCssBackground(primaryTextEl.fill) : {};
  const primaryBoxShadow = primaryTextEl ? buildCssShadow(primaryTextEl.shadow) : null;
  const primaryFeatherRadius = primaryTextEl?.feather?.enabled
    ? Math.round(
        Math.min(primaryTextEl.bounds.width, primaryTextEl.bounds.height) *
          Math.min(0.25, primaryTextEl.feather.amount || 0.05)
      )
    : 0;

  const textShadowCss = primaryTextStyle
    ? buildCssShadow(primaryTextStyle.textShadow) || "0 3px 16px rgba(0, 0, 0, 0.72)"
    : "0 4px 24px rgba(0, 0, 0, 0.85), 0 2px 8px rgba(0, 0, 0, 0.9)";

  const stageWrapperStyle =
    primaryTextEl && primaryTextStyle
      ? {
          position: "absolute",
          left: `${primaryTextEl.bounds.x}px`,
          top: `${primaryTextEl.bounds.y}px`,
          width: `${primaryTextEl.bounds.width}px`,
          height: `${primaryTextEl.bounds.height}px`,
          opacity: primaryTextEl.opacity ?? 1,
          transform: primaryTextEl.rotation ? `rotate(${primaryTextEl.rotation}deg)` : undefined,
          zIndex: primaryTextEl.zIndex + 10,
          pointerEvents: "none"
        }
      : {
          position: "absolute",
          left: "0px",
          top: "0px",
          width: `${canvasWidth}px`,
          height: `${canvasHeight}px`,
          zIndex: 10,
          pointerEvents: "none"
        };

  return (
    <div ref={wrapperRef} className="themed-stage-wrapper">
      <div
        className="propresenter-design-canvas"
        style={{
          width: `${canvasWidth}px`,
          height: `${canvasHeight}px`,
          transform: `translate(-50%, -50%) scale(${scale})`
        }}
      >
        {/* 1. Theme Shapes, Lower-Third Bars, Blur Boxes, and Theme PNG Assets */}
        {backdropElements.map((el) => (
          <ProPresenterShapeLayer
            key={el.id}
            element={el}
            visible={hasVisibleSlide}
            animationEnabled={animationEnabled}
            slideTransition={effectiveSlideTransition}
          />
        ))}

        {/* 2. Optional box fill/blur/stroke/shadow behind the animated text */}
        {primaryTextEl &&
          primaryTextStyle &&
          (primaryTextEl.fill?.enabled || primaryTextEl.stroke?.enabled || primaryTextEl.shadow?.enabled) && (
            <div
              style={{
                position: "absolute",
                left: `${primaryTextEl.bounds.x}px`,
                top: `${primaryTextEl.bounds.y}px`,
                width: `${primaryTextEl.bounds.width}px`,
                height: `${primaryTextEl.bounds.height}px`,
                opacity: hasVisibleSlide ? (primaryTextEl.opacity ?? 1) : 0,
                transform: primaryTextEl.rotation ? `rotate(${primaryTextEl.rotation}deg)` : undefined,
                transition: computeLayerOpacityTransition(
                  animationEnabled,
                  hasVisibleSlide,
                  effectiveSlideTransition
                ),
                pointerEvents: "none",
                zIndex: primaryTextEl.zIndex,
                ...primaryFillBg,
                border: primaryTextEl.stroke?.enabled
                  ? `${primaryTextEl.stroke.width || 1}px solid ${primaryTextEl.stroke.color?.css || "#fff"}`
                  : undefined,
                boxShadow: primaryBoxShadow || undefined,
                WebkitMaskImage:
                  primaryFeatherRadius > 0
                    ? `linear-gradient(to right, transparent, black ${primaryFeatherRadius}px, black calc(100% - ${primaryFeatherRadius}px), transparent), linear-gradient(to bottom, transparent, black ${primaryFeatherRadius}px, black calc(100% - ${primaryFeatherRadius}px), transparent)`
                    : undefined,
                WebkitMaskComposite: primaryFeatherRadius > 0 ? "source-in" : undefined,
                maskComposite: primaryFeatherRadius > 0 ? "intersect" : undefined
              }}
            />
          )}

        {/* 3. Persistent Primary Lyric Stage (never remounted across themed/unthemed transitions) */}
        <div style={stageWrapperStyle}>
          <LiveLyricStage
            key="primary-lyric-stage"
            text={trimmed}
            presetId={presetId}
            durationSeconds={durationSeconds}
            animationEnabled={animationEnabled}
            textEffectEnabled={textEffectEnabled}
            textEffectId={textEffectId}
            textEffectIntensity={textEffectIntensity}
            textEffectSpeed={textEffectSpeed}
            proSlideTransition={effectiveSlideTransition}
            hasPendingThemeChangeRef={hasPendingThemeChangeRef}
            onBeforeEnter={handleBeforeEnter}
            fontFamily={primaryTextStyle ? primaryTextStyle.fontFamily : "Inter, sans-serif"}
            fontSize={primaryTextStyle ? primaryTextStyle.fontSize : 72}
            fontWeight={primaryTextStyle ? primaryTextStyle.fontWeight : 700}
            fontStyle={primaryTextStyle?.fontItalic ? "italic" : "normal"}
            textColor={primaryTextStyle?.textColor?.css || "#ffffff"}
            textAlign={primaryTextStyle?.textAlign || "center"}
            verticalAlign={primaryTextStyle?.verticalAlignment || "center"}
            textTransform={primaryTextStyle?.capitalization || "none"}
            lineHeight={
              primaryTextStyle
                ? Math.max(1.0, (primaryTextStyle.lineHeightMultiple || 1) * 1.12)
                : 1.28
            }
            letterSpacing={primaryTextStyle?.letterSpacing || 0}
            textStrokeWidth={primaryTextStyle?.textStrokeWidth || 0}
            textStrokeColor={primaryTextStyle?.textStrokeColor?.css || "transparent"}
            textShadow={textShadowCss}
            padding={
              primaryTextStyle
                ? `${primaryTextStyle.margins?.top || 0}px ${primaryTextStyle.margins?.right || 0}px ${primaryTextStyle.margins?.bottom || 0}px ${primaryTextStyle.margins?.left || 0}px`
                : "60px 80px"
            }
          />
        </div>
      </div>
    </div>
  );
}
