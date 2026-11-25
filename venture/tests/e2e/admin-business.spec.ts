import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";

const env = Object.fromEntries(
  readFileSync(path.resolve(__dirname, "../../.env.local"), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const RUN = Date.now().toString(36);
const PASSWORD = "Venture2026Test";
const created: string[] = [];

async function userPage(browser: Browser, name: string, patch: Record<string, unknown> = {}): Promise<{ page: Page; id: string }> {
  const email = `${name}.${RUN}@test.venture.invalid`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { display_name: name, birthdate: "1990-01-01" } });
  if (error) throw error;
  created.push(data.user.id);
  await admin.from("profiles").update({ onboarded: true, ...patch }).eq("id", data.user.id);
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  return { page, id: data.user.id };
}

test.afterAll(async () => {
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

test("admin area: hidden from regular users, every tab renders for an admin", async ({ browser }) => {
  const { page: user } = await userPage(browser, "regular");
  await user.goto("/admin");
  await expect(user.getByText("Cette page n'existe pas")).toBeVisible();

  const { page } = await userPage(browser, "boss", { platform_role: "admin" });
  for (const [tab, text] of [
    ["reports", /Signalement|Aucun signalement en attente/],
    ["overview", "Membres"],
    ["users", /inscrit le/],
    ["projects", "Créons le plus grand festival électro de Bretagne"],
    ["plans", "Tarifs"],
    ["ai", "Appels"],
    ["settings", "Afficher les données de démonstration"],
    ["audit", /Aucune action|·/],
  ] as const) {
    await page.goto(`/admin?tab=${tab}`);
    await expect(page.getByText(text).first()).toBeVisible();
  }
  // Admins can't touch roles (superadmin only): no role selector
  await page.goto("/admin?tab=users");
  await expect(page.getByLabel("Rôle")).toHaveCount(0);
});

test("admin edits a plan price; the pricing page reflects it", async ({ browser }) => {
  const { page } = await userPage(browser, "pricer", { platform_role: "admin" });
  await page.goto("/admin?tab=plans");
  await page.getByLabel("Prix mensuel (€)").nth(1).fill("12.5");
  await page.getByRole("button", { name: "Enregistrer" }).nth(1).click();
  await expect(page.getByText("Offre mise à jour.")).toBeVisible();
  await page.goto("/pricing");
  await expect(page.getByText(/12,50/)).toBeVisible();
  await expect(page.getByText("Bientôt disponible").first()).toBeVisible(); // Stripe not configured → no fake button
  await admin.from("plan_settings").update({ price_cents: 999 }).eq("plan", "plus");
});

test("business space: activation, plan gate, publishing an opportunity", async ({ browser }) => {
  const { page, id } = await userPage(browser, "acme");
  await page.goto("/business");
  await expect(page.getByText("Active ton compte professionnel")).toBeVisible();
  await page.goto("/settings#business");
  await page.getByLabel("Nom de l'entreprise").fill("Acme Events");
  await page.getByRole("button", { name: "Activer le compte pro" }).click();
  await expect(page.getByText("Compte professionnel actif")).toBeVisible();
  await page.goto("/business?tab=opportunities");
  await expect(page.getByText("Disponible avec l'offre VENTURE Business.")).toBeVisible();
  await admin.from("profiles").update({ plan: "business" }).eq("id", id);
  await page.goto("/business?tab=opportunities");
  await page.getByLabel("Titre").fill("Photographe pour festival");
  await page.getByLabel("Description").fill("Nous cherchons un photographe pour couvrir deux jours de festival en juillet.");
  await page.getByRole("button", { name: "Publier" }).click();
  await expect(page.getByText("Opportunité publiée.")).toBeVisible();
  await page.goto("/business");
  await expect(page.getByText("Par univers")).toBeVisible();
  await page.goto("/explore?u=opportunities");
  await expect(page.getByRole("main").getByRole("link", { name: /Photographe pour festival/ })).toBeVisible();
});

test("settings: privacy, data export, account deletion", async ({ browser }) => {
  const { page, id } = await userPage(browser, "leaver");
  await page.goto("/settings");
  await page.getByText("Apparaître dans les recommandations").click();
  await page.getByRole("button", { name: "Enregistrer" }).nth(1).click();
  await expect(page.getByText("Paramètres enregistrés.")).toBeVisible();
  const { data } = await admin.from("profiles").select("is_discoverable").eq("id", id).single();
  expect(data?.is_discoverable).toBe(false);

  const res = await page.request.get("/api/account/export");
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.account.id).toBe(id);
  expect(json.private.birthdate).toBe("1990-01-01");
  expect((await (await browser.newContext()).request.get("http://localhost:3000/api/account/export")).status()).toBe(401);

  await page.getByRole("button", { name: "Supprimer mon compte" }).click();
  await page.getByRole("dialog").getByLabel("Confirmation").fill("SUPPRIMER MON COMPTE");
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
  await page.waitForURL(/\/login/);
  const { data: gone } = await admin.from("profiles").select("id").eq("id", id);
  expect(gone).toEqual([]);
});

test("VENTURE AI hub and pages render without AI provider", async ({ browser }) => {
  const { page } = await userPage(browser, "curious");
  await page.goto("/ai");
  await expect(page.getByText("VENTURE AI n'est pas activé sur cette instance")).toBeVisible();
  await expect(page.getByText("Business plan")).toBeVisible();
  const r = await page.request.post("/api/ai", { data: { feature: "structure_idea", idea: "Créer une association de randonnée" } });
  expect(r.status()).toBe(503);
  const r2 = await page.request.post("/api/ai", { data: { feature: "hack" } });
  expect(r2.status()).toBe(400);
});
