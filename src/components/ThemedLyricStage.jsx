import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LiveLyricStage } from "./LiveLyricStage";
import { CountdownOverlay } from "./CountdownOverlay";
import {
  DEFAULT_PROPRESENTER_TRANSITION,
  isCutTransition
} from "../lib/propresenterTransitions";

function normalizeCompareText(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

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

function getBoxArea(el) {
  return (el?.bounds?.width || 0) * (el?.bounds?.height || 0);
}

function pickPrimaryTextElement(elements, themeSource, currentText) {
  const textEls = elements.filter((el) => el.isTextBox && el.text);
  if (textEls.length === 0) return null;
  if (textEls.length === 1) return textEls[0];

  const normalizedLive = normalizeCompareText(currentText);
  if (themeSource === "presentation-slide" && normalizedLive) {
    const exact = textEls.find(
      (el) => normalizeCompareText(el.text.plainText) === normalizedLive
    );
    if (exact) return exact;

    const nonEmpty = textEls.filter((el) => Boolean(normalizeCompareText(el.text.plainText)));
    const pool = nonEmpty.length > 0 ? nonEmpty : textEls;
    const named = pool
      .filter((el) => /lyric|text|verse|teks|isi/i.test(el.name || ""))
      .sort((a, b) => getBoxArea(b) - getBoxArea(a));
    if (named.length > 0) return named[0];

    return [...pool].sort((a, b) => getBoxArea(b) - getBoxArea(a))[0];
  }

  const named = textEls
    .filter((el) => /lyric|text|verse|teks|isi/i.test(el.name || ""))
    .sort((a, b) => getBoxArea(b) - getBoxArea(a));
  if (named.length > 0) return named[0];

  return [...textEls].sort((a, b) => getBoxArea(b) - getBoxArea(a))[0];
}

function resolvePrimaryDisplayText(liveText, primaryEl, allTextBoxes) {
  const normalizedLive = normalizeCompareText(liveText);
  if (!normalizedLive) return "";
  if (!primaryEl?.text) return normalizedLive;

  const primaryPlain = normalizeCompareText(primaryEl.text.plainText);
  if (!primaryPlain || primaryPlain === normalizedLive) {
    return normalizedLive;
  }

  // If ProPresenter OpenAPI concatenated multiple text boxes into status/slide text,
  // avoid duplicating secondary box text inside the primary text box.
  if (Array.isArray(allTextBoxes) && allTextBoxes.length > 1) {
    const otherPlains = allTextBoxes
      .filter((box) => box !== primaryEl)
      .map((box) => normalizeCompareText(box?.text?.plainText))
      .filter(Boolean);

    const hasOtherIncluded = otherPlains.some((other) => normalizedLive.includes(other));
    if (normalizedLive.includes(primaryPlain) && hasOtherIncluded) {
      return primaryPlain;
    }

    if (hasOtherIncluded) {
      const otherSet = new Set(otherPlains);
      const filteredLines = normalizedLive
        .split("\n")
        .filter((line) => !otherSet.has(line.trim()))
        .join("\n")
        .trim();
      if (filteredLines) {
        return filteredLines;
      }
      return primaryPlain;
    }
  }

  return normalizedLive;
}

function resolveLayoutTextSlots(themeInfo, liveText) {
  const elements = themeInfo?.layout?.elements || [];
  const themeSource = themeInfo?.source;
  const primaryTextEl = pickPrimaryTextElement(elements, themeSource, liveText);
  const normalizedLive = normalizeCompareText(liveText);

  if (!normalizedLive) {
    return {
      primaryTextEl,
      primaryText: "",
      secondarySlots: [],
      consumedThemeIds: new Set(primaryTextEl ? [primaryTextEl.id] : [])
    };
  }

  if (themeSource === "presentation-slide") {
    const textBoxes = elements.filter((el) => el.isTextBox && el.text);
    const primaryText = resolvePrimaryDisplayText(normalizedLive, primaryTextEl, textBoxes);
    const secondarySlots = textBoxes
      .filter((el) => el.id !== primaryTextEl?.id && normalizeCompareText(el.text.plainText) !== "")
      .map((el) => ({
        element: el,
        text: normalizeCompareText(el.text.plainText)
      }));
    const consumedThemeIds = new Set(
      [primaryTextEl?.id, ...secondarySlots.map((s) => s.element.id)].filter(Boolean)
    );
    return { primaryTextEl, primaryText, secondarySlots, consumedThemeIds };
  }

  if (themeSource === "look-theme") {
    const cueBoxes = (themeInfo?.cueTextBoxes || []).filter(
      (el) => el.isTextBox && el.text && normalizeCompareText(el.text.plainText) !== ""
    );

    if (cueBoxes.length <= 1) {
      return {
        primaryTextEl,
        primaryText: normalizedLive,
        secondarySlots: [],
        consumedThemeIds: new Set(primaryTextEl ? [primaryTextEl.id] : [])
      };
    }

    const matchedCuePrimary =
      cueBoxes.find((b) => normalizeCompareText(b.text.plainText) === normalizedLive) ||
      cueBoxes
        .filter((b) => normalizedLive.includes(normalizeCompareText(b.text.plainText)))
        .sort((a, b) => getBoxArea(b) - getBoxArea(a))[0] ||
      [...cueBoxes].sort((a, b) => getBoxArea(b) - getBoxArea(a))[0];

    const primaryText = resolvePrimaryDisplayText(normalizedLive, matchedCuePrimary, cueBoxes);
    const remainingCueBoxes = cueBoxes.filter((b) => b !== matchedCuePrimary);
    const otherThemeTextEls = elements.filter(
      (el) =>
        el.isTextBox &&
        el.text &&
        el.id !== primaryTextEl?.id &&
        normalizeCompareText(el.text.plainText) !== ""
    );
    const usedThemeIds = new Set(primaryTextEl ? [primaryTextEl.id] : []);

    const secondarySlots = remainingCueBoxes.map((cueBox) => {
      const cueName = String(cueBox.name || "").trim().toLowerCase();
      let matchedThemeEl = null;

      if (cueName) {
        matchedThemeEl = otherThemeTextEls.find(
          (tel) =>
            !usedThemeIds.has(tel.id) &&
            String(tel.name || "").trim().toLowerCase() === cueName
        );
      }

      if (!matchedThemeEl) {
        const cueCenterY = (cueBox.bounds?.y || 0) + (cueBox.bounds?.height || 0) / 2;
        const candidates = otherThemeTextEls
          .filter((tel) => !usedThemeIds.has(tel.id))
          .sort((a, b) => {
            const ay = (a.bounds?.y || 0) + (a.bounds?.height || 0) / 2;
            const by = (b.bounds?.y || 0) + (b.bounds?.height || 0) / 2;
            return Math.abs(ay - cueCenterY) - Math.abs(by - cueCenterY);
          });
        matchedThemeEl = candidates[0] || null;
      }

      if (matchedThemeEl) {
        usedThemeIds.add(matchedThemeEl.id);
      }

      return {
        element: matchedThemeEl || cueBox,
        text: normalizeCompareText(cueBox.text.plainText)
      };
    });

    return {
      primaryTextEl,
      primaryText,
      secondarySlots,
      consumedThemeIds: usedThemeIds
    };
  }

  return {
    primaryTextEl,
    primaryText: normalizedLive,
    secondarySlots: [],
    consumedThemeIds: new Set(primaryTextEl ? [primaryTextEl.id] : [])
  };
}

function buildTextBoxVisuals(textEl, canvasWidth, canvasHeight) {
  const textStyle = textEl?.text || null;
  const fillBg = textEl ? buildCssBackground(textEl.fill) : {};
  const boxShadow = textEl ? buildCssShadow(textEl.shadow) : null;
  const featherRadius = textEl?.feather?.enabled
    ? Math.round(
        Math.min(textEl.bounds.width, textEl.bounds.height) *
          Math.min(0.25, textEl.feather.amount || 0.05)
      )
    : 0;

  const hasBackdrop = Boolean(
    textEl &&
      textStyle &&
      (textEl.fill?.enabled || textEl.stroke?.enabled || textEl.shadow?.enabled)
  );

  const textShadowCss = textStyle
    ? buildCssShadow(textStyle.textShadow) || "0 3px 16px rgba(0, 0, 0, 0.72)"
    : "0 4px 24px rgba(0, 0, 0, 0.85), 0 2px 8px rgba(0, 0, 0, 0.9)";

  const stageWrapperStyle =
    textEl && textStyle
      ? {
          position: "absolute",
          left: `${textEl.bounds.x}px`,
          top: `${textEl.bounds.y}px`,
          width: `${textEl.bounds.width}px`,
          height: `${textEl.bounds.height}px`,
          opacity: textEl.opacity ?? 1,
          transform: textEl.rotation ? `rotate(${textEl.rotation}deg)` : undefined,
          zIndex: textEl.zIndex + 10,
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

  return {
    textStyle,
    fillBg,
    boxShadow,
    featherRadius,
    hasBackdrop,
    textShadowCss,
    stageWrapperStyle
  };
}

function TextBoxBackdrop({
  textEl,
  visuals,
  visible,
  animationEnabled,
  slideTransition
}) {
  if (!visuals?.hasBackdrop || !textEl) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: `${textEl.bounds.x}px`,
        top: `${textEl.bounds.y}px`,
        width: `${textEl.bounds.width}px`,
        height: `${textEl.bounds.height}px`,
        opacity: visible ? (textEl.opacity ?? 1) : 0,
        transform: textEl.rotation ? `rotate(${textEl.rotation}deg)` : undefined,
        transition: computeLayerOpacityTransition(
          animationEnabled,
          visible,
          slideTransition
        ),
        pointerEvents: "none",
        zIndex: textEl.zIndex,
        ...visuals.fillBg,
        border: textEl.stroke?.enabled
          ? `${textEl.stroke.width || 1}px solid ${textEl.stroke.color?.css || "#fff"}`
          : undefined,
        boxShadow: visuals.boxShadow || undefined,
        WebkitMaskImage:
          visuals.featherRadius > 0
            ? `linear-gradient(to right, transparent, black ${visuals.featherRadius}px, black calc(100% - ${visuals.featherRadius}px), transparent), linear-gradient(to bottom, transparent, black ${visuals.featherRadius}px, black calc(100% - ${visuals.featherRadius}px), transparent)`
            : undefined,
        WebkitMaskComposite: visuals.featherRadius > 0 ? "source-in" : undefined,
        maskComposite: visuals.featherRadius > 0 ? "intersect" : undefined
      }}
    />
  );
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

  if (fill?.type === "media") {
    const isVideo =
      fill.mediaType === "video" ||
      (fill.fileUrl && /\.(mp4|webm|mov|m4v|mkv)$/i.test(fill.fileUrl));

    if (isVideo && fill.fileUrl) {
      return (
        <div style={{ ...wrapperStyle, overflow: "hidden" }}>
          <video
            key={fill.fileUrl}
            src={fill.fileUrl}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "fill",
              display: "block",
              pointerEvents: "none"
            }}
          />
        </div>
      );
    }

    if (fill.dataUrl || fill.fileUrl) {
      return (
        <div style={{ ...wrapperStyle, overflow: "hidden" }}>
          <img
            src={fill.dataUrl || fill.fileUrl}
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

function LyricStageSlot({
  text,
  textStyle,
  textShadowCss,
  stageWrapperStyle,
  presetId,
  durationSeconds,
  animationEnabled,
  textEffectEnabled,
  textEffectId,
  textEffectIntensity,
  textEffectSpeed,
  slideTransition,
  hasPendingThemeChangeRef,
  onBeforeEnter
}) {
  return (
    <div style={stageWrapperStyle}>
      <LiveLyricStage
        text={text}
        presetId={presetId}
        durationSeconds={durationSeconds}
        animationEnabled={animationEnabled}
        textEffectEnabled={textEffectEnabled}
        textEffectId={textEffectId}
        textEffectIntensity={textEffectIntensity}
        textEffectSpeed={textEffectSpeed}
        proSlideTransition={slideTransition}
        hasPendingThemeChangeRef={hasPendingThemeChangeRef}
        onBeforeEnter={onBeforeEnter}
        fontFamily={textStyle ? textStyle.fontFamily : "Inter, sans-serif"}
        fontSize={textStyle ? textStyle.fontSize : 72}
        fontWeight={textStyle ? textStyle.fontWeight : 700}
        fontStyle={textStyle?.fontItalic ? "italic" : "normal"}
        textColor={textStyle?.textColor?.css || "#ffffff"}
        textAlign={textStyle?.textAlign || "center"}
        verticalAlign={textStyle?.verticalAlignment || "center"}
        textTransform={textStyle?.capitalization || "none"}
        lineHeight={
          textStyle ? Math.max(1.0, (textStyle.lineHeightMultiple || 1) * 1.12) : 1.28
        }
        letterSpacing={textStyle?.letterSpacing || 0}
        textStrokeWidth={textStyle?.textStrokeWidth || 0}
        textStrokeColor={textStyle?.textStrokeColor?.css || "transparent"}
        textShadow={textShadowCss}
        padding={
          textStyle
            ? `${textStyle.margins?.top || 0}px ${textStyle.margins?.right || 0}px ${textStyle.margins?.bottom || 0}px ${textStyle.margins?.left || 0}px`
            : "60px 80px"
        }
      />
    </div>
  );
}

export function ThemedLyricStage({
  text = "",
  themeInfo = null, // { source, themeName, slideName, layout, cueTextBoxes }
  presetId = "cinematic-blur",
  durationSeconds = 1.0,
  animationEnabled = true,
  offTransitionMode = "fade",
  textEffectEnabled = false,
  textEffectId = "ae-wiggle-pos",
  textEffectIntensity = 1.0,
  textEffectSpeed = 1.0,
  slideTransition = null,
  countdownConfig = null,
  countdownRuntime = null,
  isInteractiveCountdown = false,
  onCountdownPositionChange = null,
  onCountdownFontSizeChange = null
}) {
  const wrapperRef = useRef(null);
  const [scale, setScale] = useState(1);

  const trimmed = normalizeCompareText(text);

  // Hold the active slide's theme frozen until the previous slide finishes animating OUT
  const [displayedThemeInfo, setDisplayedThemeInfo] = useState(themeInfo);
  const [displayedBoxText, setDisplayedBoxText] = useState(trimmed);
  const [prevTrimmedForExit, setPrevTrimmedForExit] = useState(trimmed);
  const [isTransitioningOut, setIsTransitioningOut] = useState(false);

  const hasSlideMedia = Boolean(
    displayedThemeInfo?.cueMediaElements?.length > 0 ||
    themeInfo?.cueMediaElements?.length > 0 ||
    displayedThemeInfo?.layout?.elements?.some((e) => e.fill?.type === "media" && e.fill.enabled !== false) ||
    themeInfo?.layout?.elements?.some((e) => e.fill?.type === "media" && e.fill.enabled !== false)
  );
  const hasVisibleSlide = Boolean(trimmed) || hasSlideMedia;
  const rawSlideTransition =
    themeInfo?.cueSlideTransition || slideTransition || DEFAULT_PROPRESENTER_TRANSITION;
  const effectiveSlideTransition =
    animationEnabled === false
      ? offTransitionMode === "cut"
        ? { type: "cut", name: "Cut", durationSeconds: 0, direction: "left", source: "user-off-mode" }
        : {
            type: "dissolve",
            name: "Fade",
            durationSeconds: Math.max(0.15, Number(rawSlideTransition?.durationSeconds) || 0.35),
            direction: "left",
            source: "user-off-mode"
          }
      : rawSlideTransition;
  const shouldWaitForExit = animationEnabled !== false;

  const latestThemeInfoRef = useRef(themeInfo);
  latestThemeInfoRef.current = themeInfo;
  const displayedThemeInfoRef = useRef(displayedThemeInfo);
  displayedThemeInfoRef.current = displayedThemeInfo;

  const latestTrimmedRef = useRef(trimmed);
  latestTrimmedRef.current = trimmed;
  const displayedBoxTextRef = useRef(displayedBoxText);
  displayedBoxTextRef.current = displayedBoxText;

  const isExitingRef = useRef(false);
  const themeFlushResolverRef = useRef(null);

  if (trimmed !== prevTrimmedForExit) {
    setPrevTrimmedForExit(trimmed);
    if (shouldWaitForExit && prevTrimmedForExit !== "") {
      isExitingRef.current = true;
      setIsTransitioningOut(true);
    }
  }

  useLayoutEffect(() => {
    if (themeFlushResolverRef.current) {
      const resolve = themeFlushResolverRef.current;
      themeFlushResolverRef.current = null;
      resolve();
    }
  }, [displayedThemeInfo, displayedBoxText]);

  useEffect(() => {
    if (!shouldWaitForExit || !trimmed) {
      isExitingRef.current = false;
      setIsTransitioningOut(false);
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
    setIsTransitioningOut(false);
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

  const { primaryTextEl, secondarySlots, consumedThemeIds } = useMemo(
    () => resolveLayoutTextSlots(displayedThemeInfo, displayedBoxText),
    [displayedThemeInfo, displayedBoxText]
  );

  // Latest primary text drives LiveLyricStage's exit->enter lifecycle cleanly
  const latestPrimaryText = useMemo(
    () => resolveLayoutTextSlots(themeInfo, trimmed).primaryText,
    [themeInfo, trimmed]
  );

  // Decorative/background layers (non-text elements, plus any unconsumed empty text box that draws a box)
  const backdropElements = useMemo(() => {
    const list = [...elements];
    const cueMediaList = displayedThemeInfo?.cueMediaElements || themeInfo?.cueMediaElements || [];
    for (const cueMediaEl of cueMediaList) {
      if (
        !list.some(
          (el) =>
            el.id === cueMediaEl.id ||
            (el.fill?.fileUrl && el.fill.fileUrl === cueMediaEl.fill?.fileUrl)
        )
      ) {
        list.push(cueMediaEl);
      }
    }
    return list.filter((el) => {
      if (consumedThemeIds.has(el.id)) return false;
      if (el.isTextBox) {
        return Boolean(el.fill?.enabled || el.stroke?.enabled);
      }
      return Boolean(el.fill?.enabled || el.stroke?.enabled || el.shadow?.enabled);
    });
  }, [elements, displayedThemeInfo?.cueMediaElements, themeInfo?.cueMediaElements, consumedThemeIds]);

  const primaryVisuals = useMemo(
    () => buildTextBoxVisuals(primaryTextEl, canvasWidth, canvasHeight),
    [primaryTextEl, canvasWidth, canvasHeight]
  );

  const secondaryVisuals = useMemo(
    () =>
      secondarySlots.map((slot) => ({
        ...slot,
        visuals: buildTextBoxVisuals(slot.element, canvasWidth, canvasHeight)
      })),
    [secondarySlots, canvasWidth, canvasHeight]
  );

  // Retain slot count up to max seen so disappearing secondary text boxes fade out smoothly
  const [secondarySlotCap, setSecondarySlotCap] = useState(0);
  const lastSecondarySlotsRef = useRef([]);
  if (secondaryVisuals.length > secondarySlotCap) {
    setSecondarySlotCap(secondaryVisuals.length);
  }
  for (let i = 0; i < secondaryVisuals.length; i++) {
    lastSecondarySlotsRef.current[i] = secondaryVisuals[i];
  }

  const secondaryTextActive = hasVisibleSlide && !isTransitioningOut;
  const retainedSecondarySlots = [];
  for (let i = 0; i < secondarySlotCap; i++) {
    const activeSlot = secondaryVisuals[i];
    const fallbackSlot = lastSecondarySlotsRef.current[i];
    const slot = activeSlot || fallbackSlot;
    if (!slot) continue;
    retainedSecondarySlots.push({
      slot,
      active: Boolean(activeSlot) && secondaryTextActive
    });
  }

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

        {/* 2. Optional box fill/blur/stroke/shadow behind the primary & secondary animated text */}
        <TextBoxBackdrop
          textEl={primaryTextEl}
          visuals={primaryVisuals}
          visible={hasVisibleSlide}
          animationEnabled={animationEnabled}
          slideTransition={effectiveSlideTransition}
        />
        {retainedSecondarySlots.map(({ slot, active }, idx) => (
          <TextBoxBackdrop
            key={`secondary-backdrop-${idx}`}
            textEl={slot.element}
            visuals={slot.visuals}
            visible={active}
            animationEnabled={animationEnabled}
            slideTransition={effectiveSlideTransition}
          />
        ))}

        {/* 3. Persistent Primary Lyric Stage (never remounted across themed/unthemed transitions) */}
        <LyricStageSlot
          key="primary-lyric-stage"
          text={latestPrimaryText}
          textStyle={primaryVisuals.textStyle}
          textShadowCss={primaryVisuals.textShadowCss}
          stageWrapperStyle={primaryVisuals.stageWrapperStyle}
          presetId={presetId}
          durationSeconds={durationSeconds}
          animationEnabled={animationEnabled}
          textEffectEnabled={textEffectEnabled}
          textEffectId={textEffectId}
          textEffectIntensity={textEffectIntensity}
          textEffectSpeed={textEffectSpeed}
          slideTransition={effectiveSlideTransition}
          hasPendingThemeChangeRef={hasPendingThemeChangeRef}
          onBeforeEnter={handleBeforeEnter}
        />

        {/* 4. Secondary Slide Text Boxes (e.g. "Pendeta", "Liturgos", "Umat", "Ayat") */}
        {retainedSecondarySlots.map(({ slot, active }, idx) => (
          <LyricStageSlot
            key={`secondary-lyric-stage-${idx}`}
            text={active ? slot.text : ""}
            textStyle={slot.visuals.textStyle}
            textShadowCss={slot.visuals.textShadowCss}
            stageWrapperStyle={slot.visuals.stageWrapperStyle}
            presetId={presetId}
            durationSeconds={durationSeconds}
            animationEnabled={animationEnabled}
            textEffectEnabled={textEffectEnabled}
            textEffectId={textEffectId}
            textEffectIntensity={textEffectIntensity}
            textEffectSpeed={textEffectSpeed}
            slideTransition={effectiveSlideTransition}
          />
        ))}

        {/* 5. Countdown & Running Text Overlay */}
        <CountdownOverlay
          config={countdownConfig}
          runtime={countdownRuntime}
          isInteractive={isInteractiveCountdown}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          onPositionChange={onCountdownPositionChange}
          onFontSizeChange={onCountdownFontSizeChange}
        />
      </div>
    </div>
  );
}
