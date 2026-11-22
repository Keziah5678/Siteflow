"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import { RequireAuth } from "@/components/session";
import { Field, Spinner, errorMessage, useToast } from "@/components/ui";
import { getRepository } from "@/lib/data";
import { TECH_BY_ERA } from "@/lib/world/identity";
import { ERAS, WORLD_TYPES, defaultConstitution, identityFor, lawsAsText } from "@/lib/engine/constitution";
import type { Climate, Constitution, FundamentalRule, Visibility, WorldType } from "@/lib/engine/types";

const CLIMATES: Climate[] = ["tempéré", "arctique", "aride", "tropical", "volcanique", "océanique"];
const STEPS = ["Origine", "Nature", "Lois", "Société", "Contributions"];

function Tags({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => { const t = draft.trim(); if (t && !value.includes(t)) onChange([...value, t]); setDraft(""); };
  return (
    <div className="stack tight">
      <div className="chips">{value.map(t => <button type="button" key={t} className="chip on" onClick={() => onChange(value.filter(x => x !== t))}>{t} ✕</button>)}</div>
      <div className="row"><input value={draft} placeholder={placeholder} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} /><button type="button" className="btn sm" onClick={add}>Ajouter</button></div>
    </div>
  );
}

function Toggle({ checked, onChange, title, text, testId }: { checked: boolean; onChange: (v: boolean) => void; title: string; text: string; testId?: string }) {
  return <label className="toggle"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} data-testid={testId} /><span><b>{title}</b><span className="small muted">{text}</span></span></label>;
}

function Wizard() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [c, setC] = useState<Constitution>(() => defaultConstitution("fantastique"));
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [busy, setBusy] = useState(false);
  const [ruleTitle, setRuleTitle] = useState("");
  const [ruleText, setRuleText] = useState("");
  const [ruleTerms, setRuleTerms] = useState<string[]>([]);
  const set = <K extends keyof Constitution>(k: K, v: Constitution[K]) => setC(prev => ({ ...prev, [k]: v }));
  const pickType = (t: WorldType) => setC(prev => ({ ...defaultConstitution(t, prev.blank), climate: prev.climate, geography: prev.geography, fundamentalRules: prev.fundamentalRules, contribution: prev.contribution }));
  const nameError = step > 0 && !name.trim() ? "Votre monde a besoin d'un nom." : null;
  const preview = useMemo(() => lawsAsText(c), [c]);

  async function create() {
    if (!name.trim()) { setStep(0); return toast("Donnez un nom à votre monde.", "error"); }
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      const identity = identityFor({ id, name, description, constitution: c });
      const w = await getRepository().createWorld({ id, name, description, constitution: c, visibility, visualBible: { identity } });
      toast(`${w.name} est né.`, "success");
      router.replace(`/worlds/${w.id}/map`);
    } catch (e) { toast(errorMessage(e), "error"); setBusy(false); }
  }

  return (
    <main className="page" style={{ maxWidth: 900 }}>
      <div className="page-head"><div><span className="caps muted">Création d&apos;univers</span><h1>{name.trim() || "Un nouveau monde"}</h1></div></div>
      <div className="steps" style={{ marginBottom: 18 }}>
        {STEPS.map((s, i) => <button key={s} type="button" className={`step-dot ${i === step ? "on" : i < step ? "done" : ""}`} onClick={() => (i === 0 || name.trim()) && setStep(i)}>{i < step ? "✓" : i + 1} {s}</button>)}
      </div>

      <div className="panel stack">
        {step === 0 && (<>
          <Field label="Nom de l'univers" error={nameError}><input data-testid="world-name" value={name} maxLength={120} onChange={e => setName(e.target.value)} placeholder="Ex. Aerion" autoFocus /></Field>
          <Field label="Description" hint="Le ton, la promesse, ce qui rend ce monde unique."><textarea data-testid="world-description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Un royaume de glace où le soleil ne se lève que trois mois par an…" maxLength={2000} /></Field>
          <div className="grid cols-2">
            <button type="button" className={`type-card ${!c.blank ? "on" : ""}`} onClick={() => set("blank", false)} data-testid="origin-guided"><b>Monde guidé</b><span className="small muted">Le relief est généré dès le départ à partir de vos lois et de la graine du monde.</span></button>
            <button type="button" className={`type-card ${c.blank ? "on" : ""}`} onClick={() => set("blank", true)} data-testid="origin-blank"><b>Univers vierge</b><span className="small muted">La carte commence blanche. Chaque lieu que vous créez révèle le terrain autour de lui.</span></button>
          </div>
        </>)}

        {step === 1 && (<>
          <span className="caps muted">Type de monde</span>
          <div className="type-grid">{WORLD_TYPES.map(t => <button type="button" key={t.id} className={`type-card ${c.worldType === t.id ? "on" : ""}`} onClick={() => pickType(t.id)}><b>{t.label}</b><span className="small muted">{t.hint}</span></button>)}</div>
          <div className="grid cols-2">
            <Field label="Époque"><select value={c.era} onChange={e => { const era = e.target.value as Constitution["era"]; setC(p => ({ ...p, era, technology: { ...p.technology, maxLevel: TECH_BY_ERA[era] } })); }}>{ERAS.map(e => <option key={e}>{e}</option>)}</select></Field>
            <Field label="Niveau de réalisme" hint="Strict : le moindre anachronisme est un conflit."><select value={c.realism} onChange={e => set("realism", e.target.value as Constitution["realism"])}><option value="strict">Strict</option><option value="plausible">Plausible</option><option value="libre">Libre</option></select></Field>
            <Field label="Climat dominant"><select value={c.climate} onChange={e => set("climate", e.target.value as Climate)}>{CLIMATES.map(x => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Géographie" hint="Continents, mers, reliefs marquants."><input value={c.geography} onChange={e => set("geography", e.target.value)} placeholder="Un continent unique entouré d'une mer gelée" /></Field>
          </div>
        </>)}

        {step === 2 && (<>
          <div className="grid cols-2">
            <Toggle testId="law-magic" checked={c.magic.allowed} onChange={v => set("magic", { ...c.magic, allowed: v })} title="Magie" text={c.magic.allowed ? "La magie existe." : "Aucune magie : Guardian refusera sorciers et sortilèges."} />
            <Toggle checked={c.creatures.fictional} onChange={v => set("creatures", { ...c.creatures, fictional: v })} title="Créatures fictives" text="Dragons, golems, espèces imaginaires." />
            <Toggle checked={c.creatures.deities} onChange={v => set("creatures", { ...c.creatures, deities: v })} title="Divinités tangibles" text="Des dieux qui existent et agissent." />
            <Toggle checked={c.creatures.intelligentSpecies} onChange={v => set("creatures", { ...c.creatures, intelligentSpecies: v })} title="Autres espèces intelligentes" text="Peuples non humains doués de raison." />
            <Toggle checked={c.npcs.allowed} onChange={v => set("npcs", { allowed: v })} title="PNJ autorisés" text="Personnages secondaires, y compris ceux nés au fil du temps." />
            <Toggle checked={c.physics.ftl} onChange={v => set("physics", { ...c.physics, ftl: v })} title="Voyage supraluminique" text="Plus vite que la lumière." />
          </div>
          {c.magic.allowed && <div className="grid cols-2">
            <Field label="Système de magie"><input value={c.magic.system} onChange={e => set("magic", { ...c.magic, system: e.target.value })} placeholder="Runes gravées dans la glace" /></Field>
            <Field label="Coût de la magie"><input value={c.magic.cost} onChange={e => set("magic", { ...c.magic, cost: e.target.value })} placeholder="Chaque sort coûte une année de vie" /></Field>
          </div>}
          <Field label={`Niveau technologique maximal : ${c.technology.maxLevel}/10`} hint="0 âge de pierre · 3 médiéval · 6 industriel · 7 moderne · 10 futur lointain">
            <input type="range" min={0} max={10} value={c.technology.maxLevel} onChange={e => set("technology", { ...c.technology, maxLevel: Number(e.target.value) })} />
          </Field>
          <div className="grid cols-2">
            <Field label="Technologies explicitement autorisées"><Tags value={c.technology.allowed} onChange={v => set("technology", { ...c.technology, allowed: v })} placeholder="ex. poudre à canon" /></Field>
            <Field label="Technologies interdites"><Tags value={c.technology.forbidden} onChange={v => set("technology", { ...c.technology, forbidden: v })} placeholder="ex. électricité" /></Field>
            <Field label="Gravité"><select value={c.physics.gravity} onChange={e => set("physics", { ...c.physics, gravity: e.target.value as Constitution["physics"]["gravity"] })}><option value="terrestre">Terrestre</option><option value="faible">Faible</option><option value="forte">Forte</option><option value="variable">Variable</option></select></Field>
            <Field label="Notes physiques"><input value={c.physics.notes} onChange={e => set("physics", { ...c.physics, notes: e.target.value })} placeholder="Deux soleils, nuits de trois jours…" /></Field>
          </div>
        </>)}

        {step === 3 && (<>
          <Field label="Civilisations" hint="Une première intuition ; vous les créerez ensuite sur la carte."><textarea value={c.civilizations} onChange={e => set("civilizations", e.target.value)} placeholder="Des clans nomades du givre, un royaume de pierre au sud…" /></Field>
          <Field label="Ressources du monde"><Tags value={c.resources} onChange={v => set("resources", v)} placeholder="ex. argent, glace bleue" /></Field>
          <div className="grid cols-2">
            <Field label="Jours par an"><input type="number" min={10} max={2000} value={c.calendar.daysPerYear} onChange={e => set("calendar", { ...c.calendar, daysPerYear: Math.max(10, Number(e.target.value) || 360) })} /></Field>
            <Field label="Mois par an"><input type="number" min={1} max={40} value={c.calendar.monthsPerYear} onChange={e => set("calendar", { ...c.calendar, monthsPerYear: Math.max(1, Number(e.target.value) || 12) })} /></Field>
            <Field label="Année de départ"><input type="number" value={c.calendar.startYear} onChange={e => set("calendar", { ...c.calendar, startYear: Number(e.target.value) || 1 })} /></Field>
            <Field label="Nom de l'ère"><input value={c.calendar.eraName} maxLength={12} onChange={e => set("calendar", { ...c.calendar, eraName: e.target.value })} /></Field>
          </div>
          <div className="divider" />
          <span className="caps muted">Lois fondamentales</span>
          {c.fundamentalRules.map(r => <div key={r.id} className="issue"><b>{r.title}</b><span className="small muted">{r.description}</span>{r.forbiddenTerms.length > 0 && <span className="small">Interdit : {r.forbiddenTerms.join(", ")}</span>}<button type="button" className="btn ghost sm" style={{ justifySelf: "start" }} onClick={() => set("fundamentalRules", c.fundamentalRules.filter(x => x.id !== r.id))}>Retirer</button></div>)}
          <div className="grid cols-2">
            <Field label="Titre de la loi"><input data-testid="rule-title" value={ruleTitle} onChange={e => setRuleTitle(e.target.value)} placeholder="Le ciel est vide" /></Field>
            <Field label="Énoncé"><input data-testid="rule-text" value={ruleText} onChange={e => setRuleText(e.target.value)} placeholder="Nul être ne peut voler." /></Field>
          </div>
          <Field label="Mots que cette loi interdit (Guardian les traquera)"><Tags value={ruleTerms} onChange={setRuleTerms} placeholder="ex. voler" /></Field>
          <div><button type="button" className="btn sm" disabled={!ruleTitle.trim()} onClick={() => { const r: FundamentalRule = { id: crypto.randomUUID().slice(0, 8), title: ruleTitle.trim(), description: ruleText.trim(), forbiddenTerms: ruleTerms }; set("fundamentalRules", [...c.fundamentalRules, r]); setRuleTitle(""); setRuleText(""); setRuleTerms([]); }}>+ Ajouter la loi</button></div>
        </>)}

        {step === 4 && (<>
          <span className="caps muted">Droits de contribution</span>
          <div className="grid cols-2">
            {([["closed", "Fermé", "Seuls vous et vos administrateurs écrivez."], ["proposals", "Sur proposition", "Les contributeurs proposent ; un gardien ou vous validez."], ["open", "Ouvert aux contributeurs", "Les contributeurs écrivent directement, sous contrôle de Guardian."]] as const).map(([v, t, d]) => (
              <button type="button" key={v} className={`type-card ${c.contribution.mode === v ? "on" : ""}`} onClick={() => set("contribution", { ...c.contribution, mode: v })}><b>{t}</b><span className="small muted">{d}</span></button>
            ))}
          </div>
          <Toggle checked={c.contribution.guardianStrict} onChange={v => set("contribution", { ...c.contribution, guardianStrict: v })} title="Guardian strict" text="Les créations en CONFLICT sont bloquées pour tous (le créateur peut amender les lois)." />
          <Toggle checked={visibility === "public"} onChange={v => setVisibility(v ? "public" : "private")} title="Monde public" text="Visible en lecture par toute la communauté. Modifiable ensuite." />
          <div className="divider" />
          <span className="caps muted">Constitution de {name || "votre monde"}</span>
          <div className="stack tight">{preview.map(l => <div key={l.key} className="small"><b>{l.title}</b> — <span className="muted">{l.text}</span></div>)}</div>
        </>)}

        <div className="row between" style={{ marginTop: 6 }}>
          <button type="button" className="btn ghost" disabled={step === 0} onClick={() => setStep(s => s - 1)}>← Retour</button>
          {step < STEPS.length - 1
            ? <button type="button" className="btn primary" data-testid="wizard-next" disabled={!name.trim()} onClick={() => setStep(s => s + 1)}>Continuer →</button>
            : <button type="button" className="btn primary lg" data-testid="wizard-create" disabled={busy} onClick={create}>{busy ? <Spinner /> : "✦ Faire naître ce monde"}</button>}
        </div>
        {step === 0 && name.trim() && <button type="button" className="btn ghost sm" style={{ justifySelf: "end" }} data-testid="wizard-quick" onClick={create} disabled={busy}>Créer tout de suite avec les lois par défaut</button>}
      </div>
    </main>
  );
}

export default function NewWorldPage() { return <><TopBar /><RequireAuth><Wizard /></RequireAuth></>; }
