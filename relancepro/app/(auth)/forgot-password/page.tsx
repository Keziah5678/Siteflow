import type { Metadata } from "next";
import { ForgotForm } from "../forms";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function Page() {
  return <div className="card p-7"><h1 className="text-2xl font-bold">Mot de passe oublié</h1><p className="muted mt-1 text-sm">Recevez un lien de réinitialisation valable une heure.</p><div className="mt-6"><ForgotForm /></div></div>;
}
