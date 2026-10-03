/**
 * @file breaks/stalled-label-freezes-whole-build-queue.mjs — epic #4075 (#3383 continuation). ONE open PR carrying a
 * per-PR `review-status:ci-heal-stalled` label froze EVERY queued build, whatever its scope: the build-dispatch
 * policy fed the three `*-stalled` labels into the SAME global `frozen` gate as the operator's manual
 * `blocked:daemon-bug`, so the daemon read "landing freeze: ON — we#2852 is labelled
 * review-status:ci-heal-stalled" and dispatched nothing — even though ci-heal-2852 had actually finished (its
 * completion record said `done`), which made the label itself a mislabel.
 *
 * Live incident: 2026-09-28, we#2852 — the build queue stalled behind one PR none of the queued items touched.
 *
 * Fix (card 4367, we PR #2857): `BUILD_DISPATCH_POLICY.globalFreezeLabels` (just `blocked:daemon-bug`) is the only set that
 * freezes every candidate; a `*-stalled` PR is an ordinary open PR, so `scope-vs-open-prs` still holds a build
 * that overlaps ITS files. (The same PR also stops a finished session reading as `-stalled` in
 * we:scripts/conveyor/review-status-tag.mjs — covered by its own incident unit test.)
 *
 * SCENARIO: a single live-shaped tick through the REAL `runBuildDispatchTick`. One open PR (we#2852) carries
 * `review-status:ci-heal-stalled` and touches `review-status-tag.mjs`; two launchable candidates — one disjoint
 * from that PR, one overlapping it. Green: the disjoint one dispatches and the overlapping one holds on
 * `scope-vs-open-prs`, with no global freeze. Red (pre-fix): the whole tick is frozen and nothing dispatches.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runBuildDispatchTick } from '../../../../skills-src/conveyor/build-dispatch-daemon.mjs';
import { BUILD_DISPATCH_POLICY } from '../../build-dispatch-policy.mjs';

const STALLED_PR = 2852;
const DISJOINT = '9101';
const OVERLAPPING = '9102';

function fakeTick() {
  const scopes = {
    [DISJOINT]: [`we:soak/scratch-${DISJOINT}.mjs`],
    [OVERLAPPING]: ['we:scripts/conveyor/review-status-tag.mjs'],
  };
  const spawnBuilds = [DISJOINT, OVERLAPPING].map((num, i) => ({ num, lane: i + 1 }));
  return {
    decisions: {
      statusLine: 'soak',
      counts: { building: 0, buildingInFlight: 0 },
      spawnBuilds,
      admission: {
        queue: spawnBuilds.map((s) => ({ num: s.num, scope: scopes[s.num] })),
        cleared: spawnBuilds.map((s) => ({ num: s.num, ready: true })),
      },
    },
    nextState: {},
  };
}

export default {
  id: 'stalled-label-freezes-whole-build-queue',
  title: 'one PR labelled review-status:*-stalled froze every queued build, even ones that never touch its files',
  card: 'we:backlog/4367 (we PR #2857, epic #4075)',
  fixedBy: { sha: 'ba6409266', where: 'lane/unfreeze-builder-stalled-label', paths: ['scripts/conveyor/build-dispatch-policy.mjs', 'scripts/conveyor/review-status-tag.mjs'] },
  fixPresent(root) {
    const p = join(root, 'scripts/conveyor/build-dispatch-policy.mjs');
    return existsSync(p) && /globalFreezeLabels/.test(readFileSync(p, 'utf8'));
  },
  async run({ log } = {}) {
    const effects = {
      planTick: () => fakeTick(),
      fetchOpenPrs: () => [{
        repo: 'we',
        prs: [{
          number: STALLED_PR, headRefName: 'lane/2852-ci-heal-fix',
          labels: [{ name: 'review-status:ci-heal-stalled' }],
          files: [{ path: 'scripts/conveyor/review-status-tag.mjs' }],
        }],
      }],
      listClaims: () => [],
      releaseClaim: () => {},
      acquireClaim: () => ({ ok: true }),
      listRunStoreInFlight: () => [],
      killSwitch: () => ({ engaged: false }),
      dispatch: () => ({ dispatching: true, lane: 1 }),
    };
    const out = await runBuildDispatchTick({ bookkeeping: {}, live: false, policy: BUILD_DISPATCH_POLICY, effects });
    const { plan } = out;
    log?.(`frozen=${plan.freeze.frozen} dispatch=${plan.dispatch.map((d) => d.num)} hold=${plan.hold.map((h) => `${h.num}:${h.rule}`)}`);
    const violations = [];
    if (plan.freeze.frozen) {
      violations.push({ invariant: 'global-freeze-on-stalled-label', detail: `whole queue frozen: ${plan.freeze.reasons.join('; ')}` });
    }
    if (!plan.dispatch.some((d) => d.num === DISJOINT)) {
      violations.push({ invariant: 'disjoint-build-held', detail: `#${DISJOINT} (disjoint from we#${STALLED_PR}) did not dispatch — held: ${plan.hold.map((h) => `${h.num}:${h.rule} (${h.reason})`).join(', ') || 'none'}` });
    }
    const overlapHold = plan.hold.find((h) => h.num === OVERLAPPING);
    if (!overlapHold || overlapHold.rule !== 'scope-vs-open-prs') {
      violations.push({ invariant: 'overlapping-build-not-held', detail: `#${OVERLAPPING} overlaps we#${STALLED_PR}'s files and must hold on scope-vs-open-prs, got ${overlapHold ? overlapHold.rule : 'dispatched'}` });
    }
    // `ticks` — the soak CLI's GREEN line reports how many ticks ran (we:scripts/conveyor/soak/run.mjs).
    return { violations, ticks: [plan], dispatch: plan.dispatch.map((d) => d.num) };
  },
  judge(report) {
    return report.violations.map((v) => `[${v.invariant}] ${v.detail}`);
  },
};
