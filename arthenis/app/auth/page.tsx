"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import { useSession } from "@/components/session";
import { Field, Spinner, errorMessage, useToast } from "@/components/ui";
import { getRepository } from "@/lib/data";

function AuthForm() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { mode: storage, refresh } = useSession();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const next = params.get("next") || "/worlds";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("Adresse e-mail invalide.");
    if (mode !== "reset" && password.length < 8) return setError("Le mot de passe doit contenir au moins 8 caractères.");
    setBusy(true);
    try {
      const repo = getRepository();
      if (mode === "signup") {
        const r = await repo.signUp(email, password, name);
        if (r.needsConfirmation) { setInfo("Compte créé. Confirmez votre adresse via l'e-mail reçu, puis connectez-vous."); setMode("signin"); return; }
        toast("Bienvenue dans Arthenis.", "success");
      } else if (mode === "signin") {
        await repo.signIn(email, password);
      } else {
        await repo.resetPassword(email);
        setInfo("Si un compte existe, un lien de réinitialisation a été envoyé.");
        return;
      }
      await refresh();
      router.replace(next.startsWith("/") ? next : "/worlds");
    } catch (err) {
      setError(errorMessage(err));
    } finally { setBusy(false); }
  }

  return (
    <main className="page" style={{ maxWidth: 480 }}>
      <form className="panel stack" onSubmit={submit} noValidate>
        <div className="stack tight" style={{ textAlign: "center" }}>
          <span className="slogan">Where worlds are born</span>
          <h2>{mode === "signup" ? "Créer un compte" : mode === "signin" ? "Connexion" : "Mot de passe oublié"}</h2>
        </div>
        {storage === "local" && <div className="notice warning small">Mode local : Supabase n&apos;est pas configuré. Votre compte et vos mondes sont stockés dans ce navigateur uniquement.</div>}
        {mode === "signup" && <Field label="Nom de créateur"><input value={name} onChange={e => setName(e.target.value)} placeholder="Ex. Keziah" autoComplete="nickname" maxLength={60} /></Field>}
        <Field label="E-mail"><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></Field>
        {mode !== "reset" && <Field label="Mot de passe" hint={mode === "signup" ? "8 caractères minimum." : undefined}><input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} required /></Field>}
        {error && <div className="notice conflict small" role="alert">{error}</div>}
        {info && <div className="notice valid small">{info}</div>}
        <button className="btn primary lg" disabled={busy} type="submit">{busy ? <Spinner /> : mode === "signup" ? "Créer mon compte" : mode === "signin" ? "Entrer" : "Envoyer le lien"}</button>
        <div className="row between small">
          {mode !== "signup" ? <button type="button" className="btn ghost sm" onClick={() => setMode("signup")}>Créer un compte</button> : <button type="button" className="btn ghost sm" onClick={() => setMode("signin")}>J&apos;ai un compte</button>}
          {mode === "signin" && <button type="button" className="btn ghost sm" onClick={() => setMode("reset")}>Mot de passe oublié</button>}
          {mode === "reset" && <button type="button" className="btn ghost sm" onClick={() => setMode("signin")}>Retour</button>}
        </div>
      </form>
    </main>
  );
}

export default function AuthPage() {
  return <><TopBar /><Suspense><AuthForm /></Suspense></>;
}
