"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import { RequireAuth } from "@/components/session";
import { Empty, Img, Loading, errorMessage, useToast } from "@/components/ui";
import { artFor } from "@/components/art";
import { getRepository, type WorldSummary } from "@/lib/data";
import { WORLD_TYPES, defaultConstitution, identityFor } from "@/lib/engine/constitution";
import { ROLE_LABEL } from "@/lib/engine/permissions";
import type { Invitation } from "@/lib/engine/types";

function WorldCard({ w }: { w: WorldSummary }) {
  const router = useRouter();
  const fallback = useMemo(() => artFor(identityFor({ id: w.id, name: w.name, description: w.description, constitution: { ...defaultConstitution(w.worldType) } }), { id: w.id, kind: "world", name: w.name, summary: w.description }), [w]);
  return (
    <article className="card link" onClick={() => router.push(`/worlds/${w.id}`)} data-testid="world-card">
      <div className="world-cover"><Img src={w.coverUrl} fallback={fallback} alt="" /></div>
      <div className="world-card-body">
        <div className="row between"><h3 className="display">{w.name}</h3>{w.role && <span className="badge violet">{ROLE_LABEL[w.role]}</span>}</div>
        <p className="muted small" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{w.description || "Un monde encore silencieux."}</p>
        <div className="row wrap small faint">
          <span className="badge">{WORLD_TYPES.find(t => t.id === w.worldType)?.label}</span>
          <span>{w.entityCount} élément(s)</span>
          <span>· jour {w.tick}</span>
          {w.visibility === "public" && <span className="badge">Public</span>}
        </div>
      </div>
    </article>
  );
}

function Library() {
  const toast = useToast();
  const router = useRouter();
  const [mine, setMine] = useState<WorldSummary[] | null>(null);
  const [pub, setPub] = useState<WorldSummary[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [tab, setTab] = useState<"mine" | "explore">("mine");
  const load = async () => {
    const repo = getRepository();
    try {
      const [m, p, i] = await Promise.all([repo.listWorlds(), repo.listPublicWorlds(), repo.myInvitations()]);
      setMine(m); setPub(p); setInvites(i);
    } catch (e) { toast(errorMessage(e), "error"); setMine([]); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!mine) return <Loading label="Ouverture de la bibliothèque" />;
  return (
    <main className="page">
      <div className="page-head">
        <div><span className="caps muted">Bibliothèque</span><h1>Vos mondes</h1></div>
        <Link className="btn primary lg" href="/worlds/new" data-testid="new-world">✦ Nouvel univers</Link>
      </div>
      {invites.length > 0 && (
        <div className="panel stack" style={{ marginBottom: 18 }}>
          <h3>Invitations</h3>
          {invites.map(inv => (
            <div key={inv.id} className="row between wrap">
              <span>Rejoindre <b>{inv.worldName ?? "un monde"}</b> en tant que {ROLE_LABEL[inv.role]}</span>
              <button className="btn sm primary" onClick={async () => { try { const id = await getRepository().acceptInvitation(inv.id); toast("Vous avez rejoint le monde.", "success"); router.push(`/worlds/${id}`); } catch (e) { toast(errorMessage(e), "error"); } }}>Accepter</button>
            </div>
          ))}
        </div>
      )}
      <div className="chips" style={{ marginBottom: 16 }}>
        <button className={`chip ${tab === "mine" ? "on" : ""}`} onClick={() => setTab("mine")}>Mes mondes ({mine.length})</button>
        <button className={`chip ${tab === "explore" ? "on" : ""}`} onClick={() => setTab("explore")}>Explorer les mondes publics ({pub.length})</button>
      </div>
      {tab === "mine" ? (
        mine.length ? <div className="grid cols-3">{mine.map(w => <WorldCard key={w.id} w={w} />)}</div>
          : <Empty glyph="◍" title="Aucun monde pour l'instant"><p>Tout commence par une page blanche — ou par des lois.</p><Link className="btn primary" href="/worlds/new">Créer mon premier univers</Link></Empty>
      ) : (
        pub.length ? <div className="grid cols-3">{pub.map(w => <WorldCard key={w.id} w={w} />)}</div> : <Empty title="Aucun monde public">Les créateurs peuvent rendre leur monde public depuis ses paramètres.</Empty>
      )}
    </main>
  );
}

export default function WorldsPage() { return <><TopBar /><RequireAuth><Library /></RequireAuth></>; }
