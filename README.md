# Seedflow

Seedflow transforme une idée en positionnement, offre, identité, site internet,
système de génération de prospects et assistant IA — piloté par une IA
« opérateur » plutôt qu'un simple générateur de texte.

C'est une application SaaS réelle : authentification, base de données
multi-tenant avec RLS, génération de site par IA, prévisualisation en temps
réel, modification du site par conversation, CRM, formulaires, SEO, audit de
qualité et facturation Stripe.

## Stack technique

- **Next.js 16** (App Router, Turbopack, React 19, TypeScript strict)
- **Tailwind CSS v4** — design tokens dédiés, aucune interface générique de template
- **Framer Motion** — système d'animation (`src/lib/motion.ts`) avec intensité réglable et respect de `prefers-reduced-motion`
- **Supabase** — Postgres, Auth, Row Level Security
- **OpenAI** (via le SDK `openai`) — orchestrateur IA modulaire
- **Stripe** — abonnements
- **Zod** — validation de toutes les entrées utilisateur et de toutes les sorties IA structurées

## Architecture

```
src/
  app/
    (auth)/                    connexion, inscription, mot de passe
    dashboard/[workspace]/      espace de travail : projets, paramètres
      projects/[project]/       profil, site, design, CRM, formulaires, SEO, audit, versions, automatisations
    s/[slug]/                   site public généré (servi en lecture, publié uniquement)
    api/                        routes serveur (génération, modification IA, CRM, SEO, audit, Stripe…)
  components/
    ui/                         primitives (bouton, carte, dialog…)
    motion/                     Reveal, Stagger, MotionProvider
    site-renderer/               moteur de rendu des sections du site généré
    wizard/, crm/, chat/, project/
  lib/
    ai/                         orchestrateur IA + modules spécialisés (voir ci-dessous)
    supabase/                   clients navigateur / serveur / rôle de service
    site/                       application des diffs IA, snapshots de version
    actions/                    Server Actions (workspaces, projets)
supabase/
  migrations/                   schéma SQL + politiques RLS
```

### Orchestrateur IA (`src/lib/ai`)

Un `Orchestrator` central coordonne des modules spécialisés, chacun avec son
propre prompt et son schéma de sortie validé par Zod — jamais un unique
prompt monolithique :

- `DesignGenerator` — palette, typographie, espacements, style des boutons
- `WebsitePlanner` — décide quelles pages sont pertinentes et leur structure
- `ContentGenerator` — rédige le contenu réel de chaque section
- `SEOGenerator` — titres, meta descriptions
- `FormGenerator` — formulaires adaptés au secteur
- `ImageGenerationService` — abstraction pour un fournisseur d'images IA (interchangeable)
- `LeadQualifier` — qualifie automatiquement les prospects entrants
- `WebsiteAssistant` — assistant public, ne répond qu'à partir des données réelles
- `WebsiteAuditor` — audit design/contenu/SEO/responsive/accessibilité/performance/sécurité/conversion/cohérence
- `ModificationAgent` — traduit une demande en langage naturel en une liste d'opérations structurées appliquées à la base de données

**Règle non négociable, appliquée dans chaque prompt** : ne jamais inventer de
prix, horaires, certifications, avis, résultats, garanties, partenaires ou
récompenses. En l'absence d'information, un placeholder explicite est utilisé.

## Développement

```bash
npm install
cp .env.example .env.local   # puis renseignez vos clés, voir ci-dessous
npm run dev
```

`npm run build` et `npm run lint` passent même sans aucune variable
d'environnement configurée : l'application affiche alors des états « non
configuré » explicites plutôt que de planter.

## Configuration requise

### 1. Supabase (obligatoire — authentification + toutes les données)

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Dans l'éditeur SQL du projet, exécutez dans l'ordre les fichiers de
   `supabase/migrations/` (`0001_init.sql` puis `0002_public_slug.sql`).
3. Renseignez `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` et
   `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API).
4. Dans Authentication → URL Configuration, ajoutez comme Redirect URLs :
   `http://localhost:3000/auth/callback` et `https://votre-domaine/auth/callback`,
   ainsi que `.../update-password` pour la réinitialisation de mot de passe.

Toutes les tables ont RLS activé : un utilisateur ne voit que les espaces de
travail dont il est membre. Le contenu d'un site n'est lisible publiquement
que lorsque son statut est `published`.

### 2. OpenAI (obligatoire pour la génération IA)

Renseignez `OPENAI_API_KEY`. `OPENAI_MODEL` par défaut à `gpt-4o-mini` — changez-le si besoin.

Sans cette clé, l'application reste pleinement utilisable (auth, création de
projet, questionnaire) mais la génération de site, la modification par
conversation, l'assistant, la qualification de prospects et l'audit renvoient
une erreur explicite plutôt que d'inventer du contenu.

### 3. Génération d'images IA (optionnel)

`IMAGE_GENERATION_PROVIDER=openai` avec `OPENAI_API_KEY` (ou
`IMAGE_GENERATION_API_KEY` dédiée) active la génération d'images. Sans
fournisseur configuré, les sections affichent un emplacement réservé explicite
plutôt qu'une fausse photo de stock.

### 4. Stripe (optionnel — facturation)

1. Créez un produit + un tarif récurrent dans le Dashboard Stripe, renseignez `STRIPE_PRICE_ID_PRO`.
2. Renseignez `STRIPE_SECRET_KEY` et `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
3. Créez un endpoint webhook pointant vers `https://votre-domaine/api/stripe/webhook`
   pour les événements `checkout.session.completed` et `customer.subscription.deleted`,
   puis renseignez `STRIPE_WEBHOOK_SECRET`.

### 5. Application

`NEXT_PUBLIC_APP_URL` — URL publique de production (utilisée pour les liens Stripe et le SEO).

## Scénario de test manuel

1. Créer un compte → 2. Créer un espace de travail → 3. Créer un projet →
4. Compléter le questionnaire business → 5. Générer le site →
6. Visualiser l'aperçu (desktop/tablette/mobile) → 7. Modifier le design →
8. Ajouter une page par conversation IA → 9. Consulter les formulaires
générés → 10. Soumettre un formulaire depuis le site public → 11. Voir le
prospect apparaître dans le CRM → 12. Tester l'assistant IA → 13. Lancer un
audit SEO/qualité → 14. Modifier le site par conversation → 15. Consulter
l'historique des versions → 16. Restaurer une version précédente →
17. Publier/dépublier le site → 18. Vérifier le rendu mobile → 19. Vérifier
le rendu desktop → 20. Déconnexion/reconnexion → 21. Vérifier qu'un autre
compte ne voit pas ces données (RLS) → 22. Vérifier qu'aucune clé secrète
n'apparaît côté client.

## À FAIRE PAR LE PROPRIÉTAIRE

Ce qui nécessite une configuration externe que je ne peux pas effectuer
depuis ce dépôt :

1. **Créer le projet Supabase et exécuter les migrations** (`supabase/migrations/*.sql`) — indispensable, rien ne fonctionne sans cela.
2. **Renseigner les variables d'environnement** de production (Supabase, OpenAI, Stripe) sur votre plateforme d'hébergement — jamais dans le code.
3. **Créer un bucket de stockage Supabase** (ex. `brand-assets`, public en lecture) si vous voulez un véritable upload de logo/photos : le questionnaire n'accepte pour l'instant qu'une **URL** de logo, il n'y a pas encore d'upload de fichier binaire.
4. **Configurer Stripe** (produit, tarif, webhook) comme décrit ci-dessus pour activer les paiements réels.
5. **Domaines personnalisés** : chaque site est aujourd'hui servi sur `/s/<identifiant-public>`. Le champ `websites.domain` existe pour un mapping de domaine personnalisé, mais le routage DNS/certificat correspondant doit être mis en place au niveau de l'hébergeur (Vercel Domains ou équivalent).
6. **Exécution réelle des automatisations** : les automatisations sont créées et activables dans l'interface, mais l'envoi effectif (email, webhook) nécessite de connecter un fournisseur (ex. Resend, Postmark, ou un webhook sortant) — non implémenté, pour ne pas simuler un envoi qui n'aurait pas lieu.
7. **Déploiement** : déployez sur Vercel (ou tout hébergeur Next.js) avec les variables d'environnement ci-dessus.
