# RelancePro — état d'avancement

État au 22/11/2026. Seul ce qui a été réellement exécuté est indiqué comme testé.

## Terminé et vérifié

| Domaine | Ce qui fonctionne | Vérification |
|---|---|---|
| Base de données | Schéma `rp` complet, RLS par entreprise, secrets non lisibles par le rôle applicatif, historique des consentements et journal d'audit non modifiables, migrations idempotentes | 14 tests d'intégration sur PostgreSQL 16 |
| Isolation entre entreprises | Lecture, modification, suppression et insertion impossibles chez une autre entreprise ; 404 sur les fiches et exports d'autrui | Intégration (RLS directe) + e2e |
| Authentification | Inscription, vérification e-mail (lien à usage unique), connexion, limitation des tentatives, réinitialisation qui déconnecte toutes les sessions, sessions révocables et expirantes, invitations d'équipe | Intégration + e2e |
| Site vitrine | Accueil, fonctionnalités, tarifs, comment ça marche, démo interactive (données fictives signalées), aide (7 articles), contact, parrainage, 7 pages métiers, 4 pages juridiques (projets), sitemap, robots, thème clair/sombre | e2e + axe (aucune violation grave WCAG A/AA, hors contraste non mesuré) |
| Prospects | Ajout, modification, import CSV (format Excel français), export CSV, historique, notes, devis, statuts, recherche et filtres, détection des demandes oubliées, score, export RGPD (JSON) et effacement | Unitaires + intégration + e2e |
| RelancePro AI (déterministe) | Intention (demande, positive, question, refus, désinscription, absence), urgence, besoin, résumé, sujets nécessitant un humain, rédaction à partir des seuls faits, détection des montants, dates, promesses, liens et téléphones inventés | 12 tests unitaires |
| Conformité | Base légale obligatoire, opposition définitive (survit à l'effacement et au réimport), refus de l'intérêt légitime sur adresse personnelle, plafond 30 jours, 20 h entre deux contacts, limite quotidienne, heures de repos, week-end, lien et en-tête de désinscription (RFC 8058) | 6 tests unitaires + intégration + e2e |
| Envoi d'e-mails | Connexion SMTP vérifiée, mot de passe chiffré AES-256-GCM, e-mail de test, relance validée envoyée une seule fois (idempotence) | Contre un vrai serveur SMTP local (intégration + e2e) |
| Désinscription | Page de confirmation et POST en un clic, signature HMAC, opposition appliquée partout | Intégration + e2e |
| Séquences | Assisté par défaut ; automatique (Pro+) avec alerte, relance auto si aucun signal, report si règle temporelle ; arrêt sur réponse ; arrêt d'urgence | Intégration + e2e |
| File d'attente | Idempotente, verrouillage SKIP LOCKED, reprises avec délai croissant, échec définitif signalé | Intégration |
| Facturation | Formules et droits appliqués côté serveur, essai 7 jours avec quotas, webhooks Stripe à signature vérifiée, rejeu sans effet, échec de paiement | Unitaires + intégration (événements signés localement) |
| Administration | MRR, abonnements, essais, conversion, résiliations, coût IA par client, marge estimée, intégrations, erreurs, demandes, alertes ; accès réservé (404 sinon) | Intégration + e2e |
| Responsive | Site et espace client sans défilement horizontal sur Pixel 7 | e2e mobile |
| Build | `next build` de production, lint, TypeScript strict | OK |

Tests exécutés lors de la dernière passe : **23 unitaires, 14 d'intégration, 5 parcours de bout en bout — tous réussis.**

## Défauts trouvés et corrigés pendant les tests

- Les heures de repos n'étaient jamais appliquées (lecture de l'heure au format français).
- Le pilote PostgreSQL v4 stockait les objets JSON passés via `JSON.stringify` comme des chaînes (charge utile des tâches, audit, réglages corrompus).
- L'en-tête `List-Unsubscribe` devait passer par l'option dédiée de nodemailer.
- Les messages d'erreur des paramètres étaient placés dans l'ancre de l'URL et ne s'affichaient pas.

## Pas encore testé ou incomplet

- **Stripe Checkout et portail client** : aucune clé ; seule la partie webhooks est testée.
- **LLM** (Anthropic / OpenAI) : aucune clé ; le moteur déterministe est utilisé et testé.
- **E-mails de la plateforme via un vrai fournisseur** (`PLATFORM_SMTP_URL`) : non testés.
- **Gmail et Outlook par OAuth** : code prêt, jamais exécuté (applications OAuth à créer).
- **Livraison HTTP réelle des webhooks** : non testée contre un serveur externe.
- **Agendas Google/Microsoft, lecture IMAP des réponses, connecteurs CRM natifs** : non développés (alternatives V1 documentées dans INTEGRATIONS.md).
- **Récompenses de parrainage** : suivi en place, attribution manuelle.
- **Contraste des couleurs** : non mesuré par axe (règle désactivée), à vérifier.
- **Tests de charge** : non réalisés.
- Les pages du site vitrine sont rendues dynamiquement (le menu dépend de la session) ; elles pourraient être rendues statiquement.

## Ce qui demande votre intervention

1. **Comptes et coûts** : projet Supabase (région UE), projet Vercel (formule Pro pour la tâche planifiée toutes les 5 minutes), compte Stripe (mode test puis production), fournisseur d'e-mails transactionnels avec votre domaine. Optionnel : clé IA.
2. **Informations juridiques** : raison sociale, SIREN, adresse, directeur de publication, contact RGPD ; validation des documents juridiques et rédaction de l'accord de sous-traitance (liste dans LAUNCH.md).
3. **Décisions commerciales** : prix définitifs, conditions du parrainage, offre de lancement.
4. **Déploiement** : autorisation de mettre en production (rien n'a été déployé). Le connecteur Vercel de cette session doit être reconnecté pour que je puisse le faire.
