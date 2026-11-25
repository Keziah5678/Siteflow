# Sécurité

> Ce document décrit les mesures réellement implémentées et testées. Il ne constitue pas une attestation de conformité (RGPD ou autre) : une revue juridique et un audit de sécurité indépendant restent nécessaires avant la production.

## Principes

1. **Refus par défaut, en base.** RLS activée sur toutes les tables. Les privilèges `INSERT`/`UPDATE`/`DELETE` par défaut sont révoqués puis ré-accordés **colonne par colonne** : un utilisateur ne peut pas modifier `plan`, `platform_role`, `is_verified_organizer`, `is_suspended`, les compteurs, `is_demo`, `sponsor_id`, `moderation`…
2. **Transitions par RPC.** Accepter une candidature, répondre à une proposition ou une demande de contact, modérer, administrer un compte : fonctions `SECURITY DEFINER` qui revérifient l'identité (`auth.uid()`) et le rôle.
3. **Clé service role** uniquement dans des modules `server-only` (webhook Stripe, comptabilité IA, limitation de débit, suppression de compte), après vérification de l'utilisateur. Jamais dans le navigateur.
4. **Validation serveur** de toutes les entrées (Zod) + contraintes `CHECK` en base (longueurs, formats d'URL, plages numériques).

## Mesures

| Exigence | Implémentation | Test |
|---|---|---|
| Authentification | Supabase Auth, PKCE, sessions par cookies httpOnly, `getUser()` (validation du JWT) dans le proxy | E2E |
| Vérification email | `enable_confirmations = true` ; connexion refusée avant confirmation | E2E (Mailpit) |
| Mot de passe | ≥ 10 caractères, minuscules + majuscules + chiffres (Auth + Zod), changement sécurisé | unitaire + E2E |
| Réinitialisation | lien email, réponse identique que le compte existe ou non (pas d'énumération) | manuel |
| Majeurs uniquement | trigger `handle_new_user` rejette < 18 ans ou date absente, même via l'API Auth brute | intégration |
| RLS / permissions | 36 tests d'intégration RLS avec de vrais JWT (propriétaire, membre, externe, admin, anonyme) | intégration |
| Injections | requêtes paramétrées (PostgREST / supabase-js) ; caractères spéciaux des filtres `or()` nettoyés ; aucun SQL dynamique côté client | revue |
| XSS | React échappe tout ; aucun HTML utilisateur ; liens externes `rel="noopener noreferrer nofollow ugc"` ; URL `http(s)` uniquement ; couvertures limitées au bucket VENTURE | unitaire |
| En-têtes | CSP stricte (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`), HSTS (prod), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` | build |
| Limitation de débit | triggers SQL par table (projets 10/j, commentaires 30/10 min, messages 60/min, candidatures 20/h, contacts 20/j, signalements 20/j…) + limiteur Postgres pour inscription (5/h/IP), connexion (20/10 min/IP, 10/10 min/email), reset, IA (10/min) | intégration + E2E |
| Bots | champ piège (honeypot) silencieux + limites par IP. Captcha (Turnstile/hCaptcha) prêt côté Supabase, **non activé** (clé requise) | unitaire |
| Redirections | `safeRedirectPath` (pas de redirection ouverte) | unitaire |
| Messagerie | lecture/écriture réservées aux participants ; expéditeur non usurpable ; blocage appliqué en base ; pièces jointes dans un dossier par conversation | intégration + E2E |
| Fichiers | buckets privés `project-files` (équipe) et `message-files` (participants), URL signées 60 s ; avatars/couvertures dans le dossier de l'utilisateur ; types et tailles limités | intégration |
| Modération | signalements, masquage, suspension, file de traitement, journal d'audit | intégration + E2E |
| Stripe | signature vérifiée (`constructEvent`), table `stripe_events` (idempotence), un seul abonnement actif, clé d'idempotence au checkout, clés live refusées sans `STRIPE_ALLOW_LIVE` | intégration |
| Clés API | `.env*` ignorés par git ; aucune clé dans le dépôt (les clés locales Supabase sont les valeurs de démonstration publiques du CLI) | revue |
| Données personnelles | export JSON complet, suppression du compte (annulation d'abonnement, fichiers, cascade) | E2E |
| IA | données utilisateur balisées et traitées comme données (anti-injection de prompt), identifiants inventés filtrés, quotas, aucune action autonome | intégration |

## Limites connues / à faire avant production

- CSP : `script-src 'unsafe-inline'` requis par les scripts d'amorçage de Next.js ; passer aux nonces lors du choix de l'hébergement.
- Captcha non activé (nécessite une clé Turnstile/hCaptcha).
- Limites de débit Auth relevées en local (`config.jsonc`) pour les tests : configurer des valeurs de production dans le tableau de bord Supabase.
- SMTP de production à configurer (les emails locaux vont dans Mailpit).
- Modération automatique du contenu (filtrage) non implémentée : modération humaine sur signalement uniquement.
- Les messages ne sont pas chiffrés de bout en bout (chiffrés au repos et en transit par l'hébergeur).
- Revue juridique (CGU, politique de confidentialité — la page `/legal` est provisoire et l'indique), registre des traitements, DPA avec les sous-traitants (Supabase, Stripe, fournisseur IA).

## Signaler une vulnérabilité

Ouvrir une issue privée (security advisory) sur le dépôt GitHub.
