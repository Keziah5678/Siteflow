import Link from "next/link";
import type { Metadata } from "next";
import { verifyEmailAction } from "../actions";
import { ResendForm } from "../forms";
import { currentUser } from "@/lib/auth/session";
import { env } from "@/lib/server/env";

export const metadata: Metadata = { title: "Vérification de l'e-mail" };

export default async function Page({ searchParams }: PageProps<"/verify-email">) {
  const sp = await searchParams;
  if (typeof sp.token === "string") {
    const ok = await verifyEmailAction(sp.token);
    return (
      <div className="card p-7 text-center">
        <h1 className="text-2xl font-bold">{ok ? "Adresse confirmée" : "Lien invalide ou expiré"}</h1>
        <p className="muted mt-2 text-sm">{ok ? "Votre espace est prêt." : "Connectez-vous pour recevoir un nouveau lien."}</p>
        <Link href={ok ? "/app" : "/login"} className="btn btn-primary mt-6">{ok ? "Ouvrir RelancePro" : "Se connecter"}</Link>
      </div>
    );
  }
  const user = await currentUser();
  return (
    <div className="card p-7">
      <h1 className="text-2xl font-bold">Confirmez votre adresse</h1>
      <p className="muted mt-2 text-sm">Nous avons envoyé un lien de confirmation{user ? <> à <strong>{user.email}</strong></> : ""}. Cliquez dessus pour activer votre espace.</p>
      {user && !user.emailVerified && <div className="mt-6"><ResendForm /></div>}
      {env.devTools && <p className="muted mt-6 text-xs">Développement : les e-mails sont visibles dans <Link href="/dev/outbox" className="underline">la boîte locale</Link>.</p>}
    </div>
  );
}
