---
bornAs: xz13po8
kind: story
size: 3
parent: "3383"
relatedTo: ["3562"]
status: open
scope: ["we:scripts/conveyor/scope-prep-docket-watch.mjs", "we:scripts/conveyor/__tests__/scope-prep-docket-watch.test.mjs", "we:scripts/conveyor/tick-core.mjs", "we:skills-src/conveyor/runner.mjs"]
dateOpened: "2026-09-07"
tags: [conveyor, prepare, readiness]
---

# Generalize the leverage-ranked auto-prepare docket pass beyond decisions to unscoped, ready-to-prepare build items

we:backlog/3562-a-standing-mechanical-pass-keeps-the-5-highest-leverage-open.md's decision-docket-watch pass (ranks open decisions by leverageScore, auto-dispatches prepare-decision for the un-prepared top N) is scoped to decisions only. The operator wants the same keep-a-healthy-buffer-of-prepared-dispatchable-work guarantee for backlog items broadly, not just decisions. we:src/_data/backlog.js:653's leverageScore is already computed for every open item regardless of kind, and we:scripts/conveyor/tick-core.mjs's planPrepareSpawns already dispatches BOTH prepare-decision AND prepare-scope generically over any input array -- but today's prepare-scope population (state.unshaped) is queue-reactive only, the same reactive-only gap #3562 diagnosed and fixed for decisions. This item builds the build-item-side sibling pass and its own config knobs, following #3562's exact env-override convention.

## Checked first: this is a new sibling, not an edit to #3562

Re-read we:backlog/3562-a-standing-mechanical-pass-keeps-the-5-highest-leverage-open.md in full before filing this. Its own scope is explicitly and narrowly decision-shaped: it ranks via `suggest-next --tier=B` (Tier-B/decision only), its Done-when tests assert against decision-specific shapes, its config knobs are named `WE_DECISION_DOCKET_TARGET_COUNT` / `WE_DECISION_DOCKET_WATCH_DISABLED`, and its render half publishes to the Decision Board (we:backlog/3277-declare-an-operation-that-publishes-and-refreshes-a-decision.md, still unbuilt — re-confirmed live: `## Done when` is still the unfilled TODO scaffold). #3562 is already a fully-specified, ratified, blockedBy-tracked item ready to build as-is. Rescoping it to also cover build items would (a) force a rename of its script/config-knob names away from an already-ratified convention, and (b) couple a population that needs NO render dependency (build-item scope-prep) to one that does (#3277), for no shared benefit. A new sibling item, following the identical structural template and env-var convention, is the better fit -- confirmed here rather than assumed.

## What already exists -- reused, not reinvented

- **The leverage metric is already generic across every kind, not decision-specific.** we:src/_data/backlog.js:653 computes `item.leverageScore = item.transitiveUnblocks * 1000 + item.directUnblocks` for EVERY open item in the reverse-dependency walk -- the loop has no kind filter. #3562 narrows its own RANKING call (`suggest-next --tier=B`) to decisions only because that is the population it targets, not because the metric itself is decision-shaped. So "does a build-shaped item need a different notion of leverage" is answered by the code: no, the same score already applies uniformly. This item reuses `leverageScore` unmodified rather than inventing a second metric -- see *Open fork* below for the one residual nuance worth flagging rather than silently deciding.
- **The dispatch pipeline for build-item scope-prep already exists, generically, today.** we:scripts/conveyor/tick-core.mjs's `planPrepareSpawns` (`:392-429`) already spawns a `prepare-scope` lane agent for every item in its `unshaped` input array, using the exact same guard/retirement machinery (`retirePrepareGuards`) as decision-prepare -- #3165 (resolved 2026-08-26) wired this dispatch all the way through `we:scripts/operations/dispatch-lane.mjs`'s `briefPath(root, kind)` and `sessionSlugFor`, so `prepare-scope` is a live, tested launch kind today, not a gap. What's missing is only the INPUT population, exactly parallel to #3562's own diagnosis for decisions: `state.unshaped` is populated by we:scripts/readiness/dispatch-plan.mjs's `deriveDecisions`-equivalent build-queue scan -- reactive, current-queue-only. An unscoped item with high transitive leverage that is not currently surfaced in the build queue gets no mechanical push today, same shape as the decision-side gap #3562 closes.
- **The structural template is the same two files #3562 already cites.** we:scripts/conveyor/duplicate-pr-watch.mjs / we:scripts/conveyor/parked-pr-conflict-watch.mjs -- pure-core/IO-shell split, wired into we:skills-src/conveyor/runner.mjs's `makeCliMechanicalPasses`, no new cron/daemon.

## What this item proposes

1. **A new standing mechanical pass -- we:scripts/conveyor/scope-prep-docket-watch.mjs** -- built to the SAME structural template as #3562's we:scripts/conveyor/decision-docket-watch.mjs (and its own cited templates). Each tick:
   - **(a) Rank.** Compute `leverageScore` (reusing we:src/_data/backlog.js's pure computation, or the equivalent readiness-engine projection if one already exposes it callably) over every OPEN, non-decision item that is currently unscoped (the same predicate that produces an `unshaped-no-scope` hold in we:scripts/readiness/dispatch-plan.mjs, but evaluated across the WHOLE open backlog, not just the current queue window). Take the top N by leverageScore.
   - **(b) Dispatch prep for the unscoped top N.** Reuse `planPrepareSpawns`/`retirePrepareGuards` directly (they are already generic over any `unshaped`-shaped array -- #3165 proved this path is live) rather than a second hand-rolled dispatch/guard mechanism.
   - No render/publish half -- unlike #3562, there is no human-facing "board" for scope-prep: the whole point of preparing an item's scope is to make it immediately buildable/dispatchable, not to present it for a ruling. So this item carries **no #3277 dependency and no `blockedBy`** -- it can land and deliver value on its own.
2. **Config knobs, following #3562's exact convention (obvious default, not a fork):**
   - `WE_SCOPE_PREP_DOCKET_TARGET_COUNT` (exported `DEFAULT_SCOPE_PREP_DOCKET_TARGET_COUNT = 5` default, overridable) -- mirrors `WE_DECISION_DOCKET_TARGET_COUNT`.
   - `WE_SCOPE_PREP_DOCKET_WATCH_DISABLED` (presence-checked no-op switch, checked first in the pass's own entrypoint) -- mirrors `WE_DECISION_DOCKET_WATCH_DISABLED`.

## Open fork -- flagged, not decided silently: leverageScore (raw transitive reach) vs. unblocksToReady (immediately-freed work) as the ranking signal

we:src/_data/backlog.js also computes a second, narrower metric beside `leverageScore`: `item.unblocksToReady` (`:637-641`) -- the count of direct dependents that would flip straight to agent-ready (Tier A) if THIS item resolved, deliberately excluding decision-kind dependents ("an edge to a still-multiply-blocked item frees nothing yet"). `leverageScore` counts ALL transitive open dependents (including decisions, including items that would still be blocked by something else even after this one resolves); `unblocksToReady` counts only the dependents this item is the LAST open prerequisite for. The operator's own framing for this item is explicitly about keeping "a healthy buffer of prepared, DISPATCHABLE work" -- language that reads closer to `unblocksToReady`'s "frees actual buildable work now" semantics than to `leverageScore`'s raw reach, which can rank an item highly even when resolving it doesn't make anything else immediately pickable. **Bold default: use `leverageScore`, unmodified, for exact parity with #3562's own ranking rule** (`we:scripts/readiness/engine.mjs`'s `rankB` and every existing leverage-ranked surface in this repo use `leverageScore`, not `unblocksToReady` -- consistency with the established convention is worth more than a metric swap for one item, and the two scores correlate strongly in practice since high transitive reach usually implies some immediately-freed work too). Flagged rather than silently picked because the two metrics CAN disagree at the margin, and whoever claims this item should re-verify which one actually matches the operator's intent before building, not assume the default survives unattacked.

## Done when

1. **Executable** -- running we:scripts/conveyor/scope-prep-docket-watch.mjs with `--dry-run` fails before this item lands (file doesn't exist) and, after, reports the current top-N unscoped items by leverageScore and their scope status, without dispatching anything -- mirroring #3562's own report-first CLI shape.
2. **Executable** -- the vitest suite we:scripts/conveyor/__tests__/scope-prep-docket-watch.test.mjs covers: the ranked N match a direct leverageScore-sorted computation over the same open-unscoped population; an unscoped top-N item dispatches a prepare-scope spawn exactly once and never re-dispatches while a guard/open PR is live (reusing `planPrepareSpawns`/`retirePrepareGuards` directly, not a re-implementation); a top-N item that already carries a scope is never dispatched; a decision-kind item is never included in this pass's population (decisions stay #3562's job).
3. Wired into we:skills-src/conveyor/runner.mjs's `makeCliMechanicalPasses` -- confirmed by a smoke check that the pass is present in that list, alongside #3562's decision-docket-watch (once that lands) and the two structural templates.
4. The vitest suite also covers both config knobs: `WE_SCOPE_PREP_DOCKET_TARGET_COUNT` overrides the ranked/dispatched count away from the `DEFAULT_SCOPE_PREP_DOCKET_TARGET_COUNT = 5` default; `WE_SCOPE_PREP_DOCKET_WATCH_DISABLED` set to any value makes the pass's entrypoint a no-op (no rank call, no dispatch).
5. `npm run check:standards` shows no new errors and no new warnings against the baseline at build time (disclose the observed baseline delta in the PR body, per this repo's own convention -- do not hardcode a number here).

## Grounding

- we:src/_data/backlog.js:609-653 -- the reverse-dependency walk, `leverageScore`, and the narrower `unblocksToReady` (the *Open fork* above).
- we:scripts/conveyor/tick-core.mjs:392-429 -- `planPrepareSpawns`, already generic over any `unshaped`/`decisions` array; `:366-389` -- `retirePrepareGuards`, the reused idempotency contract.
- we:backlog/3165-tick-core-plans-auto-prepare-scope-dispatches-that-never-act.md -- resolved 2026-08-26; confirms `prepare-scope` is a live, tested dispatch kind through we:scripts/operations/dispatch-lane.mjs today, not a gap this item needs to reopen.
- we:scripts/readiness/dispatch-plan.mjs -- today's `unshaped-no-scope` hold, queue-reactive-only, the exact gap this item closes for the build-item side.
- we:scripts/conveyor/duplicate-pr-watch.mjs, we:scripts/conveyor/parked-pr-conflict-watch.mjs -- the structural templates (pure-core/IO-shell split, `makeCliMechanicalPasses` wiring).
- we:backlog/3562-a-standing-mechanical-pass-keeps-the-5-highest-leverage-open.md -- the decision-side sibling this item generalizes the pattern from; re-confirmed still unbuilt and still correctly decision-scoped, not to be edited into this item's scope.

## Placement note (2026-09-07)

This item's leverage-ranked item-selection pattern is exactly the "item selection/authoring" AI seam
we:backlog/2445's own Extraction seams section names as what a Plateau Loop coordinator inherits.
we:backlog/xd5fws3 tracks generalizing it (alongside we:backlog/3568's lane-pool hygiene and the staged
hardware-usage-aware admission-control project) into the Loop's own substrate under the existing Plateau Loop
epic (we:backlog/2445). Build and land this for WE's own dispatcher regardless; this note is a forward
pointer, not a dependency.
