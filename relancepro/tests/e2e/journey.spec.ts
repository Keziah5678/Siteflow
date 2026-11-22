import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mails, signUpVerified, unfold, logout } from "./helpers";

test.describe.configure({ mode: "serial" });
const stamp = Date.now();
const owner = `gerant-${stamp}@garage-e2e.fr`;

test("site vitrine : pages clés, contenu honnête, accessibilité", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ne perdez plus vos prospects.");
  await expect(page.getByText("Votre assistant commercial intelligent détecte les demandes oubliées")).toBeVisible();
  await expect(page.getByText("données fictives").first()).toBeVisible();
  for (const path of ["/", "/tarifs", "/fonctionnalites", "/comment-ca-marche", "/demo", "/aide", "/contact", "/secteurs/garages-automobiles", "/confidentialite", "/signup"]) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).disableRules(["color-contrast"]).analyze();
    const serious = results.violations.filter(v => v.impact === "serious" || v.impact === "critical");
    expect(serious.map(v => `${path}: ${v.id} — ${v.help}`)).toEqual([]);
  }
  await page.goto("/tarifs");
  for (const price of ["79 €", "149 €", "299 €"]) await expect(page.getByText(price).first()).toBeVisible();
  await page.goto("/demo");
  await page.getByRole("option", { name: /Claire Roux/ }).click();
  await expect(page.getByText("Aucune relance n'est possible")).toBeVisible();
});

test("formulaire de contact enregistré", async ({ page }) => {
  await page.goto("/contact");
  await page.getByLabel("Nom").fill("Prospect Curieux");
  await page.getByLabel("E-mail professionnel").fill("curieux@exemple-pme.fr");
  await page.getByLabel("Message").fill("Bonjour, RelancePro fonctionne-t-il avec OVH ?");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByText("votre message a bien été enregistré")).toBeVisible();
});

test("parcours client : inscription, boîte d'envoi réelle, prospect, relance IA validée et envoyée, désinscription", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await signUpVerified(page, owner, "Garage du Centre");

  // Real SMTP connection: wrong password refused, right one verified.
  await page.goto("/app/settings#boite");
  await page.getByLabel("Adresse d'expédition").fill("contact@garage-e2e.fr");
  await page.getByLabel("Serveur SMTP").fill("127.0.0.1");
  await page.getByLabel("Port").fill("2526");
  await page.getByLabel("SSL/TLS (465)").uncheck();
  await page.getByLabel("Identifiant").fill("relance");
  await page.getByLabel("Mot de passe").fill("faux");
  await page.getByRole("button", { name: "Tester et enregistrer" }).click();
  await expect(page.getByTestId("flash")).toContainText("Connexion refusée");
  await page.getByText("Modifier la connexion SMTP").click().catch(() => {});
  await page.getByLabel("Adresse d'expédition").fill("contact@garage-e2e.fr");
  await page.getByLabel("Serveur SMTP").fill("127.0.0.1");
  await page.getByLabel("Port").fill("2526");
  await page.getByLabel("SSL/TLS (465)").uncheck();
  await page.getByLabel("Identifiant").fill("relance");
  await page.getByLabel("Mot de passe").fill("secret");
  await page.getByRole("button", { name: "Tester et enregistrer" }).click();
  await expect(page.getByTestId("flash")).toContainText("connectée et vérifiée");
  const before = mails().length;
  await page.getByRole("button", { name: "Envoyer un e-mail de test" }).click();
  await expect(page.getByTestId("flash")).toContainText("E-mail de test envoyé");
  expect(mails().length).toBe(before + 1);

  // Signature
  await page.getByLabel("Signataire des relances").fill("Paul");
  await page.getByLabel("Signature").fill("Paul Durand\nGarage du Centre");
  await page.getByRole("button", { name: "Enregistrer les paramètres" }).click();
  await expect(page.getByTestId("flash")).toContainText("Paramètres enregistrés");

  // A prospect with a legal basis and a quote
  await page.goto("/app/prospects/new");
  await page.getByLabel("Prénom").fill("Julie");
  await page.getByLabel("Nom", { exact: true }).fill("Martin");
  await page.getByLabel("E-mail").fill("julie@martin-e2e.fr");
  await page.getByLabel("Demande / besoin").fill("Bonjour, je souhaite un devis pour la révision de ma Clio IV.");
  await page.getByLabel("Base légale").selectOption("pre_contract");
  await page.getByRole("button", { name: "Ajouter le prospect" }).click();
  await expect(page.getByRole("heading", { name: "Julie Martin" })).toBeVisible();
  await expect(page.getByText("Intention : Demande")).toBeVisible();
  await page.getByLabel("Référence du devis").fill("D-2026-041");
  await page.getByLabel("Montant du devis").fill("480");
  await page.getByLabel("Date d'envoi").fill(new Date(Date.now() - 6 * 86400_000).toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Associer un devis" }).click();
  await expect(page.getByTestId("flash")).toContainText("Devis associé");

  // RelancePro AI drafts, the human validates, the e-mail really leaves.
  await page.getByRole("button", { name: "✦ Préparer une relance" }).click();
  await expect(page).toHaveURL(/\/app\/messages/);
  await expect(page.getByLabel("Objet")).toHaveValue("Votre devis D-2026-041");
  await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue(/Bonjour Julie/);
  const n = mails().length;
  await page.getByRole("button", { name: "Valider et envoyer" }).click();
  await expect(page.getByTestId("flash")).toContainText("Relance envoyée");
  const sent = mails().slice(n);
  expect(sent).toHaveLength(1);
  expect(sent[0].to).toEqual(["julie@martin-e2e.fr"]);
  const body = unfold(sent[0].raw);
  expect(body).toContain("D-2026-041");
  const unsub = body.match(/https?:\/\/[^\s"<>]+\/u\/[\w.-]+/)![0];

  // The prospect unsubscribes through the link in the e-mail.
  await logout(page);
  await page.goto(new URL(unsub).pathname);
  await expect(page.getByText("Garage du Centre")).toBeVisible();
  await page.getByRole("button", { name: "Confirmer ma désinscription" }).click();
  await expect(page.getByText("C'est noté")).toBeVisible();

  // Back as the owner: opposition is visible and blocks any follow-up.
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(owner);
  await page.getByLabel("Mot de passe").fill("motdepasse-solide-42");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/app/);
  await page.goto("/app/prospects?status=opposed");
  await page.getByRole("link", { name: "Julie Martin" }).click();
  await expect(page.getByText("s'est opposé aux communications")).toBeVisible();
  await expect(page.getByRole("button", { name: "✦ Préparer une relance" })).toHaveCount(0);

  // A reply pasted by the user is analysed: a refusal closes the file.
  await page.goto("/app/prospects/new");
  await page.getByLabel("Prénom").fill("Marc");
  await page.getByLabel("E-mail").fill("marc@renov-e2e.fr");
  await page.getByLabel("Demande / besoin").fill("Rénovation de salle de bain.");
  await page.getByLabel("Base légale").selectOption("pre_contract");
  await page.getByRole("button", { name: "Ajouter le prospect" }).click();
  await page.getByLabel("Réponse du prospect").fill("Nous avons choisi un autre prestataire, merci.");
  await page.getByRole("button", { name: "Analyser et enregistrer" }).click();
  await expect(page.getByTestId("flash")).toContainText("refus");

  // CSV import
  await page.goto("/app/prospects");
  await page.getByText("Importer un fichier CSV").click();
  await page.getByLabel("Fichier (CSV, 5 Mo max.)").setInputFiles({ name: "demandes.csv", mimeType: "text/csv", buffer: Buffer.from("Prénom;Nom;Société;E-mail;Besoin\nNina;Bernard;Nina Immo;nina@nina-e2e.fr;Estimation T3\nX;Y;Z;pas-un-email;Test\n") });
  await page.getByLabel("Base légale pour ces contacts").selectOption("pre_contract");
  await page.getByLabel("Provenance").fill("Demandes reçues par e-mail");
  await page.getByRole("button", { name: "Importer" }).click();
  await expect(page.getByTestId("flash")).toContainText("1 prospect(s) importé(s)");
  await expect(page.getByTestId("flash")).toContainText("ligne 3");

  // Website form endpoint
  await page.goto("/app/settings#formulaire");
  const formUrl = await page.getByLabel("Adresse de réception (POST)").inputValue();
  const res = await request.post(new URL(formUrl).pathname, { form: { name: "Claire Petit", email: "claire@petit-e2e.fr", message: "Urgent : devis nettoyage de vitres." } });
  expect(res.ok()).toBe(true);
  await page.goto("/app/prospects?q=claire");
  await expect(page.getByRole("link", { name: "Claire Petit" })).toBeVisible();
  await expect(page.getByText("Urgent").first()).toBeVisible();

  // Emergency stop
  await page.goto("/app/sequences");
  page.once("dialog", d => d.accept());
  await page.getByRole("button", { name: "Arrêter toutes les automatisations" }).click();
  await expect(page.getByText("Automatisations arrêtées", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "Réactiver les automatisations" }).click();

  // Dashboard reflects the data
  await page.goto("/app?p=7");
  await expect(page.getByText("Relances envoyées", { exact: true }).first()).toBeVisible();
  await page.goto("/app/billing");
  await expect(page.getByText("Essai gratuit").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("cloisonnement : une autre entreprise ne voit rien, l'administration est réservée", async ({ page, request }) => {
  // Owner's prospect URL
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(owner);
  await page.getByLabel("Mot de passe").fill("motdepasse-solide-42");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/app/);
  await page.goto("/app/prospects?q=nina");
  await page.getByRole("link", { name: "Nina Bernard" }).click();
  await expect(page).toHaveURL(/\/app\/prospects\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Nina Bernard" })).toBeVisible();
  const prospectUrl = new URL(page.url()).pathname;
  const id = prospectUrl.split("/").pop()!;
  await expect(page.getByRole("link", { name: "Administration" })).toHaveCount(0);
  expect((await page.goto("/admin"))!.status()).toBe(404);
  await logout(page);

  await signUpVerified(page, `autre-${stamp}@concurrent-e2e.fr`, "Concurrent SARL");
  expect((await page.goto(prospectUrl))!.status()).toBe(404);
  const exp = await page.request.get(`/api/prospects/${id}/export`);
  expect(exp.status()).toBe(404);
  await page.goto("/app/prospects");
  await expect(page.getByText("Aucun prospect ici")).toBeVisible();
  await logout(page);

  // Platform owner
  await signUpVerified(page, "admin@relancepro-e2e.fr", "RelancePro SAS");
  await page.goto("/admin");
  await expect(page.getByText("Revenu mensuel récurrent")).toBeVisible();
  await expect(page.getByText("Entreprises inscrites")).toBeVisible();
  await expect(page.getByText("Prospect Curieux")).toBeVisible();

  // Cron endpoint requires its secret
  expect((await request.get("/api/cron/tick")).status()).toBe(401);
  const ok = await request.get("/api/cron/tick", { headers: { Authorization: "Bearer e2e-cron-secret" } });
  expect(ok.status()).toBe(200);
});
