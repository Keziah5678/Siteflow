import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const nf = new Intl.NumberFormat("fr-FR");
export function formatNumber(n: number): string {
  return nf.format(n);
}

export function formatEuros(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
}

export function formatDate(d: string | Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Intl.DateTimeFormat("fr-FR", opts).format(typeof d === "string" ? new Date(d) : d);
}

export function timeAgo(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.round(h / 24);
  if (days < 30) return `il y a ${days} j`;
  return formatDate(date);
}

export function initials(name: string): string {
  return name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Progress (0–100) derived only from completed steps. */
export function progressFromMilestones(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((Math.min(done, total) / total) * 100);
}

/** Accepts only same-origin relative paths for post-auth redirects. */
export function safeRedirectPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

export function splitTags(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}
