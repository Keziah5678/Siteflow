// Premium, restrained animation system for Seedflow.
// Every variant respects `animationIntensity` and prefers-reduced-motion —
// see components/motion/MotionProvider.tsx for how intensity is applied.
import type { Transition, Variants } from "framer-motion";
import type { AnimationIntensity } from "@/lib/types";

export const EASE_OUT: Transition["ease"] = [0.16, 1, 0.3, 1];
export const EASE_IN_OUT: Transition["ease"] = [0.65, 0, 0.35, 1];

interface IntensityConfig {
  distance: number;
  duration: number;
  stagger: number;
  scale: number;
}

export const INTENSITY_CONFIG: Record<AnimationIntensity, IntensityConfig> = {
  minimal: { distance: 6, duration: 0.25, stagger: 0.03, scale: 0.99 },
  subtle: { distance: 12, duration: 0.35, stagger: 0.05, scale: 0.98 },
  balanced: { distance: 20, duration: 0.45, stagger: 0.07, scale: 0.96 },
  dynamic: { distance: 32, duration: 0.55, stagger: 0.09, scale: 0.93 },
  immersive: { distance: 48, duration: 0.7, stagger: 0.12, scale: 0.88 },
};

export function fadeUp(intensity: AnimationIntensity = "balanced"): Variants {
  const c = INTENSITY_CONFIG[intensity];
  return {
    hidden: { opacity: 0, y: c.distance },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: c.duration, ease: EASE_OUT },
    },
  };
}

export function fadeIn(intensity: AnimationIntensity = "balanced"): Variants {
  const c = INTENSITY_CONFIG[intensity];
  return {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: c.duration, ease: EASE_OUT } },
  };
}

export function slideIn(
  direction: "left" | "right" = "left",
  intensity: AnimationIntensity = "balanced",
): Variants {
  const c = INTENSITY_CONFIG[intensity];
  const x = direction === "left" ? -c.distance * 1.5 : c.distance * 1.5;
  return {
    hidden: { opacity: 0, x },
    show: { opacity: 1, x: 0, transition: { duration: c.duration, ease: EASE_OUT } },
  };
}

export function scaleReveal(intensity: AnimationIntensity = "balanced"): Variants {
  const c = INTENSITY_CONFIG[intensity];
  return {
    hidden: { opacity: 0, scale: c.scale, y: c.distance * 0.6 },
    show: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: c.duration, ease: EASE_OUT },
    },
  };
}

export function staggerContainer(
  intensity: AnimationIntensity = "balanced",
  delayChildren = 0,
): Variants {
  const c = INTENSITY_CONFIG[intensity];
  return {
    hidden: {},
    show: {
      transition: {
        staggerChildren: c.stagger,
        delayChildren,
      },
    },
  };
}

export const hoverLift = {
  whileHover: { y: -4, transition: { duration: 0.2, ease: EASE_OUT } },
  whileTap: { y: 0, scale: 0.98 },
};

export const hoverScale = {
  whileHover: { scale: 1.02, transition: { duration: 0.2, ease: EASE_OUT } },
  whileTap: { scale: 0.98 },
};

export const buttonTap = {
  whileTap: { scale: 0.97 },
};

export function pageTransition(intensity: AnimationIntensity = "balanced"): Variants {
  const c = INTENSITY_CONFIG[intensity];
  return {
    initial: { opacity: 0, y: c.distance * 0.5 },
    animate: { opacity: 1, y: 0, transition: { duration: c.duration, ease: EASE_OUT } },
    exit: { opacity: 0, y: -c.distance * 0.3, transition: { duration: c.duration * 0.6, ease: EASE_IN_OUT } },
  };
}
