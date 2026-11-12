/**
 * Continuous After Effects & Kinetic Typography Text Effect Engine
 *
 * Adapted from After Effects text expressions (wiggle, posterizeTime, Turbulent Displace,
 * Swing, Skew, Tracking) and open-source kinetic typography patterns (elahlabs/elah,
 * react-bits, react-moving-text, typexperiments, DepthText).
 */

export const TEXT_EFFECT_CATEGORIES = [
  { id: "wiggle", label: "〰️ AE Wiggle & Organik" },
  { id: "wave", label: "🌊 Wave, Swing & Kinetic" },
  { id: "distort", label: "🔥 Turbulent Displace & Glitch" },
  { id: "glow", label: "✨ Glow, 3D Depth & Tracking" }
];

export const TEXT_EFFECT_PRESETS = {
  // === 1. AE Wiggle & Organik ===
  "ae-wiggle-pos": {
    id: "ae-wiggle-pos",
    category: "wiggle",
    name: "AE Wiggle Position (Organik Per-Huruf)",
    target: "per-character",
    mode: "wiggle-pos"
  },
  "ae-wiggle-word": {
    id: "ae-wiggle-word",
    category: "wiggle",
    name: "AE Wiggle Per-Kata (Mengalun)",
    target: "per-word",
    mode: "wiggle-word"
  },
  "ae-wiggle-whole": {
    id: "ae-wiggle-whole",
    category: "wiggle",
    name: "AE Wiggle Handheld (Satu Blok)",
    target: "whole",
    mode: "wiggle-whole"
  },
  "ae-jumpy-wiggle": {
    id: "ae-jumpy-wiggle",
    category: "wiggle",
    name: "AE Jumpy Wiggle (Posterize Time)",
    target: "per-character",
    mode: "jumpy-wiggle"
  },
  "ae-wiggle-rot": {
    id: "ae-wiggle-rot",
    category: "wiggle",
    name: "AE Wiggle Rotation (Goyang Sudut)",
    target: "per-character",
    mode: "wiggle-rot"
  },
  "ae-wiggle-scale": {
    id: "ae-wiggle-scale",
    category: "wiggle",
    name: "AE Wiggle Scale (Denyut Acak)",
    target: "per-character",
    mode: "wiggle-scale"
  },

  // === 2. Wave, Swing & Kinetic ===
  "wave-sine-char": {
    id: "wave-sine-char",
    category: "wave",
    name: "Sine Wave (Ombak Per-Huruf)",
    target: "per-character",
    mode: "wave-sine"
  },
  "wave-sine-word": {
    id: "wave-sine-word",
    category: "wave",
    name: "Sine Wave (Ombak Per-Kata)",
    target: "per-word",
    mode: "wave-sine"
  },
  "wave-flag": {
    id: "wave-flag",
    category: "wave",
    name: "Flag / Ribbon Wave (Kibaran)",
    target: "per-character",
    mode: "wave-flag"
  },
  "pendulum-swing": {
    id: "pendulum-swing",
    category: "wave",
    name: "Pendulum Swing (Ayunan Bandul)",
    target: "per-word",
    mode: "pendulum-swing"
  },
  "floating-ethereal": {
    id: "floating-ethereal",
    category: "wave",
    name: "Ethereal Float (Melayang Ibadah)",
    target: "whole",
    mode: "floating-ethereal"
  },
  "jelly-wobble": {
    id: "jelly-wobble",
    category: "wave",
    name: "Jelly Wobble (Elastis Kenyal)",
    target: "per-character",
    mode: "jelly-wobble"
  },
  "kinetic-skew": {
    id: "kinetic-skew",
    category: "wave",
    name: "Kinetic Skew Sway (Miring Ritmis)",
    target: "per-word",
    mode: "kinetic-skew"
  },
  "orbit-drift": {
    id: "orbit-drift",
    category: "wave",
    name: "Circular Orbit (Putaran Halus)",
    target: "per-character",
    mode: "orbit-drift"
  },
  "cascade-ripple": {
    id: "cascade-ripple",
    category: "wave",
    name: "Ripple Bounce (Pantulan Berantai)",
    target: "per-character",
    mode: "cascade-ripple"
  },

  // === 3. Turbulent Displace & Glitch ===
  "turbulent-displace": {
    id: "turbulent-displace",
    category: "distort",
    name: "Turbulent Displace (Gelombang Cair AE)",
    target: "whole",
    mode: "turbulent-displace",
    usesSvgFilter: true
  },
  "turbulent-boil": {
    id: "turbulent-boil",
    category: "distort",
    name: "Line Boil / Stop-Motion (AE Boil)",
    target: "whole",
    mode: "turbulent-boil",
    usesSvgFilter: true
  },
  "chromatic-glitch": {
    id: "chromatic-glitch",
    category: "distort",
    name: "Chromatic Glitch (RGB Split AE)",
    target: "per-word",
    mode: "chromatic-glitch"
  },
  "digital-slice-jitter": {
    id: "digital-slice-jitter",
    category: "distort",
    name: "Signal Flutter / VHS (Getar Sinyal)",
    target: "whole",
    mode: "signal-flutter"
  },
  "bass-earthquake": {
    id: "bass-earthquake",
    category: "distort",
    name: "Bass Shake (Getar Enerjik Praise)",
    target: "whole",
    mode: "bass-shake"
  },

  // === 4. Glow, 3D Depth & Tracking ===
  "neon-pulse": {
    id: "neon-pulse",
    category: "glow",
    name: "Neon Glow Pulse (Cahaya Berdenyut)",
    target: "whole",
    mode: "neon-pulse"
  },
  "depth-tilt-3d": {
    id: "depth-tilt-3d",
    category: "glow",
    name: "3D Perspective Sway (Kemiringan 3D)",
    target: "whole",
    mode: "depth-tilt-3d"
  },
  "breathing-pulse": {
    id: "breathing-pulse",
    category: "glow",
    name: "Heartbeat / Breathing (Napas)",
    target: "whole",
    mode: "breathing-pulse"
  },
  "tracking-breathe": {
    id: "tracking-breathe",
    category: "glow",
    name: "AE Tracking Breathe (Spasi Berdenyut)",
    target: "per-character",
    mode: "tracking-breathe"
  }
};

export const VALID_TEXT_EFFECT_IDS = new Set(Object.keys(TEXT_EFFECT_PRESETS));

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Deterministic fast hash in [-1, 1] for integer lattice coordinate + seed.
 */
function hash1D(n, seed) {
  const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453123;
  return (x - Math.floor(x)) * 2 - 1;
}

/**
 * Smooth 1D value noise using quintic Hermite curve (C2 continuous),
 * approximating After Effects Perlin noise.
 */
function smoothNoise1D(t, seed) {
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * f * (f * (f * 6 - 15) + 10);
  const a = hash1D(i, seed);
  const b = hash1D(i + 1, seed);
  return a + (b - a) * u;
}

/**
 * Multi-octave After Effects wiggle(freq, amp, octaves = 2, ampMult = 0.5)
 */
function aeWiggle(timeSec, freq, amp, seed, octaves = 2, ampMult = 0.5) {
  let sum = 0;
  let curFreq = freq;
  let curAmp = amp;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += smoothNoise1D(timeSec * curFreq, seed + o * 17.3) * curAmp;
    norm += curAmp;
    curFreq *= 2.03;
    curAmp *= ampMult;
  }
  return norm > 0 ? sum / (norm / amp) : 0;
}

function clearElementFxStyles(el) {
  if (!el) return;
  el.style.transform = "";
  el.style.filter = "";
  el.style.opacity = "";
  el.style.transformOrigin = "";
}

/**
 * Start a continuous requestAnimationFrame loop applying the selected text effect
 * onto `dom.fxWhole` and `dom.fxUnits`.
 */
export function startTextEffectLoop({
  dom,
  effectId = "ae-wiggle-pos",
  intensity = 1.0,
  speed = 1.0,
  svgTurbulenceEl = null,
  svgDisplacementEl = null,
  svgFilterId = ""
}) {
  if (!dom) {
    return {
      updateParams: () => {},
      stop: () => {}
    };
  }

  let state = {
    effectId: VALID_TEXT_EFFECT_IDS.has(effectId) ? effectId : "ae-wiggle-pos",
    intensity: clamp(Number(intensity) || 1.0, 0.2, 2.5),
    speed: clamp(Number(speed) || 1.0, 0.2, 3.0)
  };

  let rafId = 0;
  let stopped = false;
  let lastTs = performance.now();
  let phaseTime = 0;

  const resetAllStyles = () => {
    clearElementFxStyles(dom.fxWhole);
    if (Array.isArray(dom.fxUnits)) {
      for (const u of dom.fxUnits) {
        clearElementFxStyles(u);
      }
    }
  };

  const applyFrame = (t) => {
    const preset = TEXT_EFFECT_PRESETS[state.effectId] || TEXT_EFFECT_PRESETS["ae-wiggle-pos"];
    const mode = preset.mode;
    const amp = state.intensity;
    const fxWhole = dom.fxWhole;
    const fxUnits = dom.fxUnits || [];

    // Ensure clean baseline when switching modes
    if (!preset.usesSvgFilter && fxWhole && fxWhole.style.filter) {
      if (
        mode !== "neon-pulse" &&
        mode !== "chromatic-glitch" &&
        mode !== "signal-flutter"
      ) {
        fxWhole.style.filter = "";
      }
    }

    switch (mode) {
      case "wiggle-pos": {
        for (let i = 0; i < fxUnits.length; i++) {
          const u = fxUnits[i];
          const seed = i * 3.71 + 1.1;
          const dx = aeWiggle(t, 1.85, 5.5 * amp, seed);
          const dy = aeWiggle(t, 2.05, 7.5 * amp, seed + 41.3);
          const rot = aeWiggle(t, 1.55, 3.2 * amp, seed + 89.7);
          u.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg)`;
        }
        break;
      }

      case "wiggle-word": {
        for (let i = 0; i < fxUnits.length; i++) {
          const u = fxUnits[i];
          const wIdx = Number(u.dataset.wordIndex ?? i);
          const seed = wIdx * 5.13 + 7.4;
          const dx = aeWiggle(t, 1.35, 7.0 * amp, seed);
          const dy = aeWiggle(t, 1.5, 9.0 * amp, seed + 23.9);
          const rot = aeWiggle(t, 1.1, 2.4 * amp, seed + 61.1);
          u.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg)`;
        }
        break;
      }

      case "wiggle-whole": {
        if (fxWhole) {
          const dx = aeWiggle(t, 0.95, 14 * amp, 11.3, 2);
          const dy = aeWiggle(t, 1.08, 12 * amp, 57.9, 2);
          const rot = aeWiggle(t, 0.72, 1.6 * amp, 103.5, 2);
          fxWhole.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg)`;
        }
        break;
      }

      case "jumpy-wiggle": {
        // After Effects posterizeTime(7) + wiggle
        const posterizedT = Math.floor(t * 7) / 7;
        for (let i = 0; i < fxUnits.length; i++) {
          const u = fxUnits[i];
          const seed = i * 4.37 + 2.5;
          const dx = aeWiggle(posterizedT, 3.2, 6.5 * amp, seed, 2);
          const dy = aeWiggle(posterizedT, 3.5, 8.5 * amp, seed + 33.1, 2);
          const rot = aeWiggle(posterizedT, 2.9, 5.0 * amp, seed + 71.7, 2);
          u.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg)`;
        }
        break;
      }

      case "wiggle-rot": {
        for (let i = 0; i < fxUnits.length; i++) {
          const u = fxUnits[i];
          const seed = i * 6.17 + 3.3;
          const rot = aeWiggle(t, 1.8, 9.5 * amp, seed, 2);
          const dy = aeWiggle(t, 1.5, 3.5 * amp, seed + 19.4, 2);
          u.style.transform = `translate3d(0, ${dy.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg)`;
        }
        break;
      }

      case "wiggle-scale": {
        for (let i = 0; i < fxUnits.length; i++) {
          const u = fxUnits[i];
          const seed = i * 4.91 + 9.2;
          const s = 1 + aeWiggle(t, 1.9, 0.14 * amp, seed, 2);
          const dy = aeWiggle(t, 1.6, 3.2 * amp, seed + 29.7, 2);
          u.style.transform = `translate3d(0, ${dy.toFixed(2)}px, 0) scale(${clamp(s, 0.65, 1.45).toFixed(3)})`;
        }
        break;
      }

      case "wave-sine": {
        const isWord = preset.target === "per-word";
        const phaseStep = isWord ? 0.65 : 0.36;
        const yAmp = (isWord ? 11 : 10) * amp;
        const rotAmp = (isWord ? 2.2 : 3.0) * amp;
        for (let i = 0; i < fxUnits.length; i++) {
          const u = fxUnits[i];
          const idx = isWord ? Number(u.dataset.wordIndex ?? i) : i;
          const phase = t * 3.2 - idx * phaseStep;
          const dy = Math.sin(phase) * yAmp;
          const rot = Math.cos(phase) * rotAmp;
          u.style.transform = `translate3d(0, ${dy.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg)`;
        }
        break;
      }

      case "wave-flag": {
        for (let i = 0; i < fxUnits.length; i++) {
          const u = fxUnits[i];
          const phase = t * 3.0 - i * 0.32;
          const dx = Math.cos(phase * 0.85) * 4.5 * amp;
          const dy = Math.sin(phase) * 11 * amp;
          const rot = Math.cos(phase) * 6.5 * amp;
          const skewX = Math.sin(phase + 0.8) * 5.0 * amp;
          u.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg) skewX(${skewX.toFixed(2)}deg)`;
        }
        break;
      }

      case "pendulum-swing": {
        for (let i = 0; i < fxUnits.length; i++) {
          const u = fxUnits[i];
          const wIdx = Number(u.dataset.wordIndex ?? i);
          const phase = t * 2.4 - wIdx * 0.55;
          const rot = Math.sin(phase) * 5.5 * amp;
          const dx = Math.sin(phase) * 3.5 * amp;
          u.style.transformOrigin = "50% 15%";
          u.style.transform = `translate3d(${dx.toFixed(2)}px, 0, 0) rotate(${rot.toFixed(2)}deg)`;
        }
        break;
      }

      case "floating-ethereal": {
        if (fxWhole) {
          const dy = Math.sin(t * 1.15) * 10 * amp;
          const dx = Math.sin(t * 0.65 + 1.1) * 6 * amp;
          const rot = Math.sin(t * 0.55 + 0.5) * 0.9 * amp;
          const s = 1 + Math.sin(t * 0.85 + 2.0) * 0.015 * amp;
          fxWhole.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg) scale(${s.toFixed(4)})`;
        }
        break;
      }

      case "jelly-wobble": {
        for (let i = 0; i < fxUnits.length; i++) {
          const u = fxUnits[i];
          const phase = t * 4.0 - i * 0.42;
          const squash = Math.sin(phase) * 0.14 * amp;
          const sx = clamp(1 + squash, 0.72, 1.35);
          const sy = clamp(1 - squash * 0.9, 0.72, 1.35);
          const dy = -Math.abs(Math.sin(phase * 0.5)) * 8 * amp;
          u.style.transformOrigin = "50% 80%";
          u.style.transform = `translate3d(0, ${dy.toFixed(2)}px, 0) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
        }
        break;
      }

      case "kinetic-skew": {
        for (let i = 0; i < fxUnits.length; i++) {
          const u = fxUnits[i];
          const wIdx = Number(u.dataset.wordIndex ?? i);
          const phase = t * 2.7 - wIdx * 0.48;
          const skewX = Math.sin(phase) * 10 * amp;
          const dx = -Math.sin(phase) * 6 * amp;
          u.style.transform = `translate3d(${dx.toFixed(2)}px, 0, 0) skewX(${skewX.toFixed(2)}deg)`;
        }
        break;
      }

      case "orbit-drift": {
        for (let i = 0; i < fxUnits.length; i++) {
          const u = fxUnits[i];
          const phase = t * 2.8 - i * 0.45;
          const dx = Math.cos(phase) * 5.5 * amp;
          const dy = Math.sin(phase) * 6.5 * amp;
          u.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`;
        }
        break;
      }

      case "cascade-ripple": {
        for (let i = 0; i < fxUnits.length; i++) {
          const u = fxUnits[i];
          const cycle = (t * 1.15 - i * 0.065) % 1.8;
          const local = cycle < 0 ? cycle + 1.8 : cycle;
          // Raised-cosine pulse over [0, 0.55] followed by rest
          let dy = 0;
          let s = 1;
          if (local < 0.55) {
            const p = local / 0.55;
            const wave = Math.sin(p * Math.PI);
            dy = -wave * 16 * amp;
            s = 1 + wave * 0.08 * amp;
          }
          u.style.transform = `translate3d(0, ${dy.toFixed(2)}px, 0) scale(${s.toFixed(3)})`;
        }
        break;
      }

      case "turbulent-displace": {
        if (fxWhole && svgTurbulenceEl && svgDisplacementEl && svgFilterId) {
          const freqX = (0.012 + Math.sin(t * 0.8) * 0.003).toFixed(4);
          const freqY = (0.022 + Math.cos(t * 0.95) * 0.004).toFixed(4);
          svgTurbulenceEl.setAttribute("baseFrequency", `${freqX} ${freqY}`);
          svgTurbulenceEl.setAttribute("seed", "2");
          svgDisplacementEl.setAttribute("scale", (14 * amp).toFixed(1));
          fxWhole.style.filter = `url(#${svgFilterId})`;
          const dy = Math.sin(t * 1.2) * 3.5 * amp;
          fxWhole.style.transform = `translate3d(0, ${dy.toFixed(2)}px, 0)`;
        }
        break;
      }

      case "turbulent-boil": {
        if (fxWhole && svgTurbulenceEl && svgDisplacementEl && svgFilterId) {
          // Posterize at 8fps for classic hand-drawn animation line boil
          const frameIdx = Math.floor(t * 8);
          const seed = (frameIdx % 48) + 1;
          svgTurbulenceEl.setAttribute("baseFrequency", "0.024 0.032");
          svgTurbulenceEl.setAttribute("seed", String(seed));
          svgDisplacementEl.setAttribute("scale", (9 * amp).toFixed(1));
          fxWhole.style.filter = `url(#${svgFilterId})`;
          const dx = hash1D(frameIdx, 1.7) * 1.5 * amp;
          const dy = hash1D(frameIdx, 8.3) * 1.5 * amp;
          fxWhole.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`;
        }
        break;
      }

      case "chromatic-glitch": {
        // Periodic crisp digital glitch bursts + subtle continuous micro-tension
        const stepT = Math.floor(t * 18);
        const burst = hash1D(Math.floor(t * 3.2), 19.1);
        const isGlitching = burst > 0.42;
        if (fxWhole) {
          if (isGlitching) {
            const split = (3.5 + Math.abs(hash1D(stepT, 4.1)) * 6.5) * amp;
            const skew = hash1D(stepT, 12.9) * 5.0 * amp;
            const gx = hash1D(stepT, 7.2) * 6.0 * amp;
            fxWhole.style.transform = `translate3d(${gx.toFixed(2)}px, 0, 0) skewX(${skew.toFixed(2)}deg)`;
            fxWhole.style.filter = `drop-shadow(${split.toFixed(1)}px 0 0 rgba(0, 245, 255, 0.85)) drop-shadow(${(-split).toFixed(1)}px 0 0 rgba(255, 0, 128, 0.85))`;
          } else {
            fxWhole.style.transform = "translate3d(0, 0, 0)";
            fxWhole.style.filter = "";
          }
        }
        for (let i = 0; i < fxUnits.length; i++) {
          const u = fxUnits[i];
          const wIdx = Number(u.dataset.wordIndex ?? i);
          if (isGlitching && hash1D(stepT + wIdx * 5, 2.3) > 0.2) {
            const jx = hash1D(stepT, wIdx + 3.1) * 9 * amp;
            const jy = hash1D(stepT, wIdx + 9.7) * 3 * amp;
            u.style.transform = `translate3d(${jx.toFixed(2)}px, ${jy.toFixed(2)}px, 0)`;
          } else {
            u.style.transform = "";
          }
        }
        break;
      }

      case "signal-flutter": {
        if (fxWhole) {
          const frame = Math.floor(t * 24);
          const flutter = hash1D(frame, 31.4);
          const dx = Math.sin(t * 19) * 1.4 * amp + (flutter > 0.65 ? flutter * 7 * amp : 0);
          const skew = flutter > 0.72 ? flutter * 4.5 * amp : Math.sin(t * 7) * 0.8 * amp;
          const op = flutter > 0.8 ? clamp(1 - 0.22 * amp, 0.62, 1) : 1;
          fxWhole.style.transform = `translate3d(${dx.toFixed(2)}px, 0, 0) skewX(${skew.toFixed(2)}deg)`;
          fxWhole.style.opacity = op.toFixed(3);
        }
        break;
      }

      case "bass-shake": {
        if (fxWhole) {
          // Rapid energetic shake modulated by rhythmic pulse
          const pulse = 0.45 + 0.55 * Math.pow(Math.max(0, Math.sin(t * 4.2)), 2);
          const dx = aeWiggle(t, 12.0, 9.0 * amp * pulse, 5.1, 2);
          const dy = aeWiggle(t, 13.5, 9.0 * amp * pulse, 28.4, 2);
          const rot = aeWiggle(t, 10.5, 1.8 * amp * pulse, 64.9, 2);
          const s = 1 + pulse * 0.032 * amp;
          fxWhole.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg) scale(${s.toFixed(4)})`;
        }
        break;
      }

      case "neon-pulse": {
        if (fxWhole) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 2.6);
          const r1 = (4 + pulse * 8) * amp;
          const r2 = (12 + pulse * 18) * amp;
          const alpha1 = clamp(0.45 + pulse * 0.4, 0.2, 0.95);
          const alpha2 = clamp(0.25 + pulse * 0.35, 0.15, 0.8);
          fxWhole.style.filter = `drop-shadow(0 0 ${r1.toFixed(1)}px rgba(165, 216, 255, ${alpha1.toFixed(2)})) drop-shadow(0 0 ${r2.toFixed(1)}px rgba(99, 102, 241, ${alpha2.toFixed(2)}))`;
          const s = 1 + pulse * 0.015 * amp;
          fxWhole.style.transform = `scale(${s.toFixed(4)})`;
        }
        break;
      }

      case "depth-tilt-3d": {
        if (fxWhole) {
          const rx = Math.sin(t * 1.1) * 7.5 * amp;
          const ry = Math.cos(t * 0.85) * 10.5 * amp;
          const dy = Math.sin(t * 1.4) * 5.0 * amp;
          fxWhole.style.transform = `perspective(950px) translate3d(0, ${dy.toFixed(2)}px, 0) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
        }
        break;
      }

      case "breathing-pulse": {
        if (fxWhole) {
          const wave = Math.sin(t * 1.85);
          const s = 1 + wave * 0.035 * amp;
          const op = clamp(0.92 + wave * 0.08, 0.75, 1);
          fxWhole.style.transform = `scale(${s.toFixed(4)})`;
          fxWhole.style.opacity = op.toFixed(3);
        }
        break;
      }

      case "tracking-breathe": {
        const count = fxUnits.length;
        if (count > 1) {
          const center = (count - 1) / 2;
          const spread = (0.5 + 0.5 * Math.sin(t * 1.5)) * 5.5 * amp;
          for (let i = 0; i < count; i++) {
            const u = fxUnits[i];
            const dx = (i - center) * (spread / Math.max(4, count * 0.22));
            u.style.transform = `translate3d(${dx.toFixed(2)}px, 0, 0)`;
          }
        }
        break;
      }

      default:
        break;
    }
  };

  const tick = (now) => {
    if (stopped) return;
    const dt = Math.min(0.05, Math.max(0, (now - lastTs) / 1000));
    lastTs = now;
    phaseTime += dt * state.speed;
    applyFrame(phaseTime);
    rafId = window.requestAnimationFrame(tick);
  };

  rafId = window.requestAnimationFrame(tick);

  return {
    updateParams(next) {
      const nextId =
        next?.effectId && VALID_TEXT_EFFECT_IDS.has(next.effectId)
          ? next.effectId
          : state.effectId;
      if (nextId !== state.effectId) {
        resetAllStyles();
      }
      state = {
        effectId: nextId,
        intensity: clamp(Number(next?.intensity ?? state.intensity) || 1.0, 0.2, 2.5),
        speed: clamp(Number(next?.speed ?? state.speed) || 1.0, 0.2, 3.0)
      };
    },
    stop() {
      if (stopped) return;
      stopped = true;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      resetAllStyles();
    }
  };
}
