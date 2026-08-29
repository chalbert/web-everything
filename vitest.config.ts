import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// #449 (per #606): WE consumes the plug platform layer as the `@frontierui/plugs` package — dev-time
// resolved to the sibling Frontier UI source (mirrors vite.config.mts). The rewritten block tests
// import `@frontierui/plugs/*`, so the vitest runner needs the same alias.
const fuiPlugsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../frontierui/plugs');
// #1910: the webtheme runtime relocated to fui:webtheme (#1907, per #1282). WE's remaining runtime
// consumer — the reproduction-parity harness — imports it via `@frontierui/webtheme`, dev-time resolved
// to the sibling FUI source (mirrors the `@frontierui/plugs` alias). WE keeps only the contract + vectors.
const fuiWebthemeRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../frontierui/webtheme');

export default defineConfig({
  // Mirror vite.config.mts so .tsx files (the shared mapping fixtures + conformance suites)
  // compile the JSX mirror dialect through the realigned renderer here exactly as they do in
  // the browser. esbuild only applies these to .tsx/.jsx, so plain .ts tests are unaffected.
  esbuild: {
    jsxFactory: 'jsx.createElement',
    jsxFragment: 'jsx.Fragment',
    jsxInject: `import jsx from '/blocks/renderers/jsx'`,
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // #2082: the 80% bar governs the unit-tested STANDARDS/IMPL planes, not just blocks/. This mirrors
      // the tested standards planes in `test.include` below — every plane that ships real `*.ts` source
      // behind a unit suite. Deliberately EXCLUDED (own gates, not this rule): demos/ (the exercise apps
      // are forcing-functions, Playwright/conformance-gated), src/ (11ty templates), tools/ + scripts/
      // (build tooling, mostly .mjs). Measured 85% across this set (blocks-only was 85.45%); folding in
      // the UI/build planes craters it to ~68% and misrepresents the bar. Keep this list and the
      // `test.include` standards planes in lockstep when a new plane lands.
      include: [
        'blocks/**/*.ts',
        'capabilities/**/*.ts',
        'validity-merge/**/*.ts',
        'commitment-policy/**/*.ts',
        'error-summary/**/*.ts',
        'validator-resolution/**/*.ts',
        'capability-manifest/**/*.ts',
        'validation-generation/**/*.ts',
        'module-resolution/**/*.ts',
        'source-resolution/**/*.ts',
        'conformance-evidence/**/*.ts',
        'guard/**/*.ts',
        'reliability/**/*.ts',
        'intl/**/*.ts',
        'manifests/**/*.ts',
        'process/**/*.ts',
        'wrapper-conformance/**/*.ts',
        'conformance-vectors/**/*.ts',
        'webtheme/**/*.ts',
        'reproduction-parity/**/*.ts',
        'repro-bundle/**/*.ts',
        'explorer/**/*.ts',
        'webtraits/**/*.ts',
        'webcompliance/**/*.ts',
        'webcases/**/*.ts',
        'interaction-state/**/*.ts',
        'config/**/*.ts',
        'functions/**/*.ts',
      ],
      exclude: [
        'node_modules/**',
        'src/**',
        '_site/**',
        'coverage/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/__tests__/**',
        '**/__fixtures__/**',
        '**/index.ts', // Export/barrel files don't need coverage
        '.eleventy.js',
        'playwright.config.ts',
        'vitest.config.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    include: [
      // #1047: WE's plug tests relocated to FUI (the canonical impl home) when `we:plugs/` was deleted.
      'blocks/**/__tests__/**/*.test.{ts,tsx}',
      'src/**/__tests__/**/*.test.{ts,tsx}', // build-time data files (e.g. burndown accounting)
      'scripts/**/__tests__/**/*.test.mjs', // build/CI tooling (e.g. conformance auto-fix engine, #095)
      'skills-src/**/__tests__/**/*.test.mjs', // skill-local mechanism modules (e.g. the conveyor headless runner, #2702)
      'tools/**/__tests__/**/*.test.{ts,tsx}', // build-time Vite plugins (e.g. the trait-enforcer codegen, #484)
      'capabilities/**/__tests__/**/*.test.{ts,tsx}', // capability provider + static build-matrix (#204)
      'validity-merge/**/__tests__/**/*.test.{ts,tsx}', // validity-merge strategy plane (#212)
      'commitment-policy/**/__tests__/**/*.test.{ts,tsx}', // commitment-policy strategy plane (#1112)
      'error-summary/**/__tests__/**/*.test.{ts,tsx}', // GOV.UK error-summary aggregation model (#1114)
      'validator-resolution/**/__tests__/**/*.test.{ts,tsx}', // async validator resolution plane (#214)
      'capability-manifest/**/__tests__/**/*.test.{ts,tsx}', // capability-manifest schema + semver scheme (#266)
      'validation-generation/**/__tests__/**/*.test.{ts,tsx}', // validation-generation intents + adapter registry (#304)
      'module-resolution/**/__tests__/**/*.test.{ts,tsx}', // module-resolution axis model + materializer (#274)
      'source-resolution/**/__tests__/**/*.test.{ts,tsx}', // source-anchor contract + resolver chain (#575)
      'conformance-evidence/**/__tests__/**/*.test.{ts,tsx}', // conformance-evidence manifest contract (#599)
      'guard/**/__tests__/**/*.test.{ts,tsx}', // guard protocol provider+predicate seam (#288/#289)
      'reliability/**/__tests__/**/*.test.{ts,tsx}', // error-recovery handler registry + trust-boundary guard (#1019/#1052)
      'intl/**/__tests__/**/*.test.{ts,tsx}', // Intl-formatting provider registry + native-first default (#1020/#1055)
      'manifests/**/__tests__/**/*.test.{ts,tsx}', // changelog-manifest reader — strictest-wins severity + migration integrity gate (#1021/#1058)
      'process/**/__tests__/**/*.test.{ts,tsx}', // self-driven artefact contract runtime — meta-schema registries + driving loop (#1026/#1071)
      'wrapper-conformance/**/__tests__/**/*.test.{ts,tsx}', // behavioral wrapper conformance vectors + runner (#891)
      'conformance-vectors/**/__tests__/**/*.test.{ts,tsx}', // behavioral conformance-vector schema + per-standard suites (#1016)
      // webtheme runtime + its token/scheme/palette tests were deleted with the runtime (#1910 — impl→
      // fui:webtheme, WE keeps contract + vectors per #1282). The reproduction-parity harness now resolves
      // the runtime via the `@frontierui/webtheme` alias below.
      'reproduction-parity/**/__tests__/**/*.test.{ts,tsx}', // reproduction-conformance harness + per-target gap lists (#1226/#1243)
      'repro-bundle/**/__tests__/**/*.test.{ts,tsx}', // repro-bundle contract — shape + validator/serializer/schema (#1664)
      'explorer/**/__tests__/**/*.test.{ts,tsx}', // explorer result interchange — SARIF-compatible shape + validator/projector (#1769)
      'webtraits/**/__tests__/**/*.test.{ts,tsx}', // intent-profile → trait build-time resolver (#776)
      'webcompliance/**/__tests__/**/*.test.{ts,tsx}', // webcompliance gate runner over the policy model (#437)
      'webcases/**/__tests__/**/*.test.{ts,tsx}', // webcases mock-vs-real drift check (#334)
      'interaction-state/**/__tests__/**/*.test.{ts,tsx}', // interaction-state model — dirty/touched/focused/submitted (#1110)
      'config/**/__tests__/**/*.test.{ts,tsx}', // webeverything.config author surface + per-dimension resolver (#1702)
      'demos/**/__tests__/**/*.test.{ts,tsx}', // exercise-app domain logic (e.g. loan permission scopes, #687)
      'tests/a11y/**/__tests__/**/*.test.ts', // pure a11y-gate helpers (e.g. sitemap scope-C derivation, #847) — Playwright owns the *.spec.ts lane
      'functions/**/__tests__/**/*.test.{ts,tsx}', // Cloudflare Pages Functions — phase-1 deploy gate (#1137)
    ],
    // #2407: the hermetic gate-entrypoint integration test spawns two REAL `node` child processes (driving
    // the actual merge-ai-prs.mjs CLI end-to-end, see that file's header). Alone it's ~3s; under full-suite
    // CPU contention from OTHER concurrent worker threads/processes (e.g. the lane-pool subprocess tests)
    // it measured ~51s. Routing just this one file to its own single `forks` process keeps its subprocess
    // spawns off the shared `threads` worker pool the rest of the suite runs on, instead of contending with
    // every other file for the same pool of worker threads. Scoped to this file only — no other test's pool
    // assignment changes.
    // #3037 (PR #1211 round 2, G3): `wake-cli.test.mjs` joins it for the same reason and with the same
    // measurement behind it. It drives the REAL waker CLI in a `node` child whose `claude` is an `sh` stub,
    // and on the shared `threads` pool that child competed with every other worker for CPU — the stub's own
    // spawn missed the observer's 15-second bound roughly one `--shard=1/2` run in five, and the test failed
    // on an assertion whose subject had never been reached. The bound is now removable per-process
    // (`WE_DISPATCH_LIST_TIMEOUT_MS=0`, which the test sets) and this keeps its subprocess spawns off the
    // shared pool as well: the race is removed, and then the contention that produced it is too.
    // #xp2pmg4: `lane-pool-acquire-base.test.mjs` and `publish-secret-gate.test.mjs` join the same override
    // for the same underlying reason — both spin up real `git init`/`git clone` fixture repos, and those
    // subprocess spawns are exactly the CPU contention the comment above already names as a cost on the
    // shared `threads` pool. Measured wall-clock on main before this change: lane-pool-acquire-base.test.mjs
    // ~202.4s (13 tests), publish-secret-gate.test.mjs ~40.6s (12 tests) — both dominate the unit-test/
    // verify-lane gate far beyond anything else in the suite. This is routing-only: it moves the files onto
    // the same isolated single `forks` process as their siblings above, with no change to the tests
    // themselves (replacing the real git subprocesses with mocks is a separate, bigger design call).
    poolMatchGlobs: [
      ['scripts/__tests__/gate-entrypoint-integration.test.mjs', 'forks'],
      ['scripts/operations/__tests__/wake-cli.test.mjs', 'forks'],
      ['scripts/__tests__/lane-pool-acquire-base.test.mjs', 'forks'],
      ['scripts/__tests__/publish-secret-gate.test.mjs', 'forks'],
    ],
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    alias: {
      // #449/#1047: the block runtime + its tests import the plug layer via `@frontierui/plugs/*` (FUI
      // owns the impl, WE consumes it as a no-leakage client) — resolve to the sibling FUI source. The
      // local-plugs sub-aliases (`@core`/`@webregistries`/… + `virtual:trait-manifest`) were dropped with
      // `we:plugs/` under #1047: every consumer lived inside that tree, which now resides in FUI.
      '@frontierui/plugs': fuiPlugsRoot,
      // #1910: the reproduction-parity harness resolves the relocated webtheme runtime here (impl→fui).
      '@frontierui/webtheme': fuiWebthemeRoot,
    },
  },
});
