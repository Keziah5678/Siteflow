"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className, withLabel = false }: { className?: string; withLabel?: boolean }) {
  const [theme, setTheme] = useState<"dark" | "light" | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the theme applied pre-paint by the root script
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);
  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    if (next === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem("venture-theme", next);
    } catch {}
  }
  const label = theme === "light" ? "Passer en mode sombre" : "Passer en mode clair";
  return (
    <button type="button" onClick={toggle} aria-label={label} title={label} className={cn("inline-flex items-center gap-3 rounded-xl text-muted hover:text-fg", className)}>
      {theme === "light" ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
      {withLabel && <span className="text-sm">{theme === "light" ? "Mode sombre" : "Mode clair"}</span>}
    </button>
  );
}
