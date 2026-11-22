"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { callAi } from "@/lib/ai/client";
import { buildImagePrompt, IMAGE_STYLES, categoryForKind, type ImageStyle } from "@/lib/ai/images";
import { RELATION_LABEL } from "@/lib/engine/brain";
import { formatTick, lawsAsText } from "@/lib/engine/constitution";
import { KIND_ICON, KIND_LABEL } from "@/lib/engine/hierarchy";
import type { Entity, EntityStatus, RelationType, Revision } from "@/lib/engine/types";
import { artFor } from "../art";
import { Field, Img, Modal, Spinner, errorMessage, useToast } from "../ui";
import EntityEditor from "./EntityEditor";
import { useWorld } from "./WorldContext";

const DATA_LABELS: Record<string, string> = {
  age: "Âge", population: "Population", government: "Gouvernement", economy: "Économie", culture: "Culture", techLevel: "Technologie",
  stability: "Stabilité", tier: "Rang", appearance: "Apparence", personality: "Personnalité", origin: "Origine", abilities: "Capacités",
  goals: "Objectifs", inventory: "Inventaire", lifespan: "Espérance de vie", domain: "Domaine", abundance: "Abondance", stock: "Réserve",
  renewable: "Renouvelable", depleted: "Épuisée", objectives: "Objectifs", properties: "Propriétés", script: "Écriture", level: "Niveau",
  territoryRadius: "Territoire", radius: "Étendue", guardianNote: "Justification Guardian", intelligent: "Intelligente"
};
const STATUS_LABEL: Record<EntityStatus, string> = { active: "Actif", dead: "Mort", destroyed: "Détruit", dissolved: "Dissous", completed: "Accomplie", failed: "Échouée", archived: "Archivé" };
const REL_TYPES = Object.keys(RELATION_LABEL) as RelationType[];

function fmtValue(k: string, v: unknown, byId: Map<string, Entity>): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "boolean") return v ? "oui" : "non";
  if (Array.isArray(v)) return v.length ? v.join(", ") : null;
  if (typeof v === "number") return k === "abundance" || k === "stability" ? `${Math.round(v * 100)} %` : k === "population" ? Math.round(v).toLocaleString("fr-FR") : String(v);
  if (typeof v === "string" && /Id$/.test(k)) return byId.get(v)?.name ?? null;
  return typeof v === "string" ? v : null;
}

function RevisionList({ targetId }: { targetId: string }) {
  const { repo, state } = useWorld();
  const [revs, setRevs] = useState<Revision[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { repo.listRevisions(state.world.id, targetId).then(setRevs).catch(() => setRevs([])); }, [repo, state.world.id, targetId, state.entities]);
  if (!revs) return <Spinner />;
  return (
    <div className="stack tight" data-testid="revisions">
      {revs.map(r => {
        const before = (r.before ?? {}) as Record<string, unknown>, after = (r.after ?? {}) as Record<string, unknown>;
        const keys = ["name", "summary", "status", "kind", "parentId", "x", "y", "data", "tensions"].filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
        return (
          <div key={r.id} className="issue">
            <button className="btn ghost sm" style={{ justifyContent: "space-between", width: "100%" }} onClick={() => setOpen(o => (o === r.id ? null : r.id))}>
              <span>v{r.version} · {r.changeType}</span><span className="faint small">{new Date(r.createdAt).toLocaleString("fr-FR")}</span>
            </button>
            {r.reason && <span className="small muted">{r.reason}</span>}
            {open === r.id && <div className="diff">{keys.length ? keys.map(k => <div key={k}><b>{k}</b>{r.before != null && <div className="del">- {JSON.stringify(before[k])}</div>}<div className="add">+ {JSON.stringify(after[k])}</div></div>) : "Version initiale"}</div>}
          </div>
        );
      })}
    </div>
  );
}

export function ImageStudio({ entity, onClose }: { entity: Entity; onClose: () => void }) {
  const { state, identity, repo } = useWorld();
  const toast = useToast();
  const [style, setStyle] = useState<ImageStyle>("Peinture numérique");
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const c = state.world.constitution;
  const built = useMemo(() => {
    const refs = state.entities.filter(e => e.imageUrl && e.id !== entity.id && (e.id === entity.parentId || e.parentId === entity.parentId)).slice(0, 4).map(e => `${KIND_LABEL[e.kind]} ${e.name} : ${e.summary.slice(0, 120)}`);
    const attrs = Object.fromEntries(Object.entries(entity.data).filter(([k, v]) => DATA_LABELS[k] && (typeof v === "string" || typeof v === "number")).map(([k, v]) => [DATA_LABELS[k], v as string | number]));
    return buildImagePrompt(
      { name: state.world.name, theme: `${c.worldType} ${c.era}`, fictionEnabled: c.worldType !== "realiste", fictionalCreaturesEnabled: c.creatures.fictional, magicEnabled: c.magic.allowed, rules: lawsAsText(c).map(l => ({ title: l.title, description: l.text })), visualBible: state.world.visualBible },
      { type: KIND_LABEL[entity.kind], name: entity.name, description: entity.summary, attributes: attrs, seed: entity.id },
      { category: categoryForKind(KIND_LABEL[entity.kind]), style, extra }, refs, identity
    );
  }, [state, entity, style, extra, identity, c]);
  async function generate() {
    setBusy(true);
    const r = await callAi<{ dataUrl?: string; storagePath?: string; model: string }>("image", { worldId: state.world.id, entityId: entity.id, prompt: built.prompt });
    if (!r.ok) { setBusy(false); return toast(r.unavailable ? "Génération d'images non configurée sur ce serveur (OPENAI_API_KEY). L'illustration issue de la bible visuelle reste affichée." : r.error, "error"); }
    try {
      const ref = await repo.saveAsset(state.world.id, entity.id, r.data, built.prompt, r.data.model);
      await repo.saveEntity(state.world.id, { id: entity.id, imageUrl: ref }, { type: "update", reason: "Illustration générée" }, entity.version);
      toast("Illustration enregistrée.", "success");
      onClose();
    } catch (e) { toast(errorMessage(e), "error"); }
    setBusy(false);
  }
  return (
    <Modal title={`Atelier visuel — ${entity.name}`} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Fermer</button><button className="btn primary" onClick={generate} disabled={busy}>{busy ? <Spinner /> : "Générer (1 crédit du quota)"}</button></>}>
      <p className="small muted">Le prompt est construit à partir de la bible visuelle du monde ({identity.era}, {identity.climate}, palette et architecture) et de ses lois, pour un style cohérent d&apos;une image à l&apos;autre.</p>
      <div className="chips">{IMAGE_STYLES.map(s => <button key={s} className={`chip ${s === style ? "on" : ""}`} onClick={() => setStyle(s)}>{s}</button>)}</div>
      <Field label="Précisions"><input value={extra} onChange={e => setExtra(e.target.value)} placeholder="De nuit, sous la neige…" /></Field>
      <details><summary className="small muted">Voir le prompt complet</summary><pre className="diff">{built.prompt}</pre></details>
    </Modal>
  );
}

export default function Dossier({ id, onClose, onFocusMap }: { id: string; onClose: () => void; onFocusMap?: (e: Entity) => void }) {
  const { state, brain, byId, identity, can, repo } = useWorld();
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [image, setImage] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<EntityStatus>("dead");
  const [statusReason, setStatusReason] = useState("");
  const [relType, setRelType] = useState<RelationType>("ally");
  const [relTarget, setRelTarget] = useState("");
  const d = brain.dossier(id);
  if (!d) return null;
  const e = d.entity;
  const c = state.world.constitution;
  const fallback = artFor(identity, e);
  const facts = Object.entries(e.data).map(([k, v]) => [DATA_LABELS[k] ?? null, fmtValue(k, v, byId)] as const).filter(([k, v]) => k && v);

  async function changeStatus() {
    if (!statusReason.trim()) return toast("Indiquez ce qui s'est passé.", "error");
    try {
      await repo.saveEntity(state.world.id, { id: e.id, status: newStatus, endedTick: newStatus === "active" ? null : state.world.tick }, { type: "status", reason: statusReason }, e.version);
      await repo.addEvent(state.world.id, { tick: state.world.tick, title: `${e.name} : ${STATUS_LABEL[newStatus].toLowerCase()}`, description: statusReason, kind: newStatus === "dead" ? "death" : newStatus === "completed" || newStatus === "failed" ? "quest" : newStatus === "active" ? "narrative" : "decline", entityIds: [e.id], consequences: [] });
      await repo.logActivity(state.world.id, "status", "entity", e.id, `${e.name} → ${STATUS_LABEL[newStatus]}`);
      toast("Événement inscrit dans la chronologie.", "success");
      setStatusOpen(false);
    } catch (err) { toast(errorMessage(err), "error"); }
  }
  async function addRelation() {
    if (!relTarget) return;
    try {
      await repo.addRelation(state.world.id, { sourceId: e.id, targetId: relTarget, type: relType, sinceTick: state.world.tick, untilTick: null });
      if (relType === "war" || relType === "ally") await repo.addEvent(state.world.id, { tick: state.world.tick, title: `${e.name} ${RELATION_LABEL[relType]} ${byId.get(relTarget)?.name}`, description: "", kind: relType === "war" ? "war" : "alliance", entityIds: [e.id, relTarget], consequences: [] });
      setRelTarget("");
      toast("Relation établie.", "success");
    } catch (err) { toast(errorMessage(err), "error"); }
  }

  return (
    <>
      <Modal wide title={<span>{KIND_ICON[e.kind]} {e.name}</span>} onClose={onClose} footer={<>
        {onFocusMap && e.x != null && <button className="btn ghost" onClick={() => { onFocusMap(e); onClose(); }}>Voir sur la carte</button>}
        {can("generate_images") && <button className="btn" onClick={() => setImage(true)}>Atelier visuel</button>}
        {can("write") && <button className="btn" onClick={() => setStatusOpen(s => !s)}>Événement / statut</button>}
        {(can("write") || can("propose")) && <button className="btn primary" data-testid="dossier-edit" onClick={() => setEdit(true)}>Modifier</button>}
      </>}>
        <div className="split narrow" data-testid="dossier">
          <div className="stack">
            <div className="dossier-img"><Img src={e.imageUrl} fallback={fallback} alt={e.name} /></div>
            <div className="row wrap">
              <span className="badge violet">{KIND_LABEL[e.kind]}</span>
              <span className={`badge ${e.status === "active" ? "valid" : ""}`}>{STATUS_LABEL[e.status]}</span>
              <span className="badge">v{e.version}</span>
              {e.tensions.length > 0 && <span className="badge warning" title="Contredit la constitution depuis un amendement">En tension avec les lois</span>}
            </div>
            {d.path.length > 1 && <div className="small muted">{d.path.map(p => p.name).join(" › ")}</div>}
            {e.bornTick != null && <div className="small muted">Né(e) : {formatTick(e.bornTick, c)}</div>}
            {e.endedTick != null && <div className="small muted">Fin : {formatTick(e.endedTick, c)}</div>}
          </div>
          <div className="stack">
            <p style={{ whiteSpace: "pre-wrap" }}>{e.summary || <span className="muted">Aucune description.</span>}</p>
            {facts.length > 0 && <dl className="kv">{facts.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>}
            {statusOpen && (
              <div className="panel tight stack">
                <div className="grid cols-2">
                  <Field label="Nouveau statut"><select value={newStatus} onChange={ev => setNewStatus(ev.target.value as EntityStatus)}>{(Object.keys(STATUS_LABEL) as EntityStatus[]).filter(s => s !== e.status).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></Field>
                  <Field label="Ce qui s'est passé"><input value={statusReason} onChange={ev => setStatusReason(ev.target.value)} placeholder="Tombé à la bataille du col" /></Field>
                </div>
                <div><button className="btn sm primary" onClick={changeStatus}>Inscrire dans l&apos;histoire</button></div>
                <span className="small faint">Rien n&apos;est effacé : l&apos;état précédent reste dans les révisions, l&apos;événement rejoint la chronologie.</span>
              </div>
            )}
            {d.children.length > 0 && <div className="stack tight"><span className="caps muted">Contient</span><div className="chips">{d.children.map(ch => <span key={ch.id} className="badge">{KIND_ICON[ch.kind]} {ch.name}</span>)}</div></div>}
            <div className="stack tight">
              <span className="caps muted">Relations</span>
              {d.relations.length === 0 && <span className="small muted">Aucune relation établie.</span>}
              {d.relations.map(r => <div key={r.relation.id} className="row between small"><span style={{ opacity: r.relation.untilTick != null ? 0.55 : 1 }}>{r.text}</span>{can("write") && r.relation.untilTick == null && <button className="btn ghost sm" onClick={() => repo.endRelation(state.world.id, r.relation.id, state.world.tick).catch(err => toast(errorMessage(err), "error"))}>Mettre fin</button>}</div>)}
              {can("write") && (
                <div className="row wrap">
                  <select style={{ width: "auto" }} value={relType} onChange={ev => setRelType(ev.target.value as RelationType)}>{REL_TYPES.map(t => <option key={t} value={t}>{RELATION_LABEL[t]}</option>)}</select>
                  <select style={{ width: "auto", flex: 1 }} value={relTarget} onChange={ev => setRelTarget(ev.target.value)}><option value="">— élément —</option>{state.entities.filter(x => x.id !== e.id && x.status !== "archived").map(x => <option key={x.id} value={x.id}>{KIND_ICON[x.kind]} {x.name}</option>)}</select>
                  <button className="btn sm" onClick={addRelation} disabled={!relTarget}>Lier</button>
                </div>
              )}
            </div>
            <div className="stack tight">
              <span className="caps muted">Chronologie personnelle</span>
              {d.events.length === 0 ? <span className="small muted">Aucun événement.</span> : d.events.map(ev => <div key={ev.id} className="small" style={{ opacity: ev.canon ? 1 : 0.5 }}><b>{formatTick(ev.tick, c)}</b> — {ev.title}{!ev.canon && " (corrigé)"}</div>)}
              <Link className="small" href={`/worlds/${state.world.id}/timeline`}>Toute la chronologie →</Link>
            </div>
            <details><summary className="caps muted" style={{ cursor: "pointer" }}>Versions précédentes</summary><RevisionList targetId={e.id} /></details>
          </div>
        </div>
      </Modal>
      {edit && <EntityEditor entity={e} onClose={() => setEdit(false)} />}
      {image && <ImageStudio entity={e} onClose={() => setImage(false)} />}
    </>
  );
}
