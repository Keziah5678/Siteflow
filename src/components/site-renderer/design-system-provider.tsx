"use client";

import { designSystemToCssVars, googleFontsHref } from "@/lib/design-system-css";
import { MotionProvider } from "@/components/motion/MotionProvider";
import type { DesignSystem } from "@/lib/types";

/**
 * Applies a project's generated design system as scoped CSS custom
 * properties + loads its chosen Google Fonts. Everything under this
 * provider (the live preview, and the published public site) renders with
 * that project's own visual identity — completely independent from the
 * Seedflow dashboard's own theme.
 */
export function DesignSystemProvider({
  designSystem,
  children,
  className,
}: {
  designSystem: DesignSystem;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <MotionProvider intensity={designSystem.animation_intensity}>
      <link rel="stylesheet" href={googleFontsHref(designSystem)} />
      <div
        className={className}
        style={{
          ...designSystemToCssVars(designSystem),
          minHeight: "100%",
        }}
      >
        {children}
      </div>
    </MotionProvider>
  );
}
