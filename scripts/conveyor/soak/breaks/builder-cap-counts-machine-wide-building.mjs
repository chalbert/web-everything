/**
 * @file breaks/builder-cap-counts-machine-wide-building.mjs — card x3vs6tu. The build-dispatch daemon's own
 * concurrency cap (`planBuildDispatch`'s `busy`) folded in `externalBuilding` — the conveyor's MACHINE-WIDE
 * "building" count (hand-dispatched workers, fix workers, ci-heal workers, stranded claims) — via
 * `Math.max(durable in-flight, externalBuilding)`. That count has nothing to do with THIS builder's own
 * concurrency: a busy machine with zero of the builder's own builds running still read as "full".
 *
 * Live incident, 2026-09-29 ~10:35 AM ET: with 2 stranded claims + 4 hand-dispatched workers, the builder read
 * "6 building" at its own cap of 6 — 0 of its own builds making any progress — and dispatched NOTHING for 30+
 * minutes while 116 items sat queued. At the operator's actually-chosen cap (3) it would never build at all
 * while any other worker ran anywhere on the machine.
 *
 * Operator decision (2026-09-29): the builder cap bounds ONLY the builder's own concurrent builds. Machine-wide
 * load stays the separate load guard's job (#4076) and the heavy-admission slots', never this cap's.
 *
 * Fix (card x3vs6tu): `busy` is now `running.length` alone — `externalBuilding` never feeds the cap, though it
 * still rides through on the return value (`plan.externalBuilding`) purely as a logged signal.
 *
 * SCENARIO: mirrors the live incident's own numbers — cap 6, `externalBuilding` 6 (2 stranded + 4 workers),
 * ZERO of the builder's own durable in-flight builds, one disjointly-scoped launchable candidate. Pre-fix: the
 * old `Math.max` math reads `busy=6`, `slots=0`, dispatches nothing. Post-fix: `busy=0`, `slots=6`, dispatches
 * the one candidate.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { planBuildDispatch, BUILD_DISPATCH_POLICY } from '../../build-dispatch-policy.mjs';

const CAP = 6; // matches the live incident's own operator-chosen cap
const EXTERNAL_BUILDING = 6; // 2 stranded claims + 4 hand-dispatched workers, live 2026-09-29

export default {
  id: 'builder-cap-counts-machine-wide-building',
  title: "the builder's own cap folded in the machine-wide \"building\" count (hand/fix/ci-heal workers, stranded claims), so it dispatched nothing while making zero progress of its own",
  card: 'we:backlog/x3vs6tu',
  fixedBy: { sha: 'PENDING', where: 'lane/builder-cap-own-builds', paths: ['scripts/conveyor/build-dispatch-policy.mjs'] },
  fixPresent(root) {
    const p = join(root, 'scripts/conveyor/build-dispatch-policy.mjs');
    if (!existsSync(p)) return false;
    const src = readFileSync(p, 'utf8');
    // Fixed tree: `busy` is the builder's own running count alone. Pre-fix tree: `busy` still folds in
    // `externalBuilding` via `Math.max`. Absence of that OLD pattern is the fix marker (matches the sibling
    // `build-daemon-self-count-inflation` break's own presence-of-new-field style, inverted since this fix
    // REMOVES a field from the cap math rather than adding one).
    return !/busy\s*=\s*Math\.max\(running\.length,\s*Number\(externalBuilding\)/.test(src);
  },
  async run({ log } = {}) {
    const policy = { ...BUILD_DISPATCH_POLICY, maxConcurrentBuilds: CAP };
    const candidates = [{ num: '5001', lane: 1, scope: ['we:soak/scratch-5001.mjs'] }];
    const r = planBuildDispatch({ candidates, inFlight: [], externalBuilding: EXTERNAL_BUILDING, policy });
    log?.(`dispatch=${r.dispatch.length} busy=${r.busy} externalBuilding=${r.externalBuilding} hold=${r.hold.map((h) => `${h.num}:${h.rule}`).join(',')}`);
    const violations = [];
    if (r.dispatch.length !== 1) {
      violations.push({
        invariant: 'builder-starved-by-machine-load',
        detail: `0 of the builder's own builds are in flight (inFlight: []), yet externalBuilding=${EXTERNAL_BUILDING} `
          + `(machine-wide, not this builder's) at cap ${CAP} left ${r.dispatch.length} of 1 launchable candidates `
          + `dispatched — busy=${r.busy}, held: ${r.hold.map((h) => `${h.num}:${h.rule} (${h.reason})`).join(', ') || 'none'}`,
      });
    }
    return { violations, dispatch: r.dispatch.map((d) => d.num), busy: r.busy, externalBuilding: r.externalBuilding };
  },
  judge(report) {
    return report.violations.map((v) => `[${v.invariant}] ${v.detail}`);
  },
};
