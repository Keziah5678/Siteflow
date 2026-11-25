import Image from "next/image";
import { cn, initials } from "@/lib/utils";

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-border bg-card shadow-card", className)} {...p} />;
}

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "outline";
const tones: Record<Tone, string> = {
  neutral: "bg-bg-2 text-muted border border-border",
  primary: "bg-primary-soft text-primary-2",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  outline: "border border-border text-muted",
};
export function Badge({ tone = "neutral", className, ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium [&_svg]:size-3", tones[tone], className)} {...p} />;
}

export function Avatar({ name, src, size = 40, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.max(11, size * 0.36) };
  if (src) {
    return <Image src={src} alt="" width={size} height={size} unoptimized className={cn("shrink-0 rounded-full object-cover", className)} style={style} />;
  }
  return (
    <span aria-hidden="true" className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary-2", className)} style={style}>
      {initials(name) || "V"}
    </span>
  );
}

export function Progress({ value, label, className }: { value: number; label?: string; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={className}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-label={label}>
        <div className="v-progress-bar h-full rounded-full transition-[width] duration-500" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-12 text-center", className)}>
      {icon && <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary-2 [&_svg]:size-5">{icon}</div>}
      <p className="text-[15px] font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "neutral", title, children, className }: { tone?: "neutral" | "warning" | "success" | "danger" | "primary"; title?: string; children?: React.ReactNode; className?: string }) {
  const t = {
    neutral: "border-border bg-bg-2",
    warning: "border-warning/30 bg-warning-soft",
    success: "border-success/30 bg-success-soft",
    danger: "border-danger/30 bg-danger-soft",
    primary: "border-primary/30 bg-primary-soft",
  }[tone];
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-[13px] leading-relaxed", t, className)} role={tone === "danger" ? "alert" : undefined}>
      {title && <p className="font-medium text-fg">{title}</p>}
      {children && <div className="text-muted">{children}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-bg-2", className)} />;
}

export function SectionTitle({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-subtle">{children}</h2>
      {action}
    </div>
  );
}

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-lg border border-border bg-bg-2 px-2 py-1 text-[12px] text-muted", className)}>{children}</span>;
}
