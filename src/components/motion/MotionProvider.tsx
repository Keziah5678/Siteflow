"use client";

import { createContext, useContext, useMemo } from "react";
import { MotionConfig, useReducedMotion } from "framer-motion";
import type { AnimationIntensity } from "@/lib/types";

const IntensityContext = createContext<AnimationIntensity>("balanced");

export function useAnimationIntensity(): AnimationIntensity {
  const reduced = useReducedMotion();
  const intensity = useContext(IntensityContext);
  return reduced ? "minimal" : intensity;
}

export function MotionProvider({
  intensity = "balanced",
  children,
}: {
  intensity?: AnimationIntensity;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const effective = reduced ? "minimal" : intensity;

  const transition = useMemo(
    () => ({ duration: reduced ? 0 : undefined }),
    [reduced],
  );

  return (
    <IntensityContext.Provider value={effective}>
      <MotionConfig reducedMotion="user" transition={transition}>
        {children}
      </MotionConfig>
    </IntensityContext.Provider>
  );
}
