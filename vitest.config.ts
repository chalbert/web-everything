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
      'capabilities/**/__tests__/**/*.test.{ts,tsx}', // capability provider + static build-matrix (#204)
      'validity-merge/**/__tests__/**/*.test.{ts,tsx}', // validity-merge strategy plane (#212)
      'validator-resolution/**/__tests__/**/*.test.{ts,tsx}', // async validator resolution plane (#214)
      'capability-manifest/**/__tests__/**/*.test.{ts,tsx}', // capability-manifest schema + semver scheme (#266)
      'validation-generation/**/__tests__/**/*.test.{ts,tsx}', // validation-generation intents + adapter registry (#304)
      'module-resolution/**/__tests__/**/*.test.{ts,tsx}', // module-resolution axis model + materializer (#274)
      'guard/**/__tests__/**/*.test.{ts,tsx}', // guard protocol provider+predicate seam (#288/#289)
      'webtheme/**/__tests__/**/*.test.{ts,tsx}', // webtheme token model + DTCG→CSS compile (#404)
      'webpolicy/**/__tests__/**/*.test.{ts,tsx}', // webpolicy proof-of-compliance hash chain (#407) + enforcement seam (#408)
      'webcompliance/**/__tests__/**/*.test.{ts,tsx}', // webcompliance gate runner over the policy model (#437)
      'webdocs/**/__tests__/**/*.test.{ts,tsx}', // webdocs serve-time generator over the webcases pivot (#424)
    ],
  },
  resolve: {
    alias: {
      '@core': '/plugs/core',
      '@webregistries': '/plugs/webregistries',
      '@webinjectors': '/plugs/webinjectors',
      '@webcomponents': '/plugs/webcomponents',
      '@webcontexts': '/plugs/webcontexts',
      '@webbehaviors': '/plugs/webbehaviors',
    },
  },
});
