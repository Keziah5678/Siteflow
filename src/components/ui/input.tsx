import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "focus-ring flex h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:border-primary",
          className,
        )}
        {...rest}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "focus-ring flex min-h-24 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:border-primary",
        className,
      )}
      {...rest}
    />
  );
});

export const Label = forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  function Label({ className, ...rest }, ref) {
    return (
      <label
        ref={ref}
        className={cn("text-sm font-medium text-foreground", className)}
        {...rest}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "focus-ring flex h-10 w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 text-sm text-foreground transition-colors focus-visible:border-primary",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
    );
  },
);
