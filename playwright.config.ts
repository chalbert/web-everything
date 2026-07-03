import { defineConfig, devices } from '@playwright/test';

// Dedicated port for the deterministic interaction lane (tests/interaction/**) — off the dev ports
// (Vite :3000, 11ty :8080) so its static fixture server never collides with the user's running dev server.
const INTERACTION_PORT = Number(process.env.WE_INTERACTION_PORT) || 3137;

// #2167 (per #1997): the app dev-server ports are env-driven so a lane clone boots + probes its OWN pair,
// not main's 3000/8080. Defaults unchanged (WE's band); a lane's `.env.local` (scripts/lane-pool.mjs) sets
// these. The live-server specs read WE_ELEVENTY_PORT for their baseURL; the webServer health-check below
// probes the Vite port the same way, so `reuseExistingServer` matches the lane's own running pair.
const VITE_PORT = Number(process.env.WE_VITE_PORT) || 3000;

// When set (the CI interaction lane, #2070), skip booting the app dev server (Vite :3000 + 11ty :8080):
// the interaction project is self-contained against the static fixture server and never touches the live
// app. The live-server projects (a11y/content/smoke/visual) are not run in this mode. This lets CI gate
// the deterministic lane without a build-then-serve step (the live lanes CI-home under #800).
const INTERACTION_ONLY = !!process.env.WE_INTERACTION_ONLY;

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
    // Skipped in the interaction-only CI mode (WE_INTERACTION_ONLY) — that lane needs only the fixture
    // server below, so booting the app build would be dead weight (and not CI-safe without #800's build step).
    ...(INTERACTION_ONLY
      ? []
      : [
          {
            command: 'npm run dev',
            url: `http://localhost:${VITE_PORT}`,
            reuseExistingServer: !process.env.CI,
            timeout: 120 * 1000,
          },
        ]),
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
