export const DEFAULT_PROPRESENTER_TRANSITION = {
  type: "dissolve",
  name: "Dissolve",
  durationSeconds: 0.5,
  direction: "left",
  source: "default"
};

function getDirectionVector(direction = "left") {
  switch (direction) {
    case "right":
      return { x: "-100%", y: "0%", outX: "100%", outY: "0%", wipeFrom: "inset(0 100% 0 0)" };
    case "up":
      return { x: "0%", y: "100%", outX: "0%", outY: "-100%", wipeFrom: "inset(100% 0 0 0)" };
    case "down":
      return { x: "0%", y: "-100%", outX: "0%", outY: "100%", wipeFrom: "inset(0 0 100% 0)" };
    case "left":
    default:
      return { x: "100%", y: "0%", outX: "-100%", outY: "0%", wipeFrom: "inset(0 0 0 100%)" };
  }
}

export function isCutTransition(transition) {
  if (!transition || transition.type === "cut") return true;
  return Number(transition.durationSeconds ?? 0) <= 0.01;
}

export function buildProTransitionEnterFrames(transition) {
  const type = transition?.type || "dissolve";
  const dir = getDirectionVector(transition?.direction);

  switch (type) {
    case "push":
    case "slide":
      return [
        { opacity: 1, transform: `translate3d(${dir.x}, ${dir.y}, 0)` },
        { opacity: 1, transform: "translate3d(0, 0, 0)" }
      ];
    case "wipe":
      return [
        { opacity: 1, clipPath: dir.wipeFrom },
        { opacity: 1, clipPath: "inset(0 0 0 0)" }
      ];
    case "iris":
      return [
        { opacity: 1, clipPath: "circle(0% at 50% 50%)" },
        { opacity: 1, clipPath: "circle(80% at 50% 50%)" }
      ];
    case "zoom":
      return [
        { opacity: 0, transform: "scale(0.9)" },
        { opacity: 1, transform: "scale(1)" }
      ];
    case "blur":
      return [
        { opacity: 0, filter: "blur(18px)" },
        { opacity: 1, filter: "blur(0px)" }
      ];
    case "fade-color":
      return [
        { opacity: 0, filter: "brightness(1.3)" },
        { opacity: 1, filter: "brightness(1)" }
      ];
    case "dissolve":
    default:
      return [{ opacity: 0 }, { opacity: 1 }];
  }
}

export function buildProTransitionExitFrames(transition, { keepOpaqueUnderlay = false } = {}) {
  const type = transition?.type || "dissolve";
  const dir = getDirectionVector(transition?.direction);

  if (!keepOpaqueUnderlay) {
    switch (type) {
      case "push":
      case "slide":
        return [
          { opacity: 1, transform: "translate3d(0, 0, 0)" },
          { opacity: 0, transform: `translate3d(${dir.outX}, ${dir.outY}, 0)` }
        ];
      case "zoom":
        return [
          { opacity: 1, transform: "scale(1)" },
          { opacity: 0, transform: "scale(1.06)" }
        ];
      case "blur":
        return [
          { opacity: 1, filter: "blur(0px)" },
          { opacity: 0, filter: "blur(18px)" }
        ];
      case "fade-color":
        return [
          { opacity: 1, filter: "brightness(1)" },
          { opacity: 0, filter: "brightness(0.45)" }
        ];
      default:
        return [{ opacity: 1 }, { opacity: 0 }];
    }
  }

  switch (type) {
    case "push":
      return [
        { opacity: 1, transform: "translate3d(0, 0, 0)" },
        { opacity: 1, transform: `translate3d(${dir.outX}, ${dir.outY}, 0)` }
      ];
    case "blur":
      return [
        { opacity: 1, filter: "blur(0px)" },
        { opacity: 0.4, filter: "blur(16px)" }
      ];
    case "fade-color":
      return [
        { opacity: 1, filter: "brightness(1)" },
        { opacity: 0, filter: "brightness(0.45)" }
      ];
    default:
      // Keep outgoing media layer opaque underneath while incoming opaque layer fades/wipes over it
      return [{ opacity: 1 }, { opacity: 1 }];
  }
}

export function runElementTransition(el, frames, durationSeconds, { resetAfter = false } = {}) {
  if (!el) return Promise.resolve();
  const ms = Math.max(16, Math.round((Number(durationSeconds) || 0.5) * 1000));
  const anim = el.animate(frames, {
    duration: ms,
    easing: "cubic-bezier(0.37, 0, 0.63, 1)",
    fill: "forwards"
  });

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (resetAfter) {
        try {
          anim.commitStyles?.();
          anim.cancel();
        } catch (_) {}
        el.style.opacity = "1";
        el.style.transform = "";
        el.style.filter = "";
        el.style.clipPath = "";
      }
      resolve(anim);
    };
    const timer = setTimeout(() => {
      try {
        anim.finish?.();
      } catch (_) {}
      finish();
    }, ms + 35);

    anim.finished
      .then(() => {
        clearTimeout(timer);
        finish();
      })
      .catch(() => {
        clearTimeout(timer);
        finish();
      });
  });
}
