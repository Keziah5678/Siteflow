import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

const executablePath = process.env.PW_CHROMIUM_PATH || (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    locale: "fr-FR",
    launchOptions: executablePath ? { executablePath } : undefined,
    trace: "off",
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions: executablePath ? { executablePath } : undefined } }],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
