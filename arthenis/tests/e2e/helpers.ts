import { expect, type Page } from "@playwright/test";

export async function signUp(page: Page, email: string, name: string, password = "motdepasse-solide") {
  await page.goto("/auth?mode=signup");
  await page.getByLabel("Nom de créateur").fill(name);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/worlds$/);
}

export async function signIn(page: Page, email: string, password = "motdepasse-solide") {
  await page.goto("/auth");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Entrer" }).click();
  await expect(page).toHaveURL(/\/worlds/);
}

export async function signOut(page: Page) {
  await page.goto("/profile");
  await page.getByRole("button", { name: "Déconnexion" }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Creates a medieval world without magic, with one fundamental rule. */
export async function createMedievalWorld(page: Page, name: string, opts: { blank?: boolean } = {}) {
  await page.goto("/worlds/new");
  await page.getByTestId("world-name").fill(name);
  await page.getByTestId("world-description").fill("Un royaume de glace et de pierre.");
  if (opts.blank) await page.getByTestId("origin-blank").click();
  await page.getByTestId("wizard-next").click();
  await page.getByRole("button", { name: /^Médiéval/ }).click();
  await page.getByTestId("wizard-next").click();
  await expect(page.getByTestId("law-magic")).not.toBeChecked();
  await page.getByTestId("wizard-next").click();
  await page.getByTestId("rule-title").fill("Le ciel est vide");
  await page.getByTestId("rule-text").fill("Nul être ne vole.");
  await page.getByPlaceholder("ex. voler").fill("voler");
  await page.getByPlaceholder("ex. voler").press("Enter");
  await page.getByRole("button", { name: "+ Ajouter la loi" }).click();
  await page.getByTestId("wizard-next").click();
  await page.getByTestId("wizard-create").click();
  await expect(page).toHaveURL(/\/worlds\/[0-9a-f-]+\/map$/);
  return page.url().match(/worlds\/([0-9a-f-]+)/)![1];
}

/** Fills and saves the entity editor; accepts a Guardian warning with a justification. */
export async function saveEntity(page: Page, name: string, summary: string) {
  await page.getByTestId("entity-name").fill(name);
  await page.getByTestId("entity-summary").fill(summary);
  const just = page.getByTestId("guardian-justification");
  if (await just.isVisible()) await just.fill("Choix assumé du créateur.");
  await page.getByTestId("entity-save").click();
}

/** Clicks the 3D terrain until the scene is ready and the creation editor opens. */
export async function clickTerrain(page: Page, fx = 0.5, fy = 0.55) {
  const canvas = page.locator("[data-testid=map-shell] canvas").first();
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  for (let i = 0; i < 10; i++) {
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    if (await page.getByTestId("entity-name").isVisible({ timeout: 1500 }).catch(() => false)) return;
  }
  throw new Error("terrain never answered the click");
}
