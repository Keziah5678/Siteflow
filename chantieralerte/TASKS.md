# Plan et suivi — ChantierAlerte

Statuts : ✅ fait et testé · 🟡 fait, non testable ici · ⏳ à faire par vous (voir README)

## Plan

1. Vérifier la source réelle (BOAMP / opendatasoft) et ses champs.
2. Base Supabase : abonnés, avis, envois, sécurité RLS.
3. Table métiers → CPV + descripteurs BOAMP + mots-clés ; validation sur avis réels.
4. Robot : ingestion, résumés, paiements, cycle d'essai, alertes, anti-doublons, pannes.
5. Fonctions Edge : inscription (double opt-in), désinscription en un clic.
6. Site statique : landing, préférences, désinscription, abonnement, pages légales, pages SEO, tableau de bord.
7. GitHub Actions : cron quotidien + publication Pages ; installation de la base.
8. Tests, README, messages de prospection.

## Tâches

| Tâche | Statut | Preuve |
|---|---|---|
| API BOAMP vérifiée (URL, jeu `boamp`, champs, quota 10 000/j) | ✅ | exploration réelle, 449 avis du 27/11/2026 |
| Extraction CPV / description / lieu / montant (4 formats) | ✅ | `tests/test_parsing.py` |
| Département = lieu du chantier (pas la liste de diffusion) | ✅ | 237/240 avis avec un département unique |
| 15 métiers (CPV + descripteurs + mots-clés), faux positifs exclus | ✅ | `tests/test_trades.py` ; 99 avis pertinents / 240 |
| Résumé 2 lignes en langage simple (sigles traduits) | ✅ | `tests/test_parsing.py` |
| Email quotidien HTML + texte, aucun email si rien | ✅ | rendu vérifié en capture mobile, `tests/test_robot.py` |
| Anti-doublon, rattrapage 3 jours, API en panne | ✅ | `tests/test_robot.py` |
| Une exécution/jour à 6 h Paris (été/hiver) | ✅ | `tests/test_robot.py` |
| Plafond Brevo 290/j, payants servis en premier | ✅ | `tests/test_robot.py`, `tests/test_mailer.py` |
| Rappel J12 + email de fin d'essai | ✅ | `tests/test_robot.py` |
| Inscription double opt-in, réponses indifférenciées, anti-robot, limites | ✅ | testé sur fonction Edge locale |
| Préférences, désinscription 1 clic (lien + POST), réabonnement, suppression | ✅ | parcours navigateur (Playwright) |
| Vérification Stripe (sessions payées → payant, résiliation → fin) | ✅ | `tests/test_stripe.py` + lecture de l'API Stripe réelle (mode test) |
| Pages SEO métier × département + sitemap | ✅ | `tests/test_site.py`, 319 pages sur une journée |
| Pages légales avec champs à remplir surlignés | ✅ | `tests/test_site.py` |
| Durées de conservation RGPD appliquées par le robot | ✅ | code `run.py` |
| Tableau de bord (abonnés, essais, payants, revenu, exécutions) | 🟡 | fonction SQL testée (refus anonyme) ; connexion par lien email non testée de bout en bout |
| Envoi réel via Brevo | 🟡 | forme de la requête testée ; aucune clé Brevo disponible ici |
| Paiement via la page Stripe hébergée | 🟡 | `checkout.stripe.com` inaccessible depuis l'environnement de développement |
| Workflows GitHub Actions | 🟡 | YAML validé ; exécution réelle après fusion sur la branche par défaut |
| 5 messages de prospection | ✅ | `marketing/prospection.md` |
| Comptes, clés, lien Stripe, infos légales | ⏳ | README, « Ce que VOUS devez faire » |
| Relecture juridique (mentions, confidentialité, CGV) | ⏳ | à faire par un professionnel |
