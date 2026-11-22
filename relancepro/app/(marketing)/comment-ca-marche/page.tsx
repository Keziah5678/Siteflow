import Link from "next/link";
import type { Metadata } from "next";
import { Section } from "@/components/marketing";

export const metadata: Metadata = { title: "Comment ça marche", description: "De la demande reçue à la relance envoyée : le fonctionnement de RelancePro étape par étape." };

const FLOW = [
  ["Jour 0", "La demande arrive", "Par le formulaire de votre site, un import CSV ou une saisie après un appel. RelancePro AI en extrait le besoin, repère l'urgence et enregistre la base légale."],
  ["Jour 1", "Alerte", "Toujours pas de réponse ? Le prospect passe « À relancer » et remonte dans votre tableau de bord."],
  ["Jour 3", "Première relance", "Un message personnalisé est prêt, rédigé uniquement à partir de vos informations. Vous le relisez et l'envoyez — ou une séquence autorisée l'envoie pour vous."],
  ["Jour 7", "Seconde relance", "Si c'est approprié et dans la limite du plafond de fréquence. Toute réponse du prospect arrête la séquence."],
  ["Jour 14", "Clôture ou décision", "La séquence se termine. Vous décidez : clôturer, reprendre contact, ou passer à autre chose."]
];

export default function Page() {
  return (
    <Section eyebrow="Comment ça marche" title="Une méthode simple, appliquée avec régularité" intro="Les délais ci-dessous sont des exemples : vous les adaptez à votre métier.">
      <ol className="relative mx-auto max-w-3xl space-y-6 border-l-2 border-brand-500/30 pl-8">
        {FLOW.map(([day, title, text]) => (
          <li key={day} className="relative">
            <span className="gradient-bg absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-[var(--bg)]" aria-hidden />
            <p className="text-sm font-semibold text-brand-500">{day}</p>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="muted mt-1 text-sm leading-relaxed">{text}</p>
          </li>
        ))}
      </ol>
      <div className="mx-auto mt-12 grid max-w-3xl gap-5 sm:grid-cols-2">
        <div className="card p-6"><h2 className="font-semibold">Mode assisté (par défaut)</h2><p className="muted mt-2 text-sm">Chaque relance attend votre validation. Idéal pour démarrer et garder le contrôle du ton.</p></div>
        <div className="card p-6"><h2 className="font-semibold">Mode automatique (Pro, Business)</h2><p className="muted mt-2 text-sm">Activé séquence par séquence. Un message part seul seulement si toutes les règles sont respectées et qu&apos;aucun signal d&apos;alerte n&apos;a été relevé.</p></div>
      </div>
      <p className="mt-10 text-center"><Link href="/demo" className="btn btn-primary btn-lg">Essayer la démonstration</Link></p>
    </Section>
  );
}
