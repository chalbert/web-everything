---
bornAs: x4v2xe4
kind: epic
parent: "3383"
status: open
relatedTo: ["2612", "3070", "3625", "3639"]
dateOpened: "2026-09-19"
tags: []
---

# Mechanise the orchestrator turn: one derived state read, one set of operations, shared by sessions and the runner

Umbrella for turning the per-turn checks a live session re-derives by hand (what landed, what is owed, what needs the operator, stale labels, finished sessions, lane capacity, job records, handoff) into declared operations that the session, the runner and a completion trigger all call. Slice 1 is the completion trigger; slices 2-12 close the cheap gaps (including a failing drain-clone refresh) and take three model judgments (provider choice, docket refresh, which decisions matter) off the session; one decision rules whether session and runner are one system.

**The operator's ask (2026-09-19 19:00):** "explore using hooks better to mechanise most of the turn checks — what landed, what is next, review, conflicts — and eventually the underlying system of this session should be compatible with the runner, and both could add work and handle stuff in the exact same way." Priority added at 19:05: "queuing next work mechanically as others land" ships first.

## Why this sits under #3383 and not on its own

#3383's stated thesis is this ask: the session's role narrows to queueing work and being told about blocked items, while a mechanical layer owns dispatch, capacity and supervision. Filing it standalone would start a second effort with the same goal. It is a nested epic rather than eight loose children because #3383 already has over 120 children and its own body is a running session log; a findable umbrella keeps this programme readable. It reconciles with, and does not duplicate: #2612 (the interim main-session conveyor, whose skill this makes thinner), #3070 (which decides what wakes `advance`; slice 1's trigger overlaps it, see below), #3625 (lane and session health monitoring), and #3639 (multiple runner instances).

## The finding that shapes everything: most of this already exists

A capability search plus a read of the code shows the runner already runs nearly every check this session did by hand: `we:skills-src/conveyor/runner.mjs` `makeCliMechanicalPasses` runs the session reaper, the reconcile-fix dispatch, the review-reconcile dispatch, the parked-PR conflict watch, the advisory-label staleness sweep and the lane-pool health watch. The session did them by hand because **the runner is not running** (its lease is gone and `we:.conveyor/driver-mode.json` still says `resident` for a dead pid). So the programme is mostly not "build new checks". It is: make the existing operations callable and correct from anywhere, close the specific gaps found below, and deliver the result to the session without model recall.

## Classification of the twelve checks (H = hook, O = declared operation, J = judgment)

Hooks are the WHEN, operations are the WHAT. A hook fires on a harness event inside a session, but almost every check here is a derivation from GitHub and the process list, so its content is an operation and a hook is at most the delivery.

| # | Check | Class | Exists already | Gap and slice |
|---|---|---|---|---|
| 1 | Live PR state, both repos | O (+H delivery) | `we:scripts/operations/pr-status.mjs`, `we:scripts/conveyor/open-pr-fetch.mjs` | one cross-repo call: #3724; delivery by hook: #3726 |
| 2 | What landed since last turn | O | nothing found | landed-since cursor: #3724 |
| 3 | What needs the operator | O (+H delivery) | `we:scripts/operations/operator-queue.mjs` (#2338) | none; digest calls it |
| 4 | What is owed | O | `we:scripts/conveyor/reconcile-pass.mjs`, `we:scripts/conveyor/reconcile-fix-dispatch.mjs` | not run while the runner is down: #3720 |
| 5 | Conflict without a checkout; stale conflict label | O | `we:scripts/conveyor/parked-pr-conflict-watch.mjs` (merge-tree, self-clearing label) | runner-tick only, review-parked PRs only; the digest reports a disagreeing label: #3724. Resolving a conflict stays J. |
| 6a | Stale `ci:failed` on a green head | O | the drain's ci-lifecycle reconcile in `we:scripts/merge-ai-prs.mjs` (#2421) | unexplained miss on #2107: diagnose first, #3729 |
| 6b | Stale stand-down comment | J today | stand-down is terminal by design | becomes O only if the marker gains a machine-checkable unblock condition; not a slice |
| 7 | Stop finished sessions | O | `we:scripts/conveyor/session-reaper.mjs` (#3435, #3469), runner pass only | idle-but-alive review sessions on an open PR are not reaped: #3721 |
| 8 | Job file per dispatched worker | O (+H warn) | run records exist; nothing in the repo knows the job-file folder | `dispatch-task` operation, job view derived from the run record: #3730 |
| 9 | Lane availability | O (bug fixes) | `we:scripts/lane-pool.mjs` | `list --acquirable` ignores the provably-pushed relaxation `acquire` uses; `refresh` ignores `--lane` and one bad lane aborts all: #3725 |
| 10 | Advisory tag after each advisory round | O | `we:scripts/operations/review-pr.mjs` `advise` effect writes the label; `we:scripts/conveyor/advisory-label-sweep.mjs` removes stale ones; `operator-queue` cross-checks the comment | label write path confirmed for `advise`; the sweep, like the others, only runs inside the runner tick. Coverage of paths other than `advise` was not exhaustively verified. |
| 11 | Dispatch review for every re-armed PR, staggered under a cap | O | reconcile then `we:scripts/operations/review-dispatch.mjs`; ceiling in `we:scripts/lib/lane-concurrency.mjs` | review and fix dispatch bypass the ceiling: #3727; load-aware gate: in #3720 |
| 12 | Handoff current | O + H | prose `/handoff` file written by the model | derivable half (workers, PR states, operator queue, runner state) comes from the digest: #3726 |

**Irreducible judgment (J), stays with a model or the operator:** the readiness discussion and choosing what to build, review verdicts, ratifying decisions, clearing a stood-down agent, resolving a semantic merge conflict, picking the keeper of duplicate PRs.

## Three more candidates the operator added during the exploration

Found and measured live on 2026-09-19 after the twelve above. Same test applied (hook, operation, or judgment):

| Check | Class | What exists | Gap and slice |
|---|---|---|---|
| Refresh and publish the Decision Docket as state changes | O (a `land-advance` consumer) | the generator and pure renderer (`we:scripts/gen-decision-docket.mjs`); #3562 and #3277 own the standing pass and the publish operation | nothing triggers a refresh and publishing needs a session: #3723 |
| Choose the dispatch provider (Codex, Gemini, Claude) | O (+ optional warn-level H backstop) | `we:scripts/lib/provider-routing.mjs`, complete and pure, **zero real callers** | wire it in, derive `taskType` from the dispatch kind (the mapping is not 1:1), record the provider actually used: #3717 |
| Which open decisions bear on the work in flight | O; `/wip` and `/status` print it | decision records via `we:scripts/lib/decision-docket-data.mjs` | a `decisions-in-flight` operation sharing the docket's record source; the commands print it: #3719 |

Each is model judgment today that should not be: the model decides whether to delegate, which decisions matter, and when to refresh a page.

## Slices, in delivery order

1. **#3720** — land-advance: one operation (verify capacity, plan under scope and lane rules, dispatch only what fits), triggered by a completion event. **First, at the operator's request.** Plan-only by default; see its paused-conveyor flag.
2. **#3721** — reap finished-but-alive review, fix and ci-heal sessions. **Not a hard prerequisite of slice 1** (reconcile fails safe), but slice 1's review and fix half is inert for any PR whose finished session still lists alive; land it second.
3. **#3717** — provider routing wired in from fixed criteria. The highest-leverage unwired thing found after the finished-session cleanup; it also changes what every later dispatch does, so it lands before more dispatch paths are added.
4. **#3723** — the Decision Docket refresh as the cheapest `land-advance` consumer, and the first proof the trigger fires. It is read-only and stands alone, so it can be built against a manual call in parallel with slice 1.
5. **#3730** — `dispatch-task`: the job record emitted by the dispatch itself.
6. **#3725** — lane availability counts correctly.
7. **#3729** — diagnose and fix the stale `ci:failed` label.
8. **#3727** — review and fix dispatch under the shared ceiling.
9. **#3724** — the turn-digest operation.
10. **#3726** — deliver the digest by hook, and derive the handoff (blocked by #3724).
11. **#3719** — decisions bearing on the work in flight, printed by `/wip` and `/status`.
12. **#3731** — repair the drain daemon's failing clone refresh and make repeated failure an alert. **Urgent regardless of order, and a precondition for using the drain as a landing-event source (slice 1, shape a):** the daemon is 47 commits behind and has been deciding on a stale checkout.
13. **#3722** — the decision: one system or two? Independent of the slices; it shapes how far slices 9 to 11 and the runner's own loop are simplified afterwards.

Corrections to the brief's guess that items 7 and 8 are the two cheapest wins: **7 is cheap** but is an extension of an existing module, not new work, and the real cost is verifying that review and fix agents report `done` on every exit. **8 is not the cheapest**: it needs a new operation, because `dispatch-lane` has no generic "run this brief file" kind. Cheaper than 8 are #3725 and #3729 (small, well-located changes).

## Overlap with #3070, stated so it is not lost

#3070 (open decision) is choosing what unattended thing calls `advance` on parked operation runs; its in-session lean is a dedicated `StartInterval` job. Slice 1 (#3720) is also a completion-triggered caller. They are different operations (`wake` versus `land-advance`) but they compete for the same "one unattended caller" slot, and #3070's Fork 1 default-rejected the drain as a caller. Rule #3070 with slice 1 in view before wiring any trigger that is not a session hook or the runner tick.

**The drain is available, not blocked.** The drain daemon is running and already observes every landing it makes. What stands between it and being a trigger is a policy choice the operator can revisit, not a technical barrier: its README's "no agent spawning" non-goal, and the cross-repo boundary. If the answer is no, the trigger needs another home. Slice 1 states the two shapes: **(a)** the drain emits a landing event and something else consumes it (keeps the non-goal, recommended unless the operator says otherwise), or **(b)** the drain calls `land-advance` directly (needs the non-goal relaxed).

## Flags for the operator

- **Nothing here may become an unattended runner by the back door.** The runner is stopped but not machine-readably paused; the landing operation defaults to plan-only and needs an explicit opt-in to dispatch (details in #3720).
- **The drain daemon has been running on a stale, corrupt clone** (#3731): its refresh failed on 167 of 215 passes on 2026-09-19 and it is 47 commits behind `main`. The cause is a corrupt commit-graph, not SSH (SSH reads work). The repair is an operator action on the daemon's own clone; it was not done here.
- Slice 10 edits the harness-wide `we:.claude/settings.json`; slice 1 also adds a `Stop` hook there. Both need the operator's explicit review of the settings diff.
- #3717 turns the graduation model in #3690 (still an open decision) into a dispatch gate; ratify #3690 if the operator's stated intent is the ruling.
- #3719 found that the deployed `/wip` command is ahead of the tracked one (32 lines the source lacks) and that neither copy mentions the operator queue. Reconcile before any redeploy.
- No `preparedDate` is set on #3722; the forks are not skeptic-reviewed.

## Done when

1. **Executable** — every slice above is resolved, and the decision #3722 is ratified (or explicitly closed as "two systems"), and `node we:scripts/operations/run.mjs turn-digest` reproduces, in one call, what the 2026-09-19 session assembled by hand.
