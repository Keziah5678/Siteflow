"use client";
import Link from "next/link";
import { useActionState } from "react";
import { forgotAction, loginAction, resendVerificationAction, resetAction, signupAction, type FormState } from "./actions";
import { ReferralInput } from "@/components/client";

const Err = ({ s }: { s: FormState }) => (s.error ? <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{s.error}</p> : s.ok ? <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{s.ok}</p> : null);

const SECTORS = [["garage", "Garage automobile"], ["artisan", "Artisan"], ["batiment", "Bâtiment"], ["immobilier", "Agence immobilière"], ["services", "Société de services"], ["nettoyage", "Nettoyage"], ["b2b", "Prestataire B2B"], ["autre", "Autre"]];

export function SignupForm() {
  const [s, action, pending] = useActionState<FormState, FormData>(signupAction, {});
  return (
    <form action={action} className="space-y-4">
      <ReferralInput />
      <div><label className="label" htmlFor="name">Votre nom</label><input id="name" name="name" className="input" required autoComplete="name" /></div>
      <div><label className="label" htmlFor="company">Entreprise</label><input id="company" name="company" className="input" required autoComplete="organization" /></div>
      <div><label className="label" htmlFor="sector">Secteur</label><select id="sector" name="sector" className="input">{SECTORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      <div><label className="label" htmlFor="email">E-mail professionnel</label><input id="email" name="email" type="email" className="input" required autoComplete="email" /></div>
      <div><label className="label" htmlFor="password">Mot de passe</label><input id="password" name="password" type="password" className="input" required minLength={10} autoComplete="new-password" /><p className="hint">10 caractères minimum.</p></div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="acceptTerms" required className="mt-1" /><span>J&apos;accepte les <Link href="/conditions" className="underline">conditions générales</Link> et la <Link href="/confidentialite" className="underline">politique de confidentialité</Link>.</span></label>
      <Err s={s} />
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Création…" : "Créer mon espace — 7 jours gratuits"}</button>
    </form>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [s, action, pending] = useActionState<FormState, FormData>(loginAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/app"} />
      <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" className="input" required autoComplete="email" /></div>
      <div><label className="label" htmlFor="password">Mot de passe</label><input id="password" name="password" type="password" className="input" required autoComplete="current-password" /></div>
      <Err s={s} />
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Connexion…" : "Se connecter"}</button>
      <p className="text-center text-sm"><Link href="/forgot-password" className="muted underline">Mot de passe oublié ?</Link></p>
    </form>
  );
}

export function ForgotForm() {
  const [s, action, pending] = useActionState<FormState, FormData>(forgotAction, {});
  return (
    <form action={action} className="space-y-4">
      <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" className="input" required /></div>
      <Err s={s} />
      <button className="btn btn-primary w-full" disabled={pending}>Recevoir un lien</button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [s, action, pending] = useActionState<FormState, FormData>(resetAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div><label className="label" htmlFor="password">Nouveau mot de passe</label><input id="password" name="password" type="password" className="input" required minLength={10} autoComplete="new-password" /></div>
      <Err s={s} />
      <button className="btn btn-primary w-full" disabled={pending}>Enregistrer</button>
    </form>
  );
}

export function ResendForm() {
  const [s, action, pending] = useActionState<FormState, FormData>(resendVerificationAction, {});
  return <form action={action} className="space-y-3"><Err s={s} /><button className="btn" disabled={pending}>Renvoyer l&apos;e-mail</button></form>;
}
