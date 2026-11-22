"use client";
import { useActionState } from "react";
import { submitContact, type ContactState } from "../actions";

export function ContactForm({ kind }: { kind: "contact" | "demo" | "support" }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(submitContact, {});
  if (state.ok) return <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">Merci, votre message a bien été enregistré. Nous vous répondons par e-mail.</div>;
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <input type="hidden" name="kind" value={kind} />
      <div className="hidden" aria-hidden><label>Site web<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <div><label className="label" htmlFor="c-name">Nom</label><input id="c-name" name="name" className="input" required autoComplete="name" /></div>
      <div><label className="label" htmlFor="c-email">E-mail professionnel</label><input id="c-email" name="email" type="email" className="input" required autoComplete="email" /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="c-company">Entreprise</label><input id="c-company" name="company" className="input" autoComplete="organization" /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="c-message">{kind === "demo" ? "Votre activité et vos besoins" : "Message"}</label><textarea id="c-message" name="message" className="input min-h-32" required /></div>
      {state.error && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{state.error}</p>}
      <p className="muted text-xs sm:col-span-2">Vos coordonnées servent uniquement à vous répondre. Voir la <a className="underline" href="/confidentialite">politique de confidentialité</a>.</p>
      <div className="sm:col-span-2"><button className="btn btn-primary" disabled={pending}>{pending ? "Envoi…" : kind === "demo" ? "Demander une démonstration" : "Envoyer"}</button></div>
    </form>
  );
}
