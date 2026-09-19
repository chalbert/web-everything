---
kind: decision
parent: "x4v2xe4"
status: open
relatedTo: ["3383", "3031", "2615", "2701", "2612", "3070", "3639", "x994927"]
dateOpened: "2026-09-19"
tags: []
---

# Decision: are the interactive session and the runner one system, or two systems that share operations?

The operator wants a live session and the runner to add work and handle it identically. Most of the seams exist, but the runner keeps its own guard bookkeeping, the queue file is per checkout, hand-launched workers bypass the run store, and three separate models decide whether a worker is alive. Rule whether to converge on one system (the session becomes one more caller of the same operations) or keep two systems over shared operations.

*Not prepared:* no skeptic pass has run on the forks below and there is no `preparedDate`. The recommendation is mine, from the code reads cited here.

## What is already ruled (so it is not a fork)

- [#operations-declared-once-callers-generated](../docs/agent/platform-decisions.md#operations-declared-once-callers-generated) (#3031): an operation is declared once and every caller is generated from it. It retired the in-session reviewer because "the same operation behaves differently depending on who started it, which is precisely what one-source exists to prevent". That already settles that the session and the runner share OPERATIONS. This decision is about the LOOP around them and the STATE under them, which #3031 does not reach.
- [#conveyor-orchestration-mechanics-not-per-lane-agent](../docs/agent/platform-decisions.md#conveyor-orchestration-mechanics-not-per-lane-agent) (#2701): no per-lane conducting agent; the runner is mechanics, and genuine novelty escalates to the judgment layer.
- Epic #3383's target shape: the session's role narrows to queueing work and being told about blocked items, not driving routine progress turn by turn.
- [#state-lives-where-its-nature-dictates](../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates) (#2615): transient operator intent lives in a gitignored per-checkout sidecar; durable readiness is committed frontmatter.

## The seams that exist, and what is missing

| Step | Shared today (one implementation) | Not shared |
|---|---|---|
| Plan | `we:scripts/conveyor/tick-core.mjs` `planTick`; `we:scripts/conveyor/reconcile-pass.mjs` (stateless, keyed by PR) | `planTick`'s build, prepare and fix guards are bookkeeping piped in over STDIN, session-ephemeral. Only a process that carries it forward (the runner) uses them; a session re-derives by hand. |
| Add work | `we:scripts/operations/file-item.mjs` | the queue it writes to is `we:.conveyor/queue.json`, resolved from the CALLER's script location, so a session in a lane clone and the runner in another checkout write and read different files (#3478's resolver only answers while a runner is live) |
| Claim | `we:scripts/operations/claim.mjs`, lane lease in `we:scripts/lane-pool.mjs` | none |
| Dispatch | `we:scripts/operations/dispatch-lane.mjs`, `we:scripts/operations/review-dispatch.mjs`, `we:scripts/conveyor/reconcile-fix-dispatch.mjs` | hand-launched workers (no operation for "run this brief"; #xn4cgvr) |
| Settle | `we:scripts/operations/operator-queue.mjs` | the runner's tick output and the operator queue are separate surfaces |
| Alive? | three models | see Fork 3 |

## Where the two genuinely differ, and where it is only history

**Real differences** (keep them, and design for them):

- A person is present in a session and the runner has none. A stood-down agent is a question only a person can answer; ratifying a decision needs an explicit human utterance; a semantic merge conflict, a duplicate-PR keeper and "what should we build next" are judgment. The runner must escalate these, never guess. That is what `we:scripts/operations/operator-queue.mjs` is for.
- Authority and cost. Unattended dispatch spends money and load with nobody watching, so it needs a pause, a capacity gate and an opt-in (see #x994927). A session's dispatch is supervised by construction.

**Merely historical** (remove them):

- Hand-dispatching with bespoke prompts (the mechanical-delivery doctrine already forbids it for builds).
- Job files kept by hand beside the run records.
- Guards held in the session's head instead of derived from run records and leases.
- The session re-polling GitHub by hand for what a pass already computes.
- A queue file per checkout, and two different "is it alive" answers.

## Fork 1 — who owns the loop (plan, claim, dispatch, settle)

- **(a) [default] One loop, expressed as operations; every actor is a caller.** The steps are declared operations (`land-advance` for plan and dispatch #x994927, reconcile, the session reaper, the operator queue for settle). The runner becomes an optional scheduler that calls them on a clock; a completion hook calls them on events; a session calls them on demand. No caller carries its own copy of the loop. The session's own job is adding work (`file-item`), answering what the operator queue surfaces, and judgment. Cost: the tick's STDIN-carried guards must become derivable from durable facts (Fork 2).
- **(b) Two systems that share leaf operations.** The runner keeps `planTick` with in-process guards; the session keeps a by-hand loop; both call the same `dispatch-lane`. This is today. Cheapest now. But it is the shape #3296 was filed to escape: a proxy (session memory) standing in for a fact, and two loops that drift.
- **(c) Runner only; the session may not dispatch at all.** The purest reading of #3383's end state. Rejected as a default: the operator deliberately runs the runner stopped, ad-hoc and exploratory work would have no path, and a human could no longer intervene faster than a tick.

*Default (a), because #3031 already ruled the principle for operations and (b) is the exact drift that ruling exists to prevent; (a) only extends it from the operation to the loop around it.*

## Fork 2 — where the shared durable state lives

- **(a) [default] Derive, do not store; keep exactly one sidecar, resolved from one place.** In-flight and guard facts come from what already records them durably: run records (`dispatch-lane`'s in-flight guard), `claim`, the lane lease, and GitHub labels and comments (how `reconcile-pass` already works, statelessly). The one thing that stays a sidecar is the operator's clear-for-build intent (#2615), but every caller resolves it through ONE resolver (live runner's checkout, else the primary checkout), never the caller's own clone.
- **(b) Move the queue into GitHub (a `queued` label) or committed frontmatter.** Visible from any clone. But it reverses #2615's ruling that transient intent is session-local and would need that statute reopened.
- **(c) Keep per-checkout state and add a sync.** A fourth store to keep consistent. Not recommended.

## Fork 3 — one liveness model

Today: `claude agents --json` (thin, and the PR-to-session binding is a proxy: lane `HEAD` against the PR's `headRefOid`), the lane lease's pid heartbeat, and the run record's liveness stamp. Idle-but-finished sessions poison the first, which froze the fix pipeline on 2026-09-19.

- **(a) [default] The completion record says "finished", the listing plus run record says "alive", and a session that is alive but finished is reaped** (#x9rppp9). Reconcile's `live-process` refusal is then trustworthy because idle-finished sessions cannot persist.
- **(b) Do not leave them alive: launch workers so they exit on completion.** The spawn argv in `we:scripts/operations/dispatch-lane-io.mjs` uses `--bg`, which keeps a session resident. If a non-interactive one-shot launch exists that exits when the agent is done, "alive" would mean "working" and no reaper is needed. Possibly the better root fix, but it is unverified (#3381 and #3624 show `--bg` sessions idling at a prompt) and changes how every worker is launched. Research it before ruling; it does not have to block (a), which is small and works either way.

## Concrete code to read before ruling

`we:scripts/conveyor/tick-core.mjs` (`planTick`, the guard retirement functions), `we:scripts/conveyor/reconcile-core.mjs` (refusal 4, liveness), `we:scripts/conveyor/queue-store.mjs` and `we:scripts/conveyor/resolve-runner-checkout.mjs` (the per-checkout queue), `we:skills-src/conveyor/runner.mjs` (`makeCliMechanicalPasses`), `we:scripts/conveyor/session-reaper.mjs`.

## Done when

1. **Executable** — TODO: ratified by the operator and recorded in a `## Ruling` section; the forks it settles are then carved into slices under #x4v2xe4 or the ruling's stated home.
