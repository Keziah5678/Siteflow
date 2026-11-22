"use client";
import { useMemo, useState } from "react";

/**
 * Interactive demo running entirely in the browser on fictional data. It uses
 * the same analysis rules as the product's deterministic engine (simplified
 * copy) so visitors see real behaviour, not a recording.
 */
type Lead = { id: number; name: string; company: string; need: string; days: number; reply?: string };

const LEADS: Lead[] = [
  { id: 1, name: "Julie Martin", company: "Particulier", need: "Je souhaite un devis pour la révision de ma Clio IV.", days: 6 },
  { id: 2, name: "Bruno Petit", company: "SARL Petit Bâtiment", need: "Urgent : fuite sur la toiture de l'entrepôt, pouvez-vous passer rapidement ?", days: 2 },
  { id: 3, name: "Agence Nord", company: "Agence Nord Immobilier", need: "Nous aurions besoin d'un nettoyage hebdomadaire de nos bureaux (180 m²).", days: 9 },
  { id: 4, name: "Claire Roux", company: "Cabinet Roux", need: "Merci de ne plus me contacter.", days: 1 }
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/'/g, " ");
function analyze(t: string) {
  const n = norm(t);
  if (/ne plus me contacter|desinscri|stop/.test(n)) return { intent: "Désinscription", tone: "badge-red", urgent: false };
  if (/pas interesse|autre prestataire|non merci/.test(n)) return { intent: "Refus", tone: "badge-red", urgent: false };
  if (/d accord|interesse|rendez-vous|quand pouvez/.test(n)) return { intent: "Réponse positive", tone: "badge-green", urgent: false };
  return { intent: "Demande", tone: "badge-blue", urgent: /urgent|rapidement|fuite|panne/.test(n) };
}
function draft(l: Lead) {
  const first = l.name.split(" ")[0];
  const topic = l.need.replace(/^(urgent ?: ?)/i, "").replace(/^(je souhaite|nous aurions besoin d.)\s*/i, "").replace(/[.?!]+$/, "");
  return `Bonjour ${first},\n\nJe reviens vers vous suite à votre demande concernant ${topic.charAt(0).toLowerCase() + topic.slice(1)}.\n\nAvez-vous pu en prendre connaissance ? Je reste à votre disposition pour toute question.\n\nBien cordialement,\nVotre entreprise`;
}

export default function Demo() {
  const [selected, setSelected] = useState<number>(1);
  const [sent, setSent] = useState<number[]>([]);
  const [custom, setCustom] = useState("");
  const lead = LEADS.find(l => l.id === selected)!;
  const a = analyze(lead.need);
  const blocked = a.intent === "Désinscription";
  const customReading = useMemo(() => (custom.trim() ? analyze(custom) : null), [custom]);
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="card p-2" role="listbox" aria-label="Prospects fictifs">
        {LEADS.map(l => {
          const r = analyze(l.need);
          return (
            <button key={l.id} role="option" aria-selected={l.id === selected} onClick={() => setSelected(l.id)} className={`w-full rounded-xl p-3 text-left transition ${l.id === selected ? "bg-brand-500/10 ring-1 ring-brand-500/40" : "hover:bg-[var(--surface-2)]"}`}>
              <div className="flex items-center justify-between gap-2"><span className="font-semibold">{l.name}</span>{sent.includes(l.id) ? <span className="badge badge-green">Relancé</span> : <span className={`badge ${r.urgent ? "badge-red" : r.tone}`}>{r.urgent ? "Urgent" : r.intent}</span>}</div>
              <div className="muted mt-0.5 text-xs">{l.company} · sans réponse depuis {l.days} j</div>
            </button>
          );
        })}
      </div>
      <div className="space-y-4">
        <div className="card p-5">
          <div className="muted text-xs font-semibold uppercase tracking-wider">Demande reçue</div>
          <p className="mt-2">{lead.need}</p>
          <div className="mt-3 flex flex-wrap gap-2"><span className={`badge ${a.tone}`}>Intention : {a.intent}</span>{a.urgent && <span className="badge badge-red">Urgent</span>}<span className="badge">Base légale : demande du prospect</span></div>
        </div>
        <div className="card p-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-brand-600 dark:text-brand-400"><span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse-dot" />RelancePro AI</div>
          {blocked ? (
            <p className="text-sm">Ce prospect a demandé à ne plus être contacté. <strong>Aucune relance n&apos;est possible</strong> : son opposition est enregistrée définitivement.</p>
          ) : (<>
            <pre className="whitespace-pre-wrap rounded-xl bg-[var(--surface-2)] p-4 font-sans text-sm leading-relaxed">{draft(lead)}</pre>
            <p className="muted mt-2 text-xs">Rédigé uniquement à partir de la demande : aucun prix, délai ni promesse ajouté. Un lien de désinscription est ajouté automatiquement à l&apos;envoi.</p>
            <div className="mt-4 flex gap-2"><button className="btn btn-primary" disabled={sent.includes(lead.id)} onClick={() => setSent(s => [...s, lead.id])}>{sent.includes(lead.id) ? "Relance validée (démo)" : "Valider la relance"}</button></div>
          </>)}
        </div>
        <div className="card p-5">
          <label className="label" htmlFor="demo-reply">Testez l&apos;analyse d&apos;une réponse de prospect</label>
          <textarea id="demo-reply" className="input min-h-20" placeholder="Ex. : « C'est d'accord, quand pouvez-vous passer ? » ou « Nous avons choisi un autre prestataire. »" value={custom} onChange={e => setCustom(e.target.value)} />
          {customReading && <p className="mt-3 text-sm">Lecture de RelancePro AI : <span className={`badge ${customReading.tone}`}>{customReading.intent}</span> {customReading.intent === "Désinscription" ? "→ opposition enregistrée, séquence arrêtée." : customReading.intent === "Refus" ? "→ dossier passé en « perdu », séquence arrêtée." : customReading.intent === "Réponse positive" ? "→ statut « Rendez-vous », à traiter personnellement." : "→ à traiter."}</p>}
        </div>
      </div>
    </div>
  );
}
