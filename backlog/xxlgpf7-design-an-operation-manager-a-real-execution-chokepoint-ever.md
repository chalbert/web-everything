---
kind: decision
parent: "3383"
status: open
dateOpened: "2026-08-31"
relatedTo: ["3421", "3422"]
tags: [governance, conveyor, operations, design]
---

# Design an "operation manager": a real execution chokepoint every command routes through

Capture-only, per `#3383`'s own next-steps (2026-08-31 session): file the "operation manager" design as its
own card under this epic, capturing what was discussed rather than treating it as settled. Matches `#3422`'s
own shape — open, capture-only, no build required to close it, mirroring `#3049`'s own precedent for a
discussion-in-progress card.

## The operator's own framing, near-verbatim in substance

Discussed at length with the operator during the same 2026-08-31 session that built
`we:scripts/operations/dispatch-abort.mjs` (see below). "Operation manager" means something bigger than any
one helper script: a REAL execution chokepoint that every command — not only dispatched-agent commands —
routes through. Its shape, as discussed:

- **Semantically-named operations, not raw commands.** Callers invoke an operation by what it means (e.g.
  "stop this session," "acquire this lane"), never by the literal shell command that happens to implement it.
  No detail about HOW an operation executes leaks to the caller — which also buys OS-independence, since the
  underlying mechanism can change without any caller changing.
- **Logged and telemetered, even for cheap or read-only calls.** Every operation call is observable, not just
  the expensive or mutating ones — the same visibility this epic has repeatedly found missing elsewhere
  (`#3398`'s alerting gap, the "four overlapping heuristics" liveness problem named in this epic's own
  2026-08-30 blind-review write-up).
- **Tiered by cost.** Three rough tiers were discussed: free-and-inline (cheap enough to run synchronously,
  no scheduling needed); CPU-scheduled (queued/dispatched but not runner-only); and mutating-and-runner-only
  (state-changing calls that must go through the same runner/lane machinery dispatched builds already use).
- **The catalog grows from real usage, not speculative up-front design.** The missing-operation case —
  a dispatched agent hits a gap, halts, and surfaces a `missing-operation` finding rather than silently working
  around it or guessing (`#3405`'s already-ratified doctrine) — is explicitly the mechanism by which the
  operation catalog is meant to expand over time, not a one-time design exercise that tries to enumerate every
  operation up front.

## The concrete precedent this generalizes from

`we:scripts/operations/dispatch-abort.mjs` (built this same session, `PR #1737`, still parked `review:pending`
as of this write-up — see `#3383`'s own session-update section 3) is the first real, working instance of this
shape: a plain-module declared-style operation (matching `we:scripts/operations/wake.mjs`'s own precedent, not
the full `op()` declarative engine) that composes `stopSession` (shells `claude stop <id>`, never `kill`) and
`trustCheckout` (grants checkout trust via the same `withTrustedDirs` primitive
`we:scripts/bootstrap-session.mjs` already uses for lanes) into `abortDispatch`. It is cited here as the
concrete, working example the "operation manager" framing generalizes from — not as the operation manager
itself. The operator's own point: the real design question is not "should `we:scripts/operations/dispatch-abort.mjs`
exist" (it already does, and works) but "should EVERY command in this repo — not only the ones a dispatched
agent runs — route through something shaped like it."

## Explicitly NOT a final design

This card exists so tonight's discussion isn't lost, not because the design is settled. Nothing above has been
ruled on: the exact boundary of "every command" (does this include every `npm run` invocation, or only
operations already registered under `we:scripts/operations/`?), the concrete mechanism for the cost tiers, how
the telemetry is stored/queried, and how the missing-operation-driven catalog growth is actually wired into
`/harvest` or a lighter trigger are all open. Whoever picks this up next should read `#3383`'s own session
update for 2026-08-31 (section 3, the "operation manager" paragraph, and section 2's confidence-call/
criteria/blacklist refinements which sharpen the missing-operation growth path specifically — folded into
`#3421`'s scope separately) before treating any part of this as decided, and should continue the design
conversation with the operator rather than ruling unilaterally.
