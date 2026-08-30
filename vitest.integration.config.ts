import { defineConfig } from 'vitest/config';
import { weAlias } from './vitest.shared';

/**
 * The REAL-git / real-subprocess tier `vitest.config.ts` excludes (see that file's `test.exclude` comment
 * for the full rationale). These files shell `git init`/`clone`/`push` or spawn real `node` children per
 * test — proof-of-CLI-behavior fixtures, not pure-logic unit tests — so they're slow in a way isolation
 * inside the shared suite can only ever redistribute, never remove. Splitting them into their own run:
 *   - keeps them off the `threads` pool the ~2000-file unit suite shares, so they can't inflate each
 *     other's cost under contention (the original motivation for the handful pinned to `forks` below);
 *   - lets `npm run test:unit` (and everything that shells it — `verify-lane.mjs`'s local gate, `npm test`,
 *     `npm run verify`) skip real git/subprocess cost entirely, including its own "sensitive surface, fall
 *     back to full" case — this file is what still proves the real behavior, in CI, before merge.
 * Run via `npm run test:integration:vitest`; wired into CI's `test` job (`.github/workflows/ci.yml`) so the
 * required pre-merge gate is unchanged — only the LOCAL, per-lane cost drops.
 *
 * Three of these were originally pinned to a single serial `forks` process for a CORRECTNESS reason, not
 * just speed — each measured NOT just slow but actively flaky under CPU contention (a wall-clock comparison
 * blown, a timeout tripped): `gate-entrypoint-integration.test.mjs`, `wake-cli.test.mjs`,
 * `dispatch-spawn-live.test.mjs`. They stay pinned here. Everything else runs on this config's default
 * `threads` pool — with the ~2000-file unit suite no longer sharing it, ordinary multi-worker parallelism
 * is enough; they don't need to queue behind one another the way `singleFork` would force.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'scripts/__tests__/stdout-flush.test.mjs',
      'scripts/__tests__/gate-entrypoint-integration.test.mjs',
      'scripts/operations/__tests__/wake-cli.test.mjs',
      'scripts/__tests__/lane-pool-acquire-base.test.mjs',
      'scripts/__tests__/publish-secret-gate.test.mjs',
      'scripts/operations/__tests__/dispatch-spawn-live.test.mjs',
      'scripts/__tests__/lane-pool-reserve.test.mjs',
      'scripts/__tests__/lane-pool-cross-pool.test.mjs',
      'scripts/__tests__/lane-pool-reap-on-acquire.test.mjs',
      'scripts/__tests__/lane-pool-siblings.test.mjs',
      'scripts/__tests__/lane-pool-acquirable.test.mjs',
      'scripts/__tests__/lane-pool-refresh-guard.test.mjs',
      'scripts/__tests__/lane-pool-release-ownership.test.mjs',
      'scripts/__tests__/lane-pool-item-map.test.mjs',
      'scripts/__tests__/lane-pool-ahead-provably-pushed-single-spawn.test.mjs',
      'scripts/__tests__/lane-pool-acquire-stale-origin.test.mjs',
      'scripts/operations/__tests__/backlog-ops-integration.test.mjs',
      'scripts/operations/__tests__/dispatch-lane-integration.test.mjs',
      'scripts/operations/__tests__/gate-health-integration.test.mjs',
      'scripts/operations/__tests__/mutation-check-integration.test.mjs',
      'scripts/operations/__tests__/record-verdict-integration.test.mjs',
      'scripts/operations/__tests__/stage-pr-view-integration.test.mjs',
    ],
    poolMatchGlobs: [
      ['scripts/__tests__/gate-entrypoint-integration.test.mjs', 'forks'],
      ['scripts/operations/__tests__/wake-cli.test.mjs', 'forks'],
      ['scripts/operations/__tests__/dispatch-spawn-live.test.mjs', 'forks'],
    ],
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    alias: weAlias,
  },
});
