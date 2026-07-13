import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke-test config. By default it builds and serves the app locally
 * (`npm run build && npm run start`) and drives it on :3000. Point the suite at
 * a live deployment instead with `BASE_URL=https://lumen.vitaliipopov.dev`, in
 * which case the local web server is skipped.
 */
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const useLocalServer = !process.env.BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: useLocalServer
    ? {
        command: "npm run start",
        url: BASE_URL,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      }
    : undefined,
});
