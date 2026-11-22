import type { Metadata } from "next";

export const metadata: Metadata = { title: "Conditions générales", description: "Conditions générales d'utilisation et de vente de RelancePro." };

export default function Page() {
  return (
    <article className="mx-auto max-w-3xl px-4 pt-16">
      <h1 className="text-3xl font-bold tracking-tight">Conditions générales</h1>
      <p className="muted mt-2 text-sm">Dernière mise à jour : [date]</p>
      <div className="mt-6"><div className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"><strong>Projet de document, à faire valider par un professionnel du droit avant la commercialisation.</strong> Les éléments entre crochets doivent être complétés.</div></div>
      <div className="prose-rp">
        <h2>Objet</h2><p>Les présentes conditions régissent l&apos;accès au logiciel RelancePro, proposé aux professionnels sous forme d&apos;abonnement.</p>
        <h2>Essai et abonnement</h2><p>Un essai gratuit de 7 jours, limité en volume, est proposé sans moyen de paiement. L&apos;abonnement est mensuel, sans engagement, payable d&apos;avance par carte via Stripe. Prix hors taxes : Starter 79 €, Pro 149 €, Business 299 € par mois. Les prix peuvent évoluer avec un préavis de [30] jours.</p>
        <h2>Résiliation</h2><p>Le client résilie à tout moment depuis le portail de facturation ; l&apos;accès est maintenu jusqu&apos;à la fin de la période payée. En cas d&apos;impayé persistant, l&apos;accès peut être suspendu.</p>
        <h2>Obligations du client</h2><ul><li>Disposer d&apos;une base légale pour chaque prospect enregistré et respecter les oppositions.</li><li>Ne pas utiliser RelancePro pour des campagnes non sollicitées, de l&apos;achat de fichiers ou des envois de masse.</li><li>Relire les messages qu&apos;il valide : il reste l&apos;auteur et le responsable des messages envoyés depuis sa messagerie.</li></ul>
        <h2>Intelligence artificielle</h2><p>Les contenus proposés par RelancePro AI sont des suggestions. RelancePro met en œuvre des garde-fous mais ne garantit pas l&apos;absence d&apos;erreur.</p>
        <h2>Disponibilité et responsabilité</h2><p>RelancePro s&apos;efforce d&apos;assurer la disponibilité du service sans garantie de résultat commercial. Responsabilité limitée à [montant des sommes versées sur les 12 derniers mois].</p>
        <h2>Données</h2><p>Accord de sous-traitance (article 28 RGPD) : [lien]. Le client peut exporter ses données à tout moment.</p>
        <h2>Droit applicable</h2><p>Droit français. Tribunaux compétents : [ville].</p>
      </div>
    </article>
  );
}
