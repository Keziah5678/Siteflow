"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRepository } from "@/lib/data";
import type { AppNotification } from "@/lib/engine/types";
import { useSession } from "./session";
import { Brand } from "./ui";

export default function TopBar({ children }: { children?: React.ReactNode }) {
  const { session, mode } = useSession();
  const router = useRouter();
  const [notes, setNotes] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!session) return;
    let alive = true;
    const load = () => getRepository().listNotifications().then(n => alive && setNotes(n)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [session]);
  const unread = notes.filter(n => !n.readAt).length;
  return (
    <header className="topbar">
      <div className="row">
        <Link href={session ? "/worlds" : "/"} aria-label="Accueil Arthenis"><Brand /></Link>
        {children}
      </div>
      <nav>
        {mode === "local" && <span className="badge warning hide-sm" title="Supabase n'est pas configuré : les données restent dans ce navigateur.">Mode local</span>}
        {session ? (
          <>
            <Link className="btn ghost sm hide-sm" href="/worlds">Mes mondes</Link>
            <div style={{ position: "relative" }}>
              <button className="btn ghost sm" aria-label={`Notifications (${unread} non lues)`} onClick={() => { setOpen(o => !o); if (unread) getRepository().markNotificationsRead().then(() => setNotes(n => n.map(x => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })))); }}>
                🔔{unread > 0 && <span className="badge violet">{unread}</span>}
              </button>
              {open && (
                <div className="panel tight" style={{ position: "absolute", right: 0, top: 46, width: "min(340px, 90vw)", maxHeight: 420, overflow: "auto", zIndex: 50 }}>
                  {notes.length === 0 ? <p className="muted small">Aucune notification.</p> : notes.map(n => (
                    <div key={n.id} className="stack tight" style={{ padding: "8px 4px", borderBottom: "1px solid var(--line)" }}>
                      <b className="small">{n.title}</b><span className="small muted">{n.body}</span>
                      {n.worldId && <Link className="small" href={`/worlds/${n.worldId}`} onClick={() => setOpen(false)}>Ouvrir le monde →</Link>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Link className="btn ghost sm" href="/profile" aria-label="Profil"><span className="brand-mark" style={{ width: 22, height: 22 }} /> <span className="hide-sm">{session.displayName}</span></Link>
          </>
        ) : (
          <>
            <button className="btn ghost sm" onClick={() => router.push("/auth")}>Connexion</button>
            <button className="btn primary sm" onClick={() => router.push("/auth?mode=signup")}>Créer un compte</button>
          </>
        )}
      </nav>
    </header>
  );
}
