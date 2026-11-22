import type { Metadata } from "next";
import { ResetForm } from "../forms";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function Page({ searchParams }: PageProps<"/reset-password">) {
  const sp = await searchParams;
  return <div className="card p-7"><h1 className="text-2xl font-bold">Nouveau mot de passe</h1><p className="muted mt-1 text-sm">Toutes vos sessions seront déconnectées.</p><div className="mt-6"><ResetForm token={typeof sp.token === "string" ? sp.token : ""} /></div></div>;
}
