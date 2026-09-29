/**
 * @file breaks/wip-cap-counts-worker-prs.mjs — card xovjhwh. The build-dispatch daemon's open-item WIP cap
 * (`wip-cap`, #4353, `maxOpenItems`) built its "delivered-by-open-PR" side from EVERY open PR whose branch names
 * a card (`prDeliveredNum`) — with no check for WHO dispatched that build. A hand-dispatched worker (fix worker,
 * ci-heal worker, stranded-claim resume) opens a PR with the exact same `lane/<num>-...` shape as one of THIS
 * builder's own dispatches, so its num filled the union too.
 *
 * Live incident, 2026-09-29 ~1:40 PM ET: `openItems` read 7/7 filled by 4293, 4304, 4312, 4314, 4318, 4321,
 * x4mfp16 — every one a worker-delivered PR, none of them this builder's own dispatch — so `wip-cap` held the
 * builder's own cleared items (4382, 4131, 4319) and it built nothing, even with free build slots
 * (`maxConcurrentBuilds` far from its cap).
 *
 * Operator decision (2026-09-29): `maxOpenItems` counts only the builder's OWN open-PR deliveries, per its own
 * durable dispatch-lane run records — never every open PR that merely names a card. `maxOpenPrs` and the
 * `hot-file` scope-overlap hold are UNCHANGED (a worker's PR still counts toward the former and still blocks a
 * scope-overlapping build via the latter) — only the `wip-cap` arithmetic narrows.
 *
 * Fix (card xovjhwh): `planBuildDispatch` takes an optional `dispatchedByBuilder` set; when given, an open PR
 * only feeds the wip-cap union when its delivered num is IN that set. `build-dispatch-daemon.mjs` derives the
 * set from its own `listRunStoreInFlight`/`listSettledBuilds` reads (no new IO — only this daemon's own
 * `dispatch-lane` calls ever write those records) and threads it through.
 *
 * SCENARIO: mirrors the live incident's own numbers — cap 7 (the declared default), 7 open PRs delivering
 * 4293/4304/4312/4314/4318/4321/x4mfp16, NONE of them this builder's own (`dispatchedByBuilder: []`), and 3
 * disjointly-scoped launchable candidates (4382/4131/4319, the builder's own cleared items) with one free build
 * slot per candidate. Pre-fix (or `dispatchedByBuilder` simply ignored by an older `planBuildDispatch`): the union reads
 * 7/7 from the worker PRs alone, and every candidate holds `wip-cap`. Post-fix: the union reads 0/7 (no PR is
 * this builder's own), and all 3 candidates dispatch.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { planBuildDispatch, BUILD_DISPATCH_POLICY } from '../../build-dispatch-policy.mjs';

// The exact worker-delivered nums from the live incident (2026-09-29 ~1:40 PM ET).
const WORKER_NUMS = ['4293', '4304', '4312', '4314', '4318', '4321', 'x4mfp16'];
// The builder's own held cleared items from the same incident.
const BUILDER_NUMS = ['4382', '4131', '4319'];

function scenario() {
  const openPrs = WORKER_NUMS.map((num, i) => ({
    repo: 'we', number: 800 + i, headRefName: `lane/${num}-x`, labels: [], files: [],
  }));
  const candidates = BUILDER_NUMS.map((num) => ({ num, lane: null, scope: [`we:soak/scratch-${num}.mjs`] }));
  return planBuildDispatch({
    candidates,
    openPrs,
    dispatchedByBuilder: [], // none of the 7 open PRs are this builder's own — the live incident's own shape
    // cap 7 (declared default); build slots pinned to one per candidate so the wip-cap alone can bite pre-fix,
    // independent of the declared per-executor concurrency defaults (#4531 lowered Claude's to 1).
    policy: { ...BUILD_DISPATCH_POLICY, maxConcurrentBuilds: BUILDER_NUMS.length },
  });
}

export default {
  id: 'wip-cap-counts-worker-prs',
  title: 'the open-item wip-cap counted every open PR naming a card, including hand-dispatched workers\' — the builder held its own cleared items and built nothing',
  card: 'we:backlog/4494-builder-open-items-limit-counts-only-the-builder-s-own-items.md', // bornAs xovjhwh
  fixedBy: { sha: 'HEAD', where: 'lane/4494-wip-cap-own-items', paths: ['scripts/conveyor/build-dispatch-policy.mjs', 'skills-src/conveyor/build-dispatch-daemon.mjs'] },
  fixPresent(root) {
    const p = join(root, 'scripts/conveyor/build-dispatch-policy.mjs');
    if (!existsSync(p)) return false;
    const src = readFileSync(p, 'utf8');
    // Fixed tree: `planBuildDispatch` reads a `dispatchedByBuilder` set and only counts a delivered num when it
    // is a member. Absence of that marker is the pre-fix tree — an older `planBuildDispatch` simply ignores the
    // extra kwarg this scenario passes, reproducing the OLD unfiltered union with no separate code path needed.
    return /dispatchedByBuilder/.test(src);
  },
  async run({ log } = {}) {
    const r = scenario();
    log?.(`dispatch=${r.dispatch.map((d) => d.num).join(',')} openItems=${r.openItems.count}/${r.openItems.cap} `
      + `filling=${r.openItems.nums.join(',')} hold=${r.hold.map((h) => `${h.num}:${h.rule}`).join(',')}`);
    const violations = [];
    const dispatched = new Set(r.dispatch.map((d) => d.num));
    for (const num of BUILDER_NUMS) {
      if (!dispatched.has(num)) {
        const held = r.hold.find((h) => h.num === num);
        violations.push({
          invariant: 'builder-own-item-held-by-worker-prs',
          detail: `#${num} (the builder's own cleared item) did not dispatch — held: ${held ? `${held.rule} (${held.reason})` : 'not found'}, `
            + `even though none of openItems.filling=[${r.openItems.nums.join(', ')}] is this builder's own dispatch`,
        });
      }
    }
    return { violations, dispatch: [...dispatched], openItems: r.openItems };
  },
  judge(report) {
    return report.violations.map((v) => `[${v.invariant}] ${v.detail}`);
  },
};
