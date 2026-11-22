import Link from "next/link";
import type { ReactNode } from "react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#2f6bff" /><stop offset="1" stopColor="#6d28d9" /></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#lg)" /><path d="M20 44V20h13a8 8 0 0 1 0 16h-6l11 8" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span className="text-[17px]">Relance<span className="gradient-text">Pro</span></span>
    </span>
  );
}

export function Flash({ ok, error }: { ok?: string | null; error?: string | null }) {
  if (!ok && !error) return null;
  return (
    <div role={error ? "alert" : "status"} data-testid="flash" className={`mb-5 rounded-xl border px-4 py-3 text-sm ${error ? "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200" : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"}`}>
      {error ?? ok}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-2xl font-bold tracking-tight">{title}</h1>{subtitle && <p className="muted mt-1 text-sm">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: string; accent?: boolean }) {
  return (
    <div className="card p-4">
      <div className="muted text-xs font-semibold uppercase tracking-wider">{label}</div>
      <div className={`mt-1.5 text-2xl font-bold tabular-nums ${accent ? "gradient-text" : ""}`}>{value}</div>
      {hint && <div className="muted mt-1 text-xs">{hint}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="gradient-bg flex h-12 w-12 items-center justify-center rounded-2xl text-xl text-white">✦</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {children && <div className="muted max-w-md text-sm">{children}</div>}
      {action}
    </div>
  );
}

/** Dependency-free bar chart (SVG), accessible with a data table fallback. */
export function BarChart({ data, series, label }: { data: Array<Record<string, number | string>>; series: Array<{ key: string; label: string; color: string }>; label: string }) {
  const max = Math.max(1, ...data.flatMap(d => series.map(s => Number(d[s.key]) || 0)));
  const w = 100 / Math.max(1, data.length);
  return (
    <figure>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-44 w-full" role="img" aria-label={label}>
        {[0.25, 0.5, 0.75].map(y => <line key={y} x1="0" x2="100" y1={40 - y * 38} y2={40 - y * 38} stroke="currentColor" strokeOpacity="0.08" strokeWidth="0.2" />)}
        {data.map((d, i) => series.map((s, k) => {
          const v = Number(d[s.key]) || 0;
          const h = (v / max) * 38;
          const bw = (w * 0.7) / series.length;
          return <rect key={`${i}-${s.key}`} x={i * w + w * 0.15 + k * bw} y={40 - h} width={Math.max(0.3, bw - 0.15)} height={h} rx="0.4" fill={s.color}><title>{`${d.day} — ${s.label} : ${v}`}</title></rect>;
        }))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs">
        {series.map(s => <span key={s.key} className="muted inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.label}</span>)}
      </figcaption>
      <table className="sr-only"><caption>{label}</caption><thead><tr><th>Jour</th>{series.map(s => <th key={s.key}>{s.label}</th>)}</tr></thead><tbody>{data.map(d => <tr key={String(d.day)}><td>{d.day}</td>{series.map(s => <td key={s.key}>{d[s.key]}</td>)}</tr>)}</tbody></table>
    </figure>
  );
}

export function Field({ label, name, hint, ...rest }: { label: string; name: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} className="input" {...rest} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function TextArea({ label, name, hint, ...rest }: { label: string; name: string; hint?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <textarea id={name} name={name} className="input min-h-28" {...rest} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function LinkButton({ href, children, variant = "default", size }: { href: string; children: ReactNode; variant?: "default" | "primary" | "ghost"; size?: "sm" | "lg" }) {
  return <Link href={href} className={`btn ${variant === "primary" ? "btn-primary" : variant === "ghost" ? "btn-ghost" : ""} ${size ? `btn-${size}` : ""}`}>{children}</Link>;
}

export const euros = (cents: number | string | null | undefined) =>
  cents == null ? "—" : (Number(cents) / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export const dateFr = (d: Date | string | null | undefined, withTime = false) =>
  d ? new Date(d).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}), timeZone: "Europe/Paris" }) : "—";
