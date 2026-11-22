import type { Metadata } from "next";

export const metadata: Metadata = { title: "Politique de confidentialité", description: "Comment RelancePro traite les données personnelles." };

export default function Page() {
  return (
    <article className="mx-auto max-w-3xl px-4 pt-16">
      <h1 className="text-3xl font-bold tracking-tight">Politique de confidentialité</h1>
      <p className="muted mt-2 text-sm">Dernière mise à jour : [date]</p>
      <div className="mt-6"><div className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"><strong>Projet de document, à faire valider par un professionnel du droit avant la commercialisation.</strong> Les éléments entre crochets doivent être complétés.</div></div>
      <div className="prose-rp">
        <h2>Deux rôles distincts</h2>
        <p><strong>Responsable de traitement</strong> pour les données de nos clients et visiteurs (comptes, facturation, demandes de contact). <strong>Sous-traitant</strong> (article 28 du RGPD) pour les données des prospects que nos clients enregistrent dans RelancePro : nos clients restent responsables de ces traitements, encadrés par un accord de sous-traitance.</p>
        <h2>Données traitées</h2>
        <ul><li>Compte : nom, e-mail professionnel, mot de passe (stocké sous forme d&apos;empreinte scrypt), journal de connexion.</li><li>Facturation : gérée par Stripe ; nous ne stockons pas les numéros de carte.</li><li>Prospects de nos clients : identité, coordonnées professionnelles, demande, échanges, base légale, oppositions.</li><li>Mesure d&apos;audience : pages vues, sans cookie ni donnée personnelle.</li></ul>
        <h2>Finalités et bases légales</h2>
        <ul><li>Fourniture du service : exécution du contrat.</li><li>Sécurité, prévention des abus, journal d&apos;audit : intérêt légitime.</li><li>Obligations comptables et fiscales : obligation légale.</li><li>Réponse aux demandes de contact : mesures précontractuelles.</li></ul>
        <h2>Intelligence artificielle</h2>
        <p>RelancePro AI analyse les demandes et prépare des brouillons de relance. L&apos;analyse de base est réalisée par nos propres règles, sans transfert. Si un modèle de langage externe est activé ([fournisseur, région, conditions de non-réutilisation des données]), seules les informations nécessaires à la rédaction d&apos;un message lui sont transmises. Aucune décision produisant des effets juridiques n&apos;est prise de manière entièrement automatisée ; les messages sensibles sont soumis à validation humaine.</p>
        <h2>Durées de conservation</h2>
        <ul><li>Compte : durée du contrat puis [x] ans.</li><li>Prospects : définie par le client ; suppression possible à tout moment ; recommandation : 3 ans après le dernier contact.</li><li>Liste d&apos;opposition : conservée sous forme d&apos;empreinte non réversible tant que nécessaire pour garantir le respect de l&apos;opposition.</li><li>Factures : 10 ans.</li></ul>
        <h2>Sous-traitants ultérieurs</h2><p>Vercel (hébergement), Supabase (base de données), Stripe (paiement), [prestataire d&apos;e-mails transactionnels], [fournisseur IA le cas échéant]. Liste tenue à jour sur demande.</p>
        <h2>Vos droits</h2><p>Accès, rectification, effacement, limitation, opposition, portabilité : écrivez à [adresse DPO / contact]. Vous pouvez saisir la CNIL (cnil.fr).</p>
      </div>
    </article>
  );
}
