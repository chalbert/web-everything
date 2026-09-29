/**
 * @file breaks/unprepared-card-dispatched-as-build.mjs — card #4470 (operator rule 2026-09-28: PREPARE = full
 * design + explicit MVP cut, build only the MVP). The build queue (`we:scripts/readiness/dispatch-plan.mjs`)
 * dispatched a scoped `story`/`task` candidate to build with NO check that it had ever been through a prepare
 * pass — `dispatchPlan()` held `kind:decision`/`kind:investigation`/grouping items unconditionally, but a plain
 * story/task fell straight through to the lane/capacity gates the moment it had a `scope:`. Live 2026-09-29
 * cost: #4295 (built, then declined — declared scope wrong), #4380 (built, but already done on main), #4108
 * (built, but superseded) — each a full build-agent run a prepare pass (premise check, scope correction,
 * design/MVP/test/proof plan) would have caught before ever spending an agent run.
 *
 * Fix (card #4470): a new opt-in `preparePolicy` axis on `dispatchPlan()` (same "off unless the IO shell opts
 * in" contract `sizePolicy` already uses) holds a scoped candidate with no truthful `preparedDate` — a valid
 * `YYYY-MM-DD` string — `needs-prepare` instead of launching. The live daemon's own IO shell (`main()`, same
 * file) turns this on unconditionally by default (`{ requirePreparedDate: true }`).
 *
 * SCENARIO: a single call to the REAL `dispatchPlan()` — the exact function the live daemon's IO shell
 * (`we:scripts/readiness/dispatch-plan.mjs`'s own `main()`, which `we:scripts/conveyor/tick-core.mjs`'s `main()`
 * shells as `node dispatch-plan.mjs --json`) calls to decide the tick's `spawnBuilds` — with two scoped
 * candidates: one carrying a truthful `preparedDate`, one not. Under the live default `preparePolicy`, RED
 * (pre-fix tree): BOTH launch — the unprepared candidate is dispatched to build. GREEN (post-fix, this tree):
 * only the prepared one launches; the unprepared one holds `needs-prepare`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dispatchPlan } from '../../../readiness/dispatch-plan.mjs';

const PREPARED = '9401';
const UNPREPARED = '9402';
// The live default the IO shell opts every real tick into — see this file's own header.
const LIVE_PREPARE_POLICY = { requirePreparedDate: true };

function scenario() {
  return dispatchPlan({
    queue: [
      { num: PREPARED, kind: 'story', scope: [`we:soak/scratch-${PREPARED}.mjs`], preparedDate: '2026-09-01' },
      { num: UNPREPARED, kind: 'story', scope: [`we:soak/scratch-${UNPREPARED}.mjs`] },
    ],
    leases: [],
    freeLanes: [1, 2],
    preparePolicy: LIVE_PREPARE_POLICY,
  });
}

export default {
  id: 'unprepared-card-dispatched-as-build',
  title: 'a scoped story/task with no truthful preparedDate was dispatched to build — no prepare-pass check at all',
  card: 'we:backlog/4470-builder-builds-only-prepared-cards-unprepared-ones-get-a-pre.md',
  fixedBy: { sha: 'HEAD', where: 'lane/4470-build-only-prepared', paths: ['scripts/readiness/dispatch-plan.mjs'] },
  fixPresent(root) {
    try {
      const src = readFileSync(join(root, 'scripts/readiness/dispatch-plan.mjs'), 'utf8');
      return /needs-prepare/.test(src) && /preparePolicy/.test(src);
    } catch { return false; }
  },
  async run({ log } = {}) {
    const plan = scenario();
    log?.(`launch=${plan.launch.map((l) => l.num)} hold=${plan.held.map((h) => `${h.num}:${h.reason}`)}`);
    const violations = [];
    if (plan.launch.some((l) => l.num === UNPREPARED)) {
      violations.push({ invariant: 'unprepared-card-dispatched', detail: `#${UNPREPARED} (no preparedDate) was dispatched to build under the live default preparePolicy` });
    }
    if (!plan.launch.some((l) => l.num === PREPARED)) {
      const held = plan.held.find((h) => h.num === PREPARED);
      violations.push({ invariant: 'prepared-card-not-dispatched', detail: `#${PREPARED} (truthful preparedDate) did not launch — held: ${held ? `${held.reason}` : 'not found'}` });
    }
    const unpreparedHold = plan.held.find((h) => h.num === UNPREPARED);
    if (plan.launch.every((l) => l.num !== UNPREPARED) && (!unpreparedHold || unpreparedHold.reason !== 'needs-prepare')) {
      violations.push({ invariant: 'unprepared-card-wrong-hold-reason', detail: `#${UNPREPARED} must hold "needs-prepare", got ${unpreparedHold ? unpreparedHold.reason : 'no hold at all'}` });
    }
    return { violations, ticks: [plan], dispatch: plan.launch.map((l) => l.num) };
  },
  judge(report) {
    return report.violations.map((v) => `[${v.invariant}] ${v.detail}`);
  },
};
