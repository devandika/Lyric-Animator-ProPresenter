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
