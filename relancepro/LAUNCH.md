# Mise en production de RelancePro

Rien n'a été déployé ni facturé : chaque étape ci-dessous demande vos comptes et votre accord.

## 1. Base de données (Supabase)

1. Créer un projet Supabase **en région UE** (Francfort ou Paris). Formule Pro conseillée (sauvegardes quotidiennes + PITR en option).
2. Récupérer la chaîne « Transaction pooler » (port 6543) → `DATABASE_URL`.
3. Appliquer les migrations depuis votre poste : `DATABASE_URL=... npm run db:migrate`.
4. Vérifier : les tables sont dans le schéma `rp`, qui n'est **pas** exposé par l'API REST de Supabase (aucun droit pour `anon`/`authenticated`). Ne pas ajouter `rp` aux « exposed schemas ».

## 2. Vercel

1. Nouveau projet depuis le dépôt, **Root Directory = `relancepro`**, framework Next.js, région `cdg1` (Paris) ou `fra1`.
2. Variables (voir `.env.example`) : `DATABASE_URL`, `APP_URL`, `ENCRYPTION_KEY` (`openssl rand -base64 32`, à conserver dans un coffre : sans elle, les mots de passe SMTP chiffrés sont perdus), `CRON_SECRET`, `ADMIN_EMAILS`, `PLATFORM_SMTP_URL`, `PLATFORM_EMAIL_FROM`, `SUPPORT_EMAIL`, Stripe, IA éventuelle.
3. Ne **pas** définir `RP_DEV_TOOLS` ni `RP_ALLOW_DEV_KEY` en production.
4. Cron : `vercel.json` appelle `/api/cron/tick` toutes les 5 minutes (formule Vercel Pro requise pour une fréquence inférieure à 1 jour).
5. Domaine personnalisé + HTTPS ; e-mails de la plateforme sur un sous-domaine authentifié (SPF, DKIM, DMARC).

## 3. Contrôles avant ouverture

- [ ] `npm run lint && npm run typecheck && npm test && npm run test:integration && npm run build && npm run test:e2e`
- [ ] `GET /api/health` → `{ ok: true }` ; surveillance externe (UptimeRobot, Better Stack…) sur cette URL
- [ ] `/admin` : aucune alerte de configuration
- [ ] Paiement de test Stripe de bout en bout (carte 4242…), puis webhook reçu et formule visible dans l'espace
- [ ] Inscription réelle : e-mail de vérification reçu (pas en spam)
- [ ] `/dev/outbox` renvoie 404
- [ ] En-têtes de sécurité (CSP, HSTS) vérifiés sur securityheaders.com

## 4. Sauvegarde et restauration

- **Supabase** : sauvegardes quotidiennes automatiques (formule Pro), PITR en option. Restauration depuis le tableau de bord → Database → Backups.
- **Export indépendant** (recommandé, hebdomadaire, stocké hors Supabase et chiffré) : `pg_dump --schema=rp --format=custom "$DATABASE_URL" > rp-$(date +%F).dump`
- **Restauration** sur une base vierge : `psql "$NEW_URL" -c "create role rp_app nologin"` (si absent), puis `pg_restore --no-owner --dbname="$NEW_URL" rp-AAAA-MM-JJ.dump`, puis `npm run db:migrate` (idempotent pour les migrations déjà appliquées).
- **Clé de chiffrement** : sauvegarder `ENCRYPTION_KEY` séparément. Rotation : prévoir un script de rechiffrement (non fourni).
- Tester une restauration complète au moins une fois avant l'ouverture commerciale.

## 5. Validations juridiques (à faire réaliser par un professionnel)

- [ ] Mentions légales (société, RCS, hébergeurs) — pages marquées « projet »
- [ ] Politique de confidentialité, durées de conservation, sous-traitants ultérieurs
- [ ] Conditions générales de vente et d'utilisation (B2B), limitation de responsabilité, prix HT
- [ ] **Accord de sous-traitance (DPA, art. 28 RGPD)** à faire signer par chaque client — à rédiger
- [ ] Analyse de la licéité de la prospection B2B par e-mail selon les cas d'usage (CNIL, art. L34-5 CPCE) ; le portail de conformité de RelancePro est un garde-fou, pas un avis juridique
- [ ] Information sur l'usage de l'IA (AI Act : obligations de transparence) et accord de traitement avec le fournisseur LLM s'il est activé
- [ ] Registre des traitements de RelancePro ; analyse d'impact (AIPD) si nécessaire
- [ ] Conditions du programme de parrainage (montant de la récompense, fiscalité)
- [ ] Choix des prix définitifs (hypothèses à tester)

## 6. Commercialisation (sans dépense engagée)

Stratégie d'acquisition gratuite ou peu coûteuse, à lancer avec votre accord :
1. Les 7 pages métiers et le centre d'aide sont indexables (sitemap, robots) : les déclarer dans Google Search Console.
2. Fiche Google Business Profile et annuaires de logiciels (Capterra, Appvizer, GetApp) — gratuits.
3. Démonstrations personnalisées pour 10 premières entreprises de votre réseau (formulaire « démo » déjà en place), offre de lancement à décider.
4. Partenariats avec experts-comptables, fédérations d'artisans, CMA, réseaux de garages.
5. Contenus utiles (articles « relancer un devis sans être insistant »…) publiés sur le site, sans faux témoignage.
Aucune publicité, aucune campagne ni publication sur des comptes tiers n'a été faite.
