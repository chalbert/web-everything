import { defineConfig } from 'vitest/config';

/**
 * #4075 DAEMON SOAK HARNESS (card x0zg44l) — `npm run test:soak`. The real review + fix daemons, the real
 * rebuild/self-sync code, a real bare remote with main moving, fake GitHub + fake sessions; the invariants
 * checked after every tick (`scripts/conveyor/soak/soak.mjs`). Minutes, not seconds — so NOT in the unit suite
 * (`vitest.config.ts` only picks up `__tests__/` files; these live beside the harness as `*.soak.test.mjs`) and
 * not in the integration suite either: CI runs it as its own `daemon-soak` job, only on PRs that touch daemon
 * code (`.github/workflows/ci.yml`).
 *
 * `forks` pool: every scenario forks daemon hosts and many short-lived `node`/`git` children, the same reason the
 * simulator's own scenarios are pinned to `forks` in `vitest.integration.config.ts`. Files run in parallel (one
 * world each); tests inside a file run in order.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['scripts/conveyor/soak/**/*.soak.test.mjs'],
    pool: 'forks',
    testTimeout: 15 * 60_000,
    hookTimeout: 5 * 60_000,
  },
});
