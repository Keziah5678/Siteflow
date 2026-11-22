import Link from "next/link";
import type { Metadata } from "next";
import { Faq, Section } from "@/components/marketing";
import { ARTICLES } from "@/lib/content";
import { ContactForm } from "../contact/form";

export const metadata: Metadata = { title: "Centre d'aide", description: "Guides RelancePro : démarrage, messagerie SMTP, import CSV, conformité RGPD, séquences, facturation." };

export default function Page() {
  const cats = [...new Set(ARTICLES.map(a => a.category))];
  return (
    <>
      <Section eyebrow="Centre d'aide" title="Comment pouvons-nous vous aider ?">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {cats.map(c => (
            <div key={c} className="card p-6">
              <h2 className="font-semibold">{c}</h2>
              <ul className="mt-3 space-y-2 text-sm">{ARTICLES.filter(a => a.category === c).map(a => <li key={a.slug}><Link href={`/aide/${a.slug}`} className="text-brand-600 hover:underline dark:text-brand-400">{a.title}</Link></li>)}</ul>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Questions fréquentes"><Faq /></Section>
      <Section title="Contacter le support" intro="Clients : vous pouvez aussi écrire depuis votre espace, la demande sera liée à votre entreprise.">
        <div className="mx-auto max-w-2xl card p-6"><ContactForm kind="support" /></div>
      </Section>
    </>
  );
}
