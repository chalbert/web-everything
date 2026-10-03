/**
 * @file breaks/build-daemon-self-count-inflation.mjs — card 4342 (epic #4075). The build-dispatch daemon read
 * tick-core's `counts.building` as "builds already in flight" — but that count also includes the guards
 * tick-core just created for THIS SAME TICK's own proposed spawns (`newBuildGuards`, folded into
 * `liveBuildGuards` before `counts` is derived). So whenever tick-core proposed N builds at or above the
 * daemon's own `maxConcurrentBuilds`, the daemon saw N candidates AND N "already busy" — `slots = cap - busy`
 * hit 0 before a single candidate was even considered, and every one held `[cap]`, tick after tick, forever.
 *
 * Live incident: 207 consecutive `build-dispatch-daemon` ticks, 2026-09-27T23:20Z–2026-09-28T12:43Z, 0
 * dispatched. Every `cap` hold showed `inFlight: []` (no durable in-flight builds at all) while the daemon's own
 * dry-run (12:57Z) read "durable in-flight builds: none · tick core counts 7 building · would dispatch now:
 * nothing", each of the 7 launchable candidates held `[cap] 7 builds in flight (cap 3)` — the tick's own 7
 * proposals, double-counted as both the candidates AND the reason there was no room for them.
 *
 * Fix (card 4342): tick-core also emits `counts.buildingInFlight` — the SAME tally, but derived from build
 * guards live BEFORE this tick's own spawns (plus leased build lanes), never this tick's own candidates. The
 * daemon reads `counts.buildingInFlight ?? counts.building` for its cap math, so it counts real in-flight work,
 * not its own proposals.
 *
 * SCENARIO: a single live tick whose fake `planTick` mirrors the live incident's own dry-run evidence — 6
 * disjointly-scoped launchable candidates, `cap` set below the candidate count (3, matching the incident), and
 * an otherwise EMPTY prior-tick state (no durable claims, no leased lanes — nothing genuinely in flight). The
 * fake decision object supplies BOTH `counts.building` (== the candidate count, the pre-fix daemon's only
 * signal) and `counts.buildingInFlight: 0` (0 — nothing was actually in flight before this tick's own
 * proposals) so the SAME fixture is a faithful read under either version of the daemon: pre-fix code ignores the
 * field it does not know about and reads the inflated `building`; post-fix code prefers the honest
 * `buildingInFlight`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runBuildDispatchTick } from '../../../../skills-src/conveyor/build-dispatch-daemon.mjs';
import { BUILD_DISPATCH_POLICY } from '../../build-dispatch-policy.mjs';

/** Matches the live incident: 7 candidates, cap 3. Kept slightly smaller (6/3) here only so the fixture's
 *  expected dispatch count (== the cap) stays a round number distinct from the candidate count either way. */
const CANDIDATE_COUNT = 6;
const CAP = 3;

function fakeTick() {
  const spawnBuilds = Array.from({ length: CANDIDATE_COUNT }, (_, i) => ({ num: String(9000 + i), lane: i + 1 }));
  // Each candidate needs its OWN, disjoint scope, or `planBuildDispatch` holds it `scope-vs-open-prs` before the
  // cap is ever reached (unprovable disjointness from open PRs) — masking the exact count this break targets.
  const scopeFor = (num) => [`we:soak/scratch-${num}.mjs`];
  return {
    decisions: {
      statusLine: 'soak',
      counts: { building: CANDIDATE_COUNT, buildingInFlight: 0 },
      spawnBuilds,
      admission: {
        queue: spawnBuilds.map((s) => ({ num: s.num, scope: scopeFor(s.num) })),
        cleared: spawnBuilds.map((s) => ({ num: s.num, ready: true })),
      },
    },
    nextState: {},
  };
}

export default {
  id: 'build-daemon-self-count-inflation',
  title: 'the build-dispatch daemon counted its own just-proposed spawns as already-in-flight builds, so its cap held every candidate forever',
  card: 'we:backlog/4342 (epic #4075)',
  fixedBy: { sha: 'e32c19ac2', where: 'lane/4342-build-dispatch-inflight-count', paths: ['scripts/conveyor/tick-core.mjs', 'skills-src/conveyor/build-dispatch-daemon.mjs'] },
  fixPresent(root) {
    const p = join(root, 'skills-src/conveyor/build-dispatch-daemon.mjs');
    return existsSync(p) && /buildingInFlight/.test(readFileSync(p, 'utf8'));
  },
  async run({ log } = {}) {
    const policy = { ...BUILD_DISPATCH_POLICY, maxConcurrentBuilds: CAP };
    const effects = {
      planTick: () => fakeTick(),
      fetchOpenPrs: () => [{ repo: 'plateau-app', prs: [] }],
      listClaims: () => [],
      releaseClaim: () => {},
      acquireClaim: () => ({ ok: true }),
      listRunStoreInFlight: () => [],
      killSwitch: () => ({ engaged: false }),
      dispatch: () => ({ dispatching: true, lane: 1 }),
    };
    const out = await runBuildDispatchTick({ bookkeeping: {}, live: false, policy, effects });
    log?.(`dispatch=${out.plan.dispatch.length} hold=${out.plan.hold.map((h) => `${h.num}:${h.rule}`).join(',')}`);
    const violations = [];
    if (out.plan.dispatch.length !== CAP) {
      violations.push({
        invariant: 'cap-not-filled',
        detail: `expected ${CAP} dispatchable candidates (cap ${CAP}, nothing genuinely in flight), got ${out.plan.dispatch.length} — held: ${out.plan.hold.map((h) => `${h.num}:${h.rule} (${h.reason})`).join(', ') || 'none'}`,
      });
    }
    return { violations, dispatch: out.plan.dispatch.map((d) => d.num) };
  },
  judge(report) {
    return report.violations.map((v) => `[${v.invariant}] ${v.detail}`);
  },
};
