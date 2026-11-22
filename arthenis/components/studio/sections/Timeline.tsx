"use client";
import { useState } from "react";
import { callAi } from "@/lib/ai/client";
import { formatTick, lawsAsText } from "@/lib/engine/constitution";
import { durationToTicks, simulate, type SimulationResult } from "@/lib/engine/simulation";
import type { EventKind, TimelineEvent } from "@/lib/engine/types";
import { Field, Modal, Spinner, errorMessage, useToast } from "../../ui";
import { useWorld } from "../WorldContext";

const KIND_LABEL: Partial<Record<EventKind, string>> = { creation: "Création", narrative: "Récit", law_change: "Loi", correction: "Correction", retcon: "Révision", birth: "Naissance", death: "Décès", war: "Guerre", peace: "Paix", alliance: "Alliance", catastrophe: "Catastrophe", growth: "Essor", decline: "Déclin", tech: "Technologie", migration: "Migration", depletion: "Épuisement", politics: "Politique", quest: "Quête", simulation: "Temps" };

export default function Timeline() {
  const { state, repo, can, now, brain } = useWorld();
  const toast = useToast();
  const c = state.world.constitution;
  const [preview, setPreview] = useState<SimulationResult | null>(null);
  const [busy, setBusy] = useState<"sim" | "apply" | "narrate" | null>(null);
  const [custom, setCustom] = useState({ n: 5, unit: "years" as "days" | "months" | "years" });
  const [showAll, setShowAll] = useState(false);
  const [correcting, setCorrecting] = useState<TimelineEvent | null>(null);
  const [adding, setAdding] = useState(false);

  const run = (d: { days?: number; months?: number; years?: number }) => {
    setBusy("sim");
    setTimeout(() => { // let the spinner paint before a long simulation
      try { setPreview(simulate(state, durationToTicks(d, c))); } catch (e) { toast(errorMessage(e), "error"); }
      setBusy(null);
    }, 20);
  };
  async function narrate() {
    if (!preview) return;
    setBusy("narrate");
    const events = preview.events.slice(0, 40);
    const r = await callAi<{ events: Array<{ title: string; description: string }> }>("narrate", { worldId: state.world.id, world: `${state.world.name} — ${state.world.description}\n${lawsAsText(c).map(l => `${l.title} : ${l.text}`).join("\n")}`.slice(0, 3900), events: events.map(e => ({ title: e.title, description: e.description })) });
    setBusy(null);
    if (!r.ok) return toast(r.unavailable ? "IA non configurée : la chronique factuelle sera enregistrée telle quelle." : r.error, "info");
    setPreview({ ...preview, events: preview.events.map((e, i) => (i < r.data.events.length ? { ...e, title: r.data.events[i].title, description: r.data.events[i].description } : e)) });
  }
  async function apply() {
    if (!preview) return;
    setBusy("apply");
    try {
      await repo.applySimulation(state.world.id, preview);
      toast(`Le temps a passé : ${preview.events.length} événement(s) inscrits.`, "success");
      setPreview(null);
    } catch (e) { toast(errorMessage(e), "error"); }
    setBusy(null);
  }

  const events = [...state.events].sort((a, b) => b.tick - a.tick || b.createdAt.localeCompare(a.createdAt));
  const shown = showAll ? events : events.slice(0, 80);

  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div><span className="caps muted">Time Engine</span><h2>Chronologie</h2></div>
        <span className="clock" data-testid="world-clock">{now}</span>
      </div>

      {can("simulate") ? (
        <div className="panel stack" data-testid="time-engine">
          <div className="row wrap">
            <b>Faire avancer le temps</b>
            {[["1 jour", { days: 1 }], ["1 mois", { months: 1 }], ["1 an", { years: 1 }], ["10 ans", { years: 10 }], ["100 ans", { years: 100 }]].map(([l, d]) => (
              <button key={l as string} className="btn sm" data-testid={`advance-${(l as string).replace(" ", "")}`} disabled={!!busy} onClick={() => run(d as { days?: number })}>{l as string}</button>
            ))}
            <span className="row" style={{ gap: 6 }}>
              <input type="number" min={1} max={10000} value={custom.n} onChange={e => setCustom(x => ({ ...x, n: Math.max(1, Number(e.target.value) || 1) }))} style={{ width: 90 }} />
              <select value={custom.unit} onChange={e => setCustom(x => ({ ...x, unit: e.target.value as typeof x.unit }))} style={{ width: "auto" }}><option value="days">jours</option><option value="months">mois</option><option value="years">années</option></select>
              <button className="btn sm" disabled={!!busy} onClick={() => run({ [custom.unit]: custom.n })}>Simuler</button>
            </span>
            {busy === "sim" && <Spinner />}
          </div>
          <p className="small muted">Le moteur est déterministe : vieillissement, démographie, technologie plafonnée par vos lois, stabilité, guerres et alliances, croissance des villes, ressources, migrations et catastrophes liées au climat. Rien n&apos;est écrit avant que vous n&apos;appliquiez la prévisualisation.</p>
          {preview && (
            <div className="stack" data-testid="sim-preview">
              <div className="notice">
                <b>Prévisualisation</b> : {formatTick(preview.fromTick, c)} → {formatTick(preview.toTick, c)} · {preview.events.length} événement(s) · {preview.changes.length} élément(s) modifié(s) · naissances {preview.stats.births}, décès {preview.stats.deaths}, guerres {preview.stats.wars}, alliances {preview.stats.alliances}, catastrophes {preview.stats.catastrophes}, progrès techniques {preview.stats.techAdvances}
                {preview.stats.populationBefore > 0 && <> · population {preview.stats.populationBefore.toLocaleString("fr-FR")} → {preview.stats.populationAfter.toLocaleString("fr-FR")}</>}
              </div>
              <div className="stack tight" style={{ maxHeight: 340, overflow: "auto" }}>
                {preview.events.map((e, i) => <div key={i} className="issue"><span><span className="badge">{KIND_LABEL[e.kind] ?? e.kind}</span> <b>{e.title}</b> <span className="faint small">· {formatTick(e.tick, c)}</span></span><span className="small muted">{e.description}</span></div>)}
              </div>
              <div className="row wrap">
                <button className="btn primary" data-testid="sim-apply" onClick={apply} disabled={!!busy}>{busy === "apply" ? <Spinner /> : "Appliquer à l'histoire"}</button>
                <button className="btn" onClick={narrate} disabled={!!busy}>{busy === "narrate" ? <Spinner /> : "Raconter avec l'IA"}</button>
                <button className="btn ghost" onClick={() => setPreview(null)} disabled={!!busy}>Abandonner</button>
              </div>
            </div>
          )}
        </div>
      ) : <div className="notice small">Seuls le créateur et les administrateurs font avancer le temps.</div>}

      <div className="row between"><span className="caps muted">{events.length} événement(s) — l&apos;histoire établie ne s&apos;efface pas</span>{can("write") && <button className="btn sm" onClick={() => setAdding(true)}>+ Événement</button>}</div>
      <div className="timeline" data-testid="timeline">
        {shown.map(e => (
          <div key={e.id} className={`tl-item k-${e.kind} ${e.canon ? "" : "noncanon"}`}>
            <div className="panel tight stack tight">
              <div className="row between wrap"><span className="small faint">{formatTick(e.tick, c)} · {KIND_LABEL[e.kind] ?? e.kind}{e.source === "simulation" ? " · simulé" : ""}</span>{!e.canon && <span className="badge">corrigé</span>}</div>
              <b>{e.title}</b>
              {e.description && <span className="small muted" style={{ whiteSpace: "pre-wrap" }}>{e.description}</span>}
              {e.entityIds.length > 0 && <div className="chips">{e.entityIds.map(id => brain.byId.get(id)).filter(Boolean).map(x => <span key={x!.id} className="badge">{x!.name}</span>)}</div>}
              {e.consequences.length > 0 && <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>{e.consequences.map(cq => <li key={cq}>{cq}</li>)}</ul>}
              {e.canon && can("simulate") && <div><button className="btn ghost sm" onClick={() => setCorrecting(e)}>Corriger / réviser</button></div>}
            </div>
          </div>
        ))}
      </div>
      {!showAll && events.length > 80 && <button className="btn ghost" onClick={() => setShowAll(true)}>Afficher les {events.length - 80} plus anciens</button>}
      {correcting && <CorrectEvent ev={correcting} onClose={() => setCorrecting(null)} />}
      {adding && <AddEvent onClose={() => setAdding(false)} />}
    </div>
  );
}

function CorrectEvent({ ev, onClose }: { ev: TimelineEvent; onClose: () => void }) {
  const { repo } = useWorld();
  const toast = useToast();
  const [title, setTitle] = useState(ev.title);
  const [description, setDescription] = useState(ev.description);
  const [reason, setReason] = useState("");
  const [kind, setKind] = useState<"correction" | "retcon">("correction");
  return (
    <Modal title="Corriger l'histoire" onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Annuler</button><button className="btn primary" disabled={!reason.trim() || !title.trim()} onClick={async () => { try { await repo.correctEvent(ev.id, title, description, reason, kind); toast("La version d'origine reste consultable, marquée comme corrigée.", "success"); onClose(); } catch (e) { toast(errorMessage(e), "error"); } }}>Enregistrer la {kind === "correction" ? "correction" : "révision"}</button></>}>
      <div className="chips"><button className={`chip ${kind === "correction" ? "on" : ""}`} onClick={() => setKind("correction")}>Correction d&apos;erreur</button><button className={`chip ${kind === "retcon" ? "on" : ""}`} onClick={() => setKind("retcon")}>Révision assumée</button></div>
      <p className="small muted">{kind === "correction" ? "Une erreur de saisie ou de fait : la correction remplace l'événement dans le canon." : "Une réécriture narrative délibérée : elle est signalée comme telle aux lecteurs."} L&apos;événement d&apos;origine n&apos;est jamais supprimé.</p>
      <Field label="Titre"><input value={title} onChange={e => setTitle(e.target.value)} /></Field>
      <Field label="Description"><textarea value={description} onChange={e => setDescription(e.target.value)} /></Field>
      <Field label="Motif (obligatoire)"><input value={reason} onChange={e => setReason(e.target.value)} /></Field>
    </Modal>
  );
}

function AddEvent({ onClose }: { onClose: () => void }) {
  const { repo, state } = useWorld();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  return (
    <Modal title="Nouvel événement" onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Annuler</button><button className="btn primary" disabled={!title.trim()} onClick={async () => { try { await repo.addEvent(state.world.id, { tick: state.world.tick, title: title.trim(), description: description.trim(), kind: "narrative", entityIds: ids, consequences: [] }); toast("Événement ajouté au présent du monde.", "success"); onClose(); } catch (e) { toast(errorMessage(e), "error"); } }}>Ajouter</button></>}>
      <p className="small muted">Les événements s&apos;inscrivent au présent du monde. Pour agir sur le passé, corrigez un événement existant.</p>
      <Field label="Titre"><input value={title} onChange={e => setTitle(e.target.value)} /></Field>
      <Field label="Récit"><textarea value={description} onChange={e => setDescription(e.target.value)} /></Field>
      <Field label="Éléments concernés"><select multiple value={ids} onChange={e => setIds([...e.target.selectedOptions].map(o => o.value))} style={{ minHeight: 120 }}>{state.entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
    </Modal>
  );
}
