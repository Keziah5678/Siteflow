import { BASIS_LABEL } from "@/lib/app/prospects";
import { SubmitButton } from "@/components/client";

type P = Record<string, unknown> | null;

export function ProspectForm({ action, p, submitLabel }: { action: (f: FormData) => Promise<void>; p?: P; submitLabel: string }) {
  const v = (k: string) => (p?.[k] == null ? "" : String(p[k]));
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div><label className="label" htmlFor="firstName">Prénom</label><input id="firstName" name="firstName" defaultValue={v("firstName")} className="input" autoComplete="off" /></div>
      <div><label className="label" htmlFor="lastName">Nom</label><input id="lastName" name="lastName" defaultValue={v("lastName")} className="input" autoComplete="off" /></div>
      <div><label className="label" htmlFor="company">Entreprise</label><input id="company" name="company" defaultValue={v("company")} className="input" /></div>
      <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" defaultValue={v("email")} className="input" /></div>
      <div><label className="label" htmlFor="phone">Téléphone</label><input id="phone" name="phone" defaultValue={v("phone")} className="input" /></div>
      <div><label className="label" htmlFor="estimatedValue">Valeur estimée (€ HT)</label><input id="estimatedValue" name="estimatedValue" inputMode="decimal" defaultValue={p?.estimatedValueCents ? String(Number(p.estimatedValueCents) / 100) : ""} className="input" /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="need">Demande / besoin</label><textarea id="need" name="need" defaultValue={v("need")} className="input min-h-28" placeholder="Collez le message reçu ou résumez la demande : RelancePro AI l'analysera." /></div>
      <div><label className="label" htmlFor="lawfulBasis">Base légale</label><select id="lawfulBasis" name="lawfulBasis" defaultValue={v("lawfulBasis")} className="input"><option value="">Non renseignée (aucune relance possible)</option>{Object.entries(BASIS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <div><label className="label" htmlFor="basisNote">Preuve / contexte</label><input id="basisNote" name="basisNote" defaultValue={v("basisNote")} className="input" placeholder="Ex. : appel du 3 mai, formulaire du site" /></div>
      <div className="sm:col-span-2"><SubmitButton>{submitLabel}</SubmitButton></div>
    </form>
  );
}
