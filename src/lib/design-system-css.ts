import type { DesignSystem } from "@/lib/types";

const RADII_SCALE: Record<DesignSystem["radii"], { sm: string; md: string; lg: string; xl: string }> = {
  sharp: { sm: "0.125rem", md: "0.25rem", lg: "0.375rem", xl: "0.5rem" },
  soft: { sm: "0.4rem", md: "0.65rem", lg: "1rem", xl: "1.5rem" },
  round: { sm: "0.75rem", md: "1.25rem", lg: "1.75rem", xl: "2.5rem" },
};

const SHADOW_SCALE: Record<DesignSystem["shadows"], { sm: string; md: string; lg: string }> = {
  none: { sm: "none", md: "none", lg: "none" },
  subtle: {
    sm: "0 1px 2px rgba(15,15,10,0.06)",
    md: "0 4px 16px -4px rgba(15,15,10,0.10)",
    lg: "0 16px 32px -12px rgba(15,15,10,0.14)",
  },
  elevated: {
    sm: "0 2px 6px rgba(15,15,10,0.10)",
    md: "0 10px 30px -6px rgba(15,15,10,0.20)",
    lg: "0 30px 60px -16px rgba(15,15,10,0.28)",
  },
};

const SPACING_SCALE: Record<DesignSystem["spacing_scale"], string> = {
  tight: "0.85",
  regular: "1",
  airy: "1.35",
};

const FONT_SIZE_SCALE: Record<DesignSystem["typography"]["scale"], string> = {
  compact: "0.94",
  comfortable: "1",
  spacious: "1.08",
};

export function designSystemToCssVars(ds: DesignSystem): React.CSSProperties {
  const radii = RADII_SCALE[ds.radii];
  const shadows = SHADOW_SCALE[ds.shadows];

  return {
    "--sf-primary": ds.colors.primary,
    "--sf-secondary": ds.colors.secondary,
    "--sf-accent": ds.colors.accent,
    "--sf-background": ds.colors.background,
    "--sf-surface": ds.colors.surface,
    "--sf-foreground": ds.colors.foreground,
    "--sf-muted": ds.colors.muted,
    "--sf-border": ds.colors.border,
    "--sf-radius-sm": radii.sm,
    "--sf-radius-md": radii.md,
    "--sf-radius-lg": radii.lg,
    "--sf-radius-xl": radii.xl,
    "--sf-shadow-sm": shadows.sm,
    "--sf-shadow-md": shadows.md,
    "--sf-shadow-lg": shadows.lg,
    "--sf-spacing-scale": SPACING_SCALE[ds.spacing_scale],
    "--sf-font-scale": FONT_SIZE_SCALE[ds.typography.scale],
    "--sf-font-heading": `"${ds.typography.heading_font}", serif`,
    "--sf-font-body": `"${ds.typography.body_font}", sans-serif`,
    backgroundColor: ds.colors.background,
    color: ds.colors.foreground,
    fontFamily: `"${ds.typography.body_font}", sans-serif`,
  } as React.CSSProperties;
}

export function googleFontsHref(ds: DesignSystem): string {
  const families = Array.from(new Set([ds.typography.heading_font, ds.typography.body_font]))
    .filter(Boolean)
    .map((f) => `family=${encodeURIComponent(f.trim()).replace(/%20/g, "+")}:wght@400;500;600;700`);
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}
