# ChantierAlerte

**Ne ratez plus aucun chantier public près de chez vous.**

Service d'alertes quotidiennes par email pour les artisans et TPE du BTP. Chaque matin à 7 h, l'abonné reçoit les nouveaux appels d'offres publics (BOAMP) de son métier et de ses départements, résumés en 2 lignes. Essai gratuit de 14 jours sans carte bancaire, puis 12 €/mois.

Coût de fonctionnement : **0 €** (offres gratuites de GitHub, Supabase, Brevo ; Stripe ne prélève que des frais sur les paiements encaissés).

---

## Comment ça marche

```
                 ┌──────────── chaque jour à 6 h (heure de Paris) ────────────┐
 BOAMP (API) ──► │ Robot Python (GitHub Actions)                              │
                 │ 1. récupère les avis de la veille (+ rattrapage 3 jours)  │
 Stripe ───────► │ 2. vérifie qui a payé                                      │
                 │ 3. rappel J12, fin d'essai                                 │──► Brevo ──► emails 7 h
                 │ 4. envoie à chacun ses nouveaux avis (jamais 2 fois)       │
                 │ 5. régénère le site + pages SEO                            │──► GitHub Pages
                 └────────────────────────────────────────────────────────────┘
 Site (GitHub Pages) ──► formulaire ──► fonction Supabase « subscribe » ──► email de confirmation
                         préférences / désinscription ──► Supabase (fonctions protégées par jeton)
```

| Brique | Outil (gratuit) | Rôle |
|---|---|---|
| Site | GitHub Pages | Landing, préférences, désinscription, pages légales, pages SEO |
| Base | Supabase | Abonnés, avis, historique des envois |
| Robot | GitHub Actions + Python | Cron quotidien |
| Emails | **Brevo** | 300 emails/jour gratuits |
| Paiement | Stripe Payment Link | Abonnement 12 €/mois |

### Pourquoi Brevo plutôt que Resend
Brevo gratuit : **300 emails/jour** (campagnes et transactionnels confondus), adresse d'expédition vérifiable sans nom de domaine, mais une mention « Sent with Brevo » en pied d'email. Resend gratuit : 3 000/mois mais **100/jour** et un domaine à vérifier. Pour des alertes quotidiennes, Brevo permet ~3 fois plus d'abonnés. *(Limites relevées en novembre 2026 sur la documentation Resend et des comparatifs récents — à revérifier sur brevo.com/pricing lors de votre inscription.)*

Le robot respecte un plafond de 290 emails/jour (`MAIL_DAILY_LIMIT`) et sert **les abonnés payants en premier**. Au-delà d'environ 250 abonnés actifs, passez à l'offre payante de Brevo.

### Source de données (vérifiée)
- API : `https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp`
- Jeu de données : `boamp` (≈ 1,7 million d'avis), quota public 10 000 requêtes/jour (le robot en utilise 1 à 3).
- Champs utilisés : `idweb`, `objet`, `nomacheteur`, `code_departement`, `dateparution`, `datelimitereponse`, `descripteur_libelle`, `type_marche`, `nature_categorise_libelle`, `url_avis`, et `donnees` (avis complet : codes CPV, description, lieu d'exécution, montant estimé).
- Seuls les **nouveaux avis de marché** de travaux et de services sont retenus (pas les résultats ni les rectificatifs).

### Filtrage intelligent (`robot/trades.py`)
15 métiers. Un avis est rattaché à un métier par :
1. **codes CPV** (préfixes) — avis européens et nationaux ;
2. **descripteurs officiels du BOAMP** (« Plomberie (travaux) »…) ;
3. **mots-clés** dans l'objet et la description — indispensable pour les petits marchés (MAPA) publiés sans code CPV.

Garde-fous validés sur des avis réels : les mots-clés seuls ne suffisent pas pour les marchés de services (sauf métiers d'entretien), les missions de maîtrise d'œuvre/contrôle sont écartées, et des exclusions évitent les faux positifs (« nettoyage des sanitaires », « couverture d'assurance », « rez-de-chaussée »…).

Le **département** retenu est celui du **lieu du chantier** (code postal), et non la liste de diffusion du BOAMP (un marché à Strasbourg peut être diffusé à Paris).

### Garanties
- Un avis n'est **jamais envoyé deux fois** au même abonné (table `sent_notices`).
- **Aucun email** s'il n'y a rien de nouveau.
- **API BOAMP en panne** : 6 essais espacés ; sinon le robot envoie quand même les avis déjà connus et rattrape le lendemain (les 3 derniers jours sont toujours revérifiés).
- Une seule exécution par jour (deux déclenchements programmés pour couvrir heure d'été/hiver).
- **Double opt-in** : l'essai démarre quand l'abonné confirme son email.
- Le formulaire répond toujours la même chose (impossible de savoir si une adresse est inscrite) et ne modifie jamais un compte existant.
- Désinscription en un clic (lien + en-tête `List-Unsubscribe` reconnu par Gmail/Outlook), suppression des données en un clic.
- Toutes les clés secrètes sont dans des variables d'environnement / GitHub Secrets.

---

## Structure

```
chantieralerte/
├─ config/site.json          ← VOS INFOS : lien Stripe, adresse du site, mentions légales
├─ robot/                    Python : boamp.py, trades.py, matching.py, summary.py,
│                            emails.py, mailer.py, stripe_sync.py, run.py, build_site.py
├─ site/templates, static/   Pages du site (HTML/CSS/JS sans framework)
├─ supabase/migrations/      Tables + sécurité (RLS)
├─ supabase/functions/       subscribe, unsubscribe
├─ tests/                    37 tests (dont avis BOAMP réels)
└─ marketing/prospection.md  5 messages prêts à envoyer
../.github/workflows/        chantieralerte-daily.yml, chantieralerte-setup.yml
```

## Développement local (facultatif)

```bash
cd chantieralerte
pip install -r requirements.txt
npx supabase start                      # base locale (Docker requis)
cp .env.example .env.local              # puis coller les clés locales affichées
npx supabase functions serve --env-file supabase/functions/.env
set -a; . ./.env.local; set +a
python -m robot.run --force --dry-run   # robot sans envoyer d'email
python -m robot.build_site && (cd dist && python -m http.server 8080)
python -m pytest -q
```

---

# ✅ Ce que VOUS devez faire — étape par étape

Comptez environ 1 heure. Aucune carte bancaire n'est demandée, sauf chez Stripe pour recevoir les paiements.
Notez au fur et à mesure les valeurs demandées dans un fichier texte **privé** (jamais dans le code).

### Étape 1 — Mettre le code sur la branche principale
GitHub ne lance les tâches automatiques que depuis la branche par défaut du dépôt.
1. Sur github.com, ouvrez le dépôt **Siteflow**.
2. Cliquez sur **Pull requests → New pull request**.
3. Choisissez la branche `claude/venture-app-development-wwysln` à droite, puis **Create pull request** et **Merge**.

### Étape 2 — Activer le site (GitHub Pages)
1. Dépôt → **Settings → Pages**.
2. Dans « Build and deployment », **Source : GitHub Actions**.
3. L'adresse de votre site sera : `https://keziah5678.github.io/Siteflow/` (à noter).

### Étape 3 — Créer la base (Supabase)
1. Créez un compte sur **supabase.com** → **New project**.
2. Nom : `chantieralerte`. Choisissez un **mot de passe de base** (notez-le). Région : **Europe (Paris ou Frankfurt)**.
3. Une fois créé, allez dans **Project Settings → API** et notez :
   - **Project URL** (ex. `https://abcd.supabase.co`)
   - la clé **anon public**
   - la clé **service_role** (secrète !)
4. Notez aussi le **Reference ID** du projet (Project Settings → General).
5. Créez un jeton d'accès : avatar en haut à droite → **Account → Access Tokens → Generate new token**. Notez-le.
6. **Authentication → URL Configuration** : *Site URL* = l'adresse de votre site (étape 2) ; ajoutez la même adresse suivie de `admin.html` dans *Redirect URLs*.

### Étape 4 — Configurer l'envoi d'emails (Brevo)
1. Créez un compte gratuit sur **brevo.com** (le compte peut être relu par Brevo avant de pouvoir envoyer).
2. **Expéditeurs, domaines et IP dédiées → Expéditeurs → Ajouter** : ajoutez l'adresse qui enverra les alertes (ex. `alertes@votre-domaine.fr` ou votre adresse pro) et validez le lien reçu.
3. **SMTP & API → Clés API → Générer une nouvelle clé**. Notez-la.

### Étape 5 — Créer le paiement (Stripe)
1. Créez un compte sur **stripe.com** (restez en **mode Test** au début).
2. **Catalogue de produits → Ajouter un produit** : « ChantierAlerte », prix **12 €**, **Récurrent – Mensuel**.
3. **Liens de paiement → Nouveau** avec ce produit. Dans « Après le paiement », choisissez **Ne pas afficher la page de confirmation → Rediriger** vers `https://keziah5678.github.io/Siteflow/merci.html`.
4. Copiez le lien (`https://buy.stripe.com/...`).
5. **Développeurs → Clés API** : notez la **clé secrète** (`sk_test_...`). *(Recommandé : créez une « clé restreinte » avec uniquement la lecture des Checkout Sessions et des Subscriptions.)*

### Étape 6 — Coller les clés dans GitHub (Secrets)
Dépôt → **Settings → Secrets and variables → Actions**.

Onglet **Secrets → New repository secret**, un par ligne :

| Nom | Valeur |
|---|---|
| `SUPABASE_URL` | Project URL (étape 3) |
| `SUPABASE_ANON_KEY` | clé anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | clé service_role |
| `SUPABASE_PROJECT_REF` | Reference ID |
| `SUPABASE_ACCESS_TOKEN` | jeton d'accès Supabase |
| `SUPABASE_DB_PASSWORD` | mot de passe de la base |
| `BREVO_API_KEY` | clé API Brevo |
| `MAIL_FROM` | adresse d'expéditeur validée dans Brevo |
| `STRIPE_SECRET_KEY` | clé secrète Stripe |

Onglet **Variables → New repository variable** : `SITE_URL` = `https://keziah5678.github.io/Siteflow`

### Étape 7 — Remplir vos informations
Sur GitHub, ouvrez `chantieralerte/config/site.json`, cliquez sur le crayon ✏️ et remplacez tous les `A_REMPLIR` :
- `site_url` : `https://keziah5678.github.io/Siteflow`
- `stripe_payment_link` : le lien de l'étape 5
- `contact_email`, et le bloc `editeur` (nom, SIRET, adresse…)

Validez avec **Commit changes**. Tant qu'un champ légal n'est pas rempli, il apparaît surligné en jaune sur le site.

### Étape 8 — Installer la base
Onglet **Actions → « ChantierAlerte — installer / mettre à jour la base » → Run workflow**. Attendez la coche verte ✅ (2–3 minutes).

### Étape 9 — Premier lancement
Onglet **Actions → « ChantierAlerte — robot quotidien » → Run workflow**, cochez **Forcer**, puis **Run**.
Une fois terminé ✅, votre site est en ligne. Inscrivez-vous vous-même pour tester (vous recevrez l'email de confirmation).

Ensuite, tout est automatique chaque matin.

### Étape 10 — Votre tableau de bord
1. Supabase → **Authentication → Users → Add user → Create new user** : votre email, cochez *Auto Confirm*.
2. Supabase → **SQL Editor**, exécutez (avec votre email) :
   ```sql
   insert into public.admin_emails (email) values ('vous@exemple.fr');
   ```
3. Ouvrez `https://keziah5678.github.io/Siteflow/admin.html`, entrez votre email, cliquez sur le lien reçu : vous voyez abonnés, essais, payants, revenu mensuel et l'historique du robot.

### Étape 11 — Passer en production
- Faites relire **mentions légales, confidentialité et CGV** par un professionnel (ou un service juridique en ligne).
- Dans Stripe, passez en **mode Live**, recréez le produit et le lien de paiement, puis remplacez le lien dans `config/site.json` et la clé dans le secret `STRIPE_SECRET_KEY`.
- Faites un vrai paiement de test, puis remboursez-le.

### En cas de problème
- **Actions → dernière exécution** : le message d'erreur indique le secret manquant ou l'étape en cause.
- Tableau de bord → « Dernières exécutions du robot ».
- Pour tester le robot sans envoyer d'emails : mettez temporairement `MAIL_MODE: log` dans `.github/workflows/chantieralerte-daily.yml`.
