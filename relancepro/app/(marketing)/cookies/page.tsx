import type { Metadata } from "next";

export const metadata: Metadata = { title: "Cookies", description: "Utilisation des cookies sur RelancePro." };

export default function Page() {
  return (
    <article className="mx-auto max-w-3xl px-4 pt-16">
      <h1 className="text-3xl font-bold tracking-tight">Cookies</h1>
      <p className="muted mt-2 text-sm">Dernière mise à jour : [date]</p>
      <div className="mt-6"><div className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"><strong>Projet de document, à faire valider par un professionnel du droit avant la commercialisation.</strong> Les éléments entre crochets doivent être complétés.</div></div>
      <div className="prose-rp">
        <h2>Ce que nous utilisons</h2>
        <ul><li><strong>rp_session</strong> : cookie strictement nécessaire à la connexion à votre espace (30 jours, httpOnly).</li><li><strong>rp_org</strong> : mémorise l&apos;entreprise active si vous en avez plusieurs.</li><li><strong>Préférence de thème</strong> : stockée dans votre navigateur (localStorage), jamais transmise.</li></ul>
        <h2>Ce que nous n&apos;utilisons pas</h2><p>Aucun cookie publicitaire, aucun traceur tiers, aucun outil d&apos;analyse externe. La mesure d&apos;audience est interne, sans cookie et sans donnée personnelle. C&apos;est pourquoi aucun bandeau de consentement n&apos;est affiché ; si des traceurs soumis à consentement étaient ajoutés, un bandeau conforme serait mis en place au préalable.</p>
      </div>
    </article>
  );
}
