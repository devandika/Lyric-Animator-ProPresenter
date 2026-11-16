import { animate, cubicBezier } from "motion/react";

/**
 * Curated After Effects + animate-text Skill Presets (28 total)
 * Categories: 'worship' | 'per-character' | 'per-word' | 'per-line' | 'whole'
 */
export const ANIMATION_CATEGORIES = [
  { id: "worship", label: "⭐ Favorit Ibadah" },
  { id: "per-character", label: "✨ Per-Huruf (Letter Reveals)" },
  { id: "per-word", label: "💬 Per-Kata (Word Kinetic)" },
  { id: "per-line", label: "📏 Per-Baris (Line Reveals)" },
  { id: "whole", label: "🎬 Satu Slide Utuh (Whole Phrase)" }
];

export const ANIMATION_PRESETS = {
  // === 1. Original Worship Favorites ===
  "cinematic-blur": {
    id: "cinematic-blur",
    category: "worship",
    name: "Cinematic Blur & Rise (Penyembahan / Slow)",
    target: "per-character",
    enter: {
      durationMs: 700,
      staggerMs: 16,
      easing: [0.16, 1, 0.3, 1],
      from: { opacity: 0, x: 0, y: 28, scale: 0.98, blur: 16 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 400,
      staggerMs: 8,
      easing: [0.7, 0, 0.84, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 0, y: -20, scale: 0.98, blur: 12 }
    }
  },
  "smooth-fade-slide": {
    id: "smooth-fade-slide",
    category: "worship",
    name: "Smooth Slide Up (Modern Clean)",
    target: "per-word",
    enter: {
      durationMs: 600,
      staggerMs: 24,
      easing: [0.25, 1, 0.5, 1],
      from: { opacity: 0, x: 0, y: 35, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 350,
      staggerMs: 12,
      easing: [0.5, 0, 0.75, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 0, y: -25, scale: 1, blur: 0 }
    }
  },
  "dynamic-pop": {
    id: "dynamic-pop",
    category: "worship",
    name: "Dynamic Pop & Bounce (Praise / Fast)",
    target: "per-word",
    enter: {
      durationMs: 650,
      staggerMs: 30,
      easing: [0.34, 1.56, 0.64, 1],
      from: { opacity: 0, x: 0, y: 20, scale: 0.8, blur: 8 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 350,
      staggerMs: 12,
      easing: [0.36, 0, 0.66, -0.56],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 0, y: -15, scale: 1.08, blur: 6 }
    }
  },
  "cinematic-fade": {
    id: "cinematic-fade",
    category: "worship",
    name: "Ethereal Dissolve (Pure Elegant Fade)",
    target: "per-word",
    enter: {
      durationMs: 800,
      staggerMs: 20,
      easing: [0.22, 1, 0.36, 1],
      from: { opacity: 0, x: 0, y: 8, scale: 0.96, blur: 20 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 500,
      staggerMs: 10,
      easing: [0.65, 0, 0.35, 1],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 0, y: -8, scale: 1.02, blur: 15 }
    }
  },

  // === 2. animate-text: Per-Character ===
  "soft-blur-in": {
    id: "soft-blur-in",
    category: "per-character",
    name: "Soft Blur (Apple Hero Reveal)",
    target: "per-character",
    enter: {
      durationMs: 900,
      staggerMs: 25,
      easing: [0.22, 1, 0.36, 1],
      from: { opacity: 0, x: 0, y: 16, scale: 1, blur: 12 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 600,
      staggerMs: 15,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 0, y: -16, scale: 1, blur: 12 }
    }
  },
  "per-character-rise": {
    id: "per-character-rise",
    category: "per-character",
    name: "Per-Character Rise (Crisp tvOS)",
    target: "per-character",
    enter: {
      durationMs: 700,
      staggerMs: 24,
      easing: [0.2, 0.8, 0.2, 1],
      from: { opacity: 0, x: 0, y: 32, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 420,
      staggerMs: 14,
      easing: [0.7, 0, 0.84, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 0, y: -24, scale: 1, blur: 0 }
    }
  },
  "bottom-up-letters": {
    id: "bottom-up-letters",
    category: "per-character",
    name: "Bottom-Up Letters (Tangga Naik)",
    target: "per-character",
    enter: {
      durationMs: 400,
      staggerMs: 88,
      easing: [0.18, 1, 0.32, 1],
      from: { opacity: 0, x: 0, y: 46, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 280,
      staggerMs: 28,
      easing: [0.7, 0, 0.84, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 0, y: -14, scale: 1, blur: 0 }
    }
  },
  "top-down-letters": {
    id: "top-down-letters",
    category: "per-character",
    name: "Top-Down Letters (Tangga Turun)",
    target: "per-character",
    enter: {
      durationMs: 400,
      staggerMs: 88,
      easing: [0.18, 1, 0.32, 1],
      from: { opacity: 0, x: 0, y: -46, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 280,
      staggerMs: 28,
      easing: [0.7, 0, 0.84, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 0, y: 14, scale: 1, blur: 0 }
    }
  },
  "stagger-from-center": {
    id: "stagger-from-center",
    category: "per-character",
    name: "Stagger from Center (Dari Tengah)",
    target: "per-character",
    staggerMode: "center-out",
    enter: {
      durationMs: 620,
      staggerMs: 22,
      easing: [0.22, 1, 0.36, 1],
      from: { opacity: 0, x: 0, y: 12, scale: 1, blur: 3 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 420,
      staggerMs: 16,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 0, y: -8, scale: 1, blur: 3 }
    }
  },
  "stagger-from-edges": {
    id: "stagger-from-edges",
    category: "per-character",
    name: "Stagger from Edges (Dari Sisi Luar)",
    target: "per-character",
    staggerMode: "edges-in",
    enter: {
      durationMs: 620,
      staggerMs: 22,
      easing: [0.22, 1, 0.36, 1],
      from: { opacity: 0, x: 0, y: 12, scale: 1, blur: 3 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 420,
      staggerMs: 16,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 0, y: -8, scale: 1, blur: 3 }
    }
  },
  "typewriter": {
    id: "typewriter",
    category: "per-character",
    name: "Typewriter (Ketik Per Huruf)",
    target: "per-character",
    enter: {
      durationMs: 240,
      staggerMs: 46,
      stepped: true,
      easing: [0, 0, 1, 1],
      from: { opacity: 0, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 260,
      staggerMs: 10,
      easing: [0.7, 0, 0.84, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 0, y: -4, scale: 1, blur: 0 }
    }
  },

  // === 3. animate-text: Per-Word ===
  "per-word-crossfade": {
    id: "per-word-crossfade",
    category: "per-word",
    name: "Per-Word Crossfade (Keynote Lembut)",
    target: "per-word",
    enter: {
      durationMs: 700,
      staggerMs: 70,
      easing: [0.16, 1, 0.3, 1],
      from: { opacity: 0, x: 0, y: 8, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 500,
      staggerMs: 40,
      easing: [0.7, 0, 0.84, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 0, y: -6, scale: 1, blur: 0 }
    }
  },
  "spring-scale-in": {
    id: "spring-scale-in",
    category: "per-word",
    name: "Spring Scale In (Pop Elastis)",
    target: "per-word",
    enter: {
      durationMs: 360,
      staggerMs: 95,
      easing: [0.34, 1.56, 0.64, 1],
      from: { opacity: 0, x: 0, y: 0, scale: 0.7, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 200,
      staggerMs: 80,
      easing: [0.7, 0, 0.84, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 0, y: 0, scale: 0.8, blur: 0 }
    }
  },
  "blur-out-up": {
    id: "blur-out-up",
    category: "per-word",
    name: "Blur Out Up (Melayang Halus)",
    target: "per-word",
    enter: {
      durationMs: 560,
      staggerMs: 28,
      easing: [0.22, 1, 0.36, 1],
      from: { opacity: 0, x: 0, y: 10, scale: 1, blur: 6 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 480,
      staggerMs: 24,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 0, y: -14, scale: 1, blur: 8 }
    }
  },
  "depth-parallax-words": {
    id: "depth-parallax-words",
    category: "per-word",
    name: "Depth Parallax Words (Kedalaman 3D)",
    target: "per-word",
    enter: {
      durationMs: 700,
      staggerMs: 70,
      easing: [0.22, 1, 0.36, 1],
      from: { opacity: 0, x: 0, y: 18, scale: 0.92, blur: 3 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 500,
      staggerMs: 45,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 0, y: -10, scale: 1.05, blur: 2 }
    }
  },
  "shared-axis-y": {
    id: "shared-axis-y",
    category: "per-word",
    name: "Word Cut Staircase (Muncul Tegas Per Kata)",
    target: "per-word",
    enter: {
      durationMs: 180,
      staggerMs: 78,
      stepped: true,
      easing: [0, 0, 1, 1],
      from: { opacity: 0, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 140,
      staggerMs: 78,
      stepped: true,
      easing: [0, 0, 1, 1],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 0, y: 0, scale: 1, blur: 0 }
    }
  },
  "kinetic-center-build": {
    id: "kinetic-center-build",
    category: "per-word",
    name: "Kinetic Center Build (Geser Kanan ke Tengah)",
    target: "per-word",
    enter: {
      durationMs: 520,
      staggerMs: 48,
      easing: [0.2, 0.8, 0.2, 1],
      from: { opacity: 0, x: 44, y: 6, scale: 0.992, blur: 3.5 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 280,
      staggerMs: 16,
      easing: [0.4, 0, 0.2, 1],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 0, y: -8, scale: 1, blur: 2.5 }
    }
  },
  "short-slide-right": {
    id: "short-slide-right",
    category: "per-word",
    name: "Short Slide Right (Geser Kiri + Kata Bertahap)",
    target: "per-word",
    customRenderer: "shared-slide-opacity-stage",
    enter: {
      durationMs: 520,
      staggerMs: 92,
      easing: [0.2, 0.8, 0.2, 1],
      from: { opacity: 1, x: -24, y: 0, scale: 1, blur: 1.2 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 320,
      staggerMs: 0,
      easing: [0.4, 0, 0.2, 1],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 12, y: 0, scale: 1, blur: 1 }
    }
  },
  "short-slide-down": {
    id: "short-slide-down",
    category: "per-word",
    name: "Short Slide Down (Jatuh Lembut Dari Atas)",
    target: "per-word",
    enter: {
      durationMs: 520,
      staggerMs: 45,
      easing: [0.2, 0.8, 0.2, 1],
      from: { opacity: 0, x: 0, y: -24, scale: 0.992, blur: 2.4 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 320,
      staggerMs: 15,
      easing: [0.4, 0, 0.2, 1],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 0, y: 10, scale: 1, blur: 1.2 }
    }
  },

  // === 4. animate-text: Per-Line ===
  "mask-reveal-up": {
    id: "mask-reveal-up",
    category: "per-line",
    name: "Mask Reveal Up (Per Baris Terbuka ke Atas)",
    target: "per-line",
    maskClip: true,
    enter: {
      durationMs: 760,
      staggerMs: 90,
      easing: [0.22, 1, 0.36, 1],
      from: { opacity: 0, x: 0, y: 30, scale: 1, blur: 6 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 520,
      staggerMs: 70,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 0, y: -22, scale: 1, blur: 6 }
    }
  },
  "line-by-line-slide": {
    id: "line-by-line-slide",
    category: "per-line",
    name: "Line-by-Line Slide (Baris Geser Kiri ke Kanan)",
    target: "per-line",
    enter: {
      durationMs: 900,
      staggerMs: 120,
      easing: [0.22, 1, 0.36, 1],
      from: { opacity: 0, x: -48, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 600,
      staggerMs: 80,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 48, y: 0, scale: 1, blur: 0 }
    }
  },

  // === 5. animate-text: Whole Phrase ===
  "focus-blur-resolve": {
    id: "focus-blur-resolve",
    category: "whole",
    name: "Focus Blur Resolve (Fokus Kamera Sinematik)",
    target: "whole",
    enter: {
      durationMs: 760,
      staggerMs: 0,
      easing: [0.22, 1, 0.36, 1],
      from: { opacity: 0, x: 0, y: 14, scale: 1.01, blur: 14 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 520,
      staggerMs: 0,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 0, y: -10, scale: 1, blur: 10 }
    }
  },
  "shimmer-sweep": {
    id: "shimmer-sweep",
    category: "whole",
    name: "Shimmer Sweep (Sapuan Halus Kiri-Kanan)",
    target: "whole",
    enter: {
      durationMs: 850,
      staggerMs: 0,
      easing: [0.22, 1, 0.36, 1],
      from: { opacity: 0, x: -22, y: 0, scale: 1, blur: 8 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 650,
      staggerMs: 0,
      easing: [0.7, 0, 0.84, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 22, y: 0, scale: 1, blur: 8 }
    }
  },
  "micro-scale-fade": {
    id: "micro-scale-fade",
    category: "whole",
    name: "Micro Scale Fade (Zoom Halus Minimalis)",
    target: "whole",
    enter: {
      durationMs: 600,
      staggerMs: 0,
      easing: [0.32, 0.72, 0, 1],
      from: { opacity: 0, x: 0, y: 0, scale: 0.96, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 400,
      staggerMs: 0,
      easing: [0.7, 0, 0.84, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 0, y: 0, scale: 0.96, blur: 0 }
    }
  },
  "scale-down-fade": {
    id: "scale-down-fade",
    category: "whole",
    name: "Scale Down Fade (Turun Halus Elegan)",
    target: "whole",
    enter: {
      durationMs: 520,
      staggerMs: 0,
      easing: [0.22, 1, 0.36, 1],
      from: { opacity: 0, x: 0, y: 8, scale: 1.04, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 380,
      staggerMs: 0,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 0, y: -8, scale: 0.94, blur: 0 }
    }
  },
  "fade-through": {
    id: "fade-through",
    category: "whole",
    name: "Fade Through (Transisi Material Halus)",
    target: "whole",
    enter: {
      durationMs: 420,
      staggerMs: 0,
      easing: [0.2, 0, 0, 1],
      from: { opacity: 0, x: 0, y: 6, scale: 0.99, blur: 2 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 260,
      staggerMs: 0,
      easing: [0.4, 0, 1, 1],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 0, y: -4, scale: 1, blur: 0 }
    }
  },
  "shared-axis-x": {
    id: "shared-axis-x",
    category: "whole",
    name: "Shared Axis X (Geser Horizontal)",
    target: "whole",
    enter: {
      durationMs: 500,
      staggerMs: 0,
      easing: [0.2, 0, 0, 1],
      from: { opacity: 0, x: 24, y: 0, scale: 0.98, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 360,
      staggerMs: 0,
      easing: [0.4, 0, 1, 1],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: -20, y: 0, scale: 0.98, blur: 0 }
    }
  },
  "shared-axis-z": {
    id: "shared-axis-z",
    category: "whole",
    name: "Shared Axis Z (Zoom Kedalaman)",
    target: "whole",
    enter: {
      durationMs: 520,
      staggerMs: 0,
      easing: [0.2, 0, 0, 1],
      from: { opacity: 0, x: 0, y: 0, scale: 0.9, blur: 2 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 360,
      staggerMs: 0,
      easing: [0.4, 0, 1, 1],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 0, x: 0, y: 0, scale: 1.06, blur: 1 }
    }
  }
};

function appendFxText(parentEl, textStr, effectTarget, fxUnits, lineIdx, baseWordIdx = 0) {
  if (!textStr) {
    parentEl.textContent = "\u00A0";
    return baseWordIdx;
  }

  if (effectTarget === "per-character") {
    const chars = Array.from(textStr);
    for (const ch of chars) {
      const fxSpan = document.createElement("span");
      fxSpan.className = "lyric-fx-unit lyric-fx-char";
      fxSpan.dataset.lineIndex = String(lineIdx);
      fxSpan.dataset.wordIndex = String(baseWordIdx);
      fxSpan.textContent = ch;
      parentEl.appendChild(fxSpan);
      fxUnits.push(fxSpan);
    }
    return baseWordIdx + 1;
  }

  if (effectTarget === "per-word") {
    const fxSpan = document.createElement("span");
    fxSpan.className = "lyric-fx-unit lyric-fx-word";
    fxSpan.dataset.lineIndex = String(lineIdx);
    fxSpan.dataset.wordIndex = String(baseWordIdx);
    fxSpan.textContent = textStr;
    parentEl.appendChild(fxSpan);
    fxUnits.push(fxSpan);
    return baseWordIdx + 1;
  }

  parentEl.textContent = textStr;
  return baseWordIdx + 1;
}

function appendFxLineContent(parentEl, line, effectTarget, fxUnits, lineIdx, wordCounter) {
  if (!line) {
    parentEl.textContent = "\u00A0";
    return wordCounter;
  }

  if (!effectTarget || effectTarget === "whole") {
    parentEl.textContent = line;
    return wordCounter;
  }

  const tokens = line.match(/(\S+|\s+)/g) ?? [];
  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      const space = document.createElement("span");
      space.className = "lyric-space";
      space.textContent = token.replace(/ /g, "\u00A0");
      parentEl.appendChild(space);
      continue;
    }

    if (effectTarget === "per-character") {
      const wordWrap = document.createElement("span");
      wordWrap.className = "lyric-word-wrap";
      parentEl.appendChild(wordWrap);
      wordCounter = appendFxText(wordWrap, token, "per-character", fxUnits, lineIdx, wordCounter);
    } else {
      wordCounter = appendFxText(parentEl, token, "per-word", fxUnits, lineIdx, wordCounter);
    }
  }
  return wordCounter;
}

function appendLineRows(
  parent,
  lines,
  target,
  units,
  maskClip = false,
  effectTarget = "whole",
  fxUnits = [],
  hasLineBg = false
) {
  let wordCounter = 0;

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) {
      const lineBreak = document.createElement("div");
      lineBreak.className = "lyric-line-break";
      parent.appendChild(lineBreak);
    }

    const lineRow = document.createElement("div");
    lineRow.className = "lyric-line-row";

    const pill = document.createElement("span");
    pill.className = hasLineBg ? "lyric-line-pill has-line-bg" : "lyric-line-pill";
    lineRow.appendChild(pill);
    parent.appendChild(lineRow);

    if (target === "per-line") {
      const lineUnit = document.createElement("span");
      lineUnit.className = "lyric-anim-unit lyric-anim-line";
      wordCounter = appendFxLineContent(lineUnit, line, effectTarget, fxUnits, lineIdx, wordCounter);
      if (maskClip) {
        lineRow.style.overflow = "hidden";
      }
      pill.appendChild(lineUnit);
      units.push(pill);
      return;
    }

    if (target === "whole") {
      const span = document.createElement("span");
      span.className = "lyric-anim-unit lyric-anim-whole-line";
      wordCounter = appendFxLineContent(span, line, effectTarget, fxUnits, lineIdx, wordCounter);
      pill.appendChild(span);
      return;
    }

    if (target === "per-word") {
      const words = line.match(/(\S+|\s+)/g) ?? [];
      words.forEach((token) => {
        if (/^\s+$/.test(token)) {
          const space = document.createElement("span");
          space.className = "lyric-space";
          space.textContent = token.replace(/ /g, "\u00A0");
          pill.appendChild(space);
          return;
        }
        const span = document.createElement("span");
        span.className = "lyric-anim-unit lyric-anim-word";
        wordCounter = appendFxText(span, token, effectTarget, fxUnits, lineIdx, wordCounter);
        pill.appendChild(span);
        units.push(span);
      });
    } else {
      // per-character mode
      const words = line.split(" ");
      words.forEach((word, wIdx) => {
        if (wIdx > 0) {
          const space = document.createElement("span");
          space.className = "lyric-space";
          space.innerHTML = "&nbsp;";
          pill.appendChild(space);
        }
        const wordWrap = document.createElement("span");
        wordWrap.className = "lyric-word-wrap";
        pill.appendChild(wordWrap);

        const thisWordIdx = wordCounter++;
        for (const char of Array.from(word)) {
          const charSpan = document.createElement("span");
          charSpan.className = "lyric-anim-unit lyric-anim-char";
          appendFxText(charSpan, char, effectTarget, fxUnits, lineIdx, thisWordIdx);
          wordWrap.appendChild(charSpan);
          units.push(charSpan);
        }
      });
    }
  });
}

export function buildLyricDOM(text, target = "per-word", customClassName = "", options = {}) {
  const container = document.createElement("div");
  container.className = `lyric-phrase-container ${customClassName}`;
  container.setAttribute("aria-label", text);

  const units = [];
  const fxUnits = [];
  const lines = text.split("\n");
  const effectTarget = options.effectTarget || "whole";
  const hasLineBg = Boolean(options.hasLineBg);

  const fxWhole = document.createElement("div");
  fxWhole.className = "lyric-fx-whole";

  if (target === "whole") {
    const wholeUnit = document.createElement("div");
    wholeUnit.className = "lyric-whole-unit";
    container.appendChild(wholeUnit);
    wholeUnit.appendChild(fxWhole);
    appendLineRows(fxWhole, lines, "whole", units, false, effectTarget, fxUnits, hasLineBg);
    units.push(wholeUnit);
    return { container, units, fxWhole, fxUnits, effectTarget, animTarget: target };
  }

  container.appendChild(fxWhole);
  appendLineRows(fxWhole, lines, target, units, Boolean(options.maskClip), effectTarget, fxUnits, hasLineBg);
  return { container, units, fxWhole, fxUnits, effectTarget, animTarget: target };
}

function computeStaggerRanks(count, mode = "normal") {
  const ranks = new Array(count).fill(0);
  if (count <= 1) return ranks;

  if (mode === "center-out") {
    const center = (count - 1) / 2;
    const indices = Array.from({ length: count }, (_, i) => i).sort((a, b) => {
      const diff = Math.abs(a - center) - Math.abs(b - center);
      return diff !== 0 ? diff : a - b;
    });
    indices.forEach((origIdx, rank) => {
      ranks[origIdx] = rank;
    });
    return ranks;
  }

  if (mode === "edges-in") {
    const order = [];
    let left = 0;
    let right = count - 1;
    while (left <= right) {
      order.push(left);
      if (left !== right) order.push(right);
      left++;
      right--;
    }
    order.forEach((origIdx, rank) => {
      ranks[origIdx] = rank;
    });
    return ranks;
  }

  for (let i = 0; i < count; i++) ranks[i] = i;
  return ranks;
}

function formatTransform(frame) {
  const x = frame.x ?? 0;
  const y = frame.y ?? 0;
  const scale = frame.scale ?? 1;
  return `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
}

async function waitAnimationsWithFallback(animations, totalSec) {
  const fallbackMs = Math.ceil(totalSec * 1000) + 35;
  let timer = null;
  let timedOut = false;
  try {
    await Promise.race([
      Promise.all(animations.map((a) => a.finished)).catch(() => {}),
      new Promise((resolve) => {
        timer = setTimeout(() => {
          timedOut = true;
          resolve();
        }, fallbackMs);
      })
    ]);
    if (timedOut) {
      for (const a of animations) {
        try {
          a.finish?.();
        } catch (_) {}
      }
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function runLyricAnimation({
  container = null,
  units,
  phase = "enter", // "enter" | "exit"
  preset = ANIMATION_PRESETS["cinematic-blur"],
  durationSeconds = 1.0,
  onFinished = () => {}
}) {
  if (!units || units.length === 0) {
    onFinished();
    return;
  }

  const spec = phase === "enter" ? preset.enter : preset.exit;
  const clampedSec = Math.max(0.5, Math.min(5.0, Number(durationSeconds) || 1.0));
  const exitRatio =
    preset.enter.durationMs > 0 ? preset.exit.durationMs / preset.enter.durationMs : 0.55;
  const totalSec = phase === "enter" ? clampedSec : Math.max(0.25, clampedSec * exitRatio);

  const from = spec.from || {};
  const to = spec.to || {};

  try {
    // Special layout-aware recipe: shared-slide-opacity-stage (short-slide-right)
    if (preset.customRenderer === "shared-slide-opacity-stage" && container) {
      const ease = cubicBezier(...spec.easing);
      if (phase === "enter") {
        container.style.opacity = String(from.opacity ?? 1);
        container.style.transform = formatTransform(from);
        container.style.filter = from.blur ? `blur(${from.blur}px)` : "none";
        for (const u of units) u.style.opacity = "0";

        const titleAnim = animate(
          container,
          {
            opacity: [from.opacity ?? 1, to.opacity ?? 1],
            transform: [formatTransform(from), formatTransform(to)],
            filter: [
              from.blur ? `blur(${from.blur}px)` : "blur(0px)",
              to.blur ? `blur(${to.blur}px)` : "blur(0px)"
            ]
          },
          { duration: totalSec * 0.72, ease }
        );

        const wordDur = Math.max(0.12, totalSec * 0.45);
        const wordStagger = units.length > 1 ? (totalSec - wordDur) / (units.length - 1) : 0;
        const wordAnims = units.map((u, i) =>
          animate(u, { opacity: [0, 1] }, { duration: wordDur, delay: i * wordStagger, ease })
        );

        await waitAnimationsWithFallback([titleAnim, ...wordAnims], totalSec);
        return;
      }

      // Exit phase: slide whole container out
      const exitAnim = animate(
        container,
        {
          opacity: [from.opacity ?? 1, to.opacity ?? 0],
          transform: [formatTransform(from), formatTransform(to)],
          filter: [
            from.blur ? `blur(${from.blur}px)` : "blur(0px)",
            to.blur ? `blur(${to.blur}px)` : "blur(0px)"
          ]
        },
        { duration: totalSec, ease }
      );
      await waitAnimationsWithFallback([exitAnim], totalSec);
      return;
    }

    const isStepped = Boolean(spec.stepped);
    const ease = isStepped ? "linear" : cubicBezier(...spec.easing);
    const staggerShare = units.length > 1 ? (isStepped ? 0.94 : 0.35) : 0;
    const duration = isStepped
      ? Math.max(0.02, totalSec * (1 - staggerShare))
      : totalSec * (1 - staggerShare);
    const stagger = units.length > 1 ? (totalSec * staggerShare) / (units.length - 1) : 0;
    const ranks = computeStaggerRanks(units.length, preset.staggerMode || "normal");

    const fromOpacity = from.opacity ?? 1;
    const toOpacity = to.opacity ?? 1;
    const fromTransform = formatTransform(from);
    const toTransform = formatTransform(to);
    const fromBlur = from.blur ? `blur(${from.blur}px)` : "blur(0px)";
    const toBlur = to.blur ? `blur(${to.blur}px)` : "blur(0px)";

    // Coordinated fade for line background pills (fill warna kotak) so they don't pop in (cut)
    const pills = container
      ? Array.from(container.querySelectorAll(".lyric-line-pill"))
      : [];
    const pillAnims = [];

    // Filter pills that are not already directly animated as units or wrapped by an animated unit (e.g. per-line / whole)
    const pillsToAnimate = pills.filter((p) => !units.includes(p) && !units.some((u) => u.contains(p)));
    if (pillsToAnimate.length > 0) {
      if (phase === "enter") {
        const pillFadeDuration = Math.min(totalSec * 0.75, 0.45);
        pillsToAnimate.forEach((pill) => {
          pill.style.opacity = "0";
          pillAnims.push(
            animate(
              pill,
              { opacity: [0, 1] },
              { duration: Math.max(0.18, pillFadeDuration), ease: "cubic-bezier(0.25, 0.1, 0.25, 1)" }
            )
          );
        });
      } else {
        pillsToAnimate.forEach((pill) => {
          pillAnims.push(
            animate(
              pill,
              { opacity: [1, 0] },
              { duration: totalSec, ease: "cubic-bezier(0.25, 0.1, 0.25, 1)" }
            )
          );
        });
      }
    }

    const animations = units.map((unit, index) => {
      unit.style.opacity = String(fromOpacity);
      unit.style.transform = fromTransform;
      unit.style.filter = from.blur ? `blur(${from.blur}px)` : "none";

      return animate(
        unit,
        {
          opacity: [fromOpacity, toOpacity],
          transform: [fromTransform, toTransform],
          filter: [fromBlur, toBlur]
        },
        {
          duration,
          delay: ranks[index] * stagger,
          ease
        }
      );
    });

    await waitAnimationsWithFallback([...animations, ...pillAnims], totalSec);
  } finally {
    onFinished();
  }
}
