import { defineConfig, devices } from '@playwright/test';

// Dedicated port for the deterministic interaction lane (tests/interaction/**) — off the dev ports
// (Vite :3000, 11ty :8080) so its static fixture server never collides with the user's running dev server.
const INTERACTION_PORT = Number(process.env.WE_INTERACTION_PORT) || 3137;

export default defineConfig({
  testDir: './',
  testMatch: [
    'blocks/**/__tests__/**/*.spec.ts',
    'tests/a11y/**/*.spec.ts',
    'tests/content/**/*.spec.ts',
    'tests/smoke/**/*.spec.ts',
    'tests/visual/**/*.spec.ts',
    'tests/interaction/**/*.spec.ts',
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
  // Starts the servers E2E needs. Locally each REUSES an already-running instance (never killing the
  // user's server); in CI they boot fresh.
  // (The service-worker fixture lane was removed with the local `plugs/` tree in #1047 — no
  // `*.sw.spec.ts` specs and no `sw-fixtures/serve.mjs` remain, so its webServer + project are gone.)
  webServer: [
    // The app dev server (Vite :3000 + 11ty :8080) the live-server specs (a11y, content) hit.
    {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    // The static fixture server for the deterministic interaction lane — serves the repo tree (so the
    // fixture loads the REAL shipped JS) on its own port. No app build, no live data.
    {
      command: `node tests/interaction/serve.mjs`,
      // Health-check a real 200 path — the server returns 404 for `/` (no index), which Playwright treats
      // as "not ready" and would time out on.
      url: `http://localhost:${INTERACTION_PORT}/tests/interaction/fixtures/backlog-priority.html`,
      reuseExistingServer: !process.env.CI,
      timeout: 30 * 1000,
      env: { WE_INTERACTION_PORT: String(INTERACTION_PORT) },
    },
  ],
  projects: [
    {
      // Live-server specs against the running dev server (:3000 / :8080).
      name: 'chromium',
      testIgnore: ['**/_site/**', 'tests/interaction/**'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Deterministic client-side interaction specs against the fixture server — its own baseURL/port,
      // no dependency on the app build or live backlog data.
      name: 'interaction',
      testMatch: ['tests/interaction/**/*.spec.ts'],
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${INTERACTION_PORT}` },
    },
  ],
});
