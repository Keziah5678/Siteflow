"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { callAi } from "@/lib/ai/client";
import { formatTick, lawsAsText, WORLD_TYPES } from "@/lib/engine/constitution";
import { checkDraft } from "@/lib/engine/guardian";
import { KIND_ICON, KIND_LABEL, PLACE_LEVELS, isPlace } from "@/lib/engine/hierarchy";
import type { Entity, EntityKind } from "@/lib/engine/types";
import { artFor } from "../../art";
import { Empty, Field, Img, Spinner } from "../../ui";
import Dossier from "../Dossier";
import EntityEditor from "../EntityEditor";
import GuardianView from "../GuardianView";
import { useWorld } from "../WorldContext";

/* ------------------------------------------------------------- overview */
export function Overview() {
  const { state, brain, now, identity } = useWorld();
  const s = brain.stats();
  const w = state.world;
  const recent = [...state.events].filter(e => e.canon).slice(-6).reverse();
  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div><span className="caps muted">{WORLD_TYPES.find(t => t.id === w.constitution.worldType)?.label} · {w.constitution.era}</span><h1>{w.name}</h1><p className="muted" style={{ maxWidth: 760 }}>{w.description}</p></div>
        <span className="clock">{now}</span>
      </div>
      <div className="grid cols-3">
        {[["Éléments", s.entities], ["Lieux", s.places], ["Personnages", s.characters], ["Civilisations", s.civilizations], ["Créatures", s.creatures], ["Événements", s.events]].map(([k, v]) => <div key={k} className="panel stat"><span className="caps muted">{k}</span><b>{v}</b></div>)}
      </div>
      {s.tensions > 0 && <div className="notice warning">{s.tensions} élément(s) sont en tension avec la constitution depuis un amendement. <Link href={`/worlds/${w.id}/guardian`}>Voir l&apos;audit Guardian →</Link></div>}
      <div className="split">
        <div className="panel stack"><h3>Dernières pages de l&apos;histoire</h3>{recent.length ? recent.map(e => <div key={e.id} className="small"><b>{formatTick(e.tick, w.constitution)}</b> — {e.title}</div>) : <span className="muted small">Rien encore.</span>}<Link className="small" href={`/worlds/${w.id}/timeline`}>Chronologie complète →</Link></div>
        <div className="panel stack"><h3>Bible visuelle</h3>
          <div className="row wrap">{Object.entries(identity.palette).slice(0, 12).map(([k, v]) => <span key={k} title={k} style={{ width: 26, height: 26, borderRadius: 8, background: v, border: "1px solid #ffffff22" }} />)}</div>
          <dl className="kv small"><dt>Architecture</dt><dd>{identity.architecture}</dd><dt>Matériaux</dt><dd>{identity.materials}</dd><dt>Végétation</dt><dd>{identity.vegetation}</dd><dt>Atmosphère</dt><dd>{identity.atmosphere}</dd><dt>Interdits visuels</dt><dd>{identity.forbidden.join(" · ") || "aucun"}</dd></dl>
        </div>
      </div>
      <div className="panel stack"><h3>Constitution</h3>{lawsAsText(w.constitution).map(l => <div key={l.key} className="small"><b>{l.title}</b> — <span className="muted">{l.text}</span></div>)}</div>
    </div>
  );
}

/* ----------------------------------------------------------- entity lists */
export function EntityList({ title, kinds, intro }: { title: string; kinds: EntityKind[]; intro: string }) {
  const { state, identity, can } = useWorld();
  const [filter, setFilter] = useState<EntityKind | "all">("all");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const list = state.entities.filter(e => kinds.includes(e.kind) && e.status !== "archived" && (filter === "all" || e.kind === filter) && (!q || `${e.name} ${e.summary}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => Number(b.status === "active") - Number(a.status === "active") || b.importance - a.importance || a.name.localeCompare(b.name));
  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}><div><span className="caps muted">{intro}</span><h2>{title}</h2></div>{(can("write") || can("propose")) && <button className="btn primary" data-testid="list-create" onClick={() => setCreating(true)}>✦ Créer</button>}</div>
      <div className="row wrap">
        {kinds.length > 1 && <div className="chips"><button className={`chip ${filter === "all" ? "on" : ""}`} onClick={() => setFilter("all")}>Tout</button>{kinds.map(k => <button key={k} className={`chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{KIND_ICON[k]} {KIND_LABEL[k]}</button>)}</div>}
        <input style={{ maxWidth: 260 }} placeholder="Rechercher…" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      {list.length === 0 ? <Empty title="Rien n'a encore été créé ici">{intro}</Empty> : (
        <div className="grid cols-2">
          {list.map(e => (
            <article key={e.id} className={`card link entity-card ${e.status !== "active" ? "ended" : ""}`} onClick={() => setOpen(e.id)} data-testid="entity-card">
              <div className="thumb"><Img src={e.imageUrl} fallback={artFor(identity, e)} alt="" /></div>
              <div className="stack tight">
                <div className="row between"><b>{e.name}</b><span className="badge">{KIND_LABEL[e.kind]}</span></div>
                <span className="small muted" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{e.summary || "—"}</span>
                <div className="row wrap small faint">
                  {typeof e.data.age === "number" && <span>{e.data.age as number} ans</span>}
                  {typeof e.data.population === "number" && <span>{Math.round(e.data.population as number).toLocaleString("fr-FR")} hab.</span>}
                  {e.status !== "active" && <span className="badge">{e.status}</span>}
                  {e.tensions.length > 0 && <span className="badge warning">tension</span>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {creating && <EntityEditor kinds={kinds} kind={filter === "all" ? kinds[0] : filter} onClose={() => setCreating(false)} />}
      {open && <Dossier id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/* --------------------------------------------------------- atlas & lore */
export function Atlas() {
  const { state, byId } = useWorld();
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null | undefined>(undefined);
  const places = state.entities.filter(e => isPlace(e.kind) && e.status !== "archived");
  const children = (id: string | null) => places.filter(p => (p.parentId ?? null) === id || (id === null && p.parentId && !byId.has(p.parentId))).sort((a, b) => PLACE_LEVELS.indexOf(a.kind as never) - PLACE_LEVELS.indexOf(b.kind as never) || a.name.localeCompare(b.name));
  const Node = ({ e, depth }: { e: Entity; depth: number }) => (
    <>
      <div className="row" style={{ paddingLeft: depth * 18 }}>
        <button className="tree-node" onClick={() => setOpen(e.id)}><span>{KIND_ICON[e.kind]}</span><span className="grow">{e.name}</span><span className="faint small">{KIND_LABEL[e.kind]}</span></button>
        <button className="btn ghost sm" title="Créer à l'intérieur" onClick={() => setCreating(e.id)}>＋</button>
      </div>
      {children(e.id).map(c => <Node key={c.id} e={c} depth={depth + 1} />)}
    </>
  );
  const roots = children(null);
  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}><div><span className="caps muted">Univers → Galaxies → Systèmes → Planètes → Continents → Pays → Régions → Villes → Villages → Lieux</span><h2>Atlas & hiérarchie</h2></div><button className="btn primary" onClick={() => setCreating(null)}>✦ Nouveau lieu</button></div>
      <p className="muted small">Chaque monde n&apos;utilise que les échelles dont il a besoin. Un lieu doit simplement se trouver sous un lieu d&apos;échelle supérieure.</p>
      <div className="panel tree">{roots.length ? roots.map(r => <Node key={r.id} e={r} depth={0} />) : <Empty title="Aucun lieu">Commencez par un continent sur la carte, ou par un univers et ses galaxies.</Empty>}</div>
      {creating !== undefined && <EntityEditor kinds={PLACE_LEVELS} kind={creating ? (PLACE_LEVELS[Math.min(PLACE_LEVELS.length - 1, PLACE_LEVELS.indexOf(byId.get(creating)!.kind as never) + 1)]) : "continent"} parentId={creating} onClose={() => setCreating(undefined)} />}
      {open && <Dossier id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------- brain */
type Msg = { role: "user" | "assistant"; text: string; facts?: string[] };
export function Brain() {
  const { state, brain } = useWorld();
  const [q, setQ] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [a, setA] = useState(""); const [b, setB] = useState("");
  const pathSteps = a && b ? brain.path(a, b) : null;
  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const question = q.trim();
    if (!question) return;
    setQ("");
    const local = brain.ask(question);
    setMsgs(m => [...m, { role: "user", text: question }]);
    setBusy(true);
    const r = await callAi<{ answer: string }>("brain", { worldId: state.world.id, context: brain.contextFor(question).slice(0, 23000), question, history: msgs.slice(-6).map(m => ({ role: m.role, text: m.text.slice(0, 2900) })) });
    setBusy(false);
    setMsgs(m => [...m, { role: "assistant", text: r.ok ? r.data.answer : local.answer, facts: local.facts.slice(0, 6).map(f => f.text) }]);
  }
  return (
    <div className="stack">
      <div><span className="caps muted">Mémoire du monde</span><h2>World Brain</h2><p className="muted small">Le Brain lit les données structurées du monde (lois, entités, relations, chronologie). L&apos;IA, si elle est configurée, ne fait que formuler une réponse à partir des faits qu&apos;il retrouve.</p></div>
      <div className="split">
        <div className="panel stack">
          <div className="chat" data-testid="brain-chat">
            {msgs.length === 0 && <div className="muted small">Essayez : « Qui gouverne ? », « La magie est-elle autorisée ? », « Que s&apos;est-il passé à … ? »</div>}
            {msgs.map((m, i) => <div key={i} className={`bubble ${m.role === "user" ? "user" : "brain"}`}>{m.text}{m.facts && m.facts.length > 0 && <details className="small muted" style={{ marginTop: 8 }}><summary>Faits consultés</summary>{m.facts.map(f => <div key={f}>• {f}</div>)}</details>}</div>)}
            {busy && <div className="bubble brain"><Spinner /></div>}
          </div>
          <form className="row" onSubmit={ask}><input data-testid="brain-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Interroger la mémoire du monde…" /><button className="btn primary" disabled={busy}>Demander</button></form>
        </div>
        <div className="panel stack">
          <h3>Expliquer une relation</h3>
          <Field label="De"><select value={a} onChange={e => setA(e.target.value)}><option value="">—</option>{state.entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
          <Field label="À"><select value={b} onChange={e => setB(e.target.value)}><option value="">—</option>{state.entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
          {a && b && (pathSteps ? (pathSteps.length ? <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>{pathSteps.map(s => <li key={s}>{s}</li>)}</ol> : <span className="small muted">Même élément.</span>) : <span className="small muted">Aucun lien établi entre eux (à 5 degrés).</span>)}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- guardian */
export function GuardianSection() {
  const { state } = useWorld();
  const c = state.world.constitution;
  const [kind, setKind] = useState<EntityKind>("character");
  const [text, setText] = useState("");
  const audit = useMemo(() => state.entities.filter(e => e.status !== "archived").map(e => ({ e, r: checkDraft({ kind: e.kind, name: e.name, summary: e.summary, data: e.data, parentId: e.parentId }, { constitution: c, entities: state.entities, events: state.events, tick: state.world.tick }, { selfId: e.id }) })).filter(x => x.r.verdict !== "VALID" || x.e.tensions.length), [state, c]);
  const test = text.trim() ? checkDraft({ kind, name: text.split(/[,.]/)[0].slice(0, 60), summary: text }, { constitution: c, entities: state.entities, events: state.events, tick: state.world.tick }) : null;
  return (
    <div className="stack">
      <div><span className="caps muted">Moteur de cohérence</span><h2>Guardian AI</h2><p className="muted small">Toute création passe par Guardian avant d&apos;entrer dans le canon. VALID : compatible. WARNING : possible, à expliquer. CONFLICT : contradiction avec une loi ou un fait établi.</p></div>
      <div className="split">
        <div className="panel stack">
          <h3>Tester une idée</h3>
          <Field label="Type"><select value={kind} onChange={e => setKind(e.target.value as EntityKind)}>{(["character", "npc", "creature", "animal", "deity", "city", "item", "technology", "civilization"] as EntityKind[]).map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></Field>
          <Field label="Description"><textarea data-testid="guardian-test" value={text} onChange={e => setText(e.target.value)} placeholder="Un sorcier qui commande aux dragons…" /></Field>
          {test && <GuardianView report={test} />}
        </div>
        <div className="panel stack">
          <h3>Audit du canon</h3>
          {audit.length === 0 ? <div className="notice valid small">Le canon est cohérent avec la constitution actuelle.</div> : audit.map(({ e, r }) => (
            <div key={e.id} className="stack tight"><div className="row between"><b>{KIND_ICON[e.kind]} {e.name}</b><span className={`badge ${r.verdict === "CONFLICT" || e.tensions.length ? "conflict" : "warning"}`}>{e.tensions.length ? "TENSION" : r.verdict}</span></div>
              {r.issues.slice(0, 2).map((i, k) => <span key={k} className="small muted">{i.message}</span>)}</div>
          ))}
        </div>
      </div>
      <div className="panel stack"><h3>Lois appliquées</h3>{lawsAsText(c).map(l => <div key={l.key} className="small"><b>{l.title}</b> — <span className="muted">{l.text}</span></div>)}<Link className="small" href={`/worlds/${state.world.id}/settings`}>Amender la constitution →</Link></div>
    </div>
  );
}

