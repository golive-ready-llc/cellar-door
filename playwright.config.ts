import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests for the web app (tests/smoke). `NEXT_PUBLIC_USE_MOCK` makes the
 * data layer serve a seeded in-memory cellar, so the suite needs no database
 * and no credentials.
 *
 * The web server is the production build rather than `next dev`, so what runs
 * here is what Vercel ships, and no page is compiled on first request. It
 * binds to loopback only: mock mode has no authentication, and the CI runner
 * is a shared machine.
 */
const HOST = "127.0.0.1";
const PORT = Number(process.env.SMOKE_PORT ?? 3131);
const baseURL = `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: "./tests/smoke",
  forbidOnly: !!process.env.CI,
  reporter: "list",
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npm run start -- -H ${HOST} -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      NEXT_PUBLIC_USE_MOCK: "true",
      // These tests describe the public site. A SITE_PASSWORD or single-user
      // mode in the local .env files would send every page to /gate instead,
      // so pin both off — CI has no .env files, but the checkout on this
      // machine does.
      SITE_PASSWORD: "",
      NEXT_PUBLIC_SINGLE_USER_MODE: "false",
    },
  },
});
