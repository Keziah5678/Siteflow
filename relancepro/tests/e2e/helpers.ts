import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

export const mails = (): Array<{ to: string[]; raw: string }> => JSON.parse(readFileSync("test-results/mails.json", "utf8"));
export const unfold = (raw: string) => raw.replace(/=\r?\n/g, "").replace(/=3D/g, "=");

/** Signs up, confirms the address through the local outbox, lands on the dashboard. */
export async function signUpVerified(page: Page, email: string, company: string, name = "Paul Durand") {
  await page.goto("/signup");
  await page.getByLabel("Votre nom").fill(name);
  await page.getByLabel("Entreprise").fill(company);
  await page.getByLabel("E-mail professionnel").fill(email);
  await page.getByLabel("Mot de passe").fill("motdepasse-solide-42");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Créer mon espace/ }).click();
  await expect(page).toHaveURL(/verify-email/);
  await page.goto("/dev/outbox");
  const mail = page.getByTestId("outbox-mail").filter({ hasText: email }).first();
  const text = await mail.textContent();
  const link = text!.match(/https?:\/\/\S+verify-email\?token=[\w-]+/)![0];
  await page.goto(new URL(link).pathname + new URL(link).search);
  await expect(page.getByText("Adresse confirmée")).toBeVisible();
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
}

export async function logout(page: Page) {
  await page.context().clearCookies();
}
