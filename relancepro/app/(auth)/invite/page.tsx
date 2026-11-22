import Link from "next/link";
import type { Metadata } from "next";
import { acceptInviteAction } from "../actions";
import { currentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Invitation" };

export default async function Page({ searchParams }: PageProps<"/invite">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const user = await currentUser();
  return (
    <div className="card p-7">
      <h1 className="text-2xl font-bold">Rejoindre une équipe</h1>
      {user ? (
        <form action={acceptInviteAction} className="mt-6 space-y-4">
          <input type="hidden" name="token" value={token} />
          <p className="muted text-sm">Connecté en tant que <strong>{user.email}</strong>. L&apos;invitation doit avoir été envoyée à cette adresse.</p>
          <button className="btn btn-primary w-full">Accepter l&apos;invitation</button>
        </form>
      ) : (
        <div className="mt-6 space-y-3 text-sm">
          <p className="muted">Connectez-vous, ou créez un compte avec l&apos;adresse qui a reçu l&apos;invitation, puis revenez sur ce lien.</p>
          <div className="flex gap-2"><Link className="btn btn-primary" href={`/login?next=${encodeURIComponent(`/invite?token=${token}`)}`}>Se connecter</Link><Link className="btn" href="/signup">Créer un compte</Link></div>
        </div>
      )}
    </div>
  );
}
