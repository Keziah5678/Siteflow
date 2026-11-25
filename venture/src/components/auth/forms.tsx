"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Field, Input, Checkbox } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/primitives";
import { resendConfirmationAction, resetPasswordAction, signInAction, signUpAction, updatePasswordAction } from "@/lib/actions/auth";

export function LoginForm({ next, linkError }: { next: string; linkError?: boolean }) {
  const [state, action] = useActionState(signInAction, null);
  const [resend, resendAction] = useActionState(resendConfirmationAction, null);
  const [email, setEmail] = useState("");
  return (
    <div className="space-y-4">
      {linkError && <Notice tone="warning" title="Lien invalide ou expiré">Connecte-toi ou demande un nouveau lien.</Notice>}
      <form action={action} className="space-y-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <Field label="Email" htmlFor="email" error={state?.fields?.email}>
          <Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!state?.fields?.email} />
        </Field>
        <Field label="Mot de passe" htmlFor="password" error={state?.fields?.password}>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        {state?.error && <Notice tone="danger">{state.error}</Notice>}
        <SubmitButton className="w-full" size="lg" pendingLabel="Connexion…">
          Se connecter
        </SubmitButton>
      </form>
      {state?.data?.unconfirmed === true && (
        <form action={resendAction} className="space-y-2">
          <input type="hidden" name="email" value={email} />
          <SubmitButton variant="secondary" className="w-full">Renvoyer l'email de confirmation</SubmitButton>
          {resend?.message && <p className="text-center text-[13px] text-muted">{resend.message}</p>}
        </form>
      )}
      <div className="flex justify-between text-[13px] text-muted">
        <Link href="/reset-password" className="hover:text-fg">Mot de passe oublié ?</Link>
        <Link href={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-primary-2 hover:underline">Créer un compte</Link>
      </div>
    </div>
  );
}

export function SignupForm() {
  const [state, action] = useActionState(signUpAction, null);
  if (state?.ok) {
    return (
      <div className="animate-rise rounded-2xl border border-border bg-card p-6 text-center">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-success-soft text-success">
          <MailCheck className="size-6" />
        </div>
        <h2 className="text-lg font-semibold">Vérifie ta boîte mail</h2>
        <p className="mt-2 text-sm text-muted">{state.message}</p>
      </div>
    );
  }
  const f = state?.fields ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="Nom ou pseudonyme" htmlFor="display_name" error={f.display_name}>
        <Input id="display_name" name="display_name" autoComplete="nickname" maxLength={60} required aria-invalid={!!f.display_name} />
      </Field>
      <Field label="Email" htmlFor="email" error={f.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!f.email} />
      </Field>
      <Field label="Mot de passe" htmlFor="password" error={f.password} hint="10 caractères minimum, avec majuscules, minuscules et chiffres.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required aria-invalid={!!f.password} />
      </Field>
      <Field label="Date de naissance" htmlFor="birthdate" error={f.birthdate} hint="VENTURE est réservé aux personnes majeures. Cette date n'est jamais affichée.">
        <Input id="birthdate" name="birthdate" type="date" required aria-invalid={!!f.birthdate} />
      </Field>
      {/* Honeypot (hidden from humans and assistive tech) */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Site web</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <Checkbox name="terms" label="J'accepte les conditions d'utilisation et la politique de confidentialité" description="Tes données ne sont jamais vendues. Tu peux les exporter ou supprimer ton compte à tout moment." />
      {f.terms && <p className="text-[12px] text-danger">{f.terms}</p>}
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      <SubmitButton className="w-full" size="lg" pendingLabel="Création…">
        Créer mon compte
      </SubmitButton>
      <p className="text-center text-[13px] text-muted">
        Déjà inscrit ? <Link href="/login" className="text-primary-2 hover:underline">Se connecter</Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(resetPasswordAction, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="Email" htmlFor="email" error={state?.fields?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      {state?.ok && <Notice tone="success">{state.message}</Notice>}
      <SubmitButton className="w-full" size="lg" pendingLabel="Envoi…">
        Envoyer le lien
      </SubmitButton>
      <p className="text-center text-[13px] text-muted">
        <Link href="/login" className="hover:text-fg">Retour à la connexion</Link>
      </p>
    </form>
  );
}

export function UpdatePasswordForm() {
  const [state, action] = useActionState(updatePasswordAction, null);
  if (state?.ok)
    return (
      <Notice tone="success" title="Mot de passe mis à jour">
        <Link href="/" className="text-primary-2 hover:underline">Continuer vers VENTURE</Link>
      </Notice>
    );
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="Nouveau mot de passe" htmlFor="password" error={state?.fields?.password} hint="10 caractères minimum, avec majuscules, minuscules et chiffres.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirmation" htmlFor="confirm" error={state?.fields?.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      <SubmitButton className="w-full" size="lg">Mettre à jour</SubmitButton>
    </form>
  );
}
