import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LiveLyricStage } from "./LiveLyricStage";
import { CountdownOverlay } from "./CountdownOverlay";
import {
  DEFAULT_PROPRESENTER_TRANSITION,
  isCutTransition
} from "../lib/propresenterTransitions";

function normalizeCompareText(value) {
  return String(value || "")
    .replace(/\u001F/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

const BIBLE_REF_LINE_REGEX = /\p{L}{2,}.*\d{1,3}\s*:\s*\d{1,3}/u;

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

const SUPERSCRIPT_DIGITS = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹"
};

const SUPERSCRIPT_TO_ASCII = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9"
};

function stripSuperscriptDigits(value) {
  return String(value || "").replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (ch) => SUPERSCRIPT_TO_ASCII[ch] || ch);
}

function toSuperscriptDigits(digits) {
  return String(digits || "")
    .split("")
    .map((d) => SUPERSCRIPT_DIGITS[d] || d)
    .join("");
}

function resolvePrimaryDisplayText(liveText, primaryEl, allTextBoxes) {
  const normalizedLive = normalizeCompareText(liveText);
  if (!normalizedLive) return "";
  if (!primaryEl?.text) return normalizedLive;

  const primaryPlain = normalizeCompareText(primaryEl.text.plainText);
  if (!primaryPlain) {
    return normalizedLive;
  }
  if (primaryPlain === normalizedLive) {
    return primaryPlain;
  }
  if (
    stripSuperscriptDigits(primaryPlain).replace(/\s+/g, " ") ===
    stripSuperscriptDigits(normalizedLive).replace(/\s+/g, " ")
  ) {
    return primaryPlain;
  }

  // If ProPresenter OpenAPI concatenated multiple text boxes into status/slide text,
  // avoid duplicating secondary box text inside the primary text box.
  if (Array.isArray(allTextBoxes) && allTextBoxes.length > 1) {
    const otherPlains = allTextBoxes
      .filter((box) => box !== primaryEl)
      .map((box) => normalizeCompareText(box?.text?.plainText))
      .filter(Boolean);

    const normLiveAscii = stripSuperscriptDigits(normalizedLive);
    const primaryAscii = stripSuperscriptDigits(primaryPlain);
    const hasOtherIncluded = otherPlains.some((other) =>
      normLiveAscii.includes(stripSuperscriptDigits(other))
    );
    if (normLiveAscii.includes(primaryAscii) && hasOtherIncluded) {
      return primaryPlain;
    }

    if (hasOtherIncluded) {
      const otherSet = new Set(otherPlains.map((o) => stripSuperscriptDigits(o)));
      const filteredLines = normalizedLive
        .split("\n")
        .filter((line) => !otherSet.has(stripSuperscriptDigits(line.trim())))
        .join("\n")
        .trim();
      if (filteredLines) {
        if (
          primaryAscii.replace(/\s+/g, " ") ===
          stripSuperscriptDigits(filteredLines).replace(/\s+/g, " ")
        ) {
          return primaryPlain;
        }
        return filteredLines;
      }
      return primaryPlain;
    }
  }

  return normalizedLive;
}

export function formatBibleVerseNumbers(text, showVerseNumbers = true) {
  const raw = String(text || "");
  if (!raw || !showVerseNumbers) return raw;

  return raw
    .split("\n")
    .map((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine || BIBLE_REF_LINE_REGEX.test(trimmedLine)) {
        return line;
      }
      let out = line;
      // 1. Attached verse numbers without space (e.g. "1Inilah", '23"Sesungguhnya', " 2Abraham")
      out = out.replace(
        /(^|[\s"“‘(])(\d{1,3})(?=[A-Za-z"“‘(])(?!(?:st|nd|rd|th|[dDkKgGxX])\b)/g,
        (_m, lead, digits) => `${lead}${toSuperscriptDigits(digits)}`
      );
      // 2. Space-separated verse number at the very start of a verse line (e.g. "1 Pada mulanya", '23 "Sesungguhnya')
      out = out.replace(
        /^(\s*)(\d{1,3})(?=\s+[A-Z"“‘(])/,
        (_m, lead, digits) => `${lead}${toSuperscriptDigits(digits)}`
      );
      // 3. Space-separated verse number mid-paragraph after sentence-ending punctuation (e.g. "... Abraham. 2 Abraham...")
      out = out.replace(
        /([.!?;:]["”’)]?\s+)(\d{1,3})(?=\s+[A-Z"“‘(])/g,
        (_m, lead, digits) => `${lead}${toSuperscriptDigits(digits)}`
      );
      return out;
    })
    .join("\n");
}

export function resolveLayoutTextSlots(themeInfo, liveText) {
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

  if (themeSource === "bible-theme") {
    const biblePrefs = themeInfo?.biblePrefs || {};
    const textBoxes = elements.filter((el) => el.isTextBox && el.text);
    const verseEl =
      textBoxes.find((el) => biblePrefs.verseBoxUuid && el.id === biblePrefs.verseBoxUuid) ||
      textBoxes.find(
        (el) =>
          biblePrefs.verseBoxName &&
          normalizeCompareText(el.text?.plainText) === normalizeCompareText(biblePrefs.verseBoxName)
      ) ||
      primaryTextEl;

    const refEl =
      textBoxes.find(
        (el) =>
          el.id !== verseEl?.id &&
          biblePrefs.referenceBoxUuid &&
          el.id === biblePrefs.referenceBoxUuid
      ) ||
      textBoxes.find(
        (el) =>
          el.id !== verseEl?.id &&
          biblePrefs.referenceBoxName &&
          normalizeCompareText(el.text?.plainText) === normalizeCompareText(biblePrefs.referenceBoxName)
      ) ||
      textBoxes.find((el) => el.id !== verseEl?.id && normalizeCompareText(el.text?.plainText) !== "") ||
      null;

    const lines = normalizedLive.split("\n").map((l) => l.trim()).filter(Boolean);
    const showSup = biblePrefs.showVerseNumbers !== false;

    if (refEl && lines.length >= 2) {
      const firstIsRef = BIBLE_REF_LINE_REGEX.test(lines[0]);
      const lastIsRef = !firstIsRef && BIBLE_REF_LINE_REGEX.test(lines[lines.length - 1]);
      const refText = lastIsRef ? lines[lines.length - 1] : lines[0];
      const verseLines = lastIsRef ? lines.slice(0, -1) : lines.slice(1);
      const verseText = formatBibleVerseNumbers(verseLines.join("\n"), showSup);
      const consumedThemeIds = new Set([verseEl?.id, refEl.id].filter(Boolean));
      return {
        primaryTextEl: verseEl,
        matchedCuePrimary: verseEl,
        primaryText: verseText,
        secondarySlots: [{ element: refEl, text: refText }],
        consumedThemeIds
      };
    }

    return {
      primaryTextEl: verseEl,
      matchedCuePrimary: verseEl,
      primaryText: formatBibleVerseNumbers(normalizedLive, showSup),
      secondarySlots: [],
      consumedThemeIds: new Set([verseEl?.id, refEl?.id].filter(Boolean))
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
    return {
      primaryTextEl,
      matchedCuePrimary: primaryTextEl,
      primaryText,
      secondarySlots,
      consumedThemeIds
    };
  }

  if (themeSource === "look-theme") {
    const cueBoxes = (themeInfo?.cueTextBoxes || []).filter(
      (el) => el.isTextBox && el.text && normalizeCompareText(el.text.plainText) !== ""
    );

    const matchedCuePrimary =
      cueBoxes.find((b) => normalizeCompareText(b.text.plainText) === normalizedLive) ||
      cueBoxes
        .filter((b) => normalizedLive.includes(normalizeCompareText(b.text.plainText)))
        .sort((a, b) => getBoxArea(b) - getBoxArea(a))[0] ||
      cueBoxes[0] ||
      null;

    if (cueBoxes.length <= 1) {
      return {
        primaryTextEl,
        matchedCuePrimary,
        primaryText: normalizedLive,
        secondarySlots: [],
        consumedThemeIds: new Set(primaryTextEl ? [primaryTextEl.id] : [])
      };
    }

    const primaryText = resolvePrimaryDisplayText(normalizedLive, matchedCuePrimary, cueBoxes);
    const remainingCueBoxes = cueBoxes.filter((b) => b !== matchedCuePrimary);
    const otherThemeTextEls = elements.filter(
      (el) => el.isTextBox && el.text && el.id !== primaryTextEl?.id
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
        element: matchedThemeEl || {
          ...cueBox,
          fill: { enabled: false },
          stroke: { enabled: false },
          textShape: { enabled: false }
        },
        cueBox,
        text: normalizeCompareText(cueBox.text.plainText)
      };
    });

    return {
      primaryTextEl,
      matchedCuePrimary,
      primaryText,
      secondarySlots,
      consumedThemeIds: usedThemeIds
    };
  }

  const unthemedLines = normalizedLive.split("\n").map((l) => l.trim()).filter(Boolean);
  const isUnthemedBible =
    !themeSource &&
    unthemedLines.length >= 2 &&
    (BIBLE_REF_LINE_REGEX.test(unthemedLines[0]) ||
      BIBLE_REF_LINE_REGEX.test(unthemedLines[unthemedLines.length - 1]));

  return {
    primaryTextEl,
    matchedCuePrimary: primaryTextEl,
    primaryText: isUnthemedBible ? formatBibleVerseNumbers(normalizedLive, true) : normalizedLive,
    secondarySlots: [],
    consumedThemeIds: new Set(primaryTextEl ? [primaryTextEl.id] : [])
  };
}

function isEffectiveFillVisible(fill) {
  if (!fill || !fill.enabled) return false;
  if (fill.type === "color") {
    const alpha = fill.color?.a;
    if (typeof alpha === "number" && alpha <= 0.001) return false;
  }
  if (fill.type === "gradient") {
    if (!Array.isArray(fill.stops) || fill.stops.length === 0) return false;
  }
  return true;
}

function isEffectiveStrokeVisible(stroke) {
  if (!stroke || !stroke.enabled) return false;
  if (typeof stroke.width === "number" && stroke.width <= 0) return false;
  const alpha = stroke.color?.a;
  if (typeof alpha === "number" && alpha <= 0.001) return false;
  return true;
}

export function buildTextBoxVisuals(
  textEl,
  canvasWidth,
  canvasHeight,
  cueTextEl = null,
  { inheritCueVisuals = true } = {}
) {
  const fallbackEl = inheritCueVisuals ? cueTextEl : null;

  const effectiveTextShape =
    textEl?.textShape?.enabled
      ? textEl.textShape
      : (fallbackEl?.textShape?.enabled ? fallbackEl.textShape : null);

  const effectiveFill =
    (isEffectiveFillVisible(textEl?.fill) ? textEl.fill : null) ||
    (isEffectiveFillVisible(fallbackEl?.fill) ? fallbackEl.fill : null);

  const effectiveStroke =
    (isEffectiveStrokeVisible(textEl?.stroke) ? textEl.stroke : null) ||
    (isEffectiveStrokeVisible(fallbackEl?.stroke) ? fallbackEl.stroke : null);

  const effectiveShadow =
    (textEl?.shadow?.enabled ? textEl.shadow : null) ||
    (fallbackEl?.shadow?.enabled ? fallbackEl.shadow : null);

  const textStyle = textEl?.text || cueTextEl?.text || null;
  const fillBg = effectiveFill ? buildCssBackground(effectiveFill) : {};
  const boxShadow = effectiveShadow ? buildCssShadow(effectiveShadow) : null;
  const effectiveFeather = textEl?.feather?.enabled ? textEl.feather : fallbackEl?.feather;
  const featherRadius = effectiveFeather?.enabled
    ? Math.round(
        Math.min(textEl?.bounds?.width || 1920, textEl?.bounds?.height || 1080) *
          Math.min(0.25, effectiveFeather.amount || 0.05)
      )
    : 0;

  // Line Background pill ONLY when ProPresenter's Text -> Lines -> Background (textShape.enabled) is active.
  // When Shape -> Fill (effectiveFill.enabled) is active WITHOUT textShape, render full-box TextBoxBackdrop (e.g. Liturgi headers like "Votum & Salam")!
  const isLineBackground = Boolean(
    effectiveTextShape?.enabled && (effectiveFill?.enabled || effectiveStroke?.enabled)
  );

  const hasBackdrop = Boolean(
    textEl &&
      textStyle &&
      !isLineBackground &&
      (effectiveFill?.enabled || effectiveStroke?.enabled)
  );

  const rawRadius = effectiveTextShape?.cornerRadius;
  const cornerRadius =
    typeof rawRadius === "number" && rawRadius > 0
      ? rawRadius
      : (effectiveTextShape?.enabled ? 9 : 0);

  const paddingX = effectiveTextShape?.padding ?? 24;
  const offsetY = effectiveTextShape?.offsetY ?? 0;
  const strokeCss = effectiveStroke?.enabled
    ? `${effectiveStroke.width || 1}px solid ${effectiveStroke.color?.css || "#fff"}`
    : null;

  const lineBackground = isLineBackground
    ? {
        enabled: true,
        fillBg: effectiveFill?.enabled ? fillBg : { backgroundColor: "transparent" },
        cornerRadius,
        paddingX,
        paddingY: 6,
        offsetY,
        strokeCss,
        shadowCss: effectiveShadow?.enabled ? buildCssShadow(effectiveShadow) : null
      }
    : null;

  const textShadowCss = textStyle
    ? buildCssShadow(textStyle.textShadow) || "none"
    : "0 4px 24px rgba(0, 0, 0, 0.85), 0 2px 8px rgba(0, 0, 0, 0.9)";

  const stageBounds =
    textEl && textStyle
      ? {
          x: Number(textEl.bounds?.x) || 0,
          y: Number(textEl.bounds?.y) || 0,
          width: Number(textEl.bounds?.width) || canvasWidth,
          height: Number(textEl.bounds?.height) || canvasHeight
        }
      : {
          x: 0,
          y: 0,
          width: canvasWidth,
          height: canvasHeight
        };

  const stageWrapperStyle =
    textEl && textStyle
      ? {
          position: "absolute",
          left: `${stageBounds.x}px`,
          top: `${stageBounds.y}px`,
          width: `${stageBounds.width}px`,
          height: `${stageBounds.height}px`,
          opacity: textEl.opacity ?? 1,
          transform: textEl.rotation ? `rotate(${textEl.rotation}deg)` : undefined,
          zIndex: textEl.zIndex + 10,
          overflow: "visible",
          pointerEvents: "none"
        }
      : {
          position: "absolute",
          left: "0px",
          top: "0px",
          width: `${canvasWidth}px`,
          height: `${canvasHeight}px`,
          zIndex: 10,
          overflow: "visible",
          pointerEvents: "none"
        };

  return {
    textStyle,
    effectiveFill,
    effectiveStroke,
    effectiveShadow,
    strokeCss,
    fillBg,
    boxShadow,
    featherRadius,
    hasBackdrop,
    lineBackground,
    textShadowCss,
    stageBounds,
    stageWrapperStyle
  };
}

export function TextBoxBackdrop({
  textEl,
  visuals,
  visible,
  animationEnabled,
  slideTransition
}) {
  if (!visuals?.hasBackdrop || !textEl) return null;
  if (textEl.path && !textEl.path.isRect && textEl.path.points?.length > 0) {
    return (
      <ProPresenterShapeLayer
        element={{
          ...textEl,
          fill: visuals.effectiveFill || { enabled: false },
          stroke: visuals.effectiveStroke || { enabled: false },
          shadow: visuals.effectiveShadow || null
        }}
        visible={visible}
        animationEnabled={animationEnabled}
        slideTransition={slideTransition}
      />
    );
  }
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
        border: visuals.strokeCss || undefined,
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

function SlideBackdropFadeItem({ item, onExited }) {
  const wrapRef = useRef(null);
  const animRef = useRef(null);
  const phaseRef = useRef("");

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;

    const cancelAnim = () => {
      if (animRef.current) {
        try {
          animRef.current.cancel();
        } catch (_) {}
        animRef.current = null;
      }
    };

    const isCut = isCutTransition(item.transition);
    const durationMs = isCut
      ? 0
      : Math.max(16, Math.round((Number(item.transition?.durationSeconds) || 0.5) * 1000));

    if (item.phase === "active") {
      if (phaseRef.current === "active") return undefined;
      phaseRef.current = "active";
      cancelAnim();

      if (durationMs <= 0) {
        el.style.opacity = "1";
        return undefined;
      }

      const computedOp = parseFloat(getComputedStyle(el).opacity);
      const fromOp = item.wasPresent && Number.isFinite(computedOp) ? computedOp : 0;
      el.style.opacity = String(fromOp);
      const anim = el.animate([{ opacity: fromOp }, { opacity: 1 }], {
        duration: durationMs,
        easing: "cubic-bezier(0.25, 0.1, 0.25, 1)",
        fill: "forwards"
      });
      animRef.current = anim;

      let canceled = false;
      const done = () => {
        if (canceled) return;
        el.style.opacity = "1";
        cancelAnim();
      };
      const timer = setTimeout(done, durationMs + 40);
      anim.finished
        .then(() => {
          clearTimeout(timer);
          done();
        })
        .catch(() => {
          clearTimeout(timer);
        });
      return () => {
        canceled = true;
        clearTimeout(timer);
        cancelAnim();
      };
    }

    if (item.phase === "exiting") {
      if (phaseRef.current === "exiting") return undefined;
      phaseRef.current = "exiting";
      const computedOp = parseFloat(getComputedStyle(el).opacity);
      const fromOp = Number.isFinite(computedOp) ? computedOp : 1;
      cancelAnim();

      if (durationMs <= 0 || fromOp <= 0.01) {
        el.style.opacity = "0";
        onExited(item.key);
        return undefined;
      }

      el.style.opacity = String(fromOp);
      const anim = el.animate([{ opacity: fromOp }, { opacity: 0 }], {
        duration: durationMs,
        easing: "cubic-bezier(0.25, 0.1, 0.25, 1)",
        fill: "forwards"
      });
      animRef.current = anim;

      let canceled = false;
      let finished = false;
      const done = () => {
        if (canceled || finished) return;
        finished = true;
        el.style.opacity = "0";
        cancelAnim();
        onExited(item.key);
      };
      const timer = setTimeout(done, durationMs + 40);
      anim.finished
        .then(() => {
          clearTimeout(timer);
          done();
        })
        .catch(() => {
          clearTimeout(timer);
          if (!canceled) done();
        });
      return () => {
        canceled = true;
        clearTimeout(timer);
        cancelAnim();
      };
    }

    return undefined;
  }, [item.key, item.phase, item.transition, item.wasPresent, onExited]);

  return (
    <div
      ref={wrapRef}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: item.element.zIndex
      }}
    >
      <ProPresenterShapeLayer
        element={item.element}
        visible={true}
        triggerKey={item.triggerKey}
        animationEnabled={item.animationEnabled}
        slideTransition={item.transition}
      />
    </div>
  );
}

function SlideBackdropStack({
  elements,
  visible,
  triggerKey,
  animationEnabled,
  slideTransition
}) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const activeElements = visible ? elements : [];
    const nextMap = new Map();
    for (const el of activeElements) {
      const mediaId = el.fill?.sourceFilePath || el.fill?.fileUrl || "";
      const k = `${el.id}::${mediaId}`;
      nextMap.set(k, el);
    }

    setItems((prev) => {
      const nextList = [];
      const seenKeys = new Set();

      for (const existing of prev) {
        if (nextMap.has(existing.key)) {
          seenKeys.add(existing.key);
          nextList.push({
            ...existing,
            element: nextMap.get(existing.key),
            phase: "active",
            wasPresent: true,
            triggerKey,
            animationEnabled,
            transition: slideTransition
          });
        } else if (existing.phase !== "exiting") {
          nextList.push({
            ...existing,
            phase: "exiting",
            transition: slideTransition
          });
        } else {
          nextList.push(existing);
        }
      }

      for (const [k, el] of nextMap.entries()) {
        if (!seenKeys.has(k)) {
          nextList.push({
            key: k,
            element: el,
            phase: "active",
            wasPresent: false,
            triggerKey,
            animationEnabled,
            transition: slideTransition
          });
        }
      }

      return nextList;
    });
  }, [elements, visible, triggerKey, animationEnabled, slideTransition]);

  const handleExited = useCallback((key) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  }, []);

  if (items.length === 0) return null;

  return items.map((item) => (
    <SlideBackdropFadeItem key={item.key} item={item} onExited={handleExited} />
  ));
}

export function doesThemeHaveSlideMedia(info) {
  if (!info) return false;
  return Boolean(
    info.cueMediaElements?.length > 0 ||
      info.layout?.elements?.some((e) => e.fill?.type === "media" && e.fill.enabled !== false)
  );
}

export function doesThemeHaveSlideVideo(info) {
  if (!info) return false;
  const isVidFill = (fill) =>
    fill?.type === "media" &&
    fill.enabled !== false &&
    (fill.mediaType === "video" ||
      (fill.fileUrl && /\.(mp4|webm|mov|m4v|mkv|avi|wmv)$/i.test(fill.fileUrl)));
  return Boolean(
    info.cueMediaElements?.some((e) => isVidFill(e.fill)) ||
      info.layout?.elements?.some((e) => isVidFill(e.fill))
  );
}

export function ProPresenterShapeLayer({
  element,
  visible,
  triggerKey = "",
  animationEnabled = true,
  slideTransition = null
}) {
  const videoRef = useRef(null);
  const [endedCleared, setEndedCleared] = useState(false);
  const [videoLoadError, setVideoLoadError] = useState(false);
  const { bounds, rotation, opacity, path: pathData, fill, stroke, shadow, feather } = element;
  const w = Math.max(1, bounds.width);
  const h = Math.max(1, bounds.height);
  const isCustomPath = pathData && !pathData.isRect && pathData.points?.length > 0;
  const boxShadowCss = buildCssShadow(shadow);

  const isMediaVideo =
    fill?.type === "media" &&
    (fill.mediaType === "video" ||
      (fill.fileUrl && /\.(mp4|webm|mov|m4v|mkv|avi|wmv)$/i.test(fill.fileUrl)) ||
      (fill.fileUrl && fill.fileUrl.includes("/live-alpha?")));

  const sourceIdentity = fill?.sourceFilePath || fill?.fileUrl || "";
  const [activeVideoSrc, setActiveVideoSrc] = useState(fill?.fileUrl || "");
  const prevSourceIdentityRef = useRef(sourceIdentity);

  if (prevSourceIdentityRef.current !== sourceIdentity) {
    prevSourceIdentityRef.current = sourceIdentity;
    setActiveVideoSrc(fill?.fileUrl || "");
  } else if (videoLoadError && fill?.fileUrl && fill.fileUrl !== activeVideoSrc) {
    setActiveVideoSrc(fill.fileUrl);
  }

  // Release hardware video decoder ONLY when unmounting or switching video URL (never mid-fade-out)
  useEffect(() => {
    setVideoLoadError(false);
    setEndedCleared(false);
    if (!isMediaVideo) return undefined;
    const vid = videoRef.current;
    return () => {
      if (vid) {
        try {
          vid.pause();
          vid.removeAttribute("src");
          vid.load();
        } catch (_) {}
      }
    };
  }, [isMediaVideo, activeVideoSrc]);

  // Start/restart playback when slide becomes visible or cue changes; pause after fade-out completes
  useEffect(() => {
    if (!isMediaVideo) return undefined;
    const vid = videoRef.current;
    if (!vid) return undefined;

    if (visible) {
      setEndedCleared(false);
      try {
        if (vid.readyState >= 1 && !fill?.loop) {
          vid.currentTime = 0;
        }
        const p = vid.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch (_) {}
      return undefined;
    }

    const fadeMs = Math.max(80, Math.round((Number(slideTransition?.durationSeconds) || 0.5) * 1000) + 60);
    const pauseTimer = setTimeout(() => {
      try {
        if (vid && !vid.paused) vid.pause();
      } catch (_) {}
    }, fadeMs);
    return () => clearTimeout(pauseTimer);
  }, [isMediaVideo, activeVideoSrc, fill?.loop, visible, triggerKey, slideTransition?.durationSeconds]);

  const effectiveVisible = visible && !endedCleared && !videoLoadError;

  const wrapperStyle = {
    position: "absolute",
    left: `${bounds.x}px`,
    top: `${bounds.y}px`,
    width: `${w}px`,
    height: `${h}px`,
    opacity: effectiveVisible ? (opacity ?? 1) : 0,
    transform: rotation ? `rotate(${rotation}deg)` : undefined,
    transition: computeLayerOpacityTransition(animationEnabled, effectiveVisible, slideTransition),
    pointerEvents: "none",
    zIndex: element.zIndex
  };

  if (fill?.type === "media") {
    const mediaFit = fill.objectFit || "contain";
    if (isMediaVideo && activeVideoSrc) {
      const ensurePlay = () => {
        setVideoLoadError(false);
        const vid = videoRef.current;
        if (vid && visible && !endedCleared && vid.paused) {
          const p = vid.play();
          if (p && typeof p.catch === "function") p.catch(() => {});
        }
      };
      return (
        <div style={{ ...wrapperStyle, overflow: "hidden" }}>
          <video
            ref={videoRef}
            key={activeVideoSrc}
            src={activeVideoSrc}
            autoPlay
            loop={Boolean(fill.loop)}
            muted
            playsInline
            preload="auto"
            onLoadedData={ensurePlay}
            onCanPlay={ensurePlay}
            onStalled={ensurePlay}
            onEnded={() => {
              if (!fill.loop && fill.clearOnEnd) {
                setEndedCleared(true);
              }
            }}
            onError={() => {
              setVideoLoadError(true);
            }}
            style={{
              width: "100%",
              height: "100%",
              objectFit: mediaFit,
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
              objectFit: mediaFit,
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
  stageBounds = null,
  stageWrapperStyle,
  lineBackground = null,
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
        stageBounds={stageBounds}
        lineBackground={lineBackground}
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
        scaleBehavior={textStyle?.scaleBehavior || "none"}
        textTransform={textStyle?.capitalization || "none"}
        lineHeight={1.2}
        lineHeightMultiple={
          textStyle
            ? Number(textStyle.lineHeightMultiple) > 0
              ? Number(textStyle.lineHeightMultiple)
              : 1.0
            : null
        }
        lineSpacing={textStyle?.lineSpacing || 0}
        minimumLineHeight={textStyle?.minimumLineHeight || 0}
        maximumLineHeight={textStyle?.maximumLineHeight || 0}
        exactLineHeight={textStyle?.exactLineHeight || 0}
        paragraphSpacing={
          textStyle
            ? (Number(textStyle.paragraphSpacing) || 0) +
              (Number(textStyle.paragraphSpacingBefore) || 0)
            : 0
        }
        lineFontScales={textStyle?.lineFontScales || null}
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
  const [prevAnimEnabledForExit, setPrevAnimEnabledForExit] = useState(animationEnabled !== false);
  const [isTransitioningOut, setIsTransitioningOut] = useState(false);

  const targetHasSlideMedia = doesThemeHaveSlideMedia(themeInfo);
  const targetHasContent = Boolean(trimmed) || targetHasSlideMedia;
  const hasVisibleSlide = targetHasContent;
  const hasSlideVideoTransition =
    doesThemeHaveSlideVideo(themeInfo) || doesThemeHaveSlideVideo(displayedThemeInfo);
  const rawSlideTransition =
    themeInfo?.cueSlideTransition || slideTransition || DEFAULT_PROPRESENTER_TRANSITION;
  const effectiveSlideTransition = hasSlideVideoTransition
    ? { type: "dissolve", name: "Fade", durationSeconds: 0.5, direction: "left", source: "video-slide-fade" }
    : animationEnabled === false
    ? offTransitionMode === "cut"
      ? { type: "cut", name: "Cut", durationSeconds: 0, direction: "left", source: "user-off-mode" }
      : {
          type: "dissolve",
          name: "Fade",
          durationSeconds:
            Number(rawSlideTransition?.durationSeconds) > 0.01
              ? Number(rawSlideTransition.durationSeconds)
              : 0.5,
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
    const prevWasAnimated = prevAnimEnabledForExit && prevTrimmedForExit !== "";
    const isCutMode = !shouldWaitForExit && isCutTransition(effectiveSlideTransition);
    setPrevTrimmedForExit(trimmed);
    setPrevAnimEnabledForExit(shouldWaitForExit);
    if (prevTrimmedForExit !== "" && (shouldWaitForExit || prevWasAnimated || !isCutMode)) {
      // Hold outgoing slide's theme & bounds until LiveLyricStage snapshots outgoing geometry
      // (in Fade mode) or completes exit animation (in Animated mode), preventing unthemed->themed box jumps!
      isExitingRef.current = true;
      setIsTransitioningOut(true);
    } else if (!shouldWaitForExit && targetHasContent) {
      // Empty stage or instant Cut mode: sync immediately on frame 0
      isExitingRef.current = false;
      setIsTransitioningOut(false);
      setDisplayedThemeInfo(themeInfo);
      setDisplayedBoxText(trimmed);
    }
  } else {
    if (shouldWaitForExit !== prevAnimEnabledForExit) {
      setPrevAnimEnabledForExit(shouldWaitForExit);
    }
    if (!isTransitioningOut && !isExitingRef.current && targetHasContent && displayedThemeInfo !== themeInfo) {
      setDisplayedThemeInfo(themeInfo);
    }
  }

  useLayoutEffect(() => {
    if (themeFlushResolverRef.current) {
      const resolve = themeFlushResolverRef.current;
      themeFlushResolverRef.current = null;
      resolve();
    }
  }, [displayedThemeInfo, displayedBoxText, isTransitioningOut]);

  useEffect(() => {
    if (!isExitingRef.current && (!shouldWaitForExit || !trimmed)) {
      setIsTransitioningOut(false);
    }
    // Commit themeInfo whenever target slide has text OR slide media (e.g. video lyric overlay).
    // Never overwrite displayedThemeInfo with null while clearing (!targetHasContent),
    // so outgoing text/video keeps its layout & fades out cleanly!
    if (!isExitingRef.current && targetHasContent) {
      setDisplayedThemeInfo(themeInfo);
      setDisplayedBoxText(trimmed);
    }
  }, [themeInfo, trimmed, targetHasContent, shouldWaitForExit]);

  // Safety guard: never allow isTransitioningOut to remain permanently stuck
  // if a rapid slide switch or early return skips LiveLyricStage's onBeforeEnter callback.
  useEffect(() => {
    if (!isTransitioningOut) return undefined;
    const maxWaitMs = Math.max(1800, Math.round((Number(durationSeconds) || 1.0) * 1000) + 900);
    const safetyTimer = setTimeout(() => {
      isExitingRef.current = false;
      setIsTransitioningOut(false);
      if (latestTrimmedRef.current !== "" || doesThemeHaveSlideMedia(latestThemeInfoRef.current)) {
        setDisplayedThemeInfo(latestThemeInfoRef.current);
        setDisplayedBoxText(latestTrimmedRef.current);
      }
    }, maxWaitMs);
    return () => clearTimeout(safetyTimer);
  }, [isTransitioningOut, durationSeconds]);

  const hasPendingThemeChangeRef = useRef(null);
  hasPendingThemeChangeRef.current = () => {
    const nextTheme = latestThemeInfoRef.current;
    const prevKey = displayedThemeInfoRef.current?.versionKey || "";
    const nextKey = nextTheme?.versionKey || "";
    return prevKey !== nextKey || !Object.is(displayedThemeInfoRef.current, nextTheme);
  };

  const handleBeforeEnter = useCallback(() => {
    isExitingRef.current = false;
    setIsTransitioningOut(false);
    const prevTheme = displayedThemeInfoRef.current;
    const nextTheme = latestThemeInfoRef.current;
    // Always commit the full slide text (including reference + verse lines),
    // never the primary-only slice passed back by LiveLyricStage.
    const targetBoxText = latestTrimmedRef.current;
    const prevThemeKey = prevTheme?.versionKey || "";
    const nextThemeKey = nextTheme?.versionKey || "";
    const themeChanged =
      prevThemeKey !== nextThemeKey || !Object.is(prevTheme, nextTheme);
    const boxTextChanged =
      (nextTheme?.source === "presentation-slide" || nextTheme?.source === "bible-theme") &&
      displayedBoxTextRef.current !== targetBoxText;

    if (!themeChanged && !boxTextChanged) {
      return Promise.resolve();
    }

    // Fast path: when consecutive slides share the exact same single-box visual layout & font scale,
    // commit state immediately without stalling the incoming animation behind an async layout roundtrip.
    const prevVisKey = prevTheme?.layoutVisualKey || "";
    const nextVisKey = nextTheme?.layoutVisualKey || "";
    const hasSecondaryBoxes =
      (prevTheme?.cueTextBoxes?.length || 0) > 1 ||
      (nextTheme?.cueTextBoxes?.length || 0) > 1 ||
      nextTheme?.source === "bible-theme";
    const hasLineScales =
      Boolean(prevTheme?.cueTextBoxes?.[0]?.text?.lineFontScales) ||
      Boolean(nextTheme?.cueTextBoxes?.[0]?.text?.lineFontScales);

    if (prevVisKey && prevVisKey === nextVisKey && !hasSecondaryBoxes && !hasLineScales) {
      setDisplayedThemeInfo(nextTheme);
      setDisplayedBoxText(targetBoxText);
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
      fallbackTimer = setTimeout(done, 32);
      setDisplayedThemeInfo(nextTheme);
      setDisplayedBoxText(targetBoxText);
    });
  }, []);

  const activeThemeForRender =
    !isTransitioningOut && targetHasContent ? themeInfo : displayedThemeInfo;
  const activeBoxTextForRender =
    !isTransitioningOut && targetHasContent ? trimmed : displayedBoxText;

  const layout = activeThemeForRender?.layout || null;
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

  const { primaryTextEl, matchedCuePrimary, secondarySlots, consumedThemeIds } = useMemo(
    () => resolveLayoutTextSlots(activeThemeForRender, activeBoxTextForRender),
    [activeThemeForRender, activeBoxTextForRender]
  );

  // Latest primary text drives LiveLyricStage's exit->enter lifecycle cleanly
  const latestPrimaryText = useMemo(
    () => resolveLayoutTextSlots(themeInfo, trimmed).primaryText,
    [themeInfo, trimmed]
  );

  // Decorative/background layers (non-text elements, plus any unconsumed empty text box that draws a box)
  const backdropElements = useMemo(() => {
    const list = [...elements];
    const cueMediaList = activeThemeForRender?.cueMediaElements || [];
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
      if (typeof el.opacity === "number" && el.opacity <= 0.001) return false;
      if (el.isTextBox) {
        return Boolean(isEffectiveFillVisible(el.fill) || isEffectiveStrokeVisible(el.stroke));
      }
      return Boolean(isEffectiveFillVisible(el.fill) || isEffectiveStrokeVisible(el.stroke));
    });
  }, [elements, activeThemeForRender?.cueMediaElements, consumedThemeIds]);

  const isLookOverride = activeThemeForRender?.source === "look-theme";

  const primaryVisuals = useMemo(
    () =>
      buildTextBoxVisuals(primaryTextEl, canvasWidth, canvasHeight, matchedCuePrimary, {
        inheritCueVisuals: !isLookOverride
      }),
    [primaryTextEl, matchedCuePrimary, isLookOverride, canvasWidth, canvasHeight]
  );

  const secondaryVisuals = useMemo(
    () =>
      secondarySlots.map((slot) => ({
        ...slot,
        visuals: buildTextBoxVisuals(
          slot.element,
          canvasWidth,
          canvasHeight,
          slot.cueBox || slot.element,
          { inheritCueVisuals: !isLookOverride }
        )
      })),
    [secondarySlots, isLookOverride, canvasWidth, canvasHeight]
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

  // Merge active TextBoxBackdrops into SlideBackdropStack so boxes fade smoothly
  // when transitioning between unthemed slides (no box) and themed slides (with box).
  const combinedBackdropElements = useMemo(() => {
    const list = [...backdropElements];
    if (primaryVisuals?.hasBackdrop && primaryTextEl) {
      list.push({
        ...primaryTextEl,
        id: `tb-backdrop:${primaryTextEl.id || "primary"}`,
        fill: primaryVisuals.effectiveFill || { enabled: false },
        stroke: primaryVisuals.effectiveStroke || { enabled: false },
        shadow: primaryVisuals.effectiveShadow || null,
        feather: primaryTextEl.feather?.enabled ? primaryTextEl.feather : undefined
      });
    }
    secondaryVisuals.forEach((slot, idx) => {
      if (slot?.visuals?.hasBackdrop && slot.element && secondaryTextActive) {
        list.push({
          ...slot.element,
          id: `tb-sec-backdrop:${slot.element.id || idx}`,
          fill: slot.visuals.effectiveFill || { enabled: false },
          stroke: slot.visuals.effectiveStroke || { enabled: false },
          shadow: slot.visuals.effectiveShadow || null,
          feather: slot.element.feather?.enabled ? slot.element.feather : undefined
        });
      }
    });
    return list;
  }, [
    backdropElements,
    primaryVisuals,
    primaryTextEl,
    secondaryVisuals,
    secondaryTextActive
  ]);

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
        {/* 1. Theme Shapes, Lower-Third Bars, Text Box Backdrops, Blur Boxes, Slide Videos, and Theme PNG Assets */}
        <SlideBackdropStack
          elements={combinedBackdropElements}
          visible={hasVisibleSlide}
          triggerKey={activeThemeForRender?.versionKey || ""}
          animationEnabled={animationEnabled}
          slideTransition={effectiveSlideTransition}
        />

        {/* 2. Persistent Primary Lyric Stage (never remounted across themed/unthemed transitions) */}
        <LyricStageSlot
          key="primary-lyric-stage"
          text={latestPrimaryText}
          textStyle={primaryVisuals.textStyle}
          textShadowCss={primaryVisuals.textShadowCss}
          stageBounds={primaryVisuals.stageBounds}
          stageWrapperStyle={primaryVisuals.stageWrapperStyle}
          lineBackground={primaryVisuals.lineBackground}
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

        {/* 3. Secondary Slide Text Boxes (e.g. "Pendeta", "Liturgos", "Umat", "Ayat") */}
        {retainedSecondarySlots.map(({ slot, active }, idx) => (
          <LyricStageSlot
            key={`secondary-lyric-stage-${idx}`}
            text={active ? slot.text : ""}
            textStyle={slot.visuals.textStyle}
            textShadowCss={slot.visuals.textShadowCss}
            stageBounds={slot.visuals.stageBounds}
            stageWrapperStyle={slot.visuals.stageWrapperStyle}
            lineBackground={slot.visuals.lineBackground}
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
