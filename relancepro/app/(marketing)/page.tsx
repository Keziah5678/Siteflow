import Link from "next/link";
import { DashboardPreview, Faq, PricingCards, Section, TrialNote } from "@/components/marketing";
import { FEATURES, SECTORS, STEPS } from "@/lib/content";
import { ContactForm } from "./contact/form";

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-40 h-[560px] bg-[radial-gradient(ellipse_at_top,#2f6bff33,transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top,#6d28d955,transparent_60%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-10 pt-16 lg:grid-cols-2 lg:pt-24">
          <div className="animate-float-up">
            <span className="badge badge-violet">RelancePro AI · conçu pour les PME françaises</span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[56px]">Ne perdez plus vos prospects. <span className="gradient-text">RelancePro les transforme en opportunités.</span></h1>
            <p className="muted mt-6 max-w-xl text-lg leading-relaxed">Votre assistant commercial intelligent détecte les demandes oubliées, prépare vos relances et vous aide à convertir davantage de prospects.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn btn-primary btn-lg">Démarrer l&apos;essai gratuit</Link>
              <Link href="/demo" className="btn btn-lg">Voir la démonstration</Link>
            </div>
            <p className="muted mt-4 text-sm">7 jours gratuits · sans carte bancaire · envoi automatique désactivé par défaut</p>
          </div>
          <div className="animate-float-up [animation-delay:150ms]"><DashboardPreview /></div>
        </div>
      </section>

      <Section eyebrow="Le problème" title="Une demande sans réponse est une vente qui part ailleurs" intro="Un garage, un artisan, une agence reçoit des dizaines de demandes chaque mois. Entre les chantiers, les rendez-vous et le téléphone, certaines restent sans suite, des devis ne sont jamais relancés. RelancePro sert à ce que ces opportunités ne se perdent plus.">
        <div className="grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="card p-6"><div className="gradient-bg flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white">{i + 1}</div><h3 className="mt-4 font-semibold">{s.title}</h3><p className="muted mt-2 text-sm leading-relaxed">{s.text}</p></div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Fonctionnalités" title="Tout ce qu'il faut pour relancer, rien de superflu">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.slice(0, 6).map(f => <div key={f.title} className="card p-6"><div className="text-2xl text-brand-500" aria-hidden>{f.icon}</div><h3 className="mt-3 font-semibold">{f.title}</h3><p className="muted mt-2 text-sm leading-relaxed">{f.text}</p></div>)}
        </div>
        <p className="mt-8 text-center"><Link href="/fonctionnalites" className="btn">Toutes les fonctionnalités</Link></p>
      </Section>

      <Section eyebrow="Confiance" title="Vous gardez la main, toujours">
        <div className="grid gap-5 md:grid-cols-3">
          {[["Validation humaine par défaut", "Aucun message ne part sans votre accord, sauf sur les séquences que vous avez explicitement automatisées."], ["Aucune invention", "Prix, délais, remises, liens : tout ce qui n'est pas dans vos données bloque le message pour relecture."], ["Respect des oppositions", "Désinscription en un clic dans chaque e-mail, opposition définitive, plafond de fréquence, arrêt d'urgence."]].map(([t, d]) => (
            <div key={t} className="card p-6"><h3 className="font-semibold">{t}</h3><p className="muted mt-2 text-sm leading-relaxed">{d}</p></div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Métiers" title="Pensé pour les entreprises qui vivent de leurs demandes de devis">
        <div className="flex flex-wrap justify-center gap-2">{SECTORS.map(s => <Link key={s.slug} href={`/secteurs/${s.slug}`} className="btn">{s.name}</Link>)}</div>
      </Section>

      <Section id="tarifs" eyebrow="Tarifs" title="Une formule simple, sans engagement">
        <PricingCards />
        <TrialNote />
      </Section>

      <Section eyebrow="FAQ" title="Questions fréquentes"><Faq /></Section>

      <Section eyebrow="Contact" title="Une question avant de commencer ?" intro="Écrivez-nous : nous répondons personnellement, en général sous un jour ouvré.">
        <div className="mx-auto max-w-2xl card p-6"><ContactForm kind="contact" /></div>
      </Section>

      <section className="mx-auto max-w-6xl px-4 pt-24">
        <div className="gradient-bg rounded-3xl px-6 py-14 text-center text-white">
          <h2 className="text-3xl font-bold">Vos prochaines ventes sont peut-être déjà dans votre boîte de réception.</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/80">Importez vos demandes en cours et voyez en quelques minutes celles qui attendent une réponse.</p>
          <Link href="/signup" className="btn btn-lg mt-8 border-transparent bg-white text-anthracite hover:bg-white/90">Commencer gratuitement</Link>
        </div>
      </section>
    </>
  );
}
