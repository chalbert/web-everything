---
bornAs: xynt0jj
kind: story
size: 5
parent: "3029"
status: resolved
blockedBy: ["3032", "3030"]
dateOpened: "2026-08-08"
dateStarted: "2026-08-13"
dateResolved: "2026-08-13"
scope:
  - we:scripts/operations/
  - we:scripts/conveyor/
scopeRationale: "Adds one declaration file and reads the existing conveyor tick core; the declaration filename does not exist yet."
tags: [plateau-loop, delivery, operations, conveyor, dispatch]
---

# Declare dispatch — the effect that starts rather than completes

The real test of the four-kind vocabulary. Dispatching a lane reads the queue, the leases and the free slots —
all `compute`, all already scripted — and then its effect **launches an agent that outlives the run by an hour**.

Nothing in `compute` / `judge` / `confirm` / `effect` describes an effect that *begins* rather than *finishes*.
Every other declared operation's effects are applied and done; this one hands off.

## Gated on the spike

`blockedBy` [#3030] deliberately. That two-point spike establishes whether the command-line background-agent
lifecycle already owns start / observe / stop, and its answer changes what gets built here:

- **Lifecycle covers it** → the effect is "start a background agent, record the handle", the run completes
  normally, and the engine never models a long-running child. No new kind.
- **Covers start only** → a thin adapter supplies observation and stop. Still no new kind.
- **Does not fit** → the vocabulary has a genuine hole, and per
  [#operations-declared-once-callers-generated](../docs/agent/platform-decisions.md#operations-declared-once-callers-generated)
  that is a signal the *model* is wrong. Extending to a fifth kind would then be its own decision, argued in the
  open, not a quiet addition inside this slice.

**Do not start this slice before the spike reports.** Building it blind is how a fifth kind gets added by
accident.

## What it must not disturb

Dispatch is the conveyor's own machinery, and the mechanical tick core already exists and is tested. This slice
declares the operation **over** that core; it does not re-derive dispatch policy, and it puts no model in the
per-lane loop — [#conveyor-orchestration-mechanics-not-per-lane-agent](../docs/agent/platform-decisions.md#conveyor-orchestration-mechanics-not-per-lane-agent)
is untouched. The singleton runner lock stays exactly where it is.

## Progress

**Delivered — answer 2, and no fifth kind.** The spike (#3030) reported before this started, and its answer held:
`compute` / `judge` / `confirm` / `effect` already describe an effect that begins rather than finishes, because
three kinds suspend and `advance` is idempotent with no resume. Nothing here extends the vocabulary. The two
mechanisms the spike said were missing had already shipped (`dispatch: true` + `inFlight` in #3073, the observer
contract + waker in #3084), so this slice is three ordinary steps over machinery that existed.

- **we:scripts/operations/dispatch-lane.mjs** — the declaration. `read` (shape one tick read + FILL the delivery
  brief) → `plan` (the verdict: dispatching, or the hold reason) → `dispatch` (ONE `dispatch: true`,
  `idempotent: false` effect, or ZERO when the core said no). No `confirm` and no `judge`: a human or a model in
  the per-lane loop is what `#conveyor-orchestration-mechanics-not-per-lane-agent` forbids. Its whole static
  import graph has zero `node:` specifiers, asserted.
- **we:scripts/operations/dispatch-lane-io.mjs** — the io shell. ONE call to `we:scripts/conveyor/tick-core.mjs`
  with the caller's bookkeeping on STDIN (the same CLI the runner drives, not a re-composition of it), item
  identity through the tick's own `normNum`, item scope from the canonical backlog loader, the brief read as
  text. Plus the SINK that starts the agent and the OBSERVER that polls it.
- **The holds are structural, not promised.** `lane` is not an input field — a caller dispatches the lane the
  core assigned or nothing. A `num` the core SUPPRESSED comes back as a non-dispatch carrying the guard's own
  reason. No guard rule, TTL or lease check is re-derived here.
- **The handle is MINTED, not discovered.** `claude --session-id <uuid>` lets the dispatcher choose the id
  before the agent exists, so there is no before/after diff of `claude agents --json` and no race with any other
  session starting in the same instant. The spike had not found this flag; it is the one place its account was
  narrower than the CLI.
- **Registered** in `we:scripts/operations/run.mjs`'s `OPERATIONS` (the derived `--help` and the HTTP route come
  free), and its observer registered in `we:scripts/operations/wake.mjs`, which had been holding an empty table
  for the first thing that dispatched.
- **Verified against a real queue**: the reader run against live `tick-core` output resolved this item's real
  spec path, scope and status line, and the whole operation ran end to end through the derived CLI (correctly
  answering "not cleared for build" — #3037 was claimed, so it is not in the cleared queue). The DISPATCHING
  branch was then run against the real 36KB brief and this item's real frontmatter, producing a fully-filled
  prompt and the exact `claude --bg --session-id …` argv — everything up to, and not including, starting the
  process.
- **Proven across a process boundary** — `we:scripts/operations/__tests__/dispatch-crosses-processes.test.mjs`:
  a second `node` handed only a run id reads the handle, the lane and the brief off disk and observes with the
  real observer.

**Fixed in the pre-PR review round**, recorded because two of them were the whole feature:

- **The brief fill refused every real dispatch.** The first cut threw on any leftover `{{TOKEN}}`, and the real
  brief's own prose carries two (`{{PLACEHOLDERS}}`, `{{LIKE_THIS}}`, both documentation about the fill
  convention). Forty green tests missed it because every one used a synthetic template. Unknown tokens are now
  REPORTED, never fatal, and a test fills the brief off disk — the check was also mis-weighted, since a stray
  token costs one confusing line and a false refusal costs the whole dispatch.
- **The bookkeeping file could dial the holds it was supposed to inherit.** `tick-core`'s shell reads `config`
  (the TTLs, the retry caps) and `signals.returnedBuildNums` (which retires live build guards) off the same
  STDIN, so piping the caller's file through verbatim let it set `buildTtlTicks: 0` and clear a lane that
  already had an agent on it. Only `bookkeeping` is forwarded now; the drops are reported.
- **`nextState` over-claimed.** `planTick` records a guard per PLANNED spawn; this operation starts ONE. Carried
  forward, it would have held a sibling's lane for a whole TTL against a dispatch that never happened. Split
  into `dispatchedGuard` (what this earned) and `tickNextState` (named for what it is).
- Also: a value allowlist on the fill (`SCOPE` is pasted UNQUOTED into a shell command the agent runs), a
  refusal to dispatch from inside a lane clone, timeouts on both subprocess calls, one `claude agents` read per
  waker pass rather than one per entry, and `WE_DISPATCH_AGENT_ARGS` so the permission/model knob is reachable
  by an operator rather than only by a test.

**Deliberately not delivered**, each filed rather than half-done:

- The observer answers `running` or `unresolved` and never `succeeded`. `claude agents --json` reports LIVENESS,
  not outcome, and `--all` showed no terminal record for a completed background session, so "gone" collapses
  *finished cleanly* and *died*. A real completion signal is #x9ylkp7.
- The conveyor still dispatches through the main-session bridge's `Agent` spawn; this operation is a second,
  declared path rather than the only one. Routing the bridge through it is #xaibmeu.
- **Stop is still unprovided** (the spike's follow-up 3) and retry is still unowned (#3083). Neither is touched.

## Acceptance

A lane is dispatched through the declared operation with the same holds, the same scope-lease arbitration and the
same guard bookkeeping as the current tick, verified against a real queue. The launched agent's handle is
recorded on the run so the conveyor can find it after a restart. If the spike returned answer 3, this slice
instead lands a written case for the missing kind and stops — a deliberate non-delivery is a better outcome than
a silent vocabulary extension.

> **Read the first clause honestly at resolve.** No `claude` process was started. The dispatch path was run
> against a real queue read and this item's real frontmatter, up to and including the exact
> `claude --bg --session-id …` argv, and stopped there — a delivery agent launched from inside this build's own
> lane would nest two checkouts (the sink now refuses it). Every other clause is met: the holds are the tick
> core's by construction, the handle is recorded, and its survival across a process boundary is proven by a
> test that uses a real second `node`. **The first LIVE dispatch is #xaibmeu**, which is also where a background
> session's permission mode gets settled. Resolved on that reading; a reviewer who wants the live run before
> `resolved` should bounce this and it will hold until #xaibmeu.
