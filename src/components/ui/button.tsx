"use client";

import { forwardRef } from "react";
import Link, { type LinkProps } from "next/link";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { buttonTap } from "@/lib/motion";

export const BUTTON_VARIANTS = {
  primary:
    "bg-primary text-primary-foreground hover:opacity-90 shadow-[var(--shadow-sm)]",
  outline:
    "border border-border-strong bg-transparent text-foreground hover:bg-surface-raised",
  ghost: "bg-transparent text-foreground hover:bg-surface-raised",
  accent: "bg-accent text-accent-foreground hover:opacity-90 shadow-[var(--shadow-sm)]",
  danger: "bg-danger text-white hover:opacity-90",
} as const;

export const BUTTON_SIZES = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
} as const;

export function buttonClasses(
  variant: keyof typeof BUTTON_VARIANTS = "primary",
  size: keyof typeof BUTTON_SIZES = "md",
  className?: string,
) {
  return cn(
    "focus-ring inline-flex items-center justify-center rounded-[var(--radius-md)] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className,
  );
}

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
  loading?: boolean;
  children?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, disabled, children, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      disabled={disabled || loading}
      className={buttonClasses(variant, size, className)}
      {...buttonTap}
      {...rest}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </motion.button>
  );
});

export interface LinkButtonProps extends LinkProps {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
  className?: string;
  children?: React.ReactNode;
}

/** A Link styled as a Button — use for navigational actions instead of nesting <a> in <button>. */
export const LinkButton = forwardRef<HTMLAnchorElement, LinkButtonProps>(function LinkButton(
  { className, variant = "primary", size = "md", children, ...rest },
  ref,
) {
  return (
    <Link ref={ref} className={buttonClasses(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
});
