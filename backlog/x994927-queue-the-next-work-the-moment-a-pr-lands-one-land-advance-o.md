---
kind: story
size: 5
priority: high
parent: "x4v2xe4"
status: open
relatedTo: ["3070", "3609", "x9rppp9", "xjsj7pg", "xaypr56", "xc1u3pi", "x1ojdxq"]
scope: ["we:scripts/operations/land-advance.mjs", "we:scripts/operations/land-advance-io.mjs", "we:scripts/land-advance-hook.mjs", "we:skills-src/conveyor/runner.mjs", "we:.claude/settings.json", "we:scripts/operations/__tests__/land-advance.test.mjs"]
dateOpened: "2026-09-19"
tags: []
---

# Queue the next work when something completes: one land-advance operation — verify capacity, plan under the scope and lane rules, dispatch only what fits

A PR landing, a worker finishing, or a runner tick ending changes what is owed, yet nothing reacts: the next review, fix or ready item waits for a person or for a runner that is not running. Add ONE declared operation, `land-advance`, that verifies capacity first, plans under the existing scope and lane rules, and dispatches only up to that capacity. Every caller — a completion hook, the runner tick, the drain — calls the same operation. It defaults to plan-only; dispatch is an explicit operator opt-in (see the paused-conveyor flag below).

The operator's ask (2026-09-19): "queue next work mechanically as others land", with no human turn and no session in the loop; and, refined: the trigger is a **completion event, not a clock**, capacity is checked **before every dispatch**, and scope and lane discipline are **non-negotiable**.

## Shape: on completion → verify capacity → plan under scope/lane rules → dispatch the allowed number

`land-advance` is pure composition. It owns no rule of its own except the load gate (step 1). Each decision below already has an owner; the operation calls it and never re-derives it ([#deterministic-core-thin-judgment](../docs/agent/platform-decisions.md#deterministic-core-thin-judgment), [#operations-declared-once-callers-generated](../docs/agent/platform-decisions.md#operations-declared-once-callers-generated)).

1. **Capacity first, every call.** Budget N = free acquirable lanes, minus live dispatched sessions, capped by the ceiling, and 0 while machine load is over a threshold.
   - Free lanes: `we:scripts/lane-pool.mjs` `list --acquirable` (see #xeaxqvw — today it under-reports).
   - Ceiling and live count: `we:scripts/lib/lane-concurrency.mjs` — the same resolver `dispatch-plan` and `planTick` already share, so this call and the tick can never sum past one budget.
   - **New, small, and the only new rule:** a load gate. `os.loadavg()[0] / os.cpus().length` over a threshold means budget 0. Today's ceiling is deliberately hardware-blind (its own header defers to the unlanded hardware-aware project), and load reached 28 on 12 cores on 2026-09-19, so a count cap alone is not enough.
   - N is computed once and passed down as a hard budget to every dispatch below; nothing dispatches past it. A burst of completions therefore cannot oversubscribe the machine even before #xjsj7pg caps the other callers.
2. **Plan under the existing rules — never a looser path.**
   - Owed PR work (review, fix): `we:scripts/conveyor/reconcile-pass.mjs` (through `we:scripts/conveyor/reconcile-core.mjs` `planReconcile`) decides what is owed and every refusal (`stood-down`, `no-findings`, `cap-exhausted`, `live-process`, `awaiting-permission`, `liveness-unknown`). A refusal is reported, never overridden.
   - Next ready item: `we:scripts/readiness/conveyor-state.mjs` then `we:scripts/readiness/dispatch-plan.mjs`. It already owns: the `unshaped-no-scope` hold (an item with no declared `scope:` is REFUSED, the same rule `we:scripts/conveyor/reconcile-fix-dispatch.mjs` applies as `no-scope`), `overlaps lane-N` (an active lease's scope, or a higher-ranked item just launched), `blockedBy` order, the `capacity-cap` hold, and the pause hold. The scope-lease and partition logic sit behind it in `we:scripts/readiness/scope-lease.mjs`, `we:scripts/readiness/scope-lease-collect.mjs` and `we:scripts/readiness/lane-partition.mjs`; reuse them by calling `dispatch-plan`, not by importing them.
3. **Dispatch through the real machinery.** `we:scripts/operations/review-dispatch.mjs`, `we:scripts/conveyor/reconcile-fix-dispatch.mjs` and `we:scripts/operations/dispatch-lane.mjs`. They acquire through `lane-pool`'s real lease (`acquire`, never an assumed-free lane) and record a durable run record. `dispatch-lane`'s run-record in-flight guard, plus `claim`, plus the lane lease, are what make a second call a no-op for an already-dispatched item.

## Which completion events exist (checked, not assumed)

- **Harness hook events, by how well they are evidenced.** Wired in this repo's `we:.claude/settings.json`: `SessionStart`, `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStop` (the last two already run `we:scripts/guard-stop-passive-wait.mjs`). Used or observed per `we:docs/agent/agent-cli-capability-map.md`: `SessionEnd`, `PreCompact`, `SubagentStart`, `TaskCreated`, `TaskCompleted` (whether the last four can block is an open question there). Documented Claude Code events that are neither wired nor verified here: `UserPromptSubmit`, `Notification`. Probe before relying on any of the unverified ones. There is **no** post-merge hook event in the harness.
- **A worker finishing** → its `Stop` hook. Project hooks load from the lane clone's tracked `we:.claude/settings.json`, so a dispatched `--bg` worker should fire them. The implementer must PROBE this on a real bg worker: `SubagentStop` fires only for Task-tool subagents, not `--bg` sessions.
- **An interactive turn ending** → `Stop`. It fires every turn, so the hook is a thin `we:scripts/land-advance-hook.mjs`: it exits at once if the single-flight lease is held or a cooldown (default 60 s) has not elapsed, otherwise starts the operation detached and returns. No turn ever awaits it.
- **The runner's completed tick** → not a harness hook; a call at the end of `makeCliMechanicalPasses` in `we:skills-src/conveyor/runner.mjs`.
- **The drain's completed pass** → not a harness hook, and not git either: the daemon refreshes its clone with `fetch` + `reset --hard`, which fires no `post-merge`. The only seam is end-of-pass in `we:scripts/merge-ai-prs.mjs`. **Contested, so NOT in this slice's scope:** the drain daemon's README lists "no agent spawning" as a deliberate non-goal, it lives in another repo (plateau-app), and #3070 Fork 1 default-rejected the drain as a caller of an unrelated operation on layering grounds. Add it later behind the same gate only if the operator rules that way.
- **A PR merging on GitHub** → no local event exists. A webhook could only wake something local, and a wake is never a trusted order.

The events are wake signals only. `land-advance` re-derives everything from GitHub, the lanes and the run records on each call, which is how [#event-driven-land-is-wake-only](../docs/agent/platform-decisions.md#event-driven-land-is-wake-only) says a wake must be treated. That is also why it is safe to fire twice.

## What the trigger runs, beyond dispatch

`land-advance` is the one place a completion event fans out to mechanical consumers. Two are filed as their own slices so this one stays small:

- **The Decision Docket refresh** (#xc1u3pi): read-only, needs no lane and no session, so it does not count against the worker budget. It is the cheapest consumer and the best first proof that the trigger fires at all; build it against a manual call first and wire it here once the trigger exists.
- **Provider routing** (#x1ojdxq): the provider and supervision level for every dispatch this operation makes come from that slice's router wiring, never from a brief. Until it lands, this operation dispatches exactly as `dispatch-lane` does today.

## Idempotence and safety

- Safe to fire twice for one landing: state is re-derived, and dispatch is guarded by `dispatch-lane`'s run-record in-flight guard, `claim` and the lane lease. Add a single-flight lease (reuse the `runner-lock` or `drain-lock` primitive; do not mint a new one) so concurrent callers exit `busy` instead of racing to plan.
- Never double-dispatches over a live session: `reconcile-core` refuses `live-process`. **Does the reaper slice (#x9rppp9) block this one? Not for safety** — the refusal fails safe. **It does for value:** while a finished review session still lists alive, reconcile refuses that PR forever, so the review and fix half of this operation is inert for it. The item-pull half does not depend on session liveness. Ship this slice plan-only first and land #x9rppp9 next.
- Every call records a run record (it is a declared operation), so a plan-only run is auditable.

## FLAG FOR THE OPERATOR — this must not become an unattended runner by the back door

The runner is stopped, not machine-readably paused: `we:.conveyor/dispatch-pause.json` does not exist in the primary checkout, and `we:.conveyor/driver-mode.json` still says `resident` for a dead pid. **Absence of a runner is not a pause signal**, so `land-advance` cannot infer one. Therefore:

- **Default `--mode=plan`:** compute and record what it would dispatch; dispatch nothing.
- `--mode=dispatch` requires BOTH an explicit operator opt-in (a durable setting the operator writes, not a flag an agent passes) AND the pause marker (`we:scripts/readiness/dispatch-pause.mjs`) being unset. The operator can make a pause real today with `dispatch-pause set`.
- **Where the marker and the opt-in are read matters.** `dispatch-pause` resolves `.conveyor/` from the SCRIPT'S own location and fails OPEN when the file is missing. A hook firing inside a lane clone would read that clone's empty `.conveyor/` and see "not paused". Read both from one canonical checkout: the live runner's (`we:scripts/conveyor/resolve-runner-checkout.mjs`), else the primary checkout. Never the caller's own clone. This is the per-checkout-sidecar problem that decision #xaypr56 rules on properly.
- Item-pull (starting new work) is the riskiest half. Give it its own opt-in, separate from review and fix dispatch of work already in flight.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/land-advance.test.mjs` passes; its cases fail before this item lands:
   - budget 0 when free lanes are 0, when live sessions are at the ceiling, or when load is over the threshold — and nothing is dispatched;
   - an item with no declared `scope:` is refused, and two items whose scopes overlap never dispatch in one call;
   - `--mode=plan` (the default) dispatches nothing and records a run record;
   - two concurrent calls produce exactly one dispatch (single-flight lease plus the run-record guard);
   - a set pause marker, read from the canonical checkout while the caller stands in an empty lane clone, forces plan-only.
2. **Probed live, not just on fixtures** — `node we:scripts/operations/run.mjs land-advance --mode=plan` against the real repo names the same owed PRs as `we:scripts/conveyor/reconcile-pass.mjs` `--json` and the same launchable items as `we:scripts/readiness/dispatch-plan.mjs` `--json`, and a bg worker's `Stop` hook is observed to invoke `we:scripts/land-advance-hook.mjs`.
3. No new rule outside the load gate: `git grep` shows no second scope-overlap, lane-lease or no-scope implementation.
