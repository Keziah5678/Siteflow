/**
 * Marketing and help content. Written to be useful and verifiable: no
 * testimonials, no customer logos, no performance claims presented as
 * measured results. Examples are labelled as illustrations.
 */

export const FAQ = [
  { q: "RelancePro envoie-t-il des e-mails sans mon accord ?", a: "Non. Par défaut, chaque relance est préparée puis soumise à votre validation (mode assisté). L'envoi automatique n'existe que si vous l'activez explicitement sur une séquence, à partir de la formule Pro, et il peut être arrêté à tout moment d'un clic." },
  { q: "Depuis quelle adresse partent les relances ?", a: "Depuis votre propre boîte e-mail professionnelle, que vous connectez dans les paramètres (SMTP, compatible avec la plupart des messageries). Les réponses arrivent donc directement chez vous." },
  { q: "L'IA peut-elle inventer un prix ou un délai ?", a: "RelancePro AI rédige uniquement à partir des informations que vous avez saisies (demande, devis, signature). Tout montant, date, délai, promesse ou lien absent de vos données est détecté et le message est bloqué pour relecture humaine." },
  { q: "Est-ce conforme au RGPD ?", a: "RelancePro est conçu pour vous aider à respecter le RGPD : base légale enregistrée pour chaque prospect, opposition définitive et respectée même après réimport, lien de désinscription dans chaque message, plafond de fréquence, export et suppression des données. La conformité de vos propres traitements reste de votre responsabilité ; nos documents juridiques sont des projets en cours de validation." },
  { q: "Puis-je importer mes demandes existantes ?", a: "Oui, par fichier CSV (export Excel, Google Sheets ou de votre logiciel de devis). Les en-têtes français et anglais sont reconnus, les doublons et adresses invalides sont signalés." },
  { q: "Que se passe-t-il à la fin de l'essai gratuit ?", a: "Rien n'est facturé automatiquement sans que vous ayez choisi une formule. Vos données sont conservées ; l'accès en écriture est suspendu jusqu'à la souscription." },
  { q: "Puis-je résilier à tout moment ?", a: "Oui, depuis le portail de facturation. L'abonnement reste actif jusqu'à la fin de la période payée." }
];

export const STEPS = [
  { title: "Centralisez vos demandes", text: "Formulaire de votre site, import CSV, saisie après un appel : chaque demande devient un prospect avec son historique." },
  { title: "RelancePro AI repère les oubliés", text: "Les demandes sans réponse et les devis sans suite remontent automatiquement, classés par urgence et par intérêt." },
  { title: "Relancez au bon moment", text: "Une relance personnalisée est prête. Vous validez en un clic — ou vous laissez une séquence autorisée s'en charger." }
];

export const FEATURES = [
  { title: "Détection des demandes oubliées", text: "Une demande reste sans réponse ? Un devis n'a pas eu de suite ? RelancePro le signale chaque jour, avant que le client ne parte ailleurs.", icon: "◎" },
  { title: "Analyse des messages", text: "Besoin exprimé, urgence, intention (intéressé, question, refus, désinscription), sujets sensibles qui demandent une réponse humaine.", icon: "◈" },
  { title: "Relances personnalisées et factuelles", text: "Rédigées à partir de vos données uniquement. Aucun prix, délai ni engagement inventé : tout écart est bloqué pour relecture.", icon: "✎" },
  { title: "Séquences configurables", text: "Alerte à J+1, relances à J+3 et J+7, clôture à J+14 : les délais et les messages sont les vôtres. Toute réponse arrête la séquence.", icon: "⟳" },
  { title: "Conformité intégrée", text: "Base légale par prospect, opposition définitive, lien de désinscription, plafond de fréquence, heures de repos, arrêt d'urgence.", icon: "⚖" },
  { title: "Tableau de bord vérifiable", text: "Relances envoyées, réponses, rendez-vous, chiffre d'affaires confirmé : chaque chiffre renvoie aux prospects concernés.", icon: "▤" },
  { title: "Import CSV et formulaire web", text: "Importez vos fichiers existants et branchez le formulaire de votre site en copiant une adresse.", icon: "⇪" },
  { title: "Webhooks signés", text: "Envoyez chaque nouveau prospect, relance ou réponse vers votre CRM, Zapier, Make ou n8n.", icon: "⚡" },
  { title: "Équipe et rôles", text: "Propriétaire, administrateurs, membres : chacun voit l'espace de l'entreprise, seuls les administrateurs modifient les réglages sensibles.", icon: "◉" }
];

export type Sector = { slug: string; name: string; title: string; intro: string; situations: string[]; example: { need: string; followUp: string }; tips: string[] };

export const SECTORS: Sector[] = [
  {
    slug: "garages-automobiles", name: "Garages automobiles", title: "Relance des devis pour garages automobiles",
    intro: "Entre l'atelier, le téléphone et les clients au comptoir, les demandes de devis reçues par e-mail ou via le site attendent souvent. RelancePro les centralise et vous rappelle qui relancer.",
    situations: ["Devis de réparation envoyé, client sans nouvelles depuis une semaine", "Demande de révision reçue un samedi, oubliée le lundi", "Client qui hésite entre deux garages et attend un signe"],
    example: { need: "Devis pour le remplacement des plaquettes et disques avant d'une Clio IV.", followUp: "Bonjour Monsieur Martin,\n\nJe reviens vers vous au sujet du devis D-2026-041 envoyé le 12 mars pour le remplacement des plaquettes et disques avant de votre Clio.\n\nAvez-vous pu en prendre connaissance ? Je reste à votre disposition pour toute question.\n\nBien cordialement,\nPaul — Garage du Centre" },
    tips: ["Associez chaque demande à son devis : la relance cite la référence et la date.", "Laissez le prix dans le devis : la relance ne le répète pas si vous ne le saisissez pas.", "Une alerte à J+1 suffit souvent pour les demandes urgentes (panne, contrôle technique)."]
  },
  {
    slug: "artisans", name: "Artisans", title: "Suivi des demandes de devis pour artisans",
    intro: "Plombiers, électriciens, menuisiers, peintres : vous êtes sur les chantiers, pas devant vos e-mails. RelancePro garde la liste des demandes à jour et prépare les relances pendant que vous travaillez.",
    situations: ["Visite technique faite, devis envoyé, pas de retour", "Demande d'intervention urgente qui mérite un appel rapide", "Client relancé trois fois : RelancePro bloque la quatrième"],
    example: { need: "Remplacement d'un chauffe-eau 200 L dans une maison individuelle.", followUp: "Bonjour Madame Leroy,\n\nJe reviens vers vous suite à votre demande concernant le remplacement de votre chauffe-eau.\n\nAvez-vous pu en prendre connaissance ? Je reste à votre disposition pour toute question.\n\nBien cordialement,\nKarim — KB Plomberie" },
    tips: ["Notez « urgent » dans la demande : elle remonte en tête de liste.", "Utilisez le mode assisté : vous validez depuis votre téléphone entre deux chantiers.", "Ajoutez votre lien de prise de rendez-vous dans les paramètres pour les visites techniques."]
  },
  {
    slug: "batiment", name: "Entreprises du bâtiment", title: "Relances commerciales pour entreprises du bâtiment",
    intro: "Rénovation, gros œuvre, second œuvre : les projets sont longs et les décisions lentes. Une relance au bon moment évite qu'un devis sérieux tombe dans l'oubli.",
    situations: ["Devis de rénovation en attente de décision pendant plusieurs semaines", "Appel d'offres privé sans retour après la date annoncée", "Projet reporté : relancer plus tard sans harceler"],
    example: { need: "Rénovation complète d'une salle de bain de 6 m².", followUp: "Bonjour Monsieur Petit,\n\nJe me permets de vous relancer : votre projet de rénovation de salle de bain est-il toujours d'actualité ?\n\nBien cordialement,\nÉquipe Rénov'Est" },
    tips: ["Allongez les délais de séquence (J+7, J+21, J+45) pour les projets longs.", "Le plafond de fréquence protège votre image : 3 relances sur 30 jours par défaut.", "Le statut « Rendez-vous obtenu » arrête la séquence automatiquement."]
  },
  {
    slug: "agences-immobilieres", name: "Agences immobilières", title: "Suivi des contacts pour agences immobilières",
    intro: "Demandes d'estimation, contacts sur annonce, acquéreurs à recontacter : RelancePro aide l'agence à ne laisser aucun contact sans suite, dans le respect de leurs choix.",
    situations: ["Demande d'estimation en ligne restée sans rappel", "Acquéreur venu en visite, sans nouvelle depuis", "Propriétaire qui a demandé à ne plus être sollicité : opposition respectée"],
    example: { need: "Estimation d'un appartement T3 en vue d'une vente au printemps.", followUp: "Bonjour Madame Nguyen,\n\nJe reviens vers vous suite à votre demande d'estimation de votre appartement.\n\nSi vous le souhaitez, vous pouvez choisir un créneau pour en parler : (votre lien de rendez-vous)\n\nBien cordialement,\nAgence des Halles" },
    tips: ["Enregistrez la base légale : une demande d'estimation est une demande du prospect.", "Les adresses personnelles exigent un consentement ou une demande, pas l'intérêt légitime.", "Branchez le formulaire de votre site pour créer les contacts automatiquement."]
  },
  {
    slug: "societes-de-services", name: "Sociétés de services", title: "Relances pour sociétés de services aux entreprises",
    intro: "Conseil, informatique, formation, comptabilité : vos propositions commerciales méritent un suivi régulier et professionnel.",
    situations: ["Proposition envoyée après un premier rendez-vous", "Prospect qui a demandé « de revenir vers lui le mois prochain »", "Plusieurs commerciaux : qui relance qui ?"],
    example: { need: "Accompagnement à la mise en conformité RGPD pour une PME de 40 salariés.", followUp: "Bonjour Madame Roux,\n\nJe reviens vers vous au sujet de la proposition P-112 envoyée le 4 février.\n\nAvez-vous pu en prendre connaissance ? Je reste à votre disposition pour toute question.\n\nBien cordialement,\nThomas — Cabinet Conseil" },
    tips: ["Formule Pro : plusieurs utilisateurs dans le même espace.", "Les webhooks envoient les réponses vers votre CRM.", "Ajoutez des notes après chaque appel : elles restent dans l'historique."]
  },
  {
    slug: "entreprises-de-nettoyage", name: "Entreprises de nettoyage", title: "Suivi des devis pour entreprises de nettoyage",
    intro: "Contrats d'entretien de bureaux, nettoyage de fin de chantier, vitrerie : les demandes arrivent par vagues et se perdent vite.",
    situations: ["Visite de site faite, contrat non signé", "Demande ponctuelle de nettoyage de fin de chantier", "Renouvellement de contrat à anticiper"],
    example: { need: "Entretien hebdomadaire de 300 m² de bureaux.", followUp: "Bonjour Monsieur Garcia,\n\nJe reviens vers vous suite à votre demande concernant l'entretien hebdomadaire de vos bureaux.\n\nAvez-vous pu en prendre connaissance ? Je reste à votre disposition pour toute question.\n\nBien cordialement,\nNet'Pro Services" },
    tips: ["Le score met en avant les demandes récentes et de valeur.", "Un refus enregistré passe le dossier en « perdu » et arrête les relances.", "Exportez vos prospects en CSV à tout moment."]
  },
  {
    slug: "prestataires-b2b", name: "Prestataires B2B", title: "Relance commerciale pour prestataires B2B",
    intro: "Agences, studios, fournisseurs, sous-traitants : RelancePro structure le suivi de vos opportunités sans transformer vos clients en cibles de campagnes.",
    situations: ["Brief reçu, devis envoyé, silence radio", "Contact rencontré sur un salon professionnel", "Ancien client à recontacter pour un nouveau besoin"],
    example: { need: "Refonte du site vitrine d'une société industrielle.", followUp: "Bonjour Madame Morel,\n\nJe me permets de vous relancer : votre projet de refonte de site est-il toujours d'actualité ?\n\nBien cordialement,\nStudio Graphite" },
    tips: ["Contact de salon : intérêt légitime B2B possible sur une adresse professionnelle, si l'offre est liée à son activité.", "Chaque message contient un lien de désinscription, exigé par la loi.", "Mode automatique réservé aux séquences que vous avez vous-même autorisées."]
  }
];

export type Article = { slug: string; title: string; category: string; body: string[] };

export const ARTICLES: Article[] = [
  { slug: "demarrer", category: "Premiers pas", title: "Démarrer avec RelancePro en 10 minutes", body: [
    "## 1. Connectez votre boîte d'envoi", "Dans Paramètres → Boîte d'envoi, renseignez le serveur SMTP de votre messagerie. RelancePro teste la connexion avant d'enregistrer. Envoyez-vous un e-mail de test pour vérifier.",
    "## 2. Ajoutez vos demandes en cours", "Importez un CSV (Prospects → Importer) ou ajoutez-les une à une. Indiquez la base légale : une demande de devis est une demande du prospect.",
    "## 3. Traitez les relances proposées", "Le tableau de bord liste les demandes à relancer. Ouvrez un prospect, cliquez sur « Préparer une relance », relisez, validez, envoyez.",
    "## 4. (Pro) Automatisez ce qui peut l'être", "Dans Séquences, ajustez les délais. Passez une séquence en mode automatique si vous le souhaitez : seuls les messages sans aucun signal d'alerte partiront seuls." ] },
  { slug: "smtp", category: "Intégrations", title: "Connecter sa messagerie (SMTP)", body: [
    "RelancePro envoie vos relances depuis votre propre adresse, par SMTP. Paramètres courants :",
    "- **OVH / Zimbra** : ssl0.ovh.net, port 465, SSL activé.", "- **IONOS** : smtp.ionos.fr, port 465, SSL activé.", "- **Google Workspace / Gmail** : smtp.gmail.com, port 465, SSL — utilisez un mot de passe d'application (validation en deux étapes requise).", "- **Microsoft 365** : smtp.office365.com, port 587, SSL désactivé (STARTTLS) — l'authentification SMTP doit être autorisée par votre administrateur.",
    "Le mot de passe est chiffré (AES-256-GCM) et n'est jamais affiché à nouveau. Vous pouvez déconnecter la boîte à tout moment." ] },
  { slug: "import-csv", category: "Prospects", title: "Importer un fichier CSV", body: [
    "Exportez vos demandes depuis Excel, Google Sheets ou votre logiciel de devis au format CSV (séparateur point-virgule ou virgule).",
    "En-têtes reconnus : prénom, nom, entreprise, email, téléphone, besoin, montant, statut (en français ou en anglais). Une ligne doit avoir au moins un e-mail ou un téléphone.",
    "Choisissez la base légale qui s'applique à tout le fichier et décrivez sa provenance (« demandes reçues par le site en 2026 »). Les adresses ayant fait opposition sont importées avec le statut « Opposition » et ne seront jamais relancées." ] },
  { slug: "conformite", category: "Conformité", title: "Relancer en respectant le RGPD", body: [
    "## Une base légale pour chaque prospect", "Avant toute relance, RelancePro exige une base légale : demande du prospect (devis, renseignement), consentement, client existant, ou intérêt légitime B2B. L'intérêt légitime ne s'applique pas aux adresses personnelles (gmail, orange…).",
    "## L'opposition est définitive", "Un clic sur le lien de désinscription, un « ne me contactez plus » détecté dans une réponse, ou un statut « Opposition » : le prospect n'est plus jamais relancé, même s'il est réimporté plus tard.",
    "## Fréquence raisonnable", "Par défaut : 3 relances maximum sur 30 jours par prospect, au moins 20 heures entre deux messages, pas d'envoi automatique la nuit ni le week-end.",
    "## Droits des personnes", "Depuis la fiche d'un prospect, exportez toutes ses données (droit d'accès) ou supprimez-le (droit à l'effacement).",
    "Ces garde-fous ne remplacent pas un conseil juridique adapté à votre activité." ] },
  { slug: "automatisation", category: "Automatisation", title: "Séquences : mode assisté et mode automatique", body: [
    "Une séquence enchaîne des étapes à J+n après l'inscription du prospect : alerte, relance par e-mail ou clôture.",
    "**Mode assisté** (par défaut) : chaque relance est préparée et attend votre validation dans « À valider ».",
    "**Mode automatique** (Pro et Business) : une relance part seule seulement si toutes les règles de conformité sont respectées et si RelancePro AI n'a relevé aucun signal (montant, délai, sujet sensible…). Sinon elle attend votre validation.",
    "Le bouton « Arrêter toutes les automatisations » suspend immédiatement tous les envois automatiques de l'entreprise." ] },
  { slug: "formulaire-web", category: "Intégrations", title: "Brancher le formulaire de votre site", body: [
    "Dans Paramètres → Formulaire web, copiez l'adresse de réception propre à votre entreprise.",
    "Configurez votre formulaire pour envoyer en POST les champs name, email, phone, company, message (et marketingConsent si vous proposez une case d'acceptation). Un exemple HTML prêt à l'emploi est fourni.",
    "Chaque envoi crée ou met à jour le prospect, avec la base légale « demande du prospect » et la trace de la demande." ] },
  { slug: "facturation", category: "Compte", title: "Abonnement, factures et résiliation", body: [
    "Les paiements sont gérés par Stripe. Depuis Facturation, accédez au portail client pour changer de formule, mettre à jour votre carte, télécharger vos factures ou résilier.",
    "En cas d'échec de paiement, Stripe réessaie automatiquement ; vos accès sont maintenus pendant ces tentatives." ] }
];
