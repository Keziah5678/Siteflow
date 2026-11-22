import { expect, test } from "@playwright/test";
import { signUpVerified } from "./helpers";

const overflow = (page: import("@playwright/test").Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test("mobile : site et espace client sans défilement horizontal", async ({ page }) => {
  for (const path of ["/", "/tarifs", "/demo", "/secteurs/artisans", "/signup"]) {
    await page.goto(path);
    expect(await overflow(page), path).toBeLessThanOrEqual(1);
  }
  await signUpVerified(page, `mobile-${Date.now()}@artisan-e2e.fr`, "Artisan Mobile");
  for (const path of ["/app", "/app/prospects", "/app/prospects/new", "/app/messages", "/app/sequences", "/app/settings", "/app/billing"]) {
    await page.goto(path);
    await expect(page.locator("main").first()).toBeVisible();
    expect(await overflow(page), path).toBeLessThanOrEqual(1);
  }
});
