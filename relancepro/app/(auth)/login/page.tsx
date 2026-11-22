import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "../forms";

export const metadata: Metadata = { title: "Connexion" };

export default async function Page({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  return (
    <div className="card p-7">
      <h1 className="text-2xl font-bold">Connexion</h1>
      <p className="muted mt-1 text-sm">Accédez à votre espace RelancePro.</p>
      {sp.reset && <p className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Mot de passe modifié. Connectez-vous.</p>}
      <div className="mt-6"><LoginForm next={typeof sp.next === "string" ? sp.next : undefined} /></div>
      <p className="muted mt-6 text-center text-sm">Pas encore de compte ? <Link href="/signup" className="font-semibold text-brand-600 dark:text-brand-400">Essai gratuit</Link></p>
    </div>
  );
}
