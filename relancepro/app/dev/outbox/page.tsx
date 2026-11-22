import { notFound } from "next/navigation";
import { system } from "@/lib/db";
import { env } from "@/lib/server/env";
import { dateFr } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Development only: platform e-mails that were not sent because no SMTP is configured. */
export default async function Outbox() {
  if (!env.devTools) notFound();
  const mails = await system()`select id, to_email, subject, text_body, status, kind, created_at from rp.outbox_emails order by id desc limit 50`;
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Boîte locale (développement)</h1>
      <p className="muted mt-1 text-sm">E-mails de la plateforme. Indisponible en production.</p>
      <div className="mt-6 space-y-3">{mails.map(m => (
        <article key={m.id as string} className="card p-4" data-testid="outbox-mail">
          <div className="flex justify-between text-xs"><span className="font-semibold">{m.toEmail as string} · {m.kind as string}</span><span className="muted">{m.status as string} · {dateFr(m.createdAt as Date, true)}</span></div>
          <h2 className="mt-1 font-semibold">{m.subject as string}</h2>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm">{m.textBody as string}</pre>
        </article>
      ))}</div>
    </main>
  );
}
