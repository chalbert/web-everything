/**
 * @file breaks/ci-heal-empty-scope.mjs — live break 3, 2026-09-25 (#4075, card x9gnyt9). The fix-dispatch
 * daemon's ci-heal pass (`we:scripts/operations/ci-heal-pr-dispatch.mjs#dispatchCiHeal`) required its brief's
 * `SCOPE` placeholder to be non-blank. `runReconcileCiHealDispatch` builds `planned.scope` straight from
 * `resolvePrWorkUnit` (`we:scripts/conveyor/pr-work-unit.mjs`) with NO pre-dispatch gate (unlike the sibling
 * `fix` path, `reconcile-fix-dispatch.mjs#planFixesFromReconcile`, which already refuses cleanly with
 * `no-scope` before ever reaching `dispatchFix`) — so a PR naming no backlog item, whose diff-derived scope
 * ALSO came back empty (a real `gh` hiccup in the dispatching checkout, not just "no item"), reached
 * `fillBrief` with `scope: []` and threw deep inside ("dispatch-lane: no value for the brief placeholder
 * {{SCOPE}}"). One level up, `runReconcileCiHealDispatch`'s per-entry `catch` turned that into an opaque
 * `dispatch-failed` refusal, reported every tick, and the PR's ci-heal never dispatched — CI stayed red
 * forever, once per tick, until a human noticed. Live incident: PRs #2653/#2636/#2635.
 *
 * Fix: a6cbfced4 (card x9gnyt9, merged via PR #2666) — `scripts/operations/ci-heal-pr-dispatch.mjs`'s
 * `dispatchCiHeal` moves `SCOPE` from `BRIEF_REQUIRED_BY_KIND['ci-heal']`'s implicit required set into the
 * `fillBrief` call's OPTIONAL placeholder list, so a blank scope degrades to an honestly UNFENCED heal
 * (`SCOPE: ''`) instead of throwing — the diff-derived scope upstream still supplies a real fence whenever
 * `gh` cooperates; this is the last-resort backstop, never the common path.
 *
 * SCENARIO: the plain soak world's default PR fleet already seeds exactly this population —
 * `red-no-item` (`we:scripts/conveyor/soak/fleet.mjs`): red CI, no backlog item, `owes: 'ci-heal'`. This
 * scenario adds the other half of the live trigger — the diff-paths read ALSO failing — by arming a
 * persistent fake-`gh` fault on the exact verb `resolvePrWorkUnit`'s diff fallback shells
 * (`fetchPrDiffPaths` / `reconcile-fix-dispatch.mjs`, `gh pr diff <n> --name-only`, verb `"pr diff"`), so the
 * PR's itemNum is null (its branch names no item) AND its diff paths come back empty — the exact
 * `attribution:'pr', scope: []` shape the live bug needed. The fake-gh fault API matches by VERB ONLY (no
 * per-PR scoping — a harness limitation, see `we:scripts/conveyor/__tests__/helpers/fake-gh-shim.mjs`'s own
 * `fault()` docblock), so this also empties the diff-derived fallback scope for the fleet's OTHER item-less PR
 * (`changes`, owed a `fix`) — that PR already has its own correct, UNRELATED `no-scope` refusal gate
 * (`planFixesFromReconcile`), so it degrades to a harmless (and, before or after this fix, IDENTICAL) `owed`
 * "fix" noise line filtered out by this scenario's own `judge()` below, never a false signal for THIS break.
 *
 * RED = the `owed` invariant fires for `red-no-item`'s `ci-heal` (the daemon-owned-work tracker built into
 * `we:scripts/conveyor/soak/invariants.mjs` — no scenario-specific hook needed to detect it): pre-fix,
 * `dispatchCiHeal` throws before ever reaching the dispatch sink, so no `ci-heal-<pr>` session is ever
 * spawned and the PR's owed work is never marked dispatched. GREEN = post-fix, the degraded unfenced heal
 * still dispatches (spawns a real `ci-heal-<pr>` fake-claude session), so `owed` is satisfied well inside
 * grace.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runSoak } from '../soak.mjs';

/** Enough fix-dispatch ticks to exceed `invariants.mjs#DEFAULT_BOUNDS.owedGraceTicks` (6) with margin. */
const ROUNDS = 9;
/** Comfortably covers every `pr diff` call this run makes (ci-heal's `red-no-item` + fix's `changes`, once
 *  per fix-dispatch tick, across every constellation repo the daemon iterates) — see this file's own header
 *  on why the fault is verb-wide, not PR-scoped. */
const FAULT_TIMES = 400;

export default {
  id: 'ci-heal-empty-scope',
  title: "ci-heal dispatch throws (and never dispatches) on an item-less PR whose diff-derived scope also comes back empty",
  card: 'we:backlog/x9gnyt9-ci-heal-dispatch-throws-on-empty-scope-instead-of-degrading.md (epic #4075)',
  fixedBy: { sha: 'a6cbfced4', where: 'main', paths: ['scripts/operations/ci-heal-pr-dispatch.mjs'] },
  fixPresent(root) {
    try {
      const src = readFileSync(join(root, 'scripts/operations/ci-heal-pr-dispatch.mjs'), 'utf8');
      // The exact optional-placeholder-list call the fix adds: `[...OPTIONAL_BRIEF_PLACEHOLDERS, 'ITEM_NUM', 'SCOPE']`.
      return /\[\s*\.\.\.OPTIONAL_BRIEF_PLACEHOLDERS\s*,\s*'ITEM_NUM'\s*,\s*'SCOPE'\s*\]/.test(src);
    } catch { return false; }
  },
  run({ log } = {}) {
    return runSoak({
      name: 'break:ci-heal-empty-scope',
      rounds: ROUNDS,
      daemons: ['fix-dispatch'], // only fix-dispatch owns ci-heal work (invariants.mjs#OWED_KIND_DAEMON)
      mainEvery: 0, // not exercising main-staleness here — keep the run tight
      scorecards: false,
      setup(w) {
        // The live-incident's OTHER half: the diff-paths `gh` read itself failing (a real `gh` hiccup), not
        // merely "no item". See this file's own header for the verb-wide caveat.
        w.gh.fault({ verb: 'pr diff', kind: '5xx', times: FAULT_TIMES });
      },
      log,
    });
  },
  judge(report) {
    const target = report.ctx?.fleet?.find((p) => p.key === 'red-no-item');
    const pr = target?.pr;
    return report.violations
      .filter((v) => v.invariant === 'owed' && pr != null && v.detail.includes(`PR #${pr} `) && v.detail.includes('ci-heal'))
      .map((v) => `${v.daemon ?? '-'} tick ${v.tick ?? '-'}: [${v.invariant}] ${v.detail}`);
  },
};
