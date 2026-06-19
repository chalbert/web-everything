import { defineConfig } from 'vitest/config';

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
        'plugs/**/*.ts',
        'blocks/**/*.ts',
      ],
      exclude: [
        'node_modules/**',
        'src/**',
        '_site/**',
        'coverage/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        'plugs/**/__tests__/**',
        'blocks/**/__tests__/**',
        'plugs/**/index.ts', // Export files don't need coverage
        'blocks/**/index.ts', // Export files don't need coverage
        'plugs/core/utils/pathInsertionMethods.ts', // Infrastructure code not yet used by patches
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
      'plugs/**/__tests__/**/*.test.{ts,tsx}',
      'blocks/**/__tests__/**/*.test.{ts,tsx}',
      'src/**/__tests__/**/*.test.{ts,tsx}', // build-time data files (e.g. burndown accounting)
      'scripts/**/__tests__/**/*.test.mjs', // build/CI tooling (e.g. conformance auto-fix engine, #095)
      'tools/**/__tests__/**/*.test.{ts,tsx}', // build-time Vite plugins (e.g. the trait-enforcer codegen, #484)
      'capabilities/**/__tests__/**/*.test.{ts,tsx}', // capability provider + static build-matrix (#204)
      'validity-merge/**/__tests__/**/*.test.{ts,tsx}', // validity-merge strategy plane (#212)
      'commitment-policy/**/__tests__/**/*.test.{ts,tsx}', // commitment-policy strategy plane (#1112)
      'validator-resolution/**/__tests__/**/*.test.{ts,tsx}', // async validator resolution plane (#214)
      'capability-manifest/**/__tests__/**/*.test.{ts,tsx}', // capability-manifest schema + semver scheme (#266)
      'validation-generation/**/__tests__/**/*.test.{ts,tsx}', // validation-generation intents + adapter registry (#304)
      'module-resolution/**/__tests__/**/*.test.{ts,tsx}', // module-resolution axis model + materializer (#274)
      'source-resolution/**/__tests__/**/*.test.{ts,tsx}', // source-anchor contract + resolver chain (#575)
      'conformance-evidence/**/__tests__/**/*.test.{ts,tsx}', // conformance-evidence manifest contract (#599)
      'guard/**/__tests__/**/*.test.{ts,tsx}', // guard protocol provider+predicate seam (#288/#289)
      'wrapper-conformance/**/__tests__/**/*.test.{ts,tsx}', // behavioral wrapper conformance vectors + runner (#891)
      'conformance-vectors/**/__tests__/**/*.test.{ts,tsx}', // behavioral conformance-vector schema + per-standard suites (#1016)
      'webtheme/**/__tests__/**/*.test.{ts,tsx}', // webtheme token model + DTCG→CSS compile (#404)
      'webtraits/**/__tests__/**/*.test.{ts,tsx}', // intent-profile → trait build-time resolver (#776)
      'webpolicy/**/__tests__/**/*.test.{ts,tsx}', // webpolicy proof-of-compliance hash chain (#407) + enforcement seam (#408)
      'webcompliance/**/__tests__/**/*.test.{ts,tsx}', // webcompliance gate runner over the policy model (#437)
      'webcases/**/__tests__/**/*.test.{ts,tsx}', // webcases mock-vs-real drift check (#334)
      'interaction-state/**/__tests__/**/*.test.{ts,tsx}', // interaction-state model — dirty/touched/focused/submitted (#1110)
      'demos/**/__tests__/**/*.test.{ts,tsx}', // exercise-app domain logic (e.g. loan permission scopes, #687)
      'tests/a11y/**/__tests__/**/*.test.ts', // pure a11y-gate helpers (e.g. sitemap scope-C derivation, #847) — Playwright owns the *.spec.ts lane
    ],
  },
  resolve: {
    alias: {
      // The trait-enforcer is a Vite plugin not loaded under vitest, so the virtual trait
      // manifest has no provider here — alias it to the empty static manifest so bootstrap's
      // `import 'virtual:trait-manifest'` still resolves. Documented non-Vite fallback (#116/#448).
      'virtual:trait-manifest': '/plugs/webbehaviors/traitManifest',
      '@core': '/plugs/core',
      '@webregistries': '/plugs/webregistries',
      '@webinjectors': '/plugs/webinjectors',
      '@webcomponents': '/plugs/webcomponents',
      '@webcontexts': '/plugs/webcontexts',
      '@webbehaviors': '/plugs/webbehaviors',
    },
  },
});
