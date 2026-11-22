import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("dossier, relations, statut, World Brain et vue cosmique", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await signUp(page, `studio-${Date.now()}@arthenis.test`, "Studio");
  await page.getByTestId("new-world").click();
  await page.getByTestId("world-name").fill("Cosmogonie");
  await page.getByTestId("wizard-quick").click();
  await expect(page).toHaveURL(/\/map$/);
  const base = page.url().replace(/\/map$/, "");

  // Two civilizations, then a war relation from the dossier
  for (const name of ["Royaume d'Aube", "Empire du Soir"]) {
    await page.goto(`${base}/civilizations`);
    await page.getByTestId("list-create").click();
    await page.getByTestId("entity-name").fill(name);
    await page.getByTestId("entity-summary").fill("Un peuple fier.");
    await page.getByTestId("entity-save").click();
    await expect(page.getByTestId("entity-card").filter({ hasText: name })).toBeVisible();
  }
  await page.getByTestId("entity-card").filter({ hasText: "Royaume d'Aube" }).click();
  const dossier = page.getByTestId("dossier");
  await expect(dossier).toBeVisible();
  await dossier.locator("select").first().selectOption("war");
  await dossier.locator("select").nth(1).selectOption({ label: "⚜ Empire du Soir" });
  await dossier.getByRole("button", { name: "Lier" }).click();
  await expect(dossier).toContainText("Royaume d'Aube est en guerre contre Empire du Soir");

  // Status change becomes history
  await page.getByRole("button", { name: "Événement / statut" }).click();
  await page.getByLabel("Nouveau statut").selectOption("dissolved");
  await page.getByLabel("Ce qui s'est passé").fill("Le royaume se disloque après la guerre.");
  await page.getByRole("button", { name: "Inscrire dans l'histoire" }).click();
  await expect(dossier).toContainText("Dissous");
  await page.keyboard.press("Escape");

  // World Brain explains the relation from the structured data
  await page.goto(`${base}/brain`);
  await page.getByTestId("brain-input").fill("Quel lien entre Royaume d'Aube et Empire du Soir ?");
  await page.getByRole("button", { name: "Demander" }).click();
  await expect(page.getByTestId("brain-chat")).toContainText("en guerre contre");

  // Cosmic scale: a galaxy, a system and a planet, then the cosmos view
  const cosmic: Array<[string, string, string | null]> = [["galaxy", "Voie d'Argent", null], ["star_system", "Héliade", "🌌 Voie d'Argent"], ["planet", "Thalassa", "☀ Héliade"]];
  for (const [kind, name, parent] of cosmic) {
    await page.goto(`${base}/atlas`);
    await page.getByRole("button", { name: "✦ Nouveau lieu" }).click();
    await page.getByTestId("entity-kind").selectOption(kind);
    await page.getByTestId("entity-name").fill(name);
    if (parent) await page.getByLabel("Situé dans / appartient à").selectOption({ label: parent });
    await page.getByTestId("entity-save").click();
    await expect(page.locator(".tree").getByText(name)).toBeVisible();
  }
  await page.goto(`${base}/map`);
  await page.getByRole("button", { name: "✺ Cosmos" }).click();
  await expect(page.getByTestId("cosmos-canvas").or(page.locator("canvas")).first()).toBeVisible();
  await page.getByRole("button", { name: "◍ Thalassa" }).click();
  await expect(page.getByTestId("map-shell")).toContainText("Thalassa");

  expect(errors, errors.join("\n")).toEqual([]);
});
