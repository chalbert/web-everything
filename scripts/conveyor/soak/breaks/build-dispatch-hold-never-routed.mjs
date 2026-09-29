/**
 * @file breaks/build-dispatch-hold-never-routed.mjs — #4465. LIVE 2026-09-29: three build agents correctly
 * declined items as not-buildable/already-done/superseded; the build-dispatch daemon put each into
 * `build-dispatch-holds` and then never touched it again — `listBuildDispatchHolds` is read ONLY to EXCLUDE a
 * held item from a tick's dispatch candidates (`we:skills-src/conveyor/build-dispatch-daemon.mjs#heldNums`),
 * never to act on WHY it is held. A hold has no TTL-driven self-heal for a spec-judgment reason (only a
 * dead-holder-floor TTL, #4349's own posture), so the card sat with no owner until an operator happened to
 * notice — exactly the "never a manual fix" gap this item closes.
 *
 * Fix: `we:scripts/conveyor/build-dispatch-hold-router.mjs` (classify + IO-shell orchestrator), wired into
 * `we:skills-src/conveyor/build-dispatch-daemon.mjs`'s own live tick as `effects.routeHeldItems`, called with
 * `planHoldRouting`'s own plan — same LIVE-only/best-effort posture `adoptOrphans`/`retryInfraBlocked` already
 * have.
 *
 * This break's own scenario runs REAL `runBuildDispatchTick` (the actual pure core, imported live from this
 * tree) across three consecutive ticks with a held #4380-shaped item (`already-done`, citing a commit) sitting
 * in `effects.listHolds()` the whole time; only the daemon's OWN io-shell spawn (the multi-minute lane
 * acquire→edit→PR arc) is faked, exactly the way `build-dispatch-orphan-adopt.mjs`'s own scenario fakes its one
 * un-runnable-in-a-sandbox step (a real agent spawn) and nothing else.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');

const HELD_REASON = 'spec already done on main: commit b93d13e29 (fix(review-pr): judgeAdvisory quota-holds) '
  + '— card just needs resolving.';

/** A `planTick` answer with nothing to build/hold in the tick core's own admission — the ONLY candidate this
 *  scenario cares about is the held item, sitting entirely in `effects.listHolds()`, never in `spawnBuilds`. */
function emptyTick() {
  return {
    decisions: { statusLine: 'soak', counts: { building: 0 }, spawnBuilds: [], admission: { queue: [], cleared: [] } },
    nextState: {},
  };
}

export default {
  id: 'build-dispatch-hold-never-routed',
  title: 'a build-dispatch hold sits forever with no owner — the daemon reads its reason only to EXCLUDE the '
    + 'item from dispatch, never to act on WHY it is held',
  card: 'we:backlog/4465-builder-routes-a-build-agent-s-not-buildable-already-done-re.md',
  fixedBy: {
    sha: 'HEAD', where: 'lane/hold-route-4465',
    paths: ['scripts/conveyor/build-dispatch-hold-router.mjs', 'skills-src/conveyor/build-dispatch-daemon.mjs'],
  },
  fixPresent(root) {
    const routerPath = join(root, 'scripts/conveyor/build-dispatch-hold-router.mjs');
    const daemonPath = join(root, 'skills-src/conveyor/build-dispatch-daemon.mjs');
    return existsSync(routerPath) && existsSync(daemonPath) && /routeHeldItems/.test(readFileSync(daemonPath, 'utf8'));
  },
  async run({ log } = {}) {
    const { runBuildDispatchTick } = await import(resolve(REPO_ROOT, 'skills-src/conveyor/build-dispatch-daemon.mjs'));
    const routeCalls = [];
    const effects = {
      planTick: () => emptyTick(),
      fetchOpenPrs: () => [],
      listClaims: () => [],
      releaseClaim: () => {},
      acquireClaim: () => ({ ok: true }),
      listRunStoreInFlight: () => [],
      killSwitch: () => ({ engaged: false }),
      dispatch: () => ({ dispatching: false }),
      listHolds: () => [{ num: '4380', reason: HELD_REASON }],
      // The io-shell action itself (a real lane acquire + PR open) is un-runnable in a sandbox — faked here
      // exactly the way build-dispatch-orphan-adopt.mjs's own scenario fakes its one real-agent-spawn step and
      // nothing else. On the PRE-fix tree this is simply never called at all (no such wiring exists yet).
      routeHeldItems: async (plan) => { routeCalls.push(plan); return plan.map((p) => ({ num: p.num, route: p.route, action: 'landing-spawned' })); },
    };
    let bookkeeping = {};
    const ticks = [];
    for (let i = 0; i < 3; i += 1) {
      const r = await runBuildDispatchTick({ bookkeeping, live: true, effects });
      bookkeeping = r.nextBookkeeping;
      ticks.push({ holdRouting: r.holdRouting ?? null, holdRoutingResult: r.holdRoutingResult ?? null });
      log?.(`tick ${i}: holdRouting=${JSON.stringify(r.holdRouting)} routeCalls=${routeCalls.length}`);
    }
    return { routeCalls, ticks };
  },
  judge(report) {
    const problems = [];
    if (!report.routeCalls.length) {
      problems.push('#4380 sat held for 3 ticks and effects.routeHeldItems was never called — the hold has no owner');
    } else {
      const entry = report.routeCalls[0]?.find((e) => e.num === '4380');
      if (!entry) problems.push('#4380 never appeared in the routing plan handed to routeHeldItems');
      else if (entry.route !== 'already-done' || entry.commit !== 'b93d13e29') {
        problems.push(`#4380 was misclassified: ${JSON.stringify(entry)} (expected route 'already-done', commit 'b93d13e29')`);
      }
    }
    return problems;
  },
};
