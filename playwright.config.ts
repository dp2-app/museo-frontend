import { defineConfig, devices } from "@playwright/test";

/** Pruebas de punta a punta: el navegador contra el backend REAL (nunca Supabase).
 * Variables: E2E_API (API del backend), E2E_EMAIL y E2E_PASSWORD (cuenta de prueba) o E2E_CUENTA (JSON con ambas). */
const api = process.env.E2E_API ?? "http://localhost:8000/api/v1";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // En local usa el Chrome instalado; en la CI, el Chromium que instala Playwright.
    ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : "chrome",
  },
  webServer: {
    command: "npm run dev -- --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    env: { VITE_API_BASE_URL: api },
  },
});
