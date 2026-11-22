import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mentions légales", description: "Mentions légales de RelancePro." };

export default function Page() {
  return (
    <article className="mx-auto max-w-3xl px-4 pt-16">
      <h1 className="text-3xl font-bold tracking-tight">Mentions légales</h1>
      <p className="muted mt-2 text-sm">Dernière mise à jour : [date]</p>
      <div className="mt-6"><div className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"><strong>Projet de document, à faire valider par un professionnel du droit avant la commercialisation.</strong> Les éléments entre crochets doivent être complétés.</div></div>
      <div className="prose-rp">
        <h2>Éditeur</h2><p>[Raison sociale], [forme juridique] au capital de [montant] €, immatriculée au RCS de [ville] sous le numéro [SIREN], siège social : [adresse]. TVA intracommunautaire : [numéro]. Directeur de la publication : [nom]. Contact : [adresse e-mail].</p>
        <h2>Hébergement</h2><p>Application : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis. Base de données : Supabase Inc. — région d&apos;hébergement : [région UE choisie lors de la création du projet].</p>
        <h2>Propriété intellectuelle</h2><p>Les contenus, marques et logiciels de RelancePro sont protégés. Toute reproduction non autorisée est interdite.</p>
      </div>
    </article>
  );
}
