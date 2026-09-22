---
kind: decision
parent: "3383"
status: open
relatedTo: ["3720", "3722", "3807", "3609", "3727"]
scope: ["we:scripts/operations/land-advance-gate.mjs", "we:scripts/operations/land-advance-items.mjs", "we:scripts/operations/land-advance-items-io.mjs", "we:scripts/operations/land-advance-cli.mjs"]
dateOpened: "2026-09-21"
preparedDate: "2026-09-21"
tags: []
---

# Decision: land-advance item-pull and dispatch gate: canonical checkout, items per call, opt-in home, what item dispatch means

Rule the four open points of the land-advance item-pull and dispatch gate that #3720's remainder built on the prototype branch (`we:scripts/operations/land-advance-gate.mjs`, `we:scripts/operations/land-advance-items.mjs`, `we:scripts/operations/land-advance-items-io.mjs`, `we:scripts/operations/land-advance-cli.mjs`). Until this is ruled the build runs its safest default: plan only. Nothing is dispatched or queued unless the operator writes the opt-in file, and even then an ambiguous canonical checkout keeps it at plan. #3720's dispatch half waits on this card; its plan half is live.

## Why this is on the critical path

#3720 (Priority order line 35) removes "the orchestrator queueing the next work by hand when something completes", and the operator's rule 1 names it the mechanical version of how next items are picked. The plan half works today: on 2026-09-21 a live `--mode=plan` run named the owed PRs and the launchable Priority-order items. The dispatch half needs the four answers below before it may act.

## FOUND (verified 2026-09-21, prototype branch)

- Two primary checkouts exist on the laptop: `~/workspace/web-everything` (detached HEAD, with conveyor driver state) and `~/workspace/webeverything` (the operator's primary). `primaryCheckout` in `we:scripts/bootstrap-session.mjs` probes the known directory names in order and returns the first, `web-everything`. No conveyor runner holds a lock, so the runner's checkout is not available either.
- `we:scripts/readiness/dispatch-pause.mjs` resolves its marker from the script's own location and fails open when the file is missing, so a lane clone reads "not paused". The build reads the marker from the canonical checkout instead (the card's own rule).
- `we:scripts/operations/dispatch-lane.mjs` launches only what the tick core surfaced from the conveyor sidecar (`we:.conveyor/queue.json`); it takes no item it was not handed by the tick.
- A queued item is not a live session, so the capacity budget (free lanes minus live sessions) does not see it until the tick launches it.

## Recommended path at a glance

1. Name the canonical checkout in one operator machine setting; stay at plan while it is ambiguous.
2. One item per call.
3. The opt-in is `we:.conveyor/land-advance-opt-in.json` in the canonical checkout, written by the operator by hand.
4. Item dispatch means queueing into the conveyor sidecar; the runner's tick launches it.

## Supported by default — not forks

- Which Priority-order lines are candidates: band A only, skipping claimed, decision, `needs-operator-fast-forward` and in-flight lines. This is operator rule 1 as written; blocked, epic, unscoped and overlapping items are held by `we:scripts/readiness/dispatch-plan.mjs`, not re-derived.
- Owed PR work takes the budget before new items. Finishing work in flight before starting more is the card's own order.
- Any pause, even a kind-scoped one, forces plan. The card says a set marker forces plan-only.
- The event trigger follows #3720's recorded default (a): callers are the `Stop` hook and the runner tick; the drain gains no spawning.
- The load gate stays until #3807 lands (`TODO(#3807)` in `we:scripts/operations/land-advance.mjs`).

## Fork 1 — Which checkout is canonical when no runner holds the lock

*Fork-existence:* the pause marker and the opt-in must be read from one place, and this machine has two plausible primaries. Picking one silently could read "not paused" while the operator paused the other.

- **(a) Name it in one operator machine setting — recommended.** One absolute path (for example a `WE_CANONICAL_CHECKOUT` variable in the operator's shell profile, or a one-line file in the operator's home Claude folder), read by `canonicalRoot`. While it is unset and more than one primary exists, land-advance stays at plan (built and tested today). #3722 may later replace this with its per-checkout-sidecar ruling.
- **(b) Take `primaryCheckout`'s first probe (`web-everything`).** Rejected: it is an accident of list order, and the operator works in `webeverything`, so a pause written there would be missed.
- **(c) Read both; any pause pauses, the opt-in needs both files.** Rejected: two sources of truth that the operator must keep in step by hand, and a third checkout later would silently widen it.

**Skeptic:** SURVIVES. Attack: "just delete the stray checkout". That removes today's ambiguity but not the class: any second clone brings it back, and a delete is the operator's call, not an agent's. The setting costs one line.

## Fork 2 — How many items one call may queue

*Fork-existence:* a queued item holds no lane and is not a live session until the tick launches it, so the budget cannot see what earlier calls queued. The number per call bounds how fast the queue can grow between ticks.

- **(a) One item per call — recommended.** With the hook's 60-second cooldown and the single-flight lease, the queue grows by at most one item a minute, and the tick's own capacity checks decide when each launches. Built as `DEFAULT_MAX_ITEMS_PER_CALL = 1` (`--max-items=N` overrides it for a manual run).
- **(b) Up to the free budget each call.** Rejected: several completions in a row would each queue the full budget before any launched, over-queueing past what the lanes can take.
- **(c) A number in the #3807 `dispatch-budget` config.** Rejected for now: #3807 is open. Revisit when it lands; the setting would replace the constant.

**Skeptic:** SURVIVES. Attack: "one per call is too slow to fill the queue the operator asked for". Each finishing worker and each tick is a call, so a busy conveyor still adds items steadily; the cap only stops bursts.

## Fork 3 — Where the operator's opt-in lives and who writes it

*Fork-existence:* the card requires "a durable setting the operator writes, not a flag an agent passes". Its home decides who can flip it.

- **(a) `we:.conveyor/land-advance-opt-in.json` in the canonical checkout, `{ "prs": true|false, "items": true|false }`, written by the operator by hand — recommended.** Machine state, untracked, beside the pause marker; separate `prs` and `items` kinds, as the card asks for item-pull. A missing file is no opt-in; an unreadable one means plan. Built and tested.
- **(b) An environment variable on the runner.** Rejected: the `Stop` hook runs in every worker session with its own environment, so the setting would not be durable or single.
- **(c) A tracked file in the repo.** Rejected: an agent's PR could flip it, which is the back door the card forbids.

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied. Attack: an agent with file access can still write the untracked file. Accepted: no local file is agent-proof; the amendment is that nothing in the repo writes it (no command writes it), so writing it is always a deliberate act.

## Fork 4 — What "dispatching" an item means

*Fork-existence:* land-advance can either start the build itself or hand it to the machinery that already launches builds.

- **(a) Queue it into the canonical conveyor sidecar; the runner's tick launches it through `dispatch-lane` — recommended.** The in-flight guards, lane lease, claim and scope arbitration stay with the tick; queueing is idempotent. Built: `queueItemInto` in `we:scripts/operations/land-advance-items-io.mjs`. Accepted cost: with no runner running, a queued item waits.
- **(b) Queue it, then call `dispatch-lane --num=<N>` at once.** Rejected: `dispatch-lane` needs the runner's guard bookkeeping file, and a call without it runs with no in-flight guards.
- **(c) Spawn the build directly.** Rejected: a second scheduler in front of the tick, which `dispatch-lane`'s own header forbids.

**Skeptic:** SURVIVES. Attack: "then the queue is only as live as the runner". True, and named as the accepted cost; the runner is the one unattended caller #3070 allows.

## Ruling

Pending.

## Not in this decision

- The load gate versus the emergency floor: ruled by the statute, built by #3807.
- The per-checkout sidecar problem in general: #3722.
- Graduating land-advance to `main`: the separate six-slice chain.

## Done when

1. **Executable** — after the ruling, `npx vitest run we:scripts/operations/__tests__/land-advance` passes with the ruled values pinned: the canonical-checkout and opt-in tests in `we:scripts/operations/__tests__/land-advance-cli.test.mjs`, the per-call cap test in `we:scripts/operations/__tests__/land-advance.test.mjs`, and the queueing test in `we:scripts/operations/__tests__/land-advance-items-io.test.mjs`.

## Filing note

Authored on the prototype branch (`origin/lane/mechanical-dispatcher`) as `xs340b6`, unnumbered — a decision card the operator must rule belongs on `main`, not buried in a branch commit. Filed here verbatim via `file-item` as part of the same PR as the #3720-remainder graduation slice it blocks (`x3y6aek`), per the operator's own instruction.
