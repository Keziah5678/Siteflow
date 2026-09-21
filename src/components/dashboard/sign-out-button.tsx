"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/actions/workspaces";
import { cn } from "@/lib/utils";

export function SignOutButton({ className }: { className?: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => signOut())}
      className={cn(
        "focus-ring inline-flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground disabled:opacity-50",
        className,
      )}
    >
      <LogOut className="h-4 w-4" />
      Déconnexion
    </button>
  );
}
