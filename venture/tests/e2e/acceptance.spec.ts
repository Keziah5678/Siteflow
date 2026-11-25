/**
 * Acceptance journey (spec §24) with two real accounts, through the UI,
 * against the local Supabase stack (real Auth emails via Mailpit).
 */
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";

const env = Object.fromEntries(
  readFileSync(path.resolve(__dirname, "../../.env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const MAILPIT = "http://127.0.0.1:54324";
const RUN = Date.now().toString(36);
const PASSWORD = "Venture2026Test";
const A = { name: "Alice Test", email: `alice.${RUN}@test.venture.invalid`, skills: ["Organisation"] };
const B = { name: "Bruno Test", email: `bruno.${RUN}@test.venture.invalid`, skills: ["Design", "Photographie"] };
const PROJECT_TITLE = `Marque de vêtements upcyclés ${RUN}`;

test.describe.configure({ mode: "serial" });

let ctxA: BrowserContext, ctxB: BrowserContext, pageA: Page, pageB: Page;
let projectUrl = "";
let candidateId = "";

async function confirmationLink(email: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const json = (await res.json()) as { messages: { ID: string }[] };
    if (json.messages?.length) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${json.messages[0]!.ID}`)).json()) as { HTML: string; Text: string };
      const m = (msg.HTML || msg.Text).match(/href="([^"]+verify[^"]+)"/) ?? (msg.Text || "").match(/(http\S+verify\S+)/);
      if (m) return m[1]!.replaceAll("&amp;", "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no confirmation email for ${email}`);
}

async function signUpAndOnboard(page: Page, u: typeof A) {
  await page.goto("/signup");
  await page.getByLabel("Nom ou pseudonyme").fill(u.name);
  await page.getByLabel("Email").fill(u.email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByLabel("Date de naissance").fill("1994-03-02");
  await page.getByText("J'accepte les conditions").click();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByText("Vérifie ta boîte mail")).toBeVisible();

  // 1. Email verification (real email through the local SMTP catcher)
  await page.goto(await confirmationLink(u.email));
  await page.waitForURL(/\/onboarding/);

  // 2. Complete profile
  for (const s of u.skills) {
    await page.locator("#skills").fill(s);
    await page.locator("#skills").press("Enter");
  }
  await page.getByLabel("Ville (facultatif)").fill("Lyon");
  await page.getByRole("button", { name: "Terminer et découvrir les projets" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByText("Qu'aimerais-tu réaliser ?")).toBeVisible();
}

test.beforeAll(async ({ browser }) => {
  // All test signups come from 127.0.0.1: reset the app's per-IP limiter (service role only).
  await admin.from("rate_limit_hits").delete().neq("key", "");
  ctxA = await browser.newContext();
  ctxB = await browser.newContext();
  pageA = await ctxA.newPage();
  pageB = await ctxB.newPage();
});

test.afterAll(async () => {
  const { data } = await admin.from("profiles").select("id").in("username", [`alicetest`, `brunotest`]);
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of users.users.filter((x) => x.email?.includes(RUN))) await admin.auth.admin.deleteUser(u.id);
  if (candidateId) await admin.auth.admin.deleteUser(candidateId);
  void data;
  await ctxA.close();
  await ctxB.close();
});

test("visitors see the concept and are redirected to login on protected pages", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Construis la tienne/ })).toBeVisible();
  await page.goto("/create");
  await expect(page).toHaveURL(/\/login\?next=%2Fcreate/);
  await page.goto("/projects/00000000-0000-4000-8000-000000000000");
  await expect(page.getByText("Cette page n'existe pas")).toBeVisible();
});

test("signup form validation (invalid email, weak password, minor)", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Nom ou pseudonyme").fill("Mineur");
  await page.getByLabel("Email").fill("pas-un-email");
  await page.getByLabel("Mot de passe").fill("faible");
  await page.getByLabel("Date de naissance").fill("2012-05-05");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByText("Email invalide")).toBeVisible();
  await expect(page.getByText("10 caractères minimum").first()).toBeVisible();
  await expect(page.getByText(/réservé aux personnes majeures/).first()).toBeVisible();
  await expect(page.getByText("Tu dois accepter les conditions")).toBeVisible();
});

test("1–2. two accounts sign up, confirm their email and complete their profile", async () => {
  await signUpAndOnboard(pageA, A);
  await signUpAndOnboard(pageB, B);
});

test("3. Alice publishes a project (automatic suggestions, edited before publishing)", async () => {
  await pageA.getByLabel("Qu'aimerais-tu réaliser ?").fill("J'aimerais créer une marque de vêtements avec d'autres personnes.");
  await pageA.getByRole("button", { name: "Commencer" }).click();
  await pageA.waitForURL(/\/create\?idea=/);
  await pageA.getByRole("button", { name: "Suggestions automatiques" }).click();
  await expect(pageA.getByText("Suggestions automatiques").first()).toBeVisible();
  await expect(pageA.getByLabel("Titre")).toHaveValue("Créer une marque de vêtements");
  await pageA.getByLabel("Titre").fill(PROJECT_TITLE);
  await pageA.getByLabel("Ville (facultatif)").fill("Lyon");
  await pageA.getByRole("button", { name: "Publier le projet" }).click();
  await pageA.waitForURL(/\/projects\/[0-9a-f-]{36}\?created=1/);
  projectUrl = pageA.url().split("?")[0]!;
  await expect(pageA.getByText("Ton projet est publié")).toBeVisible();
  await expect(pageA.getByRole("heading", { name: PROJECT_TITLE })).toBeVisible();
  await expect(pageA.getByText("0/5 étapes")).toBeVisible();
});

test("4–5. Bruno finds it via search and the feed, and expresses interest", async () => {
  await pageB.goto(`/explore?q=${encodeURIComponent("vêtements upcyclés " + RUN)}`);
  await expect(pageB.getByRole("main").getByRole("link", { name: PROJECT_TITLE })).toBeVisible();
  await pageB.goto("/?f=creation");
  const card = pageB.getByRole("main").locator("div.rounded-2xl", { has: pageB.getByRole("link", { name: PROJECT_TITLE }) }).first();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Je suis intéressé" }).click();
  await expect(card.getByRole("button", { name: "Intéressé(e)" })).toBeVisible();
  await pageB.goto(projectUrl);
  await expect(pageB.getByText(/^1$/).first()).toBeVisible();
});

test("6. Bruno applies with « Je peux aider »", async () => {
  await pageB.goto(projectUrl);
  await pageB.getByRole("button", { name: "Je peux aider" }).first().click();
  const dialog = pageB.getByRole("dialog");
  await dialog.getByLabel("Message à l'équipe").fill("Designer textile, je peux créer la première collection et faire les photos.");
  await dialog.getByRole("button", { name: "Envoyer ma candidature" }).click();
  await expect(dialog.getByText("Candidature envoyée")).toBeVisible();
  await dialog.getByRole("button", { name: "Fermer" }).click();
  await expect(pageB.getByRole("button", { name: "Candidature envoyée" }).first()).toBeVisible();
  // Bruno cannot access the collaborative space yet
  await pageB.goto(`${projectUrl}/space`);
  await expect(pageB).toHaveURL(projectUrl);
});

test("7–8. Alice is notified, accepts the application; Bruno joins the team", async () => {
  await pageA.goto("/notifications");
  await expect(pageA.getByText("Bruno Test propose son aide")).toBeVisible();
  await pageA.goto(`${projectUrl}/space?tab=team`);
  await expect(pageA.getByText("Designer textile, je peux créer")).toBeVisible();
  await pageA.getByRole("button", { name: "Accepter" }).click();
  await expect(pageA.getByText("Aucune candidature en attente.")).toBeVisible();
  await pageB.goto(projectUrl);
  await expect(pageB.getByRole("link", { name: "Membre de l'équipe" }).first()).toBeVisible();
  await pageB.goto(`${projectUrl}/space`);
  await expect(pageB.getByText("Espace projet").first()).toBeVisible();
});

test("9. messages are exchanged in real time in the team chat", async () => {
  await pageA.goto(`${projectUrl}/space`);
  await pageA.getByRole("link", { name: "Discussion d'équipe" }).click();
  await pageA.waitForURL(/\/messages\/[0-9a-f-]{36}/);
  const chatUrl = pageA.url();
  await pageB.goto(chatUrl);
  await expect(pageB.locator("#chat-input")).toBeVisible();
  await pageB.waitForTimeout(1500); // let the realtime channel subscribe
  await pageA.locator("#chat-input").fill("Bienvenue Bruno ! On commence par la collection ?");
  await pageA.getByRole("button", { name: "Envoyer" }).click();
  await expect(pageB.getByText("Bienvenue Bruno ! On commence par la collection ?")).toBeVisible(); // pushed, no reload
  await pageB.locator("#chat-input").fill("Avec plaisir, j'envoie des croquis demain.");
  await pageB.locator("#chat-input").press("Enter");
  await expect(pageA.getByText("Avec plaisir, j'envoie des croquis demain.")).toBeVisible();
});

test("10–11. tasks are created and steps completed; progress follows real steps", async () => {
  await pageB.goto(`${projectUrl}/space?tab=tasks`);
  await pageB.getByLabel("Nouvelle tâche").fill("Dessiner trois croquis");
  await pageB.getByLabel("Assignée à").selectOption({ label: "Alice Test" });
  await pageB.getByRole("button", { name: "Ajouter" }).click();
  await expect(pageB.getByText("Dessiner trois croquis")).toBeVisible();

  await pageA.goto(`${projectUrl}/space?tab=steps`);
  await pageA.getByRole("button", { name: /Marquer l'étape .* comme terminée/ }).first().click();
  await expect(pageA.getByText("1/5 étapes terminées")).toBeVisible();
  await pageB.goto(`${projectUrl}/space?tab=steps`);
  await pageB.getByRole("button", { name: /Marquer l'étape .* comme terminée/ }).first().click();
  await expect(pageB.getByText("2/5 étapes terminées")).toBeVisible();
  await pageB.goto(projectUrl);
  await expect(pageB.getByText("40%")).toBeVisible();
});

test("12. notifications are received", async () => {
  await pageA.goto("/notifications");
  await expect(pageA.getByText("Nouvelle tâche : Dessiner trois croquis")).toBeVisible();
  await expect(pageA.getByText(/Étape terminée/).first()).toBeVisible();
  await pageB.goto("/notifications");
  await expect(pageB.getByText("Candidature acceptée")).toBeVisible();
});

test("13. VENTURE AI reports clearly when no provider is configured", async () => {
  await pageA.goto(`${projectUrl}/space?tab=ai`);
  await expect(pageA.getByText("VENTURE AI n'est pas activé sur cette instance")).toBeVisible();
});

test("14. relevant recommendations with an explanation", async () => {
  const { data, error } = await admin.auth.admin.createUser({ email: `chloe.${RUN}@test.venture.invalid`, password: PASSWORD, email_confirm: true, user_metadata: { display_name: "Chloé Marketing", birthdate: "1990-01-01" } });
  if (error) throw error;
  candidateId = data.user.id;
  await admin.from("profiles").update({ onboarded: true, skills: ["Marketing", "Réseaux sociaux"], interests: ["Mode"], is_discoverable: true, availability: "part_time" }).eq("id", candidateId);
  await pageA.goto(`${projectUrl}/space?tab=team`);
  await expect(pageA.getByRole("link", { name: "Chloé Marketing" })).toBeVisible();
  await expect(pageA.getByText(/Compétences recherchées : Marketing/)).toBeVisible();
  await expect(pageA.getByText(/ne garantissent pas la réussite/)).toBeVisible();
});

test("15. projects are still there after logout and login", async () => {
  await pageB.goto("/settings#data");
  await pageB.getByRole("button", { name: "Se déconnecter" }).click();
  await pageB.waitForURL(/\/login/);
  await pageB.goto(`${projectUrl}/space`);
  await expect(pageB).toHaveURL(/\/login/);
  await pageB.getByLabel("Email").fill(B.email);
  await pageB.getByLabel("Mot de passe").fill(PASSWORD);
  await pageB.getByRole("button", { name: "Se connecter" }).click();
  await pageB.waitForURL(/\/space/);
  await expect(pageB.getByText(PROJECT_TITLE).first()).toBeVisible();
  await pageB.goto("/profile");
  await expect(pageB.getByRole("link", { name: new RegExp(PROJECT_TITLE) })).toBeVisible();
});

test("safety: report a project and block a user", async () => {
  await pageB.goto("/u/" + (await admin.from("profiles").select("username").eq("id", candidateId).single()).data!.username);
  await pageB.getByRole("button", { name: "Signaler ce profil" }).click();
  const dialog = pageB.getByRole("dialog");
  await dialog.getByLabel("Motif").selectOption("spam");
  await dialog.getByRole("button", { name: "Envoyer le signalement" }).click();
  await expect(dialog.getByText(/l'équipe de modération/)).toBeVisible();
  await dialog.getByRole("button", { name: "Fermer" }).click();
  pageB.once("dialog", (d) => d.accept());
  await pageB.getByRole("button", { name: "Bloquer" }).click();
  await expect(pageB.getByRole("button", { name: "Débloquer" })).toBeVisible();
});

test("mobile: five-tab navigation and readable project page", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, storageState: await ctxA.storageState() });
  const page = await ctx.newPage();
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Navigation principale" }).last();
  await expect(nav.getByRole("listitem")).toHaveCount(5);
  await expect(nav.getByRole("link", { name: "Créer un projet" })).toBeVisible();
  await page.screenshot({ path: "test-results/mobile-home.png", fullPage: false });
  await page.goto(projectUrl);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: "test-results/mobile-project.png", fullPage: false });
  await ctx.close();
});
