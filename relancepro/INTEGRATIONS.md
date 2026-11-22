# Intégrations — état et autorisations nécessaires

| Intégration | État | Testée | Ce qu'il faut fournir |
|---|---|---|---|
| Envoi depuis la messagerie du client (SMTP) | Opérationnelle | Oui, contre un vrai serveur SMTP local (connexion refusée/acceptée, e-mail de test, relance, en-têtes de désinscription) | Rien côté RelancePro : chaque client saisit ses paramètres SMTP |
| Import / export CSV | Opérationnel | Oui (unitaires + e2e) | — |
| Formulaire web entrant | Opérationnel | Oui (intégration + e2e) | — |
| Webhooks sortants signés | Opérationnels | Création, refus des URL privées, mise en file : oui. Livraison HTTP réelle : non (pas de cible publique en test) | — |
| Stripe Billing | Code complet | Vérification de signature, synchronisation, rejeu idempotent, droits : oui. Checkout et portail : **non** (aucune clé) | Voir ci-dessous |
| E-mails de la plateforme | Code complet | Mise en file oui ; envoi via `PLATFORM_SMTP_URL` non testé avec un vrai fournisseur | Compte Brevo, Resend, Postmark… + domaine authentifié (SPF, DKIM, DMARC) |
| LLM (Anthropic ou OpenAI) | Code complet, optionnel | Non (aucune clé) ; le repli déterministe est testé | Clé API + accord de traitement du fournisseur |
| Gmail (OAuth) | Code prêt | Non | Voir ci-dessous |
| Outlook / Microsoft 365 (OAuth) | Code prêt | Non | Voir ci-dessous |
| Google Calendar / Microsoft Calendar | Non développé | — | V1 : lien de prise de rendez-vous (Calendly, Bookings…) dans les paramètres |
| Lecture automatique des réponses (IMAP) | Non développé | — | V1 : l'utilisateur colle la réponse dans la fiche, l'IA l'analyse ; ou webhooks entrants à venir |
| CRM tiers | Via webhooks et export CSV | — | Connecteurs natifs à développer selon la demande |

## Stripe (mode test d'abord)

1. Créer 3 produits avec un prix mensuel récurrent en EUR : Starter 79 €, Pro 149 €, Business 299 € (HT, TVA via Stripe Tax si activé).
2. Variables : `STRIPE_SECRET_KEY`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`.
3. Webhook vers `https://<domaine>/api/stripe/webhook`, événements : `checkout.session.completed`, `customer.subscription.created|updated|deleted|paused|resumed`, `invoice.payment_failed`. Copier le secret dans `STRIPE_WEBHOOK_SECRET`.
4. Portail client : activer changement de formule, mise à jour de carte, factures, résiliation en fin de période.
5. Activer les relances automatiques de paiement (Smart Retries) et les e-mails d'échec de paiement.

## Gmail (permission minimale : `gmail.send`)

1. Google Cloud Console → projet → écran de consentement OAuth (type « externe »), domaine vérifié.
2. Identifiants OAuth « Application Web », URI de redirection : `https://<domaine>/api/oauth/gmail/callback`.
3. Scope `https://www.googleapis.com/auth/gmail.send` (scope **restreint** : la publication exige la vérification Google et un audit de sécurité CASA, payant, avant d'être ouverte à tous les clients).
4. Variables `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. En attendant : SMTP avec mot de passe d'application.

## Microsoft 365 / Outlook (permissions : `Mail.Send`, `offline_access`, `User.Read`)

1. Entra ID → Inscriptions d'applications → comptes de tout annuaire + comptes personnels.
2. Redirection Web : `https://<domaine>/api/oauth/outlook/callback`. Secret client.
3. Variables `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`. Certaines organisations exigent un consentement administrateur.
