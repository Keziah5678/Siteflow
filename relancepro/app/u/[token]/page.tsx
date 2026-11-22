import type { Metadata } from "next";
import { parseUnsubscribeToken } from "@/lib/app/inbound";
import { system } from "@/lib/db";
import { Logo } from "@/components/ui";

export const metadata: Metadata = { title: "Se désinscrire", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: PageProps<"/u/[token]">) {
  const { token } = await params;
  const sp = await searchParams;
  const t = parseUnsubscribeToken(token);
  const org = t ? (await system()`select name from rp.organizations where id = ${t.orgId}`)[0] : null;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
      <div className="card p-7 text-center">
        <div className="mb-4 flex justify-center"><Logo /></div>
        {!t || !org ? <><h1 className="text-xl font-bold">Lien invalide</h1><p className="muted mt-2 text-sm">Ce lien de désinscription n&apos;est pas reconnu. Répondez directement à l&apos;e-mail reçu en demandant à ne plus être contacté(e).</p></>
          : sp.done ? <><h1 className="text-xl font-bold">C&apos;est noté</h1><p className="muted mt-2 text-sm">Vous ne recevrez plus de relances de {org.name as string}. Votre demande est enregistrée de façon définitive.</p></>
          : <>
            <h1 className="text-xl font-bold">Ne plus être contacté(e)</h1>
            <p className="muted mt-2 text-sm">Confirmez que vous ne souhaitez plus recevoir de messages de <strong>{org.name as string}</strong>.</p>
            <form action={`/api/unsubscribe/${token}`} method="POST" className="mt-6"><button className="btn btn-primary w-full">Confirmer ma désinscription</button></form>
          </>}
        <p className="muted mt-6 text-xs">Service de relance opéré par RelancePro pour le compte de l&apos;entreprise.</p>
      </div>
    </main>
  );
}
