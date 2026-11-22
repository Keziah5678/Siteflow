import { expect, test } from "@playwright/test";
import { signUp } from "./helpers";

test("mobile : accueil, création et studio sans défilement horizontal", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Where worlds are born").first()).toBeVisible();
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(await overflow()).toBeLessThanOrEqual(1);
  await signUp(page, `mobile-${Date.now()}@arthenis.test`, "Nomade");
  await page.getByTestId("new-world").click();
  await page.getByTestId("world-name").fill("Mobile");
  await page.getByTestId("wizard-quick").click();
  await expect(page.getByTestId("map-shell")).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
  expect(await overflow()).toBeLessThanOrEqual(1);
  await page.getByRole("link", { name: /Chronologie/ }).first().click();
  await expect(page.getByTestId("time-engine")).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(1);
});
