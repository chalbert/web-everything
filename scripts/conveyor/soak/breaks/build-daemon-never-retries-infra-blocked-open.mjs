/**
 * @file breaks/build-daemon-never-retries-infra-blocked-open.mjs — #4348-open-pr-retry (unblocks the build
 * daemon). LIVE INCIDENT (2026-09-29 06:47Z): build #4348 finished successfully (agent reported done, branch
 * `lane/4348-cross-locus-build-agents-never-get-the-we-lane-lane-is-overw` pushed to origin) and its gate went
 * green — the ONLY step that failed was `open-pr`, which hit the GitHub rate limit. `pr-land.mjs`'s own #2659
 * handler already recorded a resumable `{ref,sha,body}` handle (`.conveyor/infra-blocked.json`), but nothing
 * ever retried the open: the `infra-blocked` pass was registered in `daemon-manifest.mjs` but no daemon ever
 * ticked it, and `deliver-item-wrapper.mjs` lumped the failure into a generic `wrapper-threw` build-dispatch
 * hold indistinguishable from a real bug. The finished work sat unopened for 2+ hours.
 *
 * Fix: `build-dispatch-daemon.mjs`'s own LIVE tick — already confirmed alive and self-syncing — now runs the
 * `infra-blocked.mjs retry` pass itself, every cycle (`runBuildDispatchTick`'s new `effects.retryInfraBlocked()`
 * call, wired only when `live: true`). No rebuild: the pass only ever re-invokes `pr-land` against the
 * ALREADY-PUSHED ref.
 *
 * Scenario: a LIVE tick with an injected `retryInfraBlocked` effect. Before the fix, `runBuildDispatchTick`
 * never references `effects.retryInfraBlocked` at all, so it is never called — a resumable `blocked-on-infra`
 * open-pr (like #4348) would sit stranded forever. After the fix, it is called exactly once per live tick.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export default {
  id: 'build-daemon-never-retries-infra-blocked-open',
  title: 'a build whose PR-open failed on a GitHub rate limit (blocked-on-infra) sat stranded for 2+ hours — '
    + 'the build-dispatch daemon never retried the open (live #4348, run f4166fa3883080a9)',
  card: 'builder-open-pr-retry (unblocks the build daemon)',
  fixedBy: {
    sha: '77f9f5222b068c320a8aaca18375be79725e9237',
    where: 'lane/builder-open-pr-retry',
    paths: ['skills-src/conveyor/build-dispatch-daemon.mjs', 'scripts/operations/deliver-item-wrapper.mjs'],
  },
  fixPresent(root) {
    const p = join(root, 'skills-src/conveyor/build-dispatch-daemon.mjs');
    return existsSync(p) && /retryInfraBlocked/.test(readFileSync(p, 'utf8'));
  },
  async run({ log } = {}) {
    const daemon = await import('../../../../skills-src/conveyor/build-dispatch-daemon.mjs');
    let calls = 0;
    const out = await daemon.runBuildDispatchTick({
      bookkeeping: {},
      live: true,
      effects: {
        planTick: () => ({
          decisions: { statusLine: 'soak', counts: { building: 0 }, spawnBuilds: [], admission: { queue: [], cleared: [] } },
          nextState: {},
        }),
        fetchOpenPrs: () => [],
        listClaims: () => [],
        releaseClaim: () => {},
        acquireClaim: () => ({ ok: true }),
        listRunStoreInFlight: () => [],
        killSwitch: () => ({ engaged: false }),
        dispatch: () => ({ dispatching: false }),
        // The scenario's own probe: a #2659-shaped resume result, exactly as `infra-blocked.mjs retry`'s real
        // `--json` output would report resuming #4348 once its GitHub rate limit lifted.
        retryInfraBlocked: async () => { calls += 1; return { retried: ['4348'], resumed: [{ num: '4348', pr: 9001 }], surfaced: [], waiting: [] }; },
      },
    });
    log?.(`live tick: calls=${calls} infraRetry=${JSON.stringify(out.infraRetry)}`);
    const violations = [];
    if (calls !== 1) {
      violations.push({
        invariant: 'infra-retry-called-once-per-live-tick',
        detail: `runBuildDispatchTick(live:true) called effects.retryInfraBlocked() ${calls} time(s), expected exactly 1 — `
          + 'a resumable blocked-on-infra open-pr (e.g. #4348) is never retried and sits stranded until its build-dispatch '
          + 'hold expires (240 min), at which point the daemon would try to REBUILD it instead of just resuming the open',
      });
    }
    return { violations, calls, infraRetry: out.infraRetry };
  },
  judge(report) {
    return report.violations.map((v) => `[${v.invariant}] ${v.detail}`);
  },
};
