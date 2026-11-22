# RelancePro

> L'intelligence artificielle qui transforme les prospects oubliés en opportunités commerciales.

SaaS B2B pour PME françaises : centralise les demandes, détecte celles restées sans suite, prépare des relances
factuelles (RelancePro AI), les envoie depuis la messagerie de l'entreprise après validation — ou automatiquement
sur des séquences explicitement autorisées — dans le respect du RGPD.

- Plan et architecture : [PROJECT_PLAN.md](./PROJECT_PLAN.md)
- État réel du projet : [PROGRESS.md](./PROGRESS.md)
- Intégrations et autorisations : [INTEGRATIONS.md](./INTEGRATIONS.md)
- Mise en production, sauvegardes, juridique : [LAUNCH.md](./LAUNCH.md)

## Démarrer en local

```bash
cd relancepro
npm install
npm run db:start                     # PostgreSQL local (aucun Docker requis), port 54330
export DATABASE_URL=postgres://postgres@localhost:54330/postgres
npm run db:migrate
npm run dev                          # http://localhost:3000
```

Sans SMTP de plateforme, les e-mails (vérification, réinitialisation…) sont lisibles sur `/dev/outbox`
(désactivé en production). Sans clé IA, RelancePro AI fonctionne en mode déterministe.

## Tests

```bash
npm run lint && npm run typecheck
npm test                     # unitaires : IA, conformité, CSV, formules (23)
npm run test:integration     # base PostgreSQL jetable + vrai serveur SMTP local (14)
npm run build && npm run test:e2e   # Playwright desktop + mobile, axe (5 parcours)
```

## Structure

```
app/(marketing)   site vitrine, pages métiers, aide, juridique
app/(auth)        inscription, connexion, vérification, réinitialisation, invitation
app/app           espace client (tableau de bord, prospects, à valider, séquences, paramètres, facturation)
app/admin         tableau de bord du propriétaire de RelancePro
app/api           cron, webhook Stripe, formulaire entrant, désinscription, OAuth, exports, santé
lib/db            accès PostgreSQL, withTenant() = RLS par entreprise
lib/auth          comptes, sessions, vérification e-mail
lib/ai            RelancePro AI (moteur déterministe + LLM optionnel, garde-fous)
lib/compliance    portail de conformité avant tout envoi
lib/app           prospects, messages, séquences, webhooks, équipe, tableau de bord
lib/jobs          file d'attente durable et gestionnaires
lib/billing       formules, droits, Stripe
db/migrations     schéma SQL et politiques RLS
```
