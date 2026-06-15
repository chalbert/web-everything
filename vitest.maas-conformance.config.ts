import { defineConfig } from 'vitest/config';

/**
 * The opt-in .NET execution-conformance suite (backlog #549 — fork-1 option B).
 *
 * Deliberately a SEPARATE config from `vitest.config.ts`: its sole test
 * (`blocks/renderers/module-service/conformance/dotnet/*.test.ts`) sits outside the default `include`
 * globs so the portable inner loop (`npm test` / `npm run verify`) never spawns `dotnet`. Run only by
 * `npm run check:maas-conformance`, which resolves a capable toolchain into `MAAS_DOTNET` first; the test
 * self-skips without it. Node environment — the suite reads `golden.json` and drives a subprocess, no DOM.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['blocks/renderers/module-service/conformance/dotnet/**/*.test.ts'],
  },
});
