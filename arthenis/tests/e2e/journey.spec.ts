import { expect, test } from "@playwright/test";
import { clickTerrain, createMedievalWorld, saveEntity, signIn, signOut, signUp } from "./helpers";

const stamp = Date.now();
const creator = `createur-${stamp}@arthenis.test`;
const contributor = `contrib-${stamp}@arthenis.test`;
const reader = `lecteur-${stamp}@arthenis.test`;

test.describe.configure({ mode: "serial" });

test("parcours complet : compte → monde → lois → carte → Guardian → persistance → temps → collaboration", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));

  // Landing
  await page.goto("/");
  await expect(page.getByText("Where worlds are born").first()).toBeVisible();

  // Account + world with its laws
  await signUp(page, creator, "Keziah");
  const worldId = await createMedievalWorld(page, "Aerion");

  // The 3D map renders a WebGL canvas
  await expect(page.getByTestId("map-shell")).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });

  // Create a city directly on the map
  await page.getByTestId("place-city").click();
  await clickTerrain(page);
  await expect(page.getByLabel("Position X (0–100)")).not.toHaveValue("");
  await saveEntity(page, "Hautemarche", "Capitale de pierre au pied des glaciers.");
  await expect(page.getByTestId("map-selection")).toContainText("Hautemarche");

  // Guardian: a sorcerer in a world without magic is a CONFLICT and cannot be saved
  await page.getByTestId("nav-characters").click();
  await page.getByTestId("list-create").click();
  await page.getByTestId("entity-name").fill("Malvor");
  await page.getByTestId("entity-summary").fill("Un sorcier qui lance des boules de feu.");
  await expect(page.getByTestId("guardian-verdict")).toHaveText("CONFLICT");
  await expect(page.getByTestId("guardian-report")).toContainText("magie n'existe pas");
  await expect(page.getByTestId("entity-save")).toBeDisabled();
  // Fundamental rule from the wizard is enforced too
  await page.getByTestId("entity-summary").fill("Un homme qui sait voler au-dessus des pics.");
  await expect(page.getByTestId("guardian-report")).toContainText("Le ciel est vide");
  // A coherent character is VALID
  await page.getByTestId("entity-name").fill("Aldric");
  await page.getByTestId("entity-summary").fill("Roi vieillissant d'Aerion.");
  await page.getByLabel("Âge").fill("62");
  await expect(page.getByTestId("guardian-verdict")).toHaveText("VALID");
  await page.getByTestId("entity-save").click();
  await expect(page.getByTestId("entity-card").filter({ hasText: "Aldric" })).toBeVisible();

  // Data survives a reload, and a full sign-out / sign-in
  await page.reload();
  await expect(page.getByTestId("entity-card").filter({ hasText: "Aldric" })).toBeVisible();
  await signOut(page);
  await signIn(page, creator);
  await expect(page.getByTestId("world-card").filter({ hasText: "Aerion" })).toBeVisible();
  await page.goto(`/worlds/${worldId}/atlas`);
  await expect(page.getByText("Hautemarche")).toBeVisible();

  // Time engine: preview then apply 100 years, consequences recorded
  await page.goto(`/worlds/${worldId}/timeline`);
  const before = await page.getByTestId("world-clock").textContent();
  await page.getByTestId("advance-100ans").click();
  await expect(page.getByTestId("sim-preview")).toBeVisible();
  await expect(page.getByTestId("sim-preview")).toContainText("Mort de Aldric");
  await page.getByTestId("sim-apply").click();
  await expect(page.getByTestId("sim-preview")).toBeHidden();
  await expect(page.getByTestId("world-clock")).not.toHaveText(before!);
  await page.reload();
  await expect(page.getByTestId("timeline")).toContainText("Mort de Aldric");

  // Constitution amendment: recorded, with impact analysis
  await page.goto(`/worlds/${worldId}/settings`);
  await page.getByTestId("amend-magic").check();
  await expect(page.getByTestId("law-impact")).toContainText("Magie");
  await page.getByTestId("amend-reason").fill("Les runes anciennes se réveillent.");
  await page.getByTestId("amend-submit").click();
  await page.goto(`/worlds/${worldId}/timeline`);
  await expect(page.getByTestId("timeline")).toContainText("Amendement de la constitution");

  // Collaboration: invite a contributor and a reader
  await page.goto(`/worlds/${worldId}/collaboration`);
  await page.getByTestId("invite-email").fill(contributor);
  await page.getByTestId("invite-send").click();
  await expect(page.getByText(`${contributor} · Contributeur · en attente`)).toBeVisible();
  await page.getByTestId("invite-email").fill(reader);
  await page.locator("select").last().selectOption("reader");
  await page.getByTestId("invite-send").click();
  await expect(page.getByText(`${reader} · Lecteur · en attente`)).toBeVisible();
  await signOut(page);

  // A stranger cannot open the private world
  await signUp(page, `intrus-${stamp}@arthenis.test`, "Intrus");
  await page.goto(`/worlds/${worldId}/map`);
  await expect(page.getByText("Monde inaccessible")).toBeVisible();
  await signOut(page);

  // Contributor accepts, proposes (cannot write directly)
  await signUp(page, contributor, "Contributrice");
  await page.getByRole("button", { name: "Accepter" }).click();
  await expect(page).toHaveURL(new RegExp(`/worlds/${worldId}`));
  await page.goto(`/worlds/${worldId}/creatures`);
  await page.getByTestId("list-create").click();
  await page.getByTestId("entity-kind").selectOption("animal");
  await saveEntity(page, "Loup blanc", "Prédateur des neiges éternelles.");
  await expect(page.getByTestId("entity-save")).toBeHidden();
  await page.goto(`/worlds/${worldId}/collaboration`);
  await expect(page.getByTestId("proposals")).toContainText("Loup blanc");
  await signOut(page);

  // Reader: read-only
  await signUp(page, reader, "Lecteur");
  await page.getByRole("button", { name: "Accepter" }).click();
  await page.goto(`/worlds/${worldId}/characters`);
  await expect(page.getByTestId("entity-card").first()).toBeVisible();
  await expect(page.getByTestId("list-create")).toHaveCount(0);
  await signOut(page);

  // Creator validates the proposal
  await signIn(page, creator);
  await page.goto(`/worlds/${worldId}/collaboration`);
  await page.getByTestId("proposal-review").first().click();
  await page.getByTestId("proposal-approve").click();
  await page.goto(`/worlds/${worldId}/creatures`);
  await expect(page.getByTestId("entity-card").filter({ hasText: "Loup blanc" })).toBeVisible();

  // History: revisions are kept
  await page.goto(`/worlds/${worldId}/history`);
  await expect(page.getByText("law_change").first()).toBeVisible();
  await expect(page.getByText("simulation").first()).toBeVisible();

  expect(errors, errors.join("\n")).toEqual([]);
});

test("univers vierge : la carte commence blanche", async ({ page }) => {
  await signUp(page, `vierge-${stamp}@arthenis.test`, "Vierge");
  await createMedievalWorld(page, "Néant", { blank: true });
  await expect(page.getByTestId("terra-incognita")).toBeVisible();
  await page.getByRole("button", { name: "Placer un premier continent" }).click();
  await clickTerrain(page);
  await saveEntity(page, "Boréalie", "Le premier continent.");
  await expect(page.getByTestId("terra-incognita")).toBeHidden();
});
