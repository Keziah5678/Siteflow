import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PricingCards, Section } from "@/components/marketing";
import { SECTORS } from "@/lib/content";

export function generateStaticParams() { return SECTORS.map(s => ({ slug: s.slug })); }

export async function generateMetadata({ params }: PageProps<"/secteurs/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const s = SECTORS.find(x => x.slug === slug);
  return s ? { title: s.title, description: s.intro } : {};
}

export default async function Page({ params }: PageProps<"/secteurs/[slug]">) {
  const { slug } = await params;
  const s = SECTORS.find(x => x.slug === slug);
  if (!s) notFound();
  return (
    <>
      <section className="mx-auto max-w-4xl px-4 pt-16 text-center">
        <span className="badge badge-blue">{s.name}</span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">{s.title}</h1>
        <p className="muted mx-auto mt-5 max-w-2xl text-lg leading-relaxed">{s.intro}</p>
        <div className="mt-8 flex justify-center gap-3"><Link href="/signup" className="btn btn-primary btn-lg">Essai gratuit 7 jours</Link><Link href="/demo" className="btn btn-lg">Démonstration</Link></div>
      </section>
      <Section title="Les situations que RelancePro vous aide à traiter">
        <div className="grid gap-5 md:grid-cols-3">{s.situations.map(x => <div key={x} className="card p-6 text-sm">{x}</div>)}</div>
      </Section>
      <Section title="Exemple de relance préparée" intro="Illustration : le message est construit à partir de la demande et du devis enregistrés, sans ajout d'informations.">
        <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
          <div className="card p-6"><p className="muted text-xs font-semibold uppercase tracking-wider">Demande enregistrée</p><p className="mt-2">{s.example.need}</p></div>
          <div className="card p-6"><p className="text-xs font-semibold uppercase tracking-wider text-brand-500">Relance proposée</p><pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed">{s.example.followUp}</pre></div>
        </div>
      </Section>
      <Section title="Nos conseils">
        <ul className="mx-auto max-w-3xl space-y-3">{s.tips.map(t => <li key={t} className="card flex gap-3 p-4 text-sm"><span className="text-brand-500" aria-hidden>✓</span>{t}</li>)}</ul>
      </Section>
      <Section title="Tarifs"><PricingCards /></Section>
    </>
  );
}
