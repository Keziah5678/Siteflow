"use client";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, className = "btn btn-primary", pendingLabel = "Patientez…", ...rest }: { children: React.ReactNode; className?: string; pendingLabel?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending || rest.disabled} aria-busy={pending} {...rest}>{pending ? pendingLabel : children}</button>;
}

export function ConfirmButton({ children, message, className = "btn btn-danger" }: { children: React.ReactNode; message: string; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending} onClick={e => { if (!confirm(message)) e.preventDefault(); }}>{children}</button>;
}

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => { setDark(document.documentElement.classList.contains("dark")); }, []);
  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("rp-theme", next ? "dark" : "light"); } catch { /* private mode */ }
    setDark(next);
  };
  return (
    <button type="button" onClick={toggle} className="btn btn-ghost btn-sm" aria-label={dark ? "Passer au thème clair" : "Passer au thème sombre"} title="Thème">
      {dark ? "☀︎" : "☾"}
    </button>
  );
}

export function CopyField({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex gap-2">
        <input readOnly value={value} className="input font-mono text-xs" aria-label={label} onFocus={e => e.currentTarget.select()} />
        <button type="button" className="btn btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* no clipboard */ } }}>{done ? "Copié" : "Copier"}</button>
      </div>
    </div>
  );
}

/** Sends a first-party page view (no cookie, no personal data). */
export function PageView({ name = "page_view" }: { name?: string }) {
  useEffect(() => {
    const ref = new URLSearchParams(location.search).get("ref");
    if (ref) { try { localStorage.setItem("rp-ref", ref.slice(0, 20)); } catch { /* ignore */ } }
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, path: location.pathname, ref: ref ?? undefined }), keepalive: true }).catch(() => {});
  }, [name]);
  return null;
}

export function ReferralInput() {
  const [v, setV] = useState("");
  useEffect(() => { try { setV(new URLSearchParams(location.search).get("ref") ?? localStorage.getItem("rp-ref") ?? ""); } catch { /* ignore */ } }, []);
  return <input type="hidden" name="referralCode" value={v} />;
}
