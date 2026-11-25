# ROADMAP

| Phase | Contenu | État |
|---|---|---|
| 1. Fondations | Architecture, design, authentification, profils, navigation | Livrée |
| 2. Cœur social | Fil, création, participation, commentaires, équipes, messagerie, notifications | Livrée |
| 3. Intelligence | VENTURE AI, matching, recherche, Explorer, carte | Livrée (IA réelle et tuiles : à activer avec les clés/réseau de production) |
| 4. Business | Événements à la demande, comptes pro, administration, abonnements | Livrée (paiement réel Stripe test : clés requises) |
| 5. Extension | Billetterie QR, marketplace, push, emails, apps natives | À faire |

## Prochaines étapes recommandées

1. **Préproduction** : créer un projet Supabase et un projet Vercel (voir DEPLOYMENT.md), fournir les clés Stripe test et une clé IA, exécuter la suite E2E contre la préproduction.
2. **Bêta privée** avec un petit groupe : mesurer le temps de première publication (< 1 min visé) et le taux de candidature.
3. **Emails transactionnels** (SMTP Resend/Postmark) pour les notifications importantes.
4. **Billetterie** : Stripe Checkout par billet, QR signé (HMAC), scan organisateur, commission configurable (5 %).
5. **Apps natives** : Expo réutilisant Supabase Auth / Realtime ; la PWA sert de base en attendant.
6. Revue juridique (CGU, confidentialité) et audit de sécurité externe avant ouverture publique.
