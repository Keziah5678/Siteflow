"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { callAi } from "@/lib/ai/client";
import { identityFor, lawsAsText } from "@/lib/engine/constitution";
import { checkDraft, mergeAiReview } from "@/lib/engine/guardian";
import { ALL_KINDS, KIND_ICON, KIND_LABEL, canNest, isPlace, planetOf } from "@/lib/engine/hierarchy";
import type { ChangeType, Entity, EntityDraft, EntityKind, GuardianIssue, GuardianReport } from "@/lib/engine/types";
import { sampleTerrain } from "@/lib/world/terrain";
import { Field, Modal, Spinner, errorMessage, useToast } from "../ui";
import GuardianView from "./GuardianView";
import { useWorld } from "./WorldContext";

type Props = {
  onClose: () => void;
  onSaved?: (e: Entity | null) => void;
  /** Existing entity to edit; otherwise a creation. */
  entity?: Entity;
  kind?: EntityKind;
  kinds?: EntityKind[];
  position?: { x: number; y: number } | null;
  parentId?: string | null;
};

const POSITIONED = new Set<EntityKind>(["continent", "country", "region", "city", "village", "place", "character", "npc", "animal", "creature", "civilization", "resource", "quest", "item", "faction", "organization", "deity"]);

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [d, setD] = useState("");
  const add = () => { const t = d.trim(); if (t) onChange([...value, t]); setD(""); };
  return (
    <div className="stack tight">
      {value.length > 0 && <div className="chips">{value.map((t, i) => <button type="button" key={`${t}${i}`} className="chip on" onClick={() => onChange(value.filter((_, k) => k !== i))}>{t} ✕</button>)}</div>}
      <div className="row"><input value={d} placeholder={placeholder} onChange={e => setD(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} /><button type="button" className="btn sm" onClick={add}>+</button></div>
    </div>
  );
}

export default function EntityEditor({ onClose, onSaved, entity, kind: initialKind, kinds, position, parentId }: Props) {
  const { state, repo, can, byId, brain } = useWorld();
  const toast = useToast();
  const c = state.world.constitution;
  const editing = Boolean(entity);
  const [kind, setKind] = useState<EntityKind>(entity?.kind ?? initialKind ?? kinds?.[0] ?? "region");
  const [name, setName] = useState(entity?.name ?? "");
  const [summary, setSummary] = useState(entity?.summary ?? "");
  const [parent, setParent] = useState<string>(entity?.parentId ?? parentId ?? "");
  const [importance, setImportance] = useState(entity?.importance ?? 3);
  const [x, setX] = useState<number | null>(entity?.x ?? position?.x ?? null);
  const [y, setY] = useState<number | null>(entity?.y ?? position?.y ?? null);
  const [data, setData] = useState<Record<string, unknown>>(entity?.data ?? {});
  const [changeType, setChangeType] = useState<ChangeType>("update");
  const [reason, setReason] = useState("");
  const [justification, setJustification] = useState("");
  const [ai, setAi] = useState<{ issues?: GuardianIssue[]; consequences?: string[]; alternatives?: string[] } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const setD = (k: string, v: unknown) => setData(d => ({ ...d, [k]: v }));
  const str = (k: string) => (typeof data[k] === "string" ? (data[k] as string) : "");
  const num = (k: string) => (typeof data[k] === "number" ? String(data[k]) : "");
  const arr = (k: string) => (Array.isArray(data[k]) ? (data[k] as string[]) : []);

  const parents = useMemo(() => state.entities.filter(e => e.status !== "archived" && e.id !== entity?.id && canNest(e.kind, kind) && (isPlace(e.kind) || ["civilization", "faction", "family", "dynasty", "organization"].includes(e.kind))), [state.entities, kind, entity]);
  const ofKind = (...k: EntityKind[]) => state.entities.filter(e => k.includes(e.kind) && e.status !== "archived");

  const draft: EntityDraft = { kind, name, summary, parentId: parent || null, x, y, importance, data };
  const parentEntity = parent ? byId.get(parent) : undefined;
  const planetId = parentEntity ? planetOf(parentEntity, byId) : null;
  const surface = useMemo(() => identityFor(state.world, planetId ?? undefined), [state.world, planetId]);
  const draftKey = JSON.stringify(draft);
  const dataKey = JSON.stringify(data);
  const rules = useMemo(() => checkDraft(JSON.parse(draftKey) as EntityDraft, {
    constitution: c, entities: state.entities, events: state.events, tick: state.world.tick,
    biomeAt: (px, py) => sampleTerrain(surface, px, py, 4).biome
  }, { selfId: entity?.id }), [draftKey, c, state.entities, state.events, state.world.tick, surface, entity?.id]);
  const report: GuardianReport = ai ? mergeAiReview(rules, ai, c) : rules;
  useEffect(() => { setAi(null); }, [name, summary, kind, dataKey]);

  const direct = can("write");
  const mayPropose = !direct && can("propose");
  const blocked = report.verdict === "CONFLICT";
  const needsJustification = report.verdict === "WARNING" && !justification.trim();
  const needsReason = editing && (changeType === "correction" || changeType === "retcon") && !reason.trim();

  async function secondOpinion() {
    setAiBusy(true);
    const facts = brain.retrieve(`${name} ${summary}`, 12).filter(f => f.kind !== "law").map(f => f.text);
    const r = await callAi<{ review: typeof ai }>("guardian", { worldId: state.world.id, laws: lawsAsText(c), facts, draft: { kind, name, summary, data }, rulesVerdict: rules.verdict });
    setAiBusy(false);
    if (r.ok) setAi(r.data.review ?? { issues: [] });
    else toast(r.unavailable ? "IA non configurée : le verdict des règles fait foi." : r.error, r.unavailable ? "info" : "error");
  }

  async function inspire() {
    setAiBusy(true);
    const r = await callAi<{ draft: { name: string; summary: string; data: Record<string, unknown> } }>("suggest", {
      worldId: state.world.id, kind, kindLabel: KIND_LABEL[kind], laws: lawsAsText(c).map(l => `${l.title} : ${l.text}`).join("\n"),
      context: brain.contextFor(`${KIND_LABEL[kind]} ${parentEntity?.name ?? ""}`).slice(0, 5500), hint: summary || undefined
    });
    setAiBusy(false);
    if (r.ok) { setName(r.data.draft.name); setSummary(r.data.draft.summary); setData(d => ({ ...d, ...r.data.draft.data })); }
    else toast(r.unavailable ? "IA non configurée : décrivez votre idée, Guardian la vérifiera." : r.error, r.unavailable ? "info" : "error");
  }

  function applyAlternative(alt: string) {
    const m = alt.match(/comme (Animal|Personnage)/);
    if (m) setKind(m[1] === "Animal" ? "animal" : "character");
    else if (/religion/i.test(alt)) setKind("religion");
    else setSummary(s => `${s}${s ? "\n" : ""}[Piste Guardian] ${alt}`);
  }

  async function save() {
    if (blocked || needsJustification || needsReason || !name.trim()) return;
    setBusy(true);
    const payloadData = { ...data, ...(justification.trim() ? { guardianNote: justification.trim() } : {}) };
    const input = { ...(entity ? { id: entity.id } : {}), kind, name: name.trim(), summary: summary.trim(), parentId: parent || null, x, y, importance, data: payloadData, ...(entity ? {} : { bornTick: (kind === "character" || kind === "npc") && typeof data.age === "number" ? state.world.tick - Math.round((data.age as number) * c.calendar.daysPerYear) : null }) };
    try {
      if (direct) {
        const saved = await repo.saveEntity(state.world.id, input, { type: editing ? changeType : "create", reason: reason.trim() || justification.trim() || (editing ? "Modification" : "Création") }, entity?.version);
        if (!editing) await repo.addEvent(state.world.id, { tick: state.world.tick, title: `${KIND_LABEL[kind]} : ${saved.name}`, description: saved.summary || `${saved.name} rejoint le monde.`, kind: "creation", entityIds: [saved.id, ...(saved.parentId ? [saved.parentId] : [])], consequences: [...report.consequences, ...(justification.trim() ? [`Justification : ${justification.trim()}`] : [])] });
        await repo.logActivity(state.world.id, editing ? `entity_${changeType}` : "create_entity", "entity", saved.id, `${editing ? (changeType === "correction" ? "Correction" : changeType === "retcon" ? "Révision" : "Modification") : "Création"} — ${KIND_LABEL[kind]} « ${saved.name} » (${report.verdict})`);
        toast(`${saved.name} ${editing ? "mis à jour" : "rejoint le monde"}.`, "success");
        onSaved?.(saved);
      } else if (mayPropose) {
        await repo.submitProposal(state.world.id, editing ? "update" : "create", { entity: input, justification: justification.trim() || undefined }, report, entity?.id ?? null);
        toast("Proposition envoyée aux gardiens du monde.", "success");
        onSaved?.(null);
      }
      onClose();
    } catch (e) { toast(errorMessage(e), "error"); }
    finally { setBusy(false); }
  }

  const choosable = kinds ?? ALL_KINDS;
  const being = kind === "character" || kind === "npc";

  return (
    <Modal wide title={editing ? `Modifier « ${entity!.name} »` : "Nouvelle création"} onClose={onClose} footer={<>
      {blocked && can("amend_laws") && <Link className="btn ghost" href={`/worlds/${state.world.id}/settings`}>Amender les lois</Link>}
      <button className="btn ghost" onClick={onClose}>Annuler</button>
      <button className="btn primary" data-testid="entity-save" disabled={busy || blocked || needsJustification || needsReason || !name.trim() || (!direct && !mayPropose)} onClick={save}>
        {busy ? <Spinner /> : blocked ? "Bloqué par Guardian" : direct ? (editing ? "Enregistrer" : "Valider et ajouter") : "Proposer"}
      </button>
    </>}>
      <div className="split">
        <div className="stack">
          {!editing && (
            <Field label="Type">
              <select data-testid="entity-kind" value={kind} onChange={e => setKind(e.target.value as EntityKind)}>
                {choosable.map(k => <option key={k} value={k}>{KIND_ICON[k]} {KIND_LABEL[k]}</option>)}
              </select>
            </Field>
          )}
          <Field label="Nom"><input data-testid="entity-name" value={name} maxLength={160} onChange={e => setName(e.target.value)} autoFocus /></Field>
          <Field label="Description"><textarea data-testid="entity-summary" value={summary} maxLength={4000} onChange={e => setSummary(e.target.value)} placeholder="Apparence, histoire, rôle dans le monde…" /></Field>
          <div className="row"><button type="button" className="btn sm" onClick={inspire} disabled={aiBusy}>✧ Inspire-moi</button>{aiBusy && <Spinner />}</div>
          <div className="grid cols-2">
            <Field label="Situé dans / appartient à">
              <select value={parent} onChange={e => setParent(e.target.value)}>
                <option value="">— Aucun (racine) —</option>
                {parents.map(p => <option key={p.id} value={p.id}>{KIND_ICON[p.kind]} {p.name}</option>)}
              </select>
            </Field>
            <Field label={`Importance : ${importance}/5`}><input type="range" min={1} max={5} value={importance} onChange={e => setImportance(Number(e.target.value))} /></Field>
          </div>

          {being && (<div className="grid cols-2">
            <Field label="Âge"><input type="number" min={0} value={num("age")} onChange={e => setD("age", e.target.value === "" ? undefined : Number(e.target.value))} /></Field>
            <Field label="Espèce"><select value={str("speciesId")} onChange={e => setD("speciesId", e.target.value || undefined)}><option value="">Humaine</option>{ofKind("species").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Peuple / civilisation"><select value={str("civilizationId")} onChange={e => setD("civilizationId", e.target.value || undefined)}><option value="">—</option>{ofKind("civilization").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Origine"><input value={str("origin")} onChange={e => setD("origin", e.target.value)} /></Field>
            <Field label="Apparence"><input value={str("appearance")} onChange={e => setD("appearance", e.target.value)} /></Field>
            <Field label="Personnalité"><input value={str("personality")} onChange={e => setD("personality", e.target.value)} /></Field>
            <Field label="Capacités"><TagInput value={arr("abilities")} onChange={v => setD("abilities", v)} placeholder="ex. archère" /></Field>
            <Field label="Objectifs"><TagInput value={arr("goals")} onChange={v => setD("goals", v)} placeholder="ex. venger son frère" /></Field>
            <Field label="Inventaire"><TagInput value={arr("inventory")} onChange={v => setD("inventory", v)} placeholder="ex. arc d'if" /></Field>
          </div>)}
          {(kind === "creature" || kind === "animal" || kind === "species") && (<div className="grid cols-2">
            <Field label="Apparence"><input value={str("appearance")} onChange={e => setD("appearance", e.target.value)} /></Field>
            <Field label="Espérance de vie (ans)"><input type="number" min={1} value={num("lifespan")} onChange={e => setD("lifespan", e.target.value === "" ? undefined : Number(e.target.value))} /></Field>
            <Field label="Capacités"><TagInput value={arr("abilities")} onChange={v => setD("abilities", v)} placeholder="ex. vision nocturne" /></Field>
            {kind === "species" && <label className="toggle"><input type="checkbox" checked={data.intelligent === true} onChange={e => setD("intelligent", e.target.checked)} /><span><b>Espèce intelligente</b></span></label>}
          </div>)}
          {kind === "deity" && <Field label="Domaine"><input value={str("domain")} onChange={e => setD("domain", e.target.value)} placeholder="Le froid, la mémoire…" /></Field>}
          {kind === "civilization" && (<div className="grid cols-2">
            <Field label="Population"><input type="number" min={0} value={num("population")} onChange={e => setD("population", e.target.value === "" ? undefined : Number(e.target.value))} placeholder="10000" /></Field>
            <Field label={`Technologie (≤ ${c.technology.maxLevel})`}><input type="number" min={0} max={c.technology.maxLevel} value={num("techLevel")} onChange={e => setD("techLevel", Math.min(c.technology.maxLevel, Number(e.target.value)))} /></Field>
            <Field label="Gouvernement"><input value={str("government")} onChange={e => setD("government", e.target.value)} placeholder="monarchie" /></Field>
            <Field label="Économie"><input value={str("economy")} onChange={e => setD("economy", e.target.value)} placeholder="pêche, commerce de fourrures" /></Field>
            <Field label="Culture"><input value={str("culture")} onChange={e => setD("culture", e.target.value)} /></Field>
            <Field label="Religion"><select value={str("religionId")} onChange={e => setD("religionId", e.target.value || undefined)}><option value="">—</option>{ofKind("religion").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Langue"><select value={str("languageId")} onChange={e => setD("languageId", e.target.value || undefined)}><option value="">—</option>{ofKind("language").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <Field label="Couleur du territoire"><input type="color" value={str("color") || "#a568ff"} onChange={e => setD("color", e.target.value)} style={{ height: 44 }} /></Field>
          </div>)}
          {(kind === "city" || kind === "village") && (<div className="grid cols-2">
            <Field label="Population"><input type="number" min={0} value={num("population")} onChange={e => setD("population", e.target.value === "" ? undefined : Number(e.target.value))} placeholder={kind === "city" ? "8000" : "400"} /></Field>
            <Field label="Civilisation"><select value={str("civilizationId")} onChange={e => setD("civilizationId", e.target.value || undefined)}><option value="">—</option>{ofKind("civilization").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          </div>)}
          {(kind === "continent" || kind === "country" || kind === "region") && <Field label="Étendue sur la carte (rayon)"><input type="number" min={1} max={50} value={num("radius")} onChange={e => setD("radius", Number(e.target.value))} placeholder={kind === "continent" ? "28" : kind === "country" ? "16" : "10"} /></Field>}
          {kind === "resource" && (<div className="grid cols-2">
            <Field label={`Abondance : ${Math.round(Number(data.abundance ?? 0.5) * 100)} %`}><input type="range" min={0} max={1} step={0.05} value={Number(data.abundance ?? 0.5)} onChange={e => setD("abundance", Number(e.target.value))} /></Field>
            <label className="toggle"><input type="checkbox" checked={data.renewable !== false} onChange={e => setD("renewable", e.target.checked)} /><span><b>Renouvelable</b><span className="small muted">Se reconstitue avec le temps.</span></span></label>
          </div>)}
          {kind === "quest" && (<div className="grid cols-2">
            <Field label="Objectifs"><TagInput value={arr("objectives")} onChange={v => setD("objectives", v)} placeholder="ex. retrouver la couronne" /></Field>
            <Field label="Délai (années, facultatif)"><input type="number" min={0} onChange={e => setD("deadlineTick", e.target.value ? state.world.tick + Number(e.target.value) * c.calendar.daysPerYear : undefined)} /></Field>
            <Field label="Commanditaire"><select value={str("giverId")} onChange={e => setD("giverId", e.target.value || undefined)}><option value="">—</option>{ofKind("character", "npc", "faction", "organization").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          </div>)}
          {kind === "item" && <Field label="Propriétés"><input value={str("properties")} onChange={e => setD("properties", e.target.value)} /></Field>}
          {kind === "language" && <Field label="Écriture / sonorités"><input value={str("script")} onChange={e => setD("script", e.target.value)} /></Field>}
          {kind === "technology" && <Field label="Niveau requis"><input type="number" min={0} max={10} value={num("level")} onChange={e => setD("level", Number(e.target.value))} /></Field>}
          {POSITIONED.has(kind) && (
            <div className="grid cols-2">
              <Field label="Position X (0–100)" hint="Ou cliquez sur la carte en mode création."><input type="number" min={0} max={100} step={0.1} value={x ?? ""} onChange={e => setX(e.target.value === "" ? null : Math.max(0, Math.min(100, Number(e.target.value))))} /></Field>
              <Field label="Position Y (0–100)"><input type="number" min={0} max={100} step={0.1} value={y ?? ""} onChange={e => setY(e.target.value === "" ? null : Math.max(0, Math.min(100, Number(e.target.value))))} /></Field>
            </div>
          )}
          {editing && (
            <div className="stack">
              <span className="caps muted">Nature de la modification</span>
              <div className="chips">
                {([["update", "Évolution"], ["correction", "Correction d'erreur"], ["retcon", "Révision assumée de l'histoire"]] as const).map(([v, l]) => <button type="button" key={v} className={`chip ${changeType === v ? "on" : ""}`} onClick={() => setChangeType(v)}>{l}</button>)}
              </div>
              {(changeType === "correction" || changeType === "retcon") && <Field label="Motif (obligatoire, conservé dans l'historique)"><input value={reason} onChange={e => setReason(e.target.value)} /></Field>}
              <span className="small faint">La version actuelle (v{entity!.version}) reste consultable dans l&apos;historique.</span>
            </div>
          )}
        </div>
        <aside className="stack sticky-aside">
          <div className="row between"><span className="caps muted">Guardian AI</span><button type="button" className="btn sm" onClick={secondOpinion} disabled={aiBusy || !name.trim()}>Second avis IA</button></div>
          <GuardianView report={report} onAlternative={applyAlternative} />
          {report.verdict === "WARNING" && <Field label="Justification (obligatoire)" hint="Elle sera inscrite dans la chronique."><textarea data-testid="guardian-justification" value={justification} onChange={e => setJustification(e.target.value)} placeholder="Ex. Le canon a été rapporté d'une contrée lointaine." /></Field>}
          {blocked && <div className="notice conflict small">Cette création contredit le monde. Adoptez une alternative{can("amend_laws") ? ", ou amendez les lois (l'amendement est historisé et ses conséquences analysées)" : ""}.</div>}
          {!direct && mayPropose && <div className="notice small">Votre rôle vous permet de proposer : un gardien du monde validera.</div>}
          {!direct && !mayPropose && <div className="notice warning small">Votre rôle ne permet pas de modifier ce monde.</div>}
        </aside>
      </div>
    </Modal>
  );
}
