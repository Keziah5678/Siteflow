# RelancePro — plan de projet

> L'intelligence artificielle qui transforme les prospects oubliés en opportunités commerciales.

## 1. Proposition de valeur (V1 commercialisable)

Une PME française reçoit des demandes (formulaire, e-mail, téléphone, devis).
Une partie reste sans suivi. RelancePro :

1. **centralise** les prospects (saisie, import CSV, formulaire web, e-mail) ;
2. **détecte** ceux qui sont oubliés (aucun échange depuis N jours, devis sans réponse) ;
3. **analyse** chaque demande (besoin, urgence, intention, refus, désinscription) ;
4. **prépare** une relance personnalisée **qui n'invente rien** (aucun prix, délai ni engagement absent des données) ;
5. **envoie** depuis la boîte de l'entreprise, après validation humaine — ou automatiquement si l'entreprise l'a explicitement activé et que la relance est licite ;
6. **mesure** ce qui a été récupéré (réponses, rendez-vous, CA confirmé saisi par l'utilisateur).

## 2. Architecture

```
Next.js 16 (App Router, React 19, TypeScript, Tailwind 4) — hébergé sur Vercel
├── Site vitrine (pages statiques + SEO + pages métiers)
├── Espace client /app (multi-entreprise)
├── Administration /admin (propriétaire de RelancePro)
├── API /api/* (Route Handlers) : formulaires entrants, webhooks Stripe, cron, unsubscribe
└── lib/
    ├── db/        PostgreSQL (Supabase en production) via `postgres`
    │              withTenant() : transaction sous rôle `rp_app` + RLS par entreprise
    ├── auth/      comptes, sessions (cookie httpOnly, jeton haché), vérification e-mail, reset
    ├── ai/        RelancePro AI : moteur heuristique déterministe + fournisseur LLM optionnel,
    │              prompts versionnés, sortie validée (zod), garde-fous anti-invention
    ├── compliance/ portail de conformité : opposition, base légale, fréquence, heures, mode auto
    ├── automation/ séquences, planification, file d'attente (SKIP LOCKED, idempotence, reprises)
    ├── mail/      envoi SMTP (toute messagerie) + Gmail API + Microsoft Graph (OAuth, à configurer)
    ├── billing/   formules, droits, quotas, Stripe Billing (checkout, portail, webhooks idempotents)
    └── integrations/ webhooks sortants signés (HMAC), formulaire web entrant, export CSV
```

### Choix structurants

| Décision | Raison |
|---|---|
| Accès direct à PostgreSQL (driver `postgres`) plutôt que supabase-js | Un seul chemin de code testable sur un PostgreSQL local (pas de Docker ici) ; la RLS reste appliquée via `SET LOCAL ROLE rp_app` + `app.user_id` à chaque transaction ; Supabase sert de PostgreSQL managé, sauvegardé |
| Schéma dédié `rp`, aucun droit pour `anon`/`authenticated` | Les tables ne sont **pas** exposées par l'API REST automatique de Supabase |
| Authentification maison (scrypt, sessions en base) | Sessions révocables, vérification e-mail, aucune dépendance à un service tiers pour se connecter |
| File d'attente en base (`rp.jobs`, `FOR UPDATE SKIP LOCKED`) + Vercel Cron | Fiable, transactionnelle, idempotente, sans service payant supplémentaire |
| SMTP d'abord | Fonctionne avec toute messagerie professionnelle (OVH, Gmail/Workspace par mot de passe d'application, Outlook, IONOS…) sans validation d'application OAuth |
| IA : heuristique déterministe + LLM optionnel | Le produit fonctionne et reste prévisible sans clé ; le LLM améliore la rédaction, jamais les faits |

## 3. Modèle de données (schéma `rp`)

`users`, `sessions`, `email_tokens`, `organizations`, `memberships`, `invitations`,
`prospects`, `quotes`, `interactions`, `notes`, `consents` (bases légales historisées),
`suppressions` (oppositions, par e-mail haché), `sequences`, `sequence_steps`,
`enrollments`, `messages` (brouillons → validés → envoyés), `mailboxes` (secrets chiffrés AES-256-GCM),
`jobs`, `webhook_endpoints`, `webhook_deliveries`, `subscriptions`, `stripe_events`,
`ai_usage`, `audit_log`, `error_log`, `contact_requests`, `referrals`, `analytics_events`.

## 4. Parcours principaux

1. Inscription → e-mail de vérification → création de l'entreprise → essai 7 jours.
2. Connexion de la boîte d'envoi (SMTP) → test d'envoi réel.
3. Import CSV / formulaire web / saisie → base légale renseignée.
4. Tableau de bord → « À relancer » → brouillon IA → validation → envoi.
5. Séquence (J+1 alerte, J+3, J+7, J+14 clôture) en mode assisté ; mode automatique sur activation explicite (formule Pro+).
6. Réponse du prospect → classification (positive, refus, désinscription) → mise à jour du CRM, arrêt de la séquence.
7. Abonnement Stripe → droits appliqués côté serveur.

## 5. Risques et parades

| Risque | Parade |
|---|---|
| Fuite entre entreprises | RLS + tests d'intégration inter-entreprises ; toute requête métier passe par `withTenant` |
| Relance illicite / abusive | Portail de conformité bloquant (opposition, base légale, plafond de fréquence, lien de désinscription obligatoire), envoi auto désactivé par défaut, bouton d'arrêt global |
| IA qui invente | Génération contrainte aux faits connus, détection des montants/dates non présents, validation humaine si doute |
| Coûts IA | Quotas mensuels par formule, mesure par entreprise, coupure à la limite |
| Doubles envois | Clés d'idempotence uniques sur les jobs et messages, verrouillage `SKIP LOCKED` |
| Webhooks Stripe rejoués | Table `stripe_events` (clé primaire = id d'événement) |
