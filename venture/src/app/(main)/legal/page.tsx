import type { Metadata } from "next";
import { Page, PageHeader } from "@/components/layout/page";
import { Notice } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Confidentialité et conditions" };

export default function LegalPage() {
  return (
    <Page>
      <PageHeader title="Confidentialité et conditions d'utilisation" />
      <Notice tone="warning" className="mb-6" title="Document provisoire">Ce texte décrit le fonctionnement réel de VENTURE mais n'a pas encore été validé par un juriste. Il ne constitue pas une garantie de conformité réglementaire.</Notice>
      <div className="space-y-6 text-[15px] leading-relaxed text-fg/90 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold">
        <section><h2>Accès</h2><p>VENTURE est réservé aux personnes majeures (18 ans et plus). La date de naissance demandée à l'inscription sert uniquement à ce contrôle et n'est jamais affichée.</p></section>
        <section><h2>Données collectées</h2><p>Compte (email, mot de passe chiffré), profil (nom ou pseudonyme, biographie, compétences, intérêts, ambitions, ville facultative), contenus publiés (projets, commentaires, messages, documents), et usage de VENTURE AI (nombre de crédits consommés).</p></section>
        <section><h2>Localisation</h2><p>VENTURE ne demande jamais ta position GPS. Si tu l'autorises, seul le centre approximatif de ta ville est utilisé pour « À proximité » et le matching ; il n'est jamais affiché aux autres membres.</p></section>
        <section><h2>Visibilité et contrôle</h2><p>Tu choisis si ton profil est public ou réservé aux membres, si tu apparais dans les recommandations et si les projets que tu as rejoints sont visibles. Les messages ne sont accessibles qu'aux participants de la conversation ; les documents d'un projet uniquement à son équipe.</p></section>
        <section><h2>Intelligence artificielle</h2><p>Lorsque tu utilises VENTURE AI, les informations nécessaires (ton idée ou les données du projet) sont transmises au fournisseur d'IA configuré pour générer une proposition. VENTURE AI ne publie, n'envoie et ne paie rien à ta place.</p></section>
        <section><h2>Entreprises et publicité</h2><p>Les données personnelles des membres ne sont jamais vendues. Les entreprises n'accèdent qu'à des statistiques agrégées et anonymes. Tout contenu sponsorisé est signalé.</p></section>
        <section><h2>Événements</h2><p>Manifester son intérêt pour un événement proposé ne constitue ni un achat ni une réservation.</p></section>
        <section><h2>Tes droits</h2><p>Depuis Paramètres → Mes données, tu peux exporter l'ensemble de tes données (JSON) et supprimer définitivement ton compte.</p></section>
        <section><h2>Modération</h2><p>Chaque contenu et profil peut être signalé. L'équipe de modération peut masquer des contenus et suspendre des comptes. Tu peux bloquer un membre à tout moment.</p></section>
      </div>
    </Page>
  );
}
