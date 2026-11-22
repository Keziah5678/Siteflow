import Link from "next/link";
import type { Metadata } from "next";
import { SignupForm } from "../forms";

export const metadata: Metadata = { title: "Créer un compte" };

export default function Page() {
  return (
    <div className="card p-7">
      <h1 className="text-2xl font-bold">Créez votre espace</h1>
      <p className="muted mt-1 text-sm">7 jours gratuits, sans carte bancaire. Vous pourrez inviter votre équipe ensuite.</p>
      <div className="mt-6"><SignupForm /></div>
      <p className="muted mt-6 text-center text-sm">Déjà inscrit ? <Link href="/login" className="font-semibold text-brand-600 dark:text-brand-400">Se connecter</Link></p>
    </div>
  );
}
