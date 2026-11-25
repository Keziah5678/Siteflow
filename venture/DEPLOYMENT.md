# Déploiement

Cible : **Supabase Cloud** (base, Auth, Realtime, Storage) + **Vercel** (Next.js). Même procédure pour la préproduction et la production, avec deux projets distincts.

> Aucune ressource payante n'a été créée. Les étapes ci-dessous nécessitent vos comptes.

## 1. Supabase

```bash
cd venture
npx supabase login
npx supabase link --project-ref <ref-preprod>
npx supabase db push               # applique supabase/migrations/*
# Préproduction uniquement : données de démonstration
psql "$DATABASE_URL" -f supabase/seed.sql
```

Dans le tableau de bord (Authentication) :
- **Confirm email** activé ; **Minimum password length** 10, caractères requis : minuscules, majuscules, chiffres.
- **Site URL** = URL Vercel ; **Redirect URLs** : `https://<domaine>/auth/callback`.
- **SMTP** personnalisé (obligatoire en production : l'envoi intégré est limité).
- **Rate limits** : valeurs de production (les valeurs de `config.jsonc` sont relevées pour les tests locaux).
- Optionnel : **Captcha** (Turnstile).

Puis : créer le premier super-administrateur via l'éditeur SQL :
```sql
update public.profiles set platform_role = 'superadmin' where username = '<pseudo>';
```

## 2. Vercel

- Importer le dépôt, **Root Directory** = `venture`.
- Variables (Production / Preview) — voir `.env.example` :
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (**non** préfixée `NEXT_PUBLIC_`), `NEXT_PUBLIC_APP_URL`, et selon le cas `ANTHROPIC_API_KEY`, `AI_MODEL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- `npm install` exécute `postinstall` (copie du worker MapLibre dans `public/maplibre`).

## 3. Stripe (mode test)

- Clés `sk_test_…` uniquement. Une clé `sk_live_` est refusée en production tant que `STRIPE_ALLOW_LIVE=true` n'est pas défini.
- Webhook : `https://<domaine>/api/stripe/webhook`, événements `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
- Activer le **Customer Portal** dans Stripe pour « Gérer la facturation ».
- Les prix viennent de `plan_settings` (modifiables dans Administration → Abonnements).

## 4. Vérifications avant mise en ligne

- [ ] `npm run typecheck && npm run lint && npm test && npm run build && npm run test:e2e` verts (en local)
- [ ] Variables d'environnement présentes ; service role absente de toute variable `NEXT_PUBLIC_*`
- [ ] `git grep -nE "sk_live|sk_test_[A-Za-z0-9]{10}|service_role"` ne retourne aucun secret
- [ ] Inscription → email reçu → confirmation → onboarding sur l'URL déployée
- [ ] Paiement test (carte 4242…) → plan activé via le webhook
- [ ] Politiques RLS : `npx supabase db lint` et revue de `supabase/migrations/20261125000003_rls.sql`
- [ ] En-têtes de sécurité (CSP, HSTS) vérifiés sur le domaine
- [ ] Paramètre « Afficher les données de démonstration » désactivé en production

## CI

`.github/workflows/venture-ci.yml` (racine du dépôt) lance typecheck, lint, tests unitaires/intégration et E2E contre une stack Supabase locale. Déclenchement **manuel** ou sur pull request touchant `venture/`, pour ne pas consommer de minutes Actions sans décision.
