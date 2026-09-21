"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronsUpDown, Check, Plus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface WorkspaceOption {
  slug: string;
  name: string;
}

export function WorkspaceSwitcher({
  current,
  options,
}: {
  current: WorkspaceOption;
  options: WorkspaceOption[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="focus-ring flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-surface-raised"
      >
        <span className="truncate">{current.name}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface shadow-[var(--shadow-lg)]"
          >
            <div className="max-h-64 overflow-y-auto p-1 scrollbar-thin">
              {options.map((ws) => (
                <Link
                  key={ws.slug}
                  href={`/dashboard/${ws.slug}`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-sm transition-colors hover:bg-surface-raised",
                    ws.slug === current.slug && "font-medium",
                  )}
                >
                  <span className="truncate">{ws.name}</span>
                  {ws.slug === current.slug ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                </Link>
              ))}
            </div>
            <div className="border-t border-border p-1">
              <Link
                href="/dashboard/onboarding"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                Nouvel espace de travail
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
