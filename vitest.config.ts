import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// #449 (per #606): WE consumes the plug platform layer as the `@frontierui/plugs` package — dev-time
// resolved to the sibling Frontier UI source (mirrors vite.config.mts). The rewritten block tests
// import `@frontierui/plugs/*`, so the vitest runner needs the same alias.
const fuiPlugsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../frontierui/plugs');

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
      include: [
        'blocks/**/*.ts',
      ],
      exclude: [
        'node_modules/**',
        'src/**',
        '_site/**',
        'coverage/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        'blocks/**/__tests__/**',
        'blocks/**/index.ts', // Export files don't need coverage
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
      'webtheme/**/__tests__/**/*.test.{ts,tsx}', // webtheme token model + DTCG→CSS compile (#404)
      'reproduction-parity/**/__tests__/**/*.test.{ts,tsx}', // reproduction-conformance harness + per-target gap lists (#1226/#1243)
      'repro-bundle/**/__tests__/**/*.test.{ts,tsx}', // repro-bundle contract — shape + validator/serializer/schema (#1664)
      'webtraits/**/__tests__/**/*.test.{ts,tsx}', // intent-profile → trait build-time resolver (#776)
      'webpolicy/**/__tests__/**/*.test.{ts,tsx}', // webpolicy proof-of-compliance hash chain (#407) + enforcement seam (#408)
      'webcompliance/**/__tests__/**/*.test.{ts,tsx}', // webcompliance gate runner over the policy model (#437)
      'webcases/**/__tests__/**/*.test.{ts,tsx}', // webcases mock-vs-real drift check (#334)
      'interaction-state/**/__tests__/**/*.test.{ts,tsx}', // interaction-state model — dirty/touched/focused/submitted (#1110)
      'demos/**/__tests__/**/*.test.{ts,tsx}', // exercise-app domain logic (e.g. loan permission scopes, #687)
      'tests/a11y/**/__tests__/**/*.test.ts', // pure a11y-gate helpers (e.g. sitemap scope-C derivation, #847) — Playwright owns the *.spec.ts lane
      'functions/**/__tests__/**/*.test.{ts,tsx}', // Cloudflare Pages Functions — phase-1 deploy gate (#1137)
    ],
  },
  resolve: {
    alias: {
      // #449/#1047: the block runtime + its tests import the plug layer via `@frontierui/plugs/*` (FUI
      // owns the impl, WE consumes it as a no-leakage client) — resolve to the sibling FUI source. The
      // local-plugs sub-aliases (`@core`/`@webregistries`/… + `virtual:trait-manifest`) were dropped with
      // `we:plugs/` under #1047: every consumer lived inside that tree, which now resides in FUI.
      '@frontierui/plugs': fuiPlugsRoot,
    },
  },
});
