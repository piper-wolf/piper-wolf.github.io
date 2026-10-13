import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  workers: 2,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4321",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "contracts", testMatch: "publication.spec.ts" },
    { name: "chromium", testIgnore: "publication.spec.ts", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", testIgnore: "publication.spec.ts", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "node tests/serve.mjs",
    url: "http://127.0.0.1:4321",
    timeout: 120_000,
  },
});
