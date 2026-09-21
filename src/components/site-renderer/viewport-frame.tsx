"use client";

import { motion } from "framer-motion";
import { Monitor, Tablet, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

export type Viewport = "desktop" | "tablet" | "mobile";

const WIDTHS: Record<Viewport, number> = {
  desktop: 1280,
  tablet: 834,
  mobile: 390,
};

export function ViewportSwitcher({ value, onChange }: { value: Viewport; onChange: (v: Viewport) => void }) {
  const options: { value: Viewport; icon: typeof Monitor; label: string }[] = [
    { value: "desktop", icon: Monitor, label: "Ordinateur" },
    { value: "tablet", icon: Tablet, label: "Tablette" },
    { value: "mobile", icon: Smartphone, label: "Mobile" },
  ];
  return (
    <div className="inline-flex items-center gap-0.5 rounded-[var(--radius-md)] border border-border bg-surface p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-label={opt.label}
          aria-pressed={value === opt.value}
          className={cn(
            "focus-ring flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] transition-colors",
            value === opt.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-raised",
          )}
        >
          <opt.icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

export function ViewportFrame({ viewport, children }: { viewport: Viewport; children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full justify-center overflow-auto bg-surface-raised p-6">
      <motion.div
        animate={{ width: WIDTHS[viewport] }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="h-fit max-w-full overflow-hidden rounded-[var(--radius-lg)] border border-border bg-white shadow-[var(--shadow-lg)]"
      >
        {children}
      </motion.div>
    </div>
  );
}
