---
bornAs: xsc9w09
kind: story
size: 5
parent: "3029"
status: open
dateOpened: "2026-08-25"
tags: []
scope:
  - we:scripts/operations/review-dispatch.mjs
  - we:skills-src/review/review-agent-brief.md
---

# Declare an operation that dispatches an independent review to a fresh session

An author can RUN review-pr; what they cannot do is record the acceptance. `we:scripts/review-set-label.mjs:586` refuses only `--to=accepted`, and only on a proven self-clear. So a bounce needs no separate session and an ACCEPT always does — and a subagent inherits its parent's id, so a panel spawned from the authoring session is still one actor. Something must spawn a non-author session and nothing declares it: `dispatch-lane` takes `--num` and never takes a lane, so it cannot serve this. Measured 2026-08-25: ten review mandates hand-written in one session, the largest single source of repeated orchestration that day.

## 2026-08-31 — scoped and built, alongside `#3072`'s unattended-review capability

`we:scripts/operations/review-pr.mjs`'s own `read` step refuses a self-clear (same actor authoring and clearing)
for ANY eventual verdict, not only an accept — so this item's job is not merely "make an accept safe", it is
"make the review runnable from a non-author actor AT ALL". A subagent inherits `CLAUDE_CODE_SESSION_ID` from its
parent, so a review spawned as a subagent of the authoring session never clears that check no matter what it
answers. `we:scripts/operations/dispatch-lane.mjs` is the existing precedent for "start a genuinely independent
session", but it is shaped for the conveyor's tick core (`--num` resolves an item out of `planTick`'s own launch
lists, and its lane comes from that plan) — it has no notion of "review PR #N" and never takes an arbitrary lane,
so it cannot serve this directly; a new, narrower declaration was needed.

**Shape chosen: a PLAIN MODULE (`we:scripts/operations/dispatch-abort.mjs`'s precedent), not the declarative
`op()` engine (`we:scripts/operations/dispatch-lane.mjs`'s shape).** That file earns its three declared steps
and its own conveyor effect type because it is consumed by the tick core's OWN bookkeeping loop (the in-flight
ledger, the double-dispatch guard, the health-stall scan). None of that applies here: this operation dispatches
at most once per invocation, has no sibling call to guard against, and its own dispatched session acquires its
OWN lane rather than being handed one by a tick plan. Declaring three steps and a run record for that would be
machinery with nothing to consume it — this item's own instructions are explicit that wiring INTO the conveyor's
tick loop (`we:skills-src/conveyor/runner.mjs`, `we:scripts/conveyor/reconcile-pass.mjs`) is separate, later
work, so nothing here needs that machinery yet either.

**What makes the dispatched session independent**: not a derived id, not an env-var override on this process — a
brand-new random UUID, minted by `we:scripts/operations/review-dispatch.mjs` and handed to
`claude --bg --session-id=<uuid>` via the SAME spawn primitives `we:scripts/operations/dispatch-lane-io.mjs`
already exports (`defaultSpawnAgent`, `buildAgentArgv` — reused verbatim, not re-implemented). `claude --bg` does
not adopt an inherited `CLAUDE_CODE_SESSION_ID`; supplying `--session-id` fixes the spawned session's identity to
that value, deterministically — the same property `we:scripts/lib/judge-spawn.mjs` already relies on for a
juror's independence.

The dispatched session's own brief (`we:skills-src/review/review-agent-brief.md`, a new template mirroring
`we:skills-src/conveyor/delivery-agent-brief.md`'s shape) instructs it to: acquire its own lane, run
`#3072`'s `we:scripts/operations/review-loop-cli.mjs` against the named PR exactly once, and — the one rule
stated in the brief with no exception — never itself answer a queued accept, no matter how the review turned out.

## Done when

1. **Executable** — `node we:scripts/operations/review-dispatch.mjs --pr=<N> --repo=<owner/repo>` starts a
   genuinely NEW session (`claude --bg --session-id=<a freshly minted UUID>`), never a subagent of the calling
   process, whose filled brief names that PR and repo — pinned by a test asserting the spawn's argv carries a
   session id the test's own injected minter chose, never anything derived from or equal to the caller's own
   identity.
2. **Executable** — the brief-filling refuses the same three ways `we:scripts/operations/dispatch-lane.mjs
   #fillBrief` does (a missing placeholder value, a value carrying shell-unsafe characters, a MISSPELLED
   placeholder token) and reports (never fails on) an unrelated bracketed token in the brief's own prose — each
   pinned by its own test.
3. **Executable** — refuses to dispatch when run from inside a lane checkout (mirrors
   `we:scripts/operations/dispatch-lane-io.mjs#assertNotALaneCheckout`), and refuses a non-positive-integer `--pr`
   or a `--repo` that is not an `owner/repo` slug, before any brief is read or any process spawned.
4. `npm run check:standards` — no new errors.

NOT in this item's scope, stated so a later reader does not look for it here: deciding WHETHER a review is owed
for a given PR (`we:scripts/conveyor/reconcile-core.mjs`'s `DISPATCH_KINDS` `review` decision, #3296, already
landed) and wiring the tick core's own loop to CALL this operation when that decision fires — both are separate,
later integration work per this task's own instructions.
