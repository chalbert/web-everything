import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './',
  testMatch: [
    'plugs/**/__tests__/**/*.spec.ts',
    'blocks/**/__tests__/**/*.spec.ts',
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
  // Starts the servers E2E needs. Locally each REUSES an already-running instance
  // (never killing the user's server); in CI each boots fresh.
  webServer: [
    // The app dev server (Vite :3000 + 11ty :8080) the bulk of the e2e specs hit.
    {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    // The static fixture server for the real-browser service-worker lane (#684) —
    // serves `plugs/__tests__/e2e/sw-fixtures/public/` over http://localhost (the
    // secure-context-equivalent origin a SW + Background Fetch require).
    {
      command: 'node plugs/__tests__/e2e/sw-fixtures/serve.mjs',
      url: 'http://localhost:3210',
      reuseExistingServer: !process.env.CI,
      timeout: 30 * 1000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      // The SW lane runs in its own project below (different origin + serviceWorkers).
      testIgnore: ['**/_site/**', '**/*.sw.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    // Real-Chromium service-worker lane (#684): a context that allows SW registration
    // and serves over the static fixture origin, for durable-tier reload-survival
    // verification (#675). Only `*.sw.spec.ts` runs here.
    {
      name: 'chromium-sw',
      testMatch: '**/*.sw.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3210',
        serviceWorkers: 'allow',
      },
    },
  ],
});
