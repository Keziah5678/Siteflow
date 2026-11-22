"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import { RequireAuth, useSession } from "@/components/session";
import { Field, errorMessage, useToast } from "@/components/ui";
import { getRepository } from "@/lib/data";

type Health = { storage: string; ai: { text: string; textModel: string | null; images: boolean; limits: { imagesPerDay: number; textPerDay: number; perMinute: number } } };

function Profile() {
  const { session, refresh, mode } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(session?.displayName ?? "");
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => { fetch("/api/health").then(r => r.json()).then(setHealth).catch(() => {}); }, []);
  return (
    <main className="page" style={{ maxWidth: 760 }}>
      <div className="page-head"><div><span className="caps muted">Profil</span><h1>{session?.displayName}</h1><p className="muted">{session?.email}</p></div></div>
      <div className="grid">
        <form className="panel stack" onSubmit={async e => { e.preventDefault(); try { await getRepository().updateProfile(name); await refresh(); toast("Profil mis à jour.", "success"); } catch (err) { toast(errorMessage(err), "error"); } }}>
          <h3>Identité de créateur</h3>
          <Field label="Nom affiché"><input value={name} onChange={e => setName(e.target.value)} maxLength={60} /></Field>
          <div><button className="btn primary">Enregistrer</button></div>
        </form>
        <div className="panel stack">
          <h3>Configuration de la plateforme</h3>
          {!health ? <p className="muted">Vérification…</p> : (
            <dl className="kv">
              <dt>Stockage</dt><dd>{health.storage === "supabase" ? "Supabase (comptes et mondes synchronisés)" : "Local — ce navigateur uniquement"}</dd>
              <dt>IA texte</dt><dd>{health.ai.text === "none" ? "Non configurée — les moteurs déterministes fonctionnent seuls" : `${health.ai.text} · ${health.ai.textModel}`}</dd>
              <dt>Images IA</dt><dd>{health.ai.images ? `Actives (${health.ai.limits.imagesPerDay}/jour)` : "Non configurées — illustrations générées depuis la bible visuelle"}</dd>
              <dt>Limites</dt><dd>{health.ai.limits.textPerDay} requêtes IA/jour · {health.ai.limits.perMinute}/minute</dd>
            </dl>
          )}
          {mode === "local" && <p className="small muted">Pour passer en mode hébergé : renseigner NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, puis appliquer supabase/migrations.</p>}
        </div>
        <div className="panel row between wrap">
          <span className="muted">Se déconnecter de cet appareil.</span>
          <button className="btn danger" onClick={async () => { await getRepository().signOut(); await refresh(); router.replace("/"); }}>Déconnexion</button>
        </div>
      </div>
    </main>
  );
}

export default function ProfilePage() { return <><TopBar /><RequireAuth><Profile /></RequireAuth></>; }
