import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './',
  testMatch: [
    'blocks/**/__tests__/**/*.spec.ts',
    'tests/a11y/**/*.spec.ts',
    'tests/content/**/*.spec.ts',
  ],
  // The 11ty default build copies `.spec.ts` source files into `_site/`, where `testMatch` would
  // also match them — but their relative `../../../src/_data/*.json` imports resolve to nothing from
  // inside `_site/`, throwing at collection-time and blocking the whole run. Ignore the build output.
  testIgnore: '**/_site/**',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  // Starts the server E2E needs. Locally it REUSES an already-running instance
  // (never killing the user's server); in CI it boots fresh.
  // (The service-worker fixture lane was removed with the local `plugs/` tree in #1047 — no
  // `*.sw.spec.ts` specs and no `sw-fixtures/serve.mjs` remain, so its webServer + project are gone.)
  webServer: [
    // The app dev server (Vite :3000 + 11ty :8080) the e2e specs hit.
    {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      testIgnore: ['**/_site/**'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
