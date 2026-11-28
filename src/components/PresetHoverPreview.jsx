import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buildLyricDOM, runLyricAnimation } from "../lib/animationPresets";
import { startTextEffectLoop } from "../lib/textEffectEngine";
import {
  ProPresenterShapeLayer,
  TextBoxBackdrop,
  buildTextBoxVisuals,
  resolveLayoutTextSlots
} from "./ThemedLyricStage";

const FALLBACK_PREVIEW_TEXT = "KU MENYEMBAH-MU\nSEGENAP HATIKU";
const PREVIEW_WIDTH = 360;
const PREVIEW_CANVAS_HEIGHT = 202;
const PREVIEW_HEADER_HEIGHT = 34;
const PREVIEW_TOTAL_HEIGHT = PREVIEW_CANVAS_HEIGHT + PREVIEW_HEADER_HEIGHT;

function computePopupStyle(anchorRect) {
  if (!anchorRect || typeof window === "undefined") return null;
  const margin = 10;
  const gap = 10;

  let left = anchorRect.menuRight + gap;
  if (left + PREVIEW_WIDTH > window.innerWidth - margin) {
    const leftSide = anchorRect.menuLeft - PREVIEW_WIDTH - gap;
    left =
      leftSide >= margin
        ? leftSide
        : Math.max(margin, window.innerWidth - PREVIEW_WIDTH - margin);
  }

  const rowCenterY = anchorRect.rowTop + anchorRect.rowHeight / 2;
  const rawTop = rowCenterY - PREVIEW_TOTAL_HEIGHT / 2;
  const top = Math.max(
    margin,
    Math.min(window.innerHeight - PREVIEW_TOTAL_HEIGHT - margin, rawTop)
  );

  return {
    position: "fixed",
    left: `${Math.round(left)}px`,
    top: `${Math.round(top)}px`,
    width: `${PREVIEW_WIDTH}px`
  };
}

function buildStageStyleVars(textStyle, textShadowCss, lineBackground) {
  const textAlign = textStyle?.textAlign || "center";
  const verticalAlign = textStyle?.verticalAlignment || "center";
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
    lineBackground?.fillBg?.background ||
    (hasLineBg ? "rgba(0, 0, 0, 1)" : "transparent");

  const fontSize = textStyle ? textStyle.fontSize : 72;
  const fontFamily = textStyle ? textStyle.fontFamily : "Inter, sans-serif";
  const fontWeight = textStyle ? textStyle.fontWeight : 700;
  const fontStyle = textStyle?.fontItalic ? "italic" : "normal";
  const textColor = textStyle?.textColor?.css || "#ffffff";
  const textTransform = textStyle?.capitalization || "none";
  const lineHeight = textStyle
    ? Math.max(1.0, (textStyle.lineHeightMultiple || 1) * 1.12)
    : 1.28;
  const letterSpacing = textStyle?.letterSpacing || 0;
  const textStrokeWidth = textStyle?.textStrokeWidth || 0;
  const textStrokeColor = textStyle?.textStrokeColor?.css || "transparent";
  const padding = textStyle
    ? `${textStyle.margins?.top || 0}px ${textStyle.margins?.right || 0}px ${textStyle.margins?.bottom || 0}px ${textStyle.margins?.left || 0}px`
    : "60px 80px";

  return {
    hasLineBg,
    styleVars: {
      "--lyric-font-size": `${fontSize}px`,
      "--lyric-font-family": fontFamily,
      "--lyric-font-weight": fontWeight,
      "--lyric-font-style": fontStyle,
      "--lyric-color": textColor,
      "--lyric-shadow": textShadowCss,
      "--lyric-text-align": textAlign,
      "--lyric-text-transform": textTransform,
      "--lyric-line-height": lineHeight,
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
      "--lyric-line-border":
        hasLineBg && lineBackground.strokeCss ? lineBackground.strokeCss : "none",
      "--lyric-line-shadow":
        hasLineBg && lineBackground.shadowCss ? lineBackground.shadowCss : "none"
    }
  };
}

function applyStyleVars(el, styleVars) {
  if (!el || !styleVars) return;
  for (const [k, v] of Object.entries(styleVars)) {
    if (k.startsWith("--") && v !== undefined && v !== null) {
      el.style.setProperty(k, String(v));
    }
  }
}

function cancelSubtreeAnimations(root) {
  if (!root) return;
  try {
    root.getAnimations?.().forEach((a) => a.cancel());
    root.querySelectorAll?.("*").forEach((el) => {
      el.getAnimations?.().forEach((a) => a.cancel());
    });
  } catch (_) {}
}

function PreviewBackgroundMedia({ media }) {
  const videoRef = useRef(null);
  const [fallbackThumb, setFallbackThumb] = useState(false);

  useEffect(() => {
    setFallbackThumb(false);
  }, [media?.url]);

  useEffect(() => {
    const v = videoRef.current;
    return () => {
      if (v) {
        try {
          v.pause();
          v.removeAttribute("src");
          v.load();
        } catch (_) {}
      }
    };
  }, [media?.url]);

  if (!media?.url) return null;
  const isImage =
    media.mediaType === "image" || (fallbackThumb && Boolean(media.thumbUrl));
  const src = fallbackThumb && media.thumbUrl ? media.thumbUrl : media.url;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        overflow: "hidden",
        pointerEvents: "none"
      }}
    >
      {isImage ? (
        <img
          src={src}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <video
          ref={videoRef}
          key={src}
          src={src}
          poster={media.thumbUrl || undefined}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onError={() => {
            if (media.thumbUrl && !fallbackThumb) setFallbackThumb(true);
          }}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      )}
    </div>
  );
}

function PreviewSlotRunner({
  text,
  visuals,
  mode,
  item,
  options,
  onPhaseChange
}) {
  const reactId = useId();
  const svgFilterId = `preview-fx-turb-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const stageRef = useRef(null);
  const svgTurbulenceRef = useRef(null);
  const svgDisplacementRef = useRef(null);
  const onPhaseChangeRef = useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;

  const { hasLineBg, styleVars } = useMemo(
    () =>
      buildStageStyleVars(
        visuals?.textStyle,
        visuals?.textShadowCss || "0 4px 24px rgba(0,0,0,0.85), 0 2px 8px rgba(0,0,0,0.9)",
        visuals?.lineBackground
      ),
    [visuals]
  );

  const styleVarsRef = useRef(styleVars);
  styleVarsRef.current = styleVars;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !item || !text) return undefined;

    let cancelled = false;
    let holdTimer = null;
    let fxController = null;

    const sleep = (ms) =>
      new Promise((resolve) => {
        holdTimer = setTimeout(() => {
          holdTimer = null;
          resolve();
        }, ms);
      });

    if (mode === "effect") {
      onPhaseChangeRef.current?.("LIVE FX");
      stage.replaceChildren();
      const dom = buildLyricDOM(text, "whole", "active-lyric-phrase", {
        maskClip: false,
        effectTarget: item.target || "whole",
        hasLineBg
      });
      applyStyleVars(dom.container, styleVarsRef.current);
      stage.appendChild(dom.container);

      const fxIntensity = Number.isFinite(Number(options.intensity))
        ? Number(options.intensity)
        : 1.0;
      const fxSpeed = Number.isFinite(Number(options.speed)) ? Number(options.speed) : 1.0;

      fxController = startTextEffectLoop({
        dom,
        effectId: item.id,
        intensity: fxIntensity,
        speed: fxSpeed,
        svgTurbulenceEl: svgTurbulenceRef.current,
        svgDisplacementEl: svgDisplacementRef.current,
        svgFilterId
      });

      return () => {
        cancelled = true;
        if (fxController) {
          fxController.stop();
          fxController = null;
        }
        cancelSubtreeAnimations(stage);
        stage.replaceChildren();
      };
    }

    const rawDuration = Number(options.durationSeconds);
    const previewDurationSec = Math.max(
      0.5,
      Math.min(2.2, Number.isFinite(rawDuration) ? rawDuration : 1.0)
    );

    const runLoop = async () => {
      while (!cancelled && stage.isConnected) {
        stage.replaceChildren();
        const dom = buildLyricDOM(text, item.target || "per-word", "active-lyric-phrase", {
          maskClip: item.maskClip || false,
          effectTarget: "whole",
          hasLineBg
        });
        applyStyleVars(dom.container, styleVarsRef.current);
        stage.appendChild(dom.container);

        onPhaseChangeRef.current?.("IN");
        await runLyricAnimation({
          container: dom.container,
          units: dom.units,
          phase: "enter",
          preset: item,
          durationSeconds: previewDurationSec
        });
        if (cancelled || !stage.isConnected) break;

        onPhaseChangeRef.current?.("HOLD");
        await sleep(760);
        if (cancelled || !stage.isConnected) break;

        onPhaseChangeRef.current?.("OUT");
        await runLyricAnimation({
          container: dom.container,
          units: dom.units,
          phase: "exit",
          preset: item,
          durationSeconds: previewDurationSec,
          preserveFullExit: true
        });
        if (cancelled || !stage.isConnected) break;

        stage.replaceChildren();
        await sleep(220);
      }
    };

    runLoop().catch(() => {});

    return () => {
      cancelled = true;
      if (holdTimer) clearTimeout(holdTimer);
      cancelSubtreeAnimations(stage);
      stage.replaceChildren();
    };
  }, [
    mode,
    item?.id,
    text,
    hasLineBg,
    options.durationSeconds,
    options.intensity,
    options.speed,
    svgFilterId
  ]);

  return (
    <div style={visuals.stageWrapperStyle}>
      {mode === "effect" && (
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
      )}
      <div
        ref={stageRef}
        className="live-lyric-stage"
        style={styleVars}
      />
    </div>
  );
}

export function PresetHoverPreview({ mode, item, anchorRect, options = {} }) {
  const [phaseLabel, setPhaseLabel] = useState(mode === "effect" ? "LIVE FX" : "IN");

  const themeInfo = options.themeInfo || null;
  const activeMedia = options.activeMedia || null;
  const trimmedLive = String(options.sampleText || "").trim();
  const isFromLiveSlide = Boolean(trimmedLive);
  const effectiveText = isFromLiveSlide ? trimmedLive : FALLBACK_PREVIEW_TEXT;

  const layout = themeInfo?.layout || null;
  const canvasWidth = layout?.canvasWidth || 1920;
  const canvasHeight = layout?.canvasHeight || 1080;
  const elements = layout?.elements || [];

  const scale = Math.min(PREVIEW_WIDTH / canvasWidth, PREVIEW_CANVAS_HEIGHT / canvasHeight);

  const { primaryTextEl, matchedCuePrimary, primaryText, secondarySlots, consumedThemeIds } =
    useMemo(
      () => resolveLayoutTextSlots(themeInfo, effectiveText),
      [themeInfo, effectiveText]
    );

  const backdropElements = useMemo(() => {
    const list = [...elements];
    const cueMediaList = themeInfo?.cueMediaElements || [];
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
  }, [elements, themeInfo?.cueMediaElements, consumedThemeIds]);

  const primaryVisuals = useMemo(
    () => buildTextBoxVisuals(primaryTextEl, canvasWidth, canvasHeight, matchedCuePrimary),
    [primaryTextEl, matchedCuePrimary, canvasWidth, canvasHeight]
  );

  const secondaryVisuals = useMemo(
    () =>
      secondarySlots.map((slot) => ({
        ...slot,
        visuals: buildTextBoxVisuals(
          slot.element,
          canvasWidth,
          canvasHeight,
          slot.cueBox || slot.element
        )
      })),
    [secondarySlots, canvasWidth, canvasHeight]
  );

  const popupStyle = useMemo(() => computePopupStyle(anchorRect), [anchorRect]);

  if (!item || !popupStyle) return null;

  return createPortal(
    <div className="preset-hover-preview" style={popupStyle} aria-hidden="true">
      <div className="preset-hover-preview-header">
        <span className="preset-hover-preview-title">{item.name || item.id}</span>
        <span
          className={`preset-hover-preview-badge ${
            phaseLabel === "IN"
              ? "phase-in"
              : phaseLabel === "OUT"
              ? "phase-out"
              : phaseLabel === "LIVE FX"
              ? "phase-fx"
              : "phase-hold"
          }`}
        >
          {phaseLabel}
        </span>
      </div>

      <div className="preset-hover-preview-canvas">
        <PreviewBackgroundMedia media={activeMedia} />

        <div className="themed-stage-wrapper" style={{ zIndex: 2 }}>
          <div
            className="propresenter-design-canvas"
            style={{
              width: `${canvasWidth}px`,
              height: `${canvasHeight}px`,
              transform: `translate(-50%, -50%) scale(${scale})`
            }}
          >
            {backdropElements.map((el) => (
              <ProPresenterShapeLayer
                key={el.id}
                element={el}
                visible={true}
                animationEnabled={false}
                slideTransition={{ type: "cut", durationSeconds: 0 }}
              />
            ))}

            <TextBoxBackdrop
              textEl={primaryTextEl}
              visuals={primaryVisuals}
              visible={true}
              animationEnabled={false}
              slideTransition={{ type: "cut", durationSeconds: 0 }}
            />
            {secondaryVisuals.map((slot, idx) => (
              <TextBoxBackdrop
                key={`preview-sec-backdrop-${idx}`}
                textEl={slot.element}
                visuals={slot.visuals}
                visible={true}
                animationEnabled={false}
                slideTransition={{ type: "cut", durationSeconds: 0 }}
              />
            ))}

            <PreviewSlotRunner
              text={primaryText || effectiveText}
              visuals={primaryVisuals}
              mode={mode}
              item={item}
              options={options}
              onPhaseChange={setPhaseLabel}
            />

            {secondaryVisuals.map((slot, idx) => (
              <PreviewSlotRunner
                key={`preview-sec-slot-${idx}`}
                text={slot.text}
                visuals={slot.visuals}
                mode={mode}
                item={item}
                options={options}
              />
            ))}
          </div>
        </div>

        <span className="preset-hover-preview-meta">
          {isFromLiveSlide ? "Slide Aktif 1:1" : "Contoh Lirik"}
        </span>
      </div>
    </div>,
    document.body
  );
}
