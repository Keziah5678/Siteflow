"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getRepository } from "@/lib/data";

/* ------------------------------------------------------------------ toast */
type Toast = { id: number; kind: "info" | "error" | "success"; text: string };
const ToastCtx = createContext<(text: string, kind?: Toast["kind"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast["kind"] = "info") => {
    const id = Date.now() + Math.random();
    setItems(l => [...l.slice(-3), { id, kind, text }]);
    setTimeout(() => setItems(l => l.filter(t => t.id !== id)), kind === "error" ? 7000 : 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map(t => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

/* ------------------------------------------------------------------ modal */
export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" style={wide ? { width: "min(980px, 100%)" } : undefined}>
        <header><h3 className="display">{title}</h3><button className="btn ghost icon" aria-label="Fermer" onClick={onClose}>✕</button></header>
        <div className="body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}{hint && !error && <small>{hint}</small>}{error && <em className="err">{error}</em>}</label>;
}

export function Spinner() { return <span className="spinner" aria-label="Chargement" />; }

export function Loading({ label = "Chargement" }: { label?: string }) {
  return <div className="loading-screen"><div className="orb" style={{ width: 60, height: 60 }} /><span>{label}</span></div>;
}

export function Empty({ glyph = "✦", title, children }: { glyph?: string; title: string; children?: ReactNode }) {
  return <div className="empty"><div className="glyph">{glyph}</div><h3 className="display">{title}</h3>{children}</div>;
}

export function Brand({ small }: { small?: boolean }) {
  return <span className="brand"><span className="brand-mark" style={small ? { width: 24, height: 24 } : undefined} /><span className="brand-name">ARTHENIS</span></span>;
}

/** Resolves stored image references (idb:, storage:) to something an <img> can show. */
export function useImage(ref: string | null | undefined, fallback: string): string {
  const [src, setSrc] = useState<string>(ref && !ref.startsWith("idb:") && !ref.startsWith("storage:") ? ref : fallback);
  useEffect(() => {
    let alive = true;
    if (!ref) { setSrc(fallback); return; }
    if (!ref.startsWith("idb:") && !ref.startsWith("storage:")) { setSrc(ref); return; }
    getRepository().resolveImage(ref).then(u => { if (alive) setSrc(u || fallback); }).catch(() => alive && setSrc(fallback));
    return () => { alive = false; };
  }, [ref, fallback]);
  return src;
}

export function Img({ src, fallback, alt }: { src: string | null | undefined; fallback: string; alt: string }) {
  const resolved = useImage(src, fallback);
  return <img src={resolved} alt={alt} loading="lazy" onError={e => { (e.target as HTMLImageElement).src = fallback; }} />;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
