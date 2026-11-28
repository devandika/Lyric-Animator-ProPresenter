import { animate, cubicBezier } from "motion/react";

/**
 * Curated After Effects + Enchanted Media + animate-text Skill Presets (48 total)
 * Categories: 'worship' | 'enchanted' | 'per-character' | 'per-word' | 'per-line' | 'whole'
 */
export const ANIMATION_CATEGORIES = [
  { id: "worship", label: "⭐ Favorit Ibadah" },
  { id: "enchanted", label: "🎞️ Enchanted Media (20 Essential)" },
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
      from: { opacity: 1, x: 0, y: 28, scale: 0.98, blur: 16 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 400,
      staggerMs: 8,
      easing: [0.7, 0, 0.84, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: -20, scale: 0.98, blur: 12 }
    }
  },
  "smooth-fade-slide": {
    id: "smooth-fade-slide",
    category: "worship",
    name: "Smooth Slide Up (Modern Clean)",
    target: "per-word",
    maskClip: true,
    enter: {
      durationMs: 600,
      staggerMs: 24,
      easing: [0.25, 1, 0.5, 1],
      from: { opacity: 1, x: 0, y: "115%", scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: "0%", scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 350,
      staggerMs: 12,
      easing: [0.5, 0, 0.75, 0],
      from: { opacity: 1, x: 0, y: "0%", scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: "-115%", scale: 1, blur: 0 }
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
      from: { opacity: 1, x: 0, y: 20, scale: 0, blur: 6 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 350,
      staggerMs: 12,
      easing: [0.36, 0, 0.66, -0.56],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: -15, scale: 0, blur: 4 }
    }
  },
  "cinematic-fade": {
    id: "cinematic-fade",
    category: "worship",
    name: "Ethereal Dissolve (Pure Elegant Fade)",
    target: "per-word",
    allowOpacityFade: true,
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
      from: { opacity: 1, x: 0, y: 16, scale: 1, blur: 12 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 600,
      staggerMs: 15,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: -16, scale: 1, blur: 12 }
    }
  },
  "per-character-rise": {
    id: "per-character-rise",
    category: "per-character",
    name: "Per-Character Rise (Crisp tvOS)",
    target: "per-character",
    maskClip: true,
    enter: {
      durationMs: 700,
      staggerMs: 24,
      easing: [0.2, 0.8, 0.2, 1],
      from: { opacity: 1, x: 0, y: "115%", scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: "0%", scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 420,
      staggerMs: 14,
      easing: [0.7, 0, 0.84, 0],
      from: { opacity: 1, x: 0, y: "0%", scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: "-115%", scale: 1, blur: 0 }
    }
  },
  "bottom-up-letters": {
    id: "bottom-up-letters",
    category: "per-character",
    name: "Bottom-Up Letters (Tangga Naik)",
    target: "per-character",
    maskClip: true,
    enter: {
      durationMs: 400,
      staggerMs: 88,
      easing: [0.18, 1, 0.32, 1],
      from: { opacity: 1, x: 0, y: "118%", scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: "0%", scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 280,
      staggerMs: 28,
      easing: [0.7, 0, 0.84, 0],
      from: { opacity: 1, x: 0, y: "0%", scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: "-118%", scale: 1, blur: 0 }
    }
  },
  "top-down-letters": {
    id: "top-down-letters",
    category: "per-character",
    name: "Top-Down Letters (Tangga Turun)",
    target: "per-character",
    maskClip: true,
    enter: {
      durationMs: 400,
      staggerMs: 88,
      easing: [0.18, 1, 0.32, 1],
      from: { opacity: 1, x: 0, y: "-118%", scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: "0%", scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 280,
      staggerMs: 28,
      easing: [0.7, 0, 0.84, 0],
      from: { opacity: 1, x: 0, y: "0%", scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: "118%", scale: 1, blur: 0 }
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
      from: { opacity: 1, x: 0, y: 12, scale: 0, blur: 3 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 420,
      staggerMs: 16,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: -8, scale: 0, blur: 3 }
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
      from: { opacity: 1, x: 0, y: 12, scale: 0, blur: 3 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 420,
      staggerMs: 16,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: -8, scale: 0, blur: 3 }
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
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 260,
      staggerMs: 10,
      stepped: true,
      easing: [0, 0, 1, 1],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    }
  },

  // === 3. animate-text: Per-Word ===
  "per-word-crossfade": {
    id: "per-word-crossfade",
    category: "per-word",
    name: "Per-Word Crossfade (Keynote Lembut)",
    target: "per-word",
    allowOpacityFade: true,
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
      from: { opacity: 1, x: 0, y: 0, scale: 0, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 200,
      staggerMs: 80,
      easing: [0.7, 0, 0.84, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 0, blur: 0 }
    }
  },
  "blur-out-up": {
    id: "blur-out-up",
    category: "per-word",
    name: "Blur Out Up (Melayang Halus)",
    target: "per-word",
    maskClip: true,
    enter: {
      durationMs: 560,
      staggerMs: 28,
      easing: [0.22, 1, 0.36, 1],
      from: { opacity: 1, x: 0, y: "115%", scale: 1, blur: 6 },
      to: { opacity: 1, x: 0, y: "0%", scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 480,
      staggerMs: 24,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: "0%", scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: "-115%", scale: 1, blur: 8 }
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
      from: { opacity: 1, x: 0, y: 18, scale: 0, blur: 3 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 500,
      staggerMs: 45,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: -10, scale: 0, blur: 2 }
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
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 140,
      staggerMs: 78,
      stepped: true,
      easing: [0, 0, 1, 1],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
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
      from: { opacity: 1, x: 44, y: 6, scale: 0.992, blur: 3.5 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 280,
      staggerMs: 16,
      easing: [0.4, 0, 0.2, 1],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: -36, y: -8, scale: 1, blur: 2.5 }
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
      from: { opacity: 1, x: -28, y: 0, scale: 1, blur: 1.2 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 320,
      staggerMs: 0,
      easing: [0.4, 0, 0.2, 1],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 32, y: 0, scale: 1, blur: 1 }
    }
  },
  "short-slide-down": {
    id: "short-slide-down",
    category: "per-word",
    name: "Short Slide Down (Jatuh Lembut Dari Atas)",
    target: "per-word",
    maskClip: true,
    enter: {
      durationMs: 520,
      staggerMs: 45,
      easing: [0.2, 0.8, 0.2, 1],
      from: { opacity: 1, x: 0, y: "-115%", scale: 0.992, blur: 2.4 },
      to: { opacity: 1, x: 0, y: "0%", scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 320,
      staggerMs: 15,
      easing: [0.4, 0, 0.2, 1],
      from: { opacity: 1, x: 0, y: "0%", scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: "115%", scale: 1, blur: 1.2 }
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
      from: { opacity: 1, x: 0, y: "115%", scale: 1, blur: 4 },
      to: { opacity: 1, x: 0, y: "0%", scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 520,
      staggerMs: 70,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: "0%", scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: "-115%", scale: 1, blur: 4 }
    }
  },
  "line-by-line-slide": {
    id: "line-by-line-slide",
    category: "per-line",
    name: "Line-by-Line Slide (Baris Geser Kiri ke Kanan)",
    target: "per-line",
    maskClip: "horizontal",
    enter: {
      durationMs: 900,
      staggerMs: 120,
      easing: [0.22, 1, 0.36, 1],
      from: { opacity: 1, x: "-105%", y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: "0%", y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 600,
      staggerMs: 80,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: "0%", y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: "105%", y: 0, scale: 1, blur: 0 }
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
      from: { opacity: 1, x: 0, y: 14, scale: 1.06, blur: 16 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 520,
      staggerMs: 0,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: -10, scale: 0.94, blur: 14 }
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
      from: { opacity: 1, x: -24, y: 0, scale: 1, blur: 6, clipPath: "inset(-12% 100% -12% -12%)" },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0, clipPath: "inset(-12% -12% -12% -12%)" }
    },
    exit: {
      durationMs: 650,
      staggerMs: 0,
      easing: [0.7, 0, 0.84, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0, clipPath: "inset(-12% -12% -12% -12%)" },
      to: { opacity: 1, x: 24, y: 0, scale: 1, blur: 6, clipPath: "inset(-12% -12% -12% 100%)" }
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
      from: { opacity: 1, x: 0, y: 0, scale: 0, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 400,
      staggerMs: 0,
      easing: [0.7, 0, 0.84, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 0, blur: 0 }
    }
  },
  "scale-down-fade": {
    id: "scale-down-fade",
    category: "whole",
    name: "Scale Down Fade (Turun Halus Elegan)",
    target: "whole",
    maskClip: true,
    enter: {
      durationMs: 520,
      staggerMs: 0,
      easing: [0.22, 1, 0.36, 1],
      from: { opacity: 1, x: 0, y: "-110%", scale: 1.12, blur: 0 },
      to: { opacity: 1, x: 0, y: "0%", scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 380,
      staggerMs: 0,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: "0%", scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: "110%", scale: 0.92, blur: 0 }
    }
  },
  "fade-through": {
    id: "fade-through",
    category: "whole",
    name: "Fade Through (Transisi Material Halus)",
    target: "whole",
    allowOpacityFade: true,
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
    maskClip: "horizontal",
    enter: {
      durationMs: 500,
      staggerMs: 0,
      easing: [0.2, 0, 0, 1],
      from: { opacity: 1, x: "105%", y: 0, scale: 0.98, blur: 0 },
      to: { opacity: 1, x: "0%", y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 360,
      staggerMs: 0,
      easing: [0.4, 0, 1, 1],
      from: { opacity: 1, x: "0%", y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: "-105%", y: 0, scale: 0.98, blur: 0 }
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
      from: { opacity: 1, x: 0, y: 0, scale: 0, blur: 2 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 360,
      staggerMs: 0,
      easing: [0.4, 0, 1, 1],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 0, blur: 1 }
    }
  },

  // === 6. Enchanted Media — 20 Essential Text Animations ===
  "enchanted-accordion": {
    id: "enchanted-accordion",
    category: "enchanted",
    name: "Accordion (Spasi Membuka Dari Tengah)",
    target: "per-character",
    staggerMode: "center-out",
    customRenderer: "enchanted-accordion",
    enter: {
      durationMs: 820,
      staggerMs: 18,
      easing: [0.16, 1, 0.3, 1],
      from: { opacity: 1, x: 0, y: 0, scaleX: 0, scaleY: 0.94, blur: 2 },
      to: { opacity: 1, x: 0, y: 0, scaleX: 1, scaleY: 1, blur: 0 }
    },
    exit: {
      durationMs: 460,
      staggerMs: 10,
      easing: [0.7, 0, 0.84, 0],
      from: { opacity: 1, x: 0, y: 0, scaleX: 1, scaleY: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scaleX: 0, scaleY: 0.94, blur: 2 }
    }
  },
  "enchanted-bounce": {
    id: "enchanted-bounce",
    category: "enchanted",
    name: "Bounce (Pantul Elastis Per-Huruf)",
    target: "per-character",
    enter: {
      durationMs: 760,
      staggerMs: 22,
      easing: [0.34, 1.56, 0.64, 1],
      from: { opacity: 1, x: 0, y: -54, scaleX: 0, scaleY: 0, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scaleX: 1, scaleY: 1, blur: 0 }
    },
    exit: {
      durationMs: 400,
      staggerMs: 12,
      easing: [0.36, 0, 0.66, -0.56],
      from: { opacity: 1, x: 0, y: 0, scaleX: 1, scaleY: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: 36, scaleX: 0, scaleY: 0, blur: 0 }
    }
  },
  "enchanted-boxed": {
    id: "enchanted-boxed",
    category: "enchanted",
    name: "Boxed (Kotak Sorot + Pop 3D)",
    target: "per-line",
    customRenderer: "enchanted-boxed",
    enter: {
      durationMs: 780,
      staggerMs: 90,
      easing: [0.22, 1, 0.36, 1],
      from: { opacity: 1, x: 0, y: 0, scale: 0.92, rotateY: 90, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, rotateY: 0, blur: 0 }
    },
    exit: {
      durationMs: 420,
      staggerMs: 60,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, rotateY: 0, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 0.92, rotateY: -90, blur: 0 }
    }
  },
  "enchanted-clock": {
    id: "enchanted-clock",
    category: "enchanted",
    name: "Clock (Sapuan Radial 360°)",
    target: "whole",
    customRenderer: "enchanted-clock",
    enter: {
      durationMs: 850,
      staggerMs: 0,
      easing: [0.22, 1, 0.36, 1],
      from: { opacity: 1, x: 0, y: 0, scale: 0.93, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 480,
      staggerMs: 0,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 0.94, blur: 0 }
    }
  },
  "enchanted-conveyor": {
    id: "enchanted-conveyor",
    category: "enchanted",
    name: "Conveyor (Naik Dari Mask Bawah)",
    target: "per-character",
    maskClip: true,
    enter: {
      durationMs: 740,
      staggerMs: 24,
      easing: [0.22, 1, 0.36, 1],
      from: { opacity: 1, x: 0, y: "118%", scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: "0%", scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 440,
      staggerMs: 14,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: "0%", scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: "-118%", scale: 1, blur: 0 }
    }
  },
  "enchanted-elastic": {
    id: "enchanted-elastic",
    category: "enchanted",
    name: "Elastic (Karet Kenyal Acak)",
    target: "per-character",
    staggerMode: "random",
    enter: {
      durationMs: 820,
      staggerMs: 20,
      easing: [0.34, 1.56, 0.64, 1],
      from: { opacity: 1, x: 26, y: 0, scaleX: 0, scaleY: 1.4, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scaleX: 1, scaleY: 1, blur: 0 }
    },
    exit: {
      durationMs: 420,
      staggerMs: 12,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: 0, scaleX: 1, scaleY: 1, blur: 0 },
      to: { opacity: 1, x: -22, y: 0, scaleX: 0, scaleY: 1.32, blur: 0 }
    }
  },
  "enchanted-expand": {
    id: "enchanted-expand",
    category: "enchanted",
    name: "Expand (Spasi Huruf Melebar)",
    target: "per-character",
    customRenderer: "enchanted-expand",
    enter: {
      durationMs: 820,
      staggerMs: 20,
      easing: [0.16, 1, 0.3, 1],
      from: { opacity: 1, x: 0, y: 0, scaleX: 0, scaleY: 0.9, blur: 2 },
      to: { opacity: 1, x: 0, y: 0, scaleX: 1, scaleY: 1, blur: 0 }
    },
    exit: {
      durationMs: 460,
      staggerMs: 12,
      easing: [0.7, 0, 0.84, 0],
      from: { opacity: 1, x: 0, y: 0, scaleX: 1, scaleY: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scaleX: 0, scaleY: 0.9, blur: 2 }
    }
  },
  "enchanted-flicker": {
    id: "enchanted-flicker",
    category: "enchanted",
    name: "Flicker (Kedip Neon Acak)",
    target: "per-character",
    staggerMode: "random",
    customRenderer: "enchanted-flicker",
    enter: {
      durationMs: 760,
      staggerMs: 22,
      easing: [0.25, 0.1, 0.25, 1],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 440,
      staggerMs: 14,
      easing: [0.25, 0.1, 0.25, 1],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    }
  },
  "enchanted-flooded": {
    id: "enchanted-flooded",
    category: "enchanted",
    name: "Flooded (Isi Naik Seperti Air)",
    target: "per-line",
    customRenderer: "enchanted-flooded",
    enter: {
      durationMs: 840,
      staggerMs: 100,
      easing: [0.22, 1, 0.36, 1],
      from: { opacity: 1, x: 0, y: 12, scale: 0.98, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 460,
      staggerMs: 70,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: -10, scale: 0.98, blur: 0 }
    }
  },
  "enchanted-hangman": {
    id: "enchanted-hangman",
    category: "enchanted",
    name: "Hangman (Acak Huruf Decode)",
    target: "per-character",
    customRenderer: "enchanted-hangman",
    enter: {
      durationMs: 880,
      staggerMs: 24,
      easing: [0.2, 0.8, 0.2, 1],
      from: { opacity: 1, x: 0, y: 6, scale: 0.78, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 420,
      staggerMs: 12,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: -6, scale: 0.82, blur: 0 }
    }
  },
  "enchanted-interlock": {
    id: "enchanted-interlock",
    category: "enchanted",
    name: "Interlock (Ganjil-Genap Menyatu)",
    target: "per-character",
    maskClip: true,
    customRenderer: "enchanted-interlock",
    enter: {
      durationMs: 740,
      staggerMs: 16,
      easing: [0.22, 1, 0.36, 1],
      from: { opacity: 1, x: 0, y: "118%", scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: "0%", scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 420,
      staggerMs: 10,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: "0%", scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: "118%", scale: 1, blur: 0 }
    }
  },
  "enchanted-outline": {
    id: "enchanted-outline",
    category: "enchanted",
    name: "Outline (Garis Bingkai + Putar 3D)",
    target: "per-line",
    customRenderer: "enchanted-outline",
    enter: {
      durationMs: 860,
      staggerMs: 90,
      easing: [0.16, 1, 0.3, 1],
      from: { opacity: 1, x: 0, y: 0, scale: 0.96, rotateY: 90, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, rotateY: 0, blur: 0 }
    },
    exit: {
      durationMs: 460,
      staggerMs: 60,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, rotateY: 0, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 0.96, rotateY: -90, blur: 0 }
    }
  },
  "enchanted-peak-up": {
    id: "enchanted-peak-up",
    category: "enchanted",
    name: "Peak Up (Mengintip Miring Dari Bawah)",
    target: "per-character",
    maskClip: true,
    enter: {
      durationMs: 760,
      staggerMs: 22,
      easing: [0.22, 1, 0.36, 1],
      from: { opacity: 1, x: 0, y: "120%", scale: 1, rotate: 28, origin: "bottom left", blur: 0 },
      to: { opacity: 1, x: 0, y: "0%", scale: 1, rotate: 0, origin: "bottom left", blur: 0 }
    },
    exit: {
      durationMs: 420,
      staggerMs: 14,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: "0%", scale: 1, rotate: 0, origin: "bottom left", blur: 0 },
      to: { opacity: 1, x: 0, y: "120%", scale: 1, rotate: -22, origin: "bottom left", blur: 0 }
    }
  },
  "enchanted-radiate": {
    id: "enchanted-radiate",
    category: "enchanted",
    name: "Radiate (Memancar Dari Tengah)",
    target: "per-character",
    staggerMode: "center-out",
    enter: {
      durationMs: 780,
      staggerMs: 22,
      easing: [0.16, 1, 0.3, 1],
      from: { opacity: 1, x: 0, y: 0, scale: 0, blur: 6 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 440,
      staggerMs: 14,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 0, blur: 6 }
    }
  },
  "enchanted-repeat": {
    id: "enchanted-repeat",
    category: "enchanted",
    name: "Repeat (Bayangan Gema Menyatu)",
    target: "per-line",
    customRenderer: "enchanted-repeat",
    enter: {
      durationMs: 820,
      staggerMs: 90,
      easing: [0.22, 1, 0.36, 1],
      from: { opacity: 1, x: 0, y: 12, scale: 0.94, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 440,
      staggerMs: 60,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: -12, scale: 0.94, blur: 0 }
    }
  },
  "enchanted-rolling": {
    id: "enchanted-rolling",
    category: "enchanted",
    name: "Rolling (Gulung Odometer Atas-Bawah)",
    target: "per-character",
    maskClip: true,
    staggerMode: "random",
    customRenderer: "enchanted-rolling",
    enter: {
      durationMs: 860,
      staggerMs: 24,
      easing: [0.16, 1, 0.3, 1],
      from: { opacity: 1, x: 0, y: "118%", scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: "0%", scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 460,
      staggerMs: 14,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: "0%", scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: "118%", scale: 1, blur: 0 }
    }
  },
  "enchanted-shuffle": {
    id: "enchanted-shuffle",
    category: "enchanted",
    name: "Shuffle (Acak Posisi Rapi)",
    target: "per-character",
    staggerMode: "random",
    customRenderer: "enchanted-shuffle",
    enter: {
      durationMs: 780,
      staggerMs: 18,
      easing: [0.22, 1, 0.36, 1],
      from: { opacity: 1, x: 36, y: 22, scale: 0, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 420,
      staggerMs: 12,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 32, y: 20, scale: 0, blur: 0 }
    }
  },
  "enchanted-sliced": {
    id: "enchanted-sliced",
    category: "enchanted",
    name: "Sliced (Belah Horizontal Menyatu)",
    target: "per-line",
    customRenderer: "enchanted-sliced",
    enter: {
      durationMs: 780,
      staggerMs: 90,
      easing: [0.16, 1, 0.3, 1],
      from: { opacity: 1, x: "105%", y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: "0%", y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 440,
      staggerMs: 60,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: "0%", y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: "105%", y: 0, scale: 1, blur: 0 }
    }
  },
  "enchanted-springy": {
    id: "enchanted-springy",
    category: "enchanted",
    name: "Springy (Gelombang Pegas Ceria)",
    target: "per-character",
    enter: {
      durationMs: 820,
      staggerMs: 22,
      easing: [0.22, 1.48, 0.36, 1],
      from: { opacity: 1, x: 0, y: 46, scale: 0, rotate: -9, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, blur: 0 }
    },
    exit: {
      durationMs: 420,
      staggerMs: 14,
      easing: [0.36, 0, 0.66, -0.56],
      from: { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, blur: 0 },
      to: { opacity: 1, x: 0, y: -32, scale: 0, rotate: 8, blur: 0 }
    }
  },
  "enchanted-uncover": {
    id: "enchanted-uncover",
    category: "enchanted",
    name: "Uncover (Tirai Sapu Kiri ke Kanan)",
    target: "per-line",
    customRenderer: "enchanted-uncover",
    enter: {
      durationMs: 820,
      staggerMs: 100,
      easing: [0.22, 1, 0.36, 1],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    },
    exit: {
      durationMs: 460,
      staggerMs: 70,
      easing: [0.64, 0, 0.78, 0],
      from: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 },
      to: { opacity: 1, x: 0, y: 0, scale: 1, blur: 0 }
    }
  }
};

const SUPERSCRIPT_CHAR_TO_ASCII = {
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

const HAS_SUPERSCRIPT_REGEX = /[⁰¹²³⁴⁵⁶⁷⁸⁹]/;

function appendTextWithSuperscript(parentEl, textStr, hasFollowingText = false) {
  if (!HAS_SUPERSCRIPT_REGEX.test(textStr)) {
    parentEl.textContent = textStr;
    return;
  }
  parentEl.textContent = "";
  const parts = textStr.split(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    if (HAS_SUPERSCRIPT_REGEX.test(part)) {
      const supEl = document.createElement("sup");
      const nextPart = parts.slice(i + 1).join("");
      const followedByNonSpace = nextPart ? !/^\s/.test(nextPart) : hasFollowingText;
      supEl.className = followedByNonSpace ? "lyric-sup lyric-sup-tight" : "lyric-sup";
      supEl.textContent = part.replace(
        /[⁰¹²³⁴⁵⁶⁷⁸⁹]/g,
        (ch) => SUPERSCRIPT_CHAR_TO_ASCII[ch] || ch
      );
      parentEl.appendChild(supEl);
    } else {
      parentEl.appendChild(document.createTextNode(part));
    }
  }
}

function tokenizeCharsPreservingSup(str) {
  if (!HAS_SUPERSCRIPT_REGEX.test(str)) {
    return Array.from(str);
  }
  return str.match(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+|./gu) || [];
}

function appendFxText(parentEl, textStr, effectTarget, fxUnits, lineIdx, baseWordIdx = 0, hasFollowingText = false) {
  if (!textStr) {
    parentEl.textContent = "\u00A0";
    return baseWordIdx;
  }

  if (effectTarget === "per-character") {
    const chars = tokenizeCharsPreservingSup(textStr);
    for (let idx = 0; idx < chars.length; idx++) {
      const ch = chars[idx];
      const fxSpan = document.createElement("span");
      fxSpan.className = "lyric-fx-unit lyric-fx-char";
      fxSpan.dataset.lineIndex = String(lineIdx);
      fxSpan.dataset.wordIndex = String(baseWordIdx);
      appendTextWithSuperscript(fxSpan, ch, idx < chars.length - 1 || hasFollowingText);
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
    appendTextWithSuperscript(fxSpan, textStr, hasFollowingText);
    parentEl.appendChild(fxSpan);
    fxUnits.push(fxSpan);
    return baseWordIdx + 1;
  }

  appendTextWithSuperscript(parentEl, textStr, hasFollowingText);
  return baseWordIdx + 1;
}

function appendFxLineContent(parentEl, line, effectTarget, fxUnits, lineIdx, wordCounter) {
  if (!line) {
    parentEl.textContent = "\u00A0";
    return wordCounter;
  }

  if (!effectTarget || effectTarget === "whole") {
    appendTextWithSuperscript(parentEl, line, false);
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

function getMaskClipCss(maskMode) {
  if (!maskMode) return "";
  return maskMode === "horizontal"
    ? "inset(-16% 0% -16% 0%)"
    : "inset(0% -12% 0% -12%)";
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
  const maskAttr = maskClip === "horizontal" ? "horizontal" : maskClip ? "vertical" : "";

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
      if (maskAttr) {
        lineRow.dataset.maskClip = maskAttr;
        lineRow.style.clipPath = getMaskClipCss(maskAttr);
      }
      pill.appendChild(lineUnit);
      units.push(pill);
      return;
    }

    if (maskAttr && (target === "per-word" || target === "per-character")) {
      lineRow.dataset.maskClip = maskAttr;
      lineRow.style.clipPath = getMaskClipCss(maskAttr);
    }

    if (target === "whole") {
      const span = document.createElement("span");
      span.className = "lyric-anim-unit lyric-anim-whole-line";
      wordCounter = appendFxLineContent(span, line, effectTarget, fxUnits, lineIdx, wordCounter);
      pill.appendChild(span);
      return;
    }

    if (target === "per-word") {
      if (!line) {
        const space = document.createElement("span");
        space.className = "lyric-space";
        space.textContent = "\u00A0";
        pill.appendChild(space);
        return;
      }
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
      if (!line) {
        const space = document.createElement("span");
        space.className = "lyric-space";
        space.textContent = "\u00A0";
        pill.appendChild(space);
        return;
      }
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
        const charTokens = tokenizeCharsPreservingSup(word);
        for (let cIdx = 0; cIdx < charTokens.length; cIdx++) {
          const char = charTokens[cIdx];
          const charSpan = document.createElement("span");
          charSpan.className = "lyric-anim-unit lyric-anim-char";
          appendFxText(
            charSpan,
            char,
            effectTarget,
            fxUnits,
            lineIdx,
            thisWordIdx,
            cIdx < charTokens.length - 1
          );
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
  const maskClip = options.maskClip || false;

  const fxWhole = document.createElement("div");
  fxWhole.className = "lyric-fx-whole";

  if (target === "whole") {
    if (maskClip) {
      const maskAttr = maskClip === "horizontal" ? "horizontal" : "vertical";
      container.dataset.maskClip = maskAttr;
      container.style.clipPath = getMaskClipCss(maskAttr);
    }
    const wholeUnit = document.createElement("div");
    wholeUnit.className = "lyric-whole-unit";
    container.appendChild(wholeUnit);
    wholeUnit.appendChild(fxWhole);
    appendLineRows(fxWhole, lines, "whole", units, false, effectTarget, fxUnits, hasLineBg);
    units.push(wholeUnit);
    return { container, units, fxWhole, fxUnits, effectTarget, animTarget: target };
  }

  container.appendChild(fxWhole);
  appendLineRows(fxWhole, lines, target, units, maskClip, effectTarget, fxUnits, hasLineBg);
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

  if (mode === "reverse") {
    for (let i = 0; i < count; i++) ranks[i] = count - 1 - i;
    return ranks;
  }

  if (mode === "random") {
    const indices = Array.from({ length: count }, (_, i) => i).sort((a, b) => {
      const ha = Math.sin((a + 1) * 91.37 + count * 17.13) * 43758.5453;
      const hb = Math.sin((b + 1) * 91.37 + count * 17.13) * 43758.5453;
      return (ha - Math.floor(ha)) - (hb - Math.floor(hb));
    });
    indices.forEach((origIdx, rank) => {
      ranks[origIdx] = rank;
    });
    return ranks;
  }

  for (let i = 0; i < count; i++) ranks[i] = i;
  return ranks;
}

function formatTransform(frame, peer = {}) {
  const parts = [];
  const hasPersp = Boolean(frame.rotateX || frame.rotateY || peer.rotateX || peer.rotateY);
  if (hasPersp) {
    parts.push("perspective(900px)");
  }
  const x = typeof frame.x === "string" ? frame.x : `${frame.x ?? 0}px`;
  const y = typeof frame.y === "string" ? frame.y : `${frame.y ?? 0}px`;
  parts.push(`translate3d(${x}, ${y}, 0)`);

  const hasScaleXY =
    frame.scaleX !== undefined ||
    frame.scaleY !== undefined ||
    peer.scaleX !== undefined ||
    peer.scaleY !== undefined;
  if (hasScaleXY) {
    const sx = frame.scaleX ?? frame.scale ?? 1;
    const sy = frame.scaleY ?? frame.scale ?? 1;
    parts.push(`scale3d(${sx}, ${sy}, 1)`);
  } else {
    const scale = frame.scale ?? 1;
    parts.push(`scale(${scale})`);
  }

  if (frame.rotate !== undefined || peer.rotate !== undefined) {
    parts.push(`rotate(${frame.rotate ?? 0}deg)`);
  }
  if (frame.rotateX !== undefined || peer.rotateX !== undefined) {
    parts.push(`rotateX(${frame.rotateX ?? 0}deg)`);
  }
  if (frame.rotateY !== undefined || peer.rotateY !== undefined) {
    parts.push(`rotateY(${frame.rotateY ?? 0}deg)`);
  }
  if (frame.skewX !== undefined || peer.skewX !== undefined) {
    parts.push(`skewX(${frame.skewX ?? 0}deg)`);
  }
  if (frame.skewY !== undefined || peer.skewY !== undefined) {
    parts.push(`skewY(${frame.skewY ?? 0}deg)`);
  }
  return parts.join(" ");
}

function buildPillFadeAnims(container, units, phase, totalSec, allowOpacityFade = false) {
  if (!allowOpacityFade) return [];
  const pills = container
    ? Array.from(container.querySelectorAll(".lyric-line-pill"))
    : [];
  const pillAnims = [];
  const pillsToAnimate = pills.filter(
    (p) => !units.includes(p) && !units.some((u) => u.contains(p))
  );
  if (pillsToAnimate.length === 0) return pillAnims;

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
  return pillAnims;
}

function buildHasBgLinePillAnims(units, phase, duration, stagger, allowOpacityFade = false) {
  if (!allowOpacityFade) return [];
  const anims = [];
  units.forEach((pill, index) => {
    if (!pill.classList?.contains("has-line-bg")) return;
    const delay = index * stagger;
    if (phase === "enter") {
      pill.style.opacity = "0";
      anims.push(
        animate(
          pill,
          { opacity: [0, 1] },
          { duration: Math.max(0.18, duration * 0.6), delay, ease: "cubic-bezier(0.25, 0.1, 0.25, 1)" }
        )
      );
    } else {
      anims.push(
        animate(
          pill,
          { opacity: [1, 0] },
          { duration, delay, ease: "cubic-bezier(0.25, 0.1, 0.25, 1)" }
        )
      );
    }
  });
  return anims;
}

function scheduleInstantOpacitySnap(unit, phase, delaySec, durationSec) {
  if (!unit || typeof unit.animate !== "function") return null;
  if (phase === "enter") {
    unit.style.opacity = "0";
    const snap = unit.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      {
        duration: 1,
        delay: Math.max(0, Math.round(delaySec * 1000)),
        easing: "steps(1, end)",
        fill: "forwards"
      }
    );
    snap.finished
      .then(() => {
        unit.style.opacity = "1";
        try {
          snap.cancel();
        } catch (_) {}
      })
      .catch(() => {});
    return snap;
  }

  unit.style.opacity = "1";
  const snapDelayMs = Math.max(0, Math.round((delaySec + durationSec) * 1000) - 1);
  const snap = unit.animate(
    [{ opacity: 1 }, { opacity: 0 }],
    {
      duration: 1,
      delay: snapDelayMs,
      easing: "steps(1, end)",
      fill: "forwards"
    }
  );
  snap.finished
    .then(() => {
      unit.style.opacity = "0";
      try {
        snap.cancel();
      } catch (_) {}
    })
    .catch(() => {});
  return snap;
}

function isGeometricallyHidden(frame) {
  if (!frame) return false;
  if (frame.scale === 0 || frame.scaleX === 0 || frame.scaleY === 0) return true;
  if (Math.abs(Number(frame.rotateY) || 0) >= 88) return true;
  if (Math.abs(Number(frame.rotateX) || 0) >= 88) return true;
  if (typeof frame.clipPath === "string" && frame.clipPath.includes("100%")) return true;
  return false;
}

function formatSignedOffset(rawVal, sign, fallbackPx = 52) {
  if (typeof rawVal === "string") {
    const m = rawVal.trim().match(/^(-?\d+(?:\.\d+)?)(.*)$/);
    if (m) {
      const mag = Math.abs(parseFloat(m[1]));
      const unit = m[2] || "px";
      return `${sign * mag}${unit}`;
    }
  }
  const num = Math.abs(Number(rawVal) || fallbackPx);
  return sign * num;
}

function getBaseMetricsPx(el) {
  if (!el || typeof window === "undefined") return { fontSize: 64, letterSpacing: 0 };
  const cs = window.getComputedStyle(el);
  const fontSize = parseFloat(cs.fontSize) || 64;
  const ls = parseFloat(cs.letterSpacing);
  return { fontSize, letterSpacing: Number.isFinite(ls) ? ls : 0 };
}

function runRafTween(durationSec, easingFn, onProgress, isCancelled = () => false) {
  return new Promise((resolve) => {
    const startMs = performance.now();
    const durMs = Math.max(16, durationSec * 1000);
    const tick = (now) => {
      if (isCancelled()) {
        resolve();
        return;
      }
      const raw = Math.min(1, Math.max(0, (now - startMs) / durMs));
      const eased = easingFn ? easingFn(raw) : raw;
      onProgress(eased, raw);
      if (raw < 1) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
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
  const allowOpacityFade = Boolean(preset.allowOpacityFade);
  const maskTargets = [];
  if (container) {
    if (container.dataset.maskClip) maskTargets.push(container);
    container.querySelectorAll("[data-mask-clip]").forEach((el) => maskTargets.push(el));
  }

  if (preset.maskClip && maskTargets.length > 0) {
    maskTargets.forEach((el) => {
      el.style.clipPath = getMaskClipCss(el.dataset.maskClip);
    });
  }

  try {
    // Special layout-aware recipe: shared-slide-opacity-stage (short-slide-right)
    if (preset.customRenderer === "shared-slide-opacity-stage" && container) {
      const ease = cubicBezier(...spec.easing);
      if (phase === "enter") {
        container.style.opacity = "1";
        container.style.transform = formatTransform(from, to);
        container.style.filter = from.blur ? `blur(${from.blur}px)` : "none";

        const titleAnim = animate(
          container,
          {
            transform: [formatTransform(from, to), formatTransform(to, from)],
            filter: [
              from.blur ? `blur(${from.blur}px)` : "blur(0px)",
              to.blur ? `blur(${to.blur}px)` : "blur(0px)"
            ]
          },
          { duration: totalSec * 0.72, ease }
        );

        const wordDur = Math.max(0.12, totalSec * 0.45);
        const wordStagger = units.length > 1 ? (totalSec - wordDur) / (units.length - 1) : 0;
        const wordAnims = units
          .map((u, i) => scheduleInstantOpacitySnap(u, "enter", i * wordStagger, wordDur))
          .filter(Boolean);

        await waitAnimationsWithFallback([titleAnim, ...wordAnims], totalSec);
        return;
      }

      // Exit phase: crisp horizontal clip slide out without opacity fade
      const exitAnim = animate(
        container,
        {
          clipPath: ["inset(-15% -12% -15% -12%)", "inset(-15% -12% -15% 100%)"],
          transform: [formatTransform(from, to), formatTransform(to, from)],
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

    // === Enchanted Media Custom Renderers ===
    if (
      (preset.customRenderer === "enchanted-accordion" ||
        preset.customRenderer === "enchanted-expand") &&
      container
    ) {
      const ease = cubicBezier(...spec.easing);
      const isAccordion = preset.customRenderer === "enchanted-accordion";
      const staggerShare = units.length > 1 ? 0.34 : 0;
      const duration = totalSec * (1 - staggerShare);
      const stagger = units.length > 1 ? (totalSec * staggerShare) / (units.length - 1) : 0;
      const ranks = computeStaggerRanks(units.length, preset.staggerMode || "normal");
      const pillAnims = buildPillFadeAnims(container, units, phase, totalSec, allowOpacityFade);

      const fromT = formatTransform(from, to);
      const toT = formatTransform(to, from);
      const fromB = from.blur ? `blur(${from.blur}px)` : "blur(0px)";
      const toB = to.blur ? `blur(${to.blur}px)` : "blur(0px)";

      const { fontSize, letterSpacing: baseLs } = getBaseMetricsPx(units[0]);
      const compressedLs = baseLs - fontSize * (isAccordion ? 0.24 : 0.18);
      const startLs = phase === "enter" ? `${compressedLs.toFixed(1)}px` : `${baseLs.toFixed(1)}px`;
      const endLs = phase === "enter" ? `${baseLs.toFixed(1)}px` : `${compressedLs.toFixed(1)}px`;

      const anims = units.map((unit, index) => {
        unit.style.opacity = "1";
        unit.style.transform = fromT;
        unit.style.filter = from.blur ? `blur(${from.blur}px)` : "none";
        return animate(
          unit,
          {
            transform: [fromT, toT],
            filter: [fromB, toB],
            letterSpacing: [startLs, endLs]
          },
          { duration, delay: ranks[index] * stagger, ease }
        );
      });

      if (isAccordion) {
        anims.push(
          animate(
            container,
            {
              transform:
                phase === "enter"
                  ? ["scale(0.92)", "scale(1)"]
                  : ["scale(1)", "scale(0.93)"]
            },
            { duration: totalSec, ease }
          )
        );
      }

      try {
        await waitAnimationsWithFallback([...anims, ...pillAnims], totalSec);
      } finally {
        if (phase === "enter") {
          units.forEach((u) => {
            u.style.letterSpacing = "";
          });
          container.style.transform = "";
        }
      }
      return;
    }

    if (preset.customRenderer === "enchanted-clock" && container) {
      const ease = cubicBezier(...spec.easing);
      const targetEl = units[0] || container;
      const fromT = formatTransform(from, to);
      const toT = formatTransform(to, from);
      const scaleAnim = animate(
        targetEl,
        { transform: [fromT, toT] },
        { duration: totalSec, ease }
      );

      try {
        await Promise.all([
          waitAnimationsWithFallback([scaleAnim], totalSec),
          runRafTween(
            totalSec,
            ease,
            (p) => {
              const deg = Math.max(0, Math.min(360, p * 360));
              const edge = Math.min(360, deg + 2.5);
              const grad =
                phase === "enter"
                  ? `conic-gradient(from 0deg at 50% 50%, #000 0deg, #000 ${deg.toFixed(1)}deg, transparent ${edge.toFixed(1)}deg, transparent 360deg)`
                  : `conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent ${deg.toFixed(1)}deg, #000 ${edge.toFixed(1)}deg, #000 360deg)`;
              container.style.webkitMaskImage = grad;
              container.style.maskImage = grad;
            },
            () => !container.isConnected
          )
        ]);
      } finally {
        if (phase === "enter") {
          container.style.webkitMaskImage = "";
          container.style.maskImage = "";
        } else {
          container.style.opacity = "0";
        }
      }
      return;
    }

    if (preset.customRenderer === "enchanted-flicker") {
      const staggerShare = units.length > 1 ? 0.42 : 0;
      const duration = totalSec * (1 - staggerShare);
      const stagger = units.length > 1 ? (totalSec * staggerShare) / (units.length - 1) : 0;
      const ranks = computeStaggerRanks(units.length, "random");
      const pillAnims = buildPillFadeAnims(container, units, phase, totalSec, allowOpacityFade);

      const animations = units.map((unit, index) => {
        unit.style.opacity = phase === "enter" ? "0" : "1";
        const frames =
          phase === "enter"
            ? [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }, { opacity: 1 }, { opacity: 0 }, { opacity: 1 }]
            : [{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }, { opacity: 0 }];
        const anim = unit.animate(frames, {
          duration: Math.max(60, Math.round(duration * 1000)),
          delay: Math.max(0, Math.round(ranks[index] * stagger * 1000)),
          easing: "steps(1, end)",
          fill: "forwards"
        });
        anim.finished
          .then(() => {
            unit.style.opacity = phase === "enter" ? "1" : "0";
            try {
              anim.cancel();
            } catch (_) {}
          })
          .catch(() => {});
        return anim;
      });

      await waitAnimationsWithFallback([...animations, ...pillAnims], totalSec);
      return;
    }

    if (preset.customRenderer === "enchanted-hangman") {
      const ease = cubicBezier(...spec.easing);
      const staggerShare = units.length > 1 ? 0.45 : 0;
      const duration = totalSec * (1 - staggerShare);
      const stagger = units.length > 1 ? (totalSec * staggerShare) / (units.length - 1) : 0;
      const pillAnims = buildPillFadeAnims(container, units, phase, totalSec, allowOpacityFade);

      const fromT = formatTransform(from, to);
      const toT = formatTransform(to, from);
      const hosts = units.map((u) => {
        const host = u.querySelector(".lyric-fx-unit") || u;
        return { unit: u, host, orig: host.textContent || "" };
      });
      const glyphPool = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

      const anims = [];
      hosts.forEach(({ unit }, index) => {
        const delay = index * stagger;
        unit.style.transform = fromT;
        const snap = scheduleInstantOpacitySnap(unit, phase, delay, duration);
        if (snap) anims.push(snap);
        anims.push(
          animate(
            unit,
            { transform: [fromT, toT] },
            { duration, delay, ease }
          )
        );
      });

      let lastFrameTick = 0;
      const scramblePromise = runRafTween(
        totalSec,
        null,
        (_, raw) => {
          const nowMs = raw * totalSec * 1000;
          if (nowMs - lastFrameTick < 36 && raw < 1) return;
          lastFrameTick = nowMs;

          const step = Math.floor(nowMs / 36);
          hosts.forEach(({ host, orig }, idx) => {
            if (!orig || !/[a-zA-Z0-9]/.test(orig)) return;
            const unitStart = (idx * stagger) / totalSec;
            const unitEnd = Math.min(1, unitStart + (duration / totalSec) * 0.85);

            if (phase === "enter") {
              if (raw >= unitEnd) {
                if (host.textContent !== orig) host.textContent = orig;
              } else if (raw >= unitStart) {
                const pick = glyphPool[(idx * 7 + step * 5) % glyphPool.length];
                host.textContent =
                  orig === orig.toLowerCase() && orig !== orig.toUpperCase()
                    ? pick.toLowerCase()
                    : pick;
              }
            } else {
              if (raw >= unitStart && raw < unitEnd) {
                const pick = glyphPool[(idx * 11 + step * 7) % glyphPool.length];
                host.textContent =
                  orig === orig.toLowerCase() && orig !== orig.toUpperCase()
                    ? pick.toLowerCase()
                    : pick;
              }
            }
          });
        },
        () => Boolean(container && !container.isConnected)
      );

      try {
        await Promise.all([
          waitAnimationsWithFallback([...anims, ...pillAnims], totalSec),
          scramblePromise
        ]);
      } finally {
        hosts.forEach(({ host, orig }) => {
          host.textContent = orig;
        });
      }
      return;
    }

    if (
      preset.customRenderer === "enchanted-interlock" ||
      preset.customRenderer === "enchanted-rolling" ||
      preset.customRenderer === "enchanted-shuffle"
    ) {
      const ease = cubicBezier(...spec.easing);
      const isRolling = preset.customRenderer === "enchanted-rolling";
      const isShuffle = preset.customRenderer === "enchanted-shuffle";
      const staggerShare = units.length > 1 ? (isRolling ? 0.38 : 0.34) : 0;
      const duration = totalSec * (1 - staggerShare);
      const stagger = units.length > 1 ? (totalSec * staggerShare) / (units.length - 1) : 0;
      const ranks = computeStaggerRanks(
        units.length,
        preset.staggerMode || (isRolling || isShuffle ? "random" : "normal")
      );
      const pillAnims = buildPillFadeAnims(container, units, phase, totalSec, allowOpacityFade);

      const rawY = phase === "enter" ? from.y : to.y;
      const baseX = Math.abs(Number(phase === "enter" ? from.x : to.x) || 36);
      const baseYNum = Math.abs(Number(rawY) || 22);
      const fromB = from.blur ? `blur(${from.blur}px)` : "blur(0px)";
      const toB = to.blur ? `blur(${to.blur}px)` : "blur(0px)";

      const animations = units.map((unit, index) => {
        const sign = index % 2 === 0 ? -1 : 1;
        let offsetFrame;
        if (isShuffle) {
          const sx = ((index * 3) % 2 === 0 ? 1 : -1) * (baseX * (0.65 + ((index * 13) % 5) * 0.15));
          const sy = sign * (baseYNum * (0.6 + ((index * 7) % 4) * 0.2));
          const rot = sign * (6 + (index % 3) * 3);
          offsetFrame = {
            ...(phase === "enter" ? from : to),
            x: sx,
            y: sy,
            rotate: rot
          };
        } else {
          offsetFrame = {
            ...(phase === "enter" ? from : to),
            y: formatSignedOffset(rawY, sign, 52)
          };
        }
        const restFrame = phase === "enter" ? to : from;
        const startFrame = phase === "enter" ? offsetFrame : restFrame;
        const endFrame = phase === "enter" ? restFrame : offsetFrame;

        const startT = formatTransform(startFrame, endFrame);
        const endT = formatTransform(endFrame, startFrame);
        unit.style.opacity = "1";
        unit.style.transform = startT;
        unit.style.filter = startFrame.blur ? `blur(${startFrame.blur}px)` : "none";

        return animate(
          unit,
          {
            transform: [startT, endT],
            filter: [fromB, toB]
          },
          { duration, delay: ranks[index] * stagger, ease }
        );
      });

      if (isRolling && container) {
        animations.push(
          animate(
            container,
            {
              transform:
                phase === "enter"
                  ? ["scale(0.94)", "scale(1)"]
                  : ["scale(1)", "scale(0.95)"]
            },
            { duration: totalSec, ease }
          )
        );
      }

      try {
        await waitAnimationsWithFallback([...animations, ...pillAnims], totalSec);
      } finally {
        if (isRolling && container && phase === "enter") {
          container.style.transform = "";
        }
      }
      return;
    }

    if (preset.customRenderer === "enchanted-boxed") {
      const ease = cubicBezier(...spec.easing);
      const staggerShare = units.length > 1 ? 0.3 : 0;
      const duration = totalSec * (1 - staggerShare);
      const stagger = units.length > 1 ? (totalSec * staggerShare) / (units.length - 1) : 0;
      const fromT = formatTransform(from, to);
      const toT = formatTransform(to, from);
      const tempNodes = [];
      const animations = buildHasBgLinePillAnims(units, phase, duration, stagger, allowOpacityFade);

      units.forEach((pill, index) => {
        const lineUnit = pill.querySelector(".lyric-anim-line") || pill;
        pill.style.position = "relative";
        const box = document.createElement("span");
        box.setAttribute("aria-hidden", "true");
        box.style.cssText =
          "position:absolute;inset:-4px -16px;border-radius:6px;pointer-events:none;z-index:0;border:2px solid var(--lyric-color,#ffffff);background:color-mix(in srgb,var(--lyric-color,#ffffff) 22%,transparent);transform-origin:center center;";
        pill.insertBefore(box, pill.firstChild);
        tempNodes.push(box);

        const delay = index * stagger;
        lineUnit.style.position = "relative";
        lineUnit.style.zIndex = "1";
        lineUnit.style.opacity = "1";
        lineUnit.style.transform = fromT;

        animations.push(
          animate(
            lineUnit,
            { transform: [fromT, toT] },
            { duration, delay, ease }
          ),
          animate(
            box,
            phase === "enter"
              ? {
                  transform: ["scaleX(0)", "scaleX(1.03)", "scaleX(0)"]
                }
              : {
                  transform: ["scaleX(1)", "scaleX(0)"]
                },
            { duration: duration * 1.02, delay, ease }
          )
        );
      });

      try {
        await waitAnimationsWithFallback(animations, totalSec);
      } finally {
        tempNodes.forEach((n) => n.remove());
        if (phase === "enter") {
          units.forEach((pill) => {
            const lineUnit = pill.querySelector(".lyric-anim-line") || pill;
            lineUnit.style.zIndex = "";
          });
        }
      }
      return;
    }

    if (preset.customRenderer === "enchanted-outline") {
      const ease = cubicBezier(...spec.easing);
      const staggerShare = units.length > 1 ? 0.28 : 0;
      const duration = totalSec * (1 - staggerShare);
      const stagger = units.length > 1 ? (totalSec * staggerShare) / (units.length - 1) : 0;
      const fromT = formatTransform(from, to);
      const toT = formatTransform(to, from);
      const tempNodes = [];
      const animations = buildHasBgLinePillAnims(units, phase, duration, stagger, allowOpacityFade);

      units.forEach((pill, index) => {
        const lineUnit = pill.querySelector(".lyric-anim-line") || pill;
        pill.style.position = "relative";
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("viewBox", "0 0 100 100");
        svg.setAttribute("preserveAspectRatio", "none");
        svg.style.cssText =
          "position:absolute;inset:-6px -16px;width:calc(100% + 32px);height:calc(100% + 12px);pointer-events:none;overflow:visible;z-index:2;";
        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("x", "1");
        rect.setAttribute("y", "1");
        rect.setAttribute("width", "98");
        rect.setAttribute("height", "98");
        rect.setAttribute("rx", "4");
        rect.setAttribute("fill", "none");
        rect.setAttribute("stroke", "var(--lyric-color, #ffffff)");
        rect.setAttribute("stroke-width", "2.5");
        rect.setAttribute("vector-effect", "non-scaling-stroke");
        rect.setAttribute("pathLength", "100");
        rect.style.strokeDasharray = "100";
        rect.style.strokeDashoffset = phase === "enter" ? "100" : "0";
        svg.appendChild(rect);
        pill.appendChild(svg);
        tempNodes.push(svg);

        const delay = index * stagger;
        const { fontSize, letterSpacing: baseLs } = getBaseMetricsPx(lineUnit);
        const wideLs = baseLs + fontSize * 0.14;
        lineUnit.style.opacity = "1";
        lineUnit.style.transform = fromT;

        animations.push(
          animate(
            lineUnit,
            {
              transform: [fromT, toT],
              letterSpacing:
                phase === "enter"
                  ? [`${wideLs.toFixed(1)}px`, `${baseLs.toFixed(1)}px`]
                  : [`${baseLs.toFixed(1)}px`, `${wideLs.toFixed(1)}px`]
            },
            { duration, delay, ease }
          ),
          animate(
            rect,
            phase === "enter"
              ? { strokeDashoffset: [100, 0, -100] }
              : { strokeDashoffset: [0, 100] },
            { duration: duration * 1.04, delay, ease }
          )
        );
      });

      try {
        await waitAnimationsWithFallback(animations, totalSec);
      } finally {
        tempNodes.forEach((n) => n.remove());
        if (phase === "enter") {
          units.forEach((pill) => {
            const lineUnit = pill.querySelector(".lyric-anim-line") || pill;
            lineUnit.style.letterSpacing = "";
          });
        }
      }
      return;
    }

    if (preset.customRenderer === "enchanted-flooded") {
      const ease = cubicBezier(...spec.easing);
      const staggerShare = units.length > 1 ? 0.3 : 0;
      const duration = totalSec * (1 - staggerShare);
      const stagger = units.length > 1 ? (totalSec * staggerShare) / (units.length - 1) : 0;
      const fromT = formatTransform(from, to);
      const toT = formatTransform(to, from);
      const tempNodes = [];
      const animations = buildHasBgLinePillAnims(units, phase, duration, stagger, allowOpacityFade);

      units.forEach((pill, index) => {
        const lineUnit = pill.querySelector(".lyric-anim-line") || pill;
        pill.style.position = "relative";
        const delay = index * stagger;

        if (phase === "enter") {
          const ghost = lineUnit.cloneNode(true);
          ghost.setAttribute("aria-hidden", "true");
          ghost.style.cssText = `position:absolute;left:${lineUnit.offsetLeft}px;top:${lineUnit.offsetTop}px;width:${lineUnit.offsetWidth}px;height:${lineUnit.offsetHeight}px;pointer-events:none;opacity:0.22;z-index:0;`;
          pill.insertBefore(ghost, pill.firstChild);
          tempNodes.push(ghost);
        }

        lineUnit.style.position = "relative";
        lineUnit.style.zIndex = "1";
        lineUnit.style.opacity = "1";
        lineUnit.style.clipPath =
          phase === "enter" ? "inset(100% -12% 0% -12%)" : "inset(-10% -12% -10% -12%)";
        lineUnit.style.transform = fromT;

        animations.push(
          animate(
            lineUnit,
            {
              clipPath:
                phase === "enter"
                  ? ["inset(100% -12% 0% -12%)", "inset(-10% -12% -10% -12%)"]
                  : ["inset(-10% -12% -10% -12%)", "inset(100% -12% 0% -12%)"],
              transform: [fromT, toT]
            },
            { duration, delay, ease }
          )
        );
      });

      try {
        await waitAnimationsWithFallback(animations, totalSec);
      } finally {
        tempNodes.forEach((n) => n.remove());
        if (phase === "enter") {
          units.forEach((pill) => {
            const lineUnit = pill.querySelector(".lyric-anim-line") || pill;
            lineUnit.style.clipPath = "";
            lineUnit.style.zIndex = "";
          });
        }
      }
      return;
    }

    if (preset.customRenderer === "enchanted-repeat") {
      const ease = cubicBezier(...spec.easing);
      const staggerShare = units.length > 1 ? 0.28 : 0;
      const duration = totalSec * (1 - staggerShare);
      const stagger = units.length > 1 ? (totalSec * staggerShare) / (units.length - 1) : 0;
      const fromT = formatTransform(from, to);
      const toT = formatTransform(to, from);
      const tempNodes = [];
      const animations = buildHasBgLinePillAnims(units, phase, duration, stagger, allowOpacityFade);

      units.forEach((pill, index) => {
        const lineUnit = pill.querySelector(".lyric-anim-line") || pill;
        lineUnit.style.position = "relative";
        const delay = index * stagger;

        [-34, 34].forEach((offsetY) => {
          const echo = document.createElement("span");
          echo.setAttribute("aria-hidden", "true");
          echo.innerHTML = lineUnit.innerHTML;
          echo.style.cssText =
            "position:absolute;inset:0;pointer-events:none;white-space:inherit;visibility:visible;opacity:0.45;";
          lineUnit.appendChild(echo);
          tempNodes.push(echo);

          animations.push(
            animate(
              echo,
              phase === "enter"
                ? {
                    transform: [`translate3d(0, ${offsetY}px, 0) scale(0.94)`, "translate3d(0, 0px, 0) scale(1)"]
                  }
                : {
                    transform: ["translate3d(0, 0px, 0) scale(1)", `translate3d(0, ${offsetY}px, 0) scale(0.94)`]
                  },
              { duration, delay, ease }
            )
          );
        });

        lineUnit.style.opacity = "1";
        lineUnit.style.transform = fromT;
        lineUnit.style.clipPath =
          phase === "enter" ? "inset(100% -12% 0% -12%)" : "inset(-10% -12% -10% -12%)";
        animations.push(
          animate(
            lineUnit,
            {
              clipPath:
                phase === "enter"
                  ? ["inset(100% -12% 0% -12%)", "inset(-10% -12% -10% -12%)"]
                  : ["inset(-10% -12% -10% -12%)", "inset(100% -12% 0% -12%)"],
              transform: [fromT, toT]
            },
            { duration, delay, ease }
          )
        );
      });

      try {
        await waitAnimationsWithFallback(animations, totalSec);
      } finally {
        tempNodes.forEach((n) => n.remove());
        if (phase === "enter") {
          units.forEach((pill) => {
            const lineUnit = pill.querySelector(".lyric-anim-line") || pill;
            lineUnit.style.clipPath = "";
          });
        }
      }
      return;
    }

    if (preset.customRenderer === "enchanted-sliced") {
      const ease = cubicBezier(...spec.easing);
      const staggerShare = units.length > 1 ? 0.28 : 0;
      const duration = totalSec * (1 - staggerShare);
      const stagger = units.length > 1 ? (totalSec * staggerShare) / (units.length - 1) : 0;
      const rawX = phase === "enter" ? from.x : to.x;
      const negShift = formatSignedOffset(rawX, -1, 105);
      const posShift = formatSignedOffset(rawX, 1, 105);
      const negCss = typeof negShift === "string" ? negShift : `${negShift}px`;
      const posCss = typeof posShift === "string" ? posShift : `${posShift}px`;
      const tempNodes = [];
      const hiddenHosts = [];
      const clippedPills = [];
      const animations = buildHasBgLinePillAnims(units, phase, duration, stagger, allowOpacityFade);

      units.forEach((pill, index) => {
        const lineUnit = pill.querySelector(".lyric-anim-line") || pill;
        pill.style.clipPath = "inset(-18% 0% -18% 0%)";
        clippedPills.push(pill);
        lineUnit.style.position = "relative";
        const delay = index * stagger;

        const topHalf = document.createElement("span");
        const bottomHalf = document.createElement("span");
        topHalf.setAttribute("aria-hidden", "true");
        bottomHalf.setAttribute("aria-hidden", "true");
        topHalf.innerHTML = lineUnit.innerHTML;
        bottomHalf.innerHTML = lineUnit.innerHTML;

        topHalf.style.cssText =
          "position:absolute;inset:0;pointer-events:none;white-space:inherit;visibility:visible;opacity:1;clip-path:inset(-18% -18% 50% -18%);";
        bottomHalf.style.cssText =
          "position:absolute;inset:0;pointer-events:none;white-space:inherit;visibility:visible;opacity:1;clip-path:inset(50% -18% -18% -18%);";

        lineUnit.style.visibility = "hidden";
        lineUnit.appendChild(topHalf);
        lineUnit.appendChild(bottomHalf);
        tempNodes.push(topHalf, bottomHalf);
        hiddenHosts.push(lineUnit);

        animations.push(
          animate(
            topHalf,
            phase === "enter"
              ? {
                  transform: [`translate3d(${negCss}, 0, 0)`, "translate3d(0%, 0, 0)"]
                }
              : {
                  transform: ["translate3d(0%, 0, 0)", `translate3d(${negCss}, 0, 0)`]
                },
            { duration, delay, ease }
          ),
          animate(
            bottomHalf,
            phase === "enter"
              ? {
                  transform: [`translate3d(${posCss}, 0, 0)`, "translate3d(0%, 0, 0)"]
                }
              : {
                  transform: ["translate3d(0%, 0, 0)", `translate3d(${posCss}, 0, 0)`]
                },
            { duration, delay, ease }
          )
        );
      });

      try {
        await waitAnimationsWithFallback(animations, totalSec);
      } finally {
        tempNodes.forEach((n) => n.remove());
        clippedPills.forEach((p) => {
          if (phase === "enter") p.style.clipPath = "";
        });
        hiddenHosts.forEach((host) => {
          host.style.visibility = phase === "enter" ? "" : "hidden";
        });
      }
      return;
    }

    if (preset.customRenderer === "enchanted-uncover") {
      const ease = cubicBezier(...spec.easing);
      const staggerShare = units.length > 1 ? 0.3 : 0;
      const duration = totalSec * (1 - staggerShare);
      const stagger = units.length > 1 ? (totalSec * staggerShare) / (units.length - 1) : 0;
      const tempNodes = [];
      const animations = buildHasBgLinePillAnims(units, phase, duration, stagger, allowOpacityFade);

      units.forEach((pill, index) => {
        const lineUnit = pill.querySelector(".lyric-anim-line") || pill;
        pill.style.position = "relative";
        const delay = index * stagger;

        const bar = document.createElement("span");
        bar.setAttribute("aria-hidden", "true");
        bar.style.cssText =
          "position:absolute;top:-4px;bottom:-4px;left:0;width:8px;border-radius:3px;background:var(--lyric-color,#ffffff);box-shadow:0 0 18px var(--lyric-color,#ffffff);pointer-events:none;z-index:2;";
        pill.appendChild(bar);
        tempNodes.push(bar);

        lineUnit.style.opacity = "1";
        lineUnit.style.clipPath =
          phase === "enter" ? "inset(-15% 100% -15% -12%)" : "inset(-15% -12% -15% -12%)";

        animations.push(
          animate(
            lineUnit,
            {
              clipPath:
                phase === "enter"
                  ? ["inset(-15% 100% -15% -12%)", "inset(-15% -12% -15% -12%)"]
                  : ["inset(-15% -12% -15% -12%)", "inset(-15% 100% -15% -12%)"]
            },
            { duration, delay, ease }
          ),
          animate(
            bar,
            phase === "enter"
              ? {
                  left: ["0%", "100%"],
                  scaleY: [0, 1, 1, 0]
                }
              : {
                  left: ["100%", "0%"],
                  scaleY: [0, 1, 1, 0]
                },
            { duration, delay, ease }
          )
        );
      });

      try {
        await waitAnimationsWithFallback(animations, totalSec);
      } finally {
        tempNodes.forEach((n) => n.remove());
        if (phase === "enter") {
          units.forEach((pill) => {
            const lineUnit = pill.querySelector(".lyric-anim-line") || pill;
            lineUnit.style.clipPath = "";
          });
        }
      }
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

    const fromOpacity = allowOpacityFade ? (from.opacity ?? 1) : 1;
    const toOpacity = allowOpacityFade ? (to.opacity ?? 1) : 1;
    const fromTransform = formatTransform(from, to);
    const toTransform = formatTransform(to, from);
    const fromBlur = from.blur ? `blur(${from.blur}px)` : "blur(0px)";
    const toBlur = to.blur ? `blur(${to.blur}px)` : "blur(0px)";
    const hasClipPath = Boolean(from.clipPath || to.clipPath);
    const fromClipPath = from.clipPath || "inset(0% 0% 0% 0%)";
    const toClipPath = to.clipPath || "inset(0% 0% 0% 0%)";

    const hiddenByGeometry =
      Boolean(preset.maskClip) ||
      isGeometricallyHidden(phase === "enter" ? from : to);
    const needsInstantSnap = !allowOpacityFade && !hiddenByGeometry;

    const pillAnims = buildPillFadeAnims(container, units, phase, totalSec, allowOpacityFade);

    const animations = [];
    units.forEach((unit, index) => {
      const delay = ranks[index] * stagger;
      if (from.origin) unit.style.transformOrigin = from.origin;
      unit.style.transform = fromTransform;
      unit.style.filter = from.blur ? `blur(${from.blur}px)` : "none";
      if (hasClipPath) unit.style.clipPath = fromClipPath;

      if (needsInstantSnap) {
        const snap = scheduleInstantOpacitySnap(unit, phase, delay, duration);
        if (snap) animations.push(snap);
      } else {
        unit.style.opacity = String(fromOpacity);
      }

      const keyframes = {
        transform: [fromTransform, toTransform],
        filter: [fromBlur, toBlur]
      };
      if (allowOpacityFade) {
        keyframes.opacity = [fromOpacity, toOpacity];
      }
      if (hasClipPath) {
        keyframes.clipPath = [fromClipPath, toClipPath];
      }

      animations.push(
        animate(unit, keyframes, {
          duration,
          delay,
          ease
        })
      );
    });

    await waitAnimationsWithFallback([...animations, ...pillAnims], totalSec);
  } finally {
    if (phase === "enter" && maskTargets.length > 0) {
      maskTargets.forEach((el) => {
        el.style.clipPath = "";
      });
    }
    onFinished();
  }
}
