"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  icon: Icon,
  children,
  exact = false,
}: {
  href: string;
  icon: LucideIcon;
  children: React.ReactNode;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "focus-ring relative flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-sm transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {active ? (
        <motion.span
          layoutId="nav-active"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
          className="absolute inset-0 rounded-[var(--radius-sm)] bg-surface-raised"
        />
      ) : null}
      <Icon className="relative z-10 h-4 w-4 shrink-0" />
      <span className="relative z-10 truncate">{children}</span>
    </Link>
  );
}
