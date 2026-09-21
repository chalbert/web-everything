---
bornAs: x5fkzgl
kind: story
size: 5
parent: "3383"
status: open
relatedTo: ["3612","3727","3800","3737","3720","3808","3806"]
scope: ["we:scripts/lib/lane-concurrency.mjs", "we:scripts/readiness/dispatch-plan.mjs", "we:scripts/conveyor/tick-core.mjs", "we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/dispatch-task.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Put the dispatch budget in a tracked dispatch-budget config that every dispatch path reads, so the number outlives any session

The limit on how much work runs at once (rule v4: 8 units, ramp 8 -> 10 -> 12, a weight per dispatch kind) lives only in the orchestrator's notes and a session cron, so a handoff loses it. Put it in one tracked config that every dispatch path reads; each change is a reviewed commit with a dated reason. Extends #3612, folds in #3727, builds design point 5 of #3800.

## Background

Today the number that limits how much work runs at once is not in the repo. The operator rule v4 (worker budget 8 units, ramp 8 -> 10 -> 12; weights review or advisory 0.25, light task 0.5, prepare 1.0, build or fix 1.5, capacity calibration exclusive) lives only in the orchestrator local notes, and the ramp is driven by a session-only cron, so a handoff loses both. In the repo the only limit is a fixed lane COUNT (default 8, env WE_MAX_CONCURRENT_LANES) in we:scripts/lib/lane-concurrency.mjs, read by we:scripts/readiness/dispatch-plan.mjs and we:scripts/conveyor/tick-core.mjs; we:scripts/operations/dispatch-lane.mjs and we:scripts/operations/dispatch-task.mjs read no budget at all. Operator, 2026-09-21: "keep adjusting as we learn. Suggest adjustment regularly, create a process that survives handoff". Add ONE tracked `dispatch-budget` config (budget, weight per dispatch kind, ramp steps, knee thresholds, emergency floor, and the date and reason of each change) that every dispatch path reads, so the number is not in any session head. Changing it is a reviewed commit, and the ledger of changes IS the git history. EXTENDS #3612 (the lane ceiling; its 2026-09-21 finding already asks for a kind-weighted resolver, and this card gives that resolver its data file and folds the kind-weighted ceiling of #3727 in) and builds design point 5 of #3800 (one home for the numbers). Design-first; not cleared for the conveyor.

## FOUND (2026-09-21, read in code on the prototype branch and on main)

- **The repo holds a count, not a budget.** `we:scripts/lib/lane-concurrency.mjs` exports `resolveMaxConcurrentLanes` (default 8, env `WE_MAX_CONCURRENT_LANES`) and `capToConcurrency`; its header says it is a fixed count and hardware-blind by design. `we:scripts/readiness/dispatch-plan.mjs` and `we:scripts/conveyor/tick-core.mjs` import both. That "8" is a number of lanes; the orchestrator's "8" is 8 UNITS of weighted work. Same digit, different meaning; the file must never let them be confused.
- **Two dispatch paths read no ceiling at all.** A search of `we:scripts/operations/dispatch-lane.mjs` and `we:scripts/operations/dispatch-task.mjs` finds no reference to the resolver, a budget or a weight (dispatch-task exists on the prototype branch only). Card #3727 says the same for review and fix dispatch.
- **No kind weight exists anywhere in the repo.** A search of the lane-concurrency, conveyor and operations dispatch files finds no 0.25 / 0.5 / 1.0 / 1.5 weight table. The weights are in the orchestrator's local notes ("DISPATCH RULE v3", kept in v4) only.
- **The statute disagrees with both.** `we:docs/agent/platform-decisions.md` (the heavy-command admission queue, "Core budget (PROVISIONAL)") says the worker dispatch cap is 3, and says "No load-average gate". Rule v4 adds an emergency floor (instantaneous CPU busy above 95 for two readings in a row, or available RAM under 8 GB). That floor is not a load-average gate, but the statute never anticipated it.
- **The ramp has no home.** Rule v4 ramps 8 -> 10 -> 12, one step at a time, each held a few hours. Today that schedule is a session-only cron in the orchestrator, so it dies with the session.

## DESIGN TO SETTLE (recommendations first)

1. **Format and place.** Recommend ONE JSON file under `we:config/` read by ONE resolver in `we:scripts/lib/lane-concurrency.mjs` (extend it, do not add a second module). JSON so the runner, a test and a checker can all parse it without importing code. Alternative: a `.mjs` module; rejected because a reviewer cannot tell a data change from a logic change in the diff.
2. **Fields.** `budget` (units), `ramp` (the allowed ladder, for example [8, 10, 12]; `budget` must be one of its values), `weights` (per dispatch kind: review, advisory, light, prepare, build, fix, calibration with `exclusive`), `knee` (thresholds `capacity-review` in card 3808 compares against), `emergencyFloor` (CPU busy percent, consecutive readings, minimum available RAM), and `changes` (newest first: date, from, to, reason, evidence pointer). The git history is the durable ledger; the `changes` list is what a reader sees without running git.
3. **Units versus lanes.** Recommend the unit budget becomes the admission rule and the old lane count stays as a separate hard upper bound (`maxLanes`) until #3612 settles. Do not delete the count in this card.
4. **What "live" means.** A dispatch is admitted while the sum of live weights plus the new weight is at most the budget. Recommend the live sum comes from the roster of live dispatched sessions and their dispatch kind (the `WE_DISPATCH_KIND` each dispatch already carries), not from the sampler, which is telemetry and can lag. Open: confirm every dispatch path stamps the kind.
5. **Bad config.** Recommend a missing or invalid file falls back to a small built-in floor and says `config-invalid` loudly in the dispatch result. Rejected: a silent default (a hidden number is the bug this card removes) and refusing all dispatch (one typo would stop the factory).
6. **Environment override.** Keep an env override for an emergency on one machine, but report it in the dispatch result so the effective number is never hidden.
7. **Hardware.** This card stores the numbers for THIS host. The formula that derives them from a hardware profile is card #3800; this card must not block it, and the file may later gain per-profile sections.
8. **Who enforces the floor.** This card stores the emergency floor; card 3808 only reports a breach. Enforcing it at dispatch time is the load gate of #3720 (see the finding there), reading the floor from this config.
9. **The statute.** Point `we:docs/agent/platform-decisions.md` at the config, replace its "worker dispatch cap is 3", and state whether the emergency floor is compatible with "No load-average gate" (recommend: yes, it is a floor on CPU busy and RAM, not a load-average gate; say so in the statute).

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/dispatch-budget.test.mjs` fails before this lands and passes after: (a) the resolver returns the seeded values (budget 8, ramp 8/10/12, review 0.25, light 0.5, prepare 1.0, build 1.5, fix 1.5, calibration exclusive); (b) with live weight 7.0, a build (1.5) is refused and a review (0.25) is admitted; calibration is admitted only when live weight is 0; (c) a config whose `budget` is not in `ramp`, or that lacks a weight for a dispatch kind, resolves to the built-in floor and reports `config-invalid`.
2. **Assertable** — `we:scripts/operations/dispatch-lane.mjs`, `we:scripts/operations/dispatch-task.mjs`, `we:scripts/readiness/dispatch-plan.mjs` and `we:scripts/conveyor/tick-core.mjs` each import the one resolver, and a test fails if any of them reads `WE_MAX_CONCURRENT_LANES` or holds a numeric budget or weight of its own.
3. **Assertable** — a check in `npm run check:standards` fails when the `budget` or any weight changes without a new `changes` entry that carries a date and a reason.
4. **Handoff** — from a fresh checkout with no orchestrator notes and no env, one command prints the effective budget, weights and the last change; the statute names that command.

Seeded from rule v4 as of 2026-09-21. Not verified: that every dispatch path stamps `WE_DISPATCH_KIND` (design point 4), and the numeric knee thresholds, which rule v4 does not state (see card 3808).
