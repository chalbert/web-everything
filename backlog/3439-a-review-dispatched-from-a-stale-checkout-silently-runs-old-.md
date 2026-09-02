---
bornAs: xb2rz0g
kind: task
parent: "3383"
status: resolved
dateOpened: "2026-09-01"
dateStarted: "2026-09-01"
dateResolved: "2026-09-02"
tags: []
scope:
  - we:scripts/operations/review-dispatch.mjs
  - we:scripts/lib/main-staleness.mjs
  - we:scripts/operations/__tests__/review-dispatch.test.mjs
---

# A review dispatched from a stale checkout silently runs old code regardless of what's on main

Found live 2026-09-01. `we:scripts/operations/review-dispatch.mjs` spawns the review agent with its
start-of-life `cwd` at the DISPATCHING checkout's own location. If that checkout is stale (e.g. a scratch
clone pinned to `origin/lane/mechanical-dispatcher`, not rebased since a fix merged to `main`), the agent's
own `node we:scripts/operations/review-loop-cli.mjs` invocation loads THAT checkout's copy of
`we:scripts/lib/review-loop-policy.mjs` — not the fresh lane it later acquires for the PR's own data. Two
real review rounds tonight kept reporting pre-`#3434` behavior (queued for a human, not mechanical accept)
until dispatched from a genuinely current `main` clone instead. Nothing in the dispatch or the brief checks
or asserts that the dispatching checkout is current — a stale one fails silently, producing a real but
wrong-for-the-wrong-reason verdict rather than an error.

## Done when

1. **Executable** — `we:scripts/operations/review-dispatch.mjs` (or its brief) asserts the dispatching
   checkout is not behind `origin/main` before spawning, and refuses plainly (not a silent stale-code run)
   when it is — with a real test proving a checkout N commits behind is refused, not silently used.
2. Decide and document where a dispatched review's own code SHOULD come from — the dispatching checkout at
   spawn time (today's actual behavior, now made loud instead of silent) or the lane it acquires (would need
   the agent to re-invoke itself from within the lane) — this card should record the choice, not just the gate.

## Progress

Added `assertMainNotStale` in `we:scripts/operations/review-dispatch.mjs`, wired into `dispatchReview` before
the brief is read or the agent spawned. Refuses (throws) whenever `origin/main` is ahead of the dispatching
checkout — behind, diverged, or not, no auto fast-forward (unlike the read-only ranker's `checkMainStaleness`
use, this checkout may carry uncommitted work a caller does not expect mutated). A fetch failure (offline)
stays fail-soft, matching `we:scripts/lib/main-staleness.mjs`'s own philosophy.

**Decision (#2):** the dispatched review's code keeps coming from the dispatching checkout at spawn time —
today's actual behavior — not the lane it later acquires. Re-invoking from inside the freshly-acquired lane
would close the gap more completely but is a bigger structural change this item does not make; recorded as the
explicit choice in `assertMainNotStale`'s own doc comment, per this item's #2.

Tests: `we:scripts/operations/__tests__/review-dispatch.test.mjs` — `assertMainNotStale` unit coverage (fresh
passes through, N-commits-behind refuses naming the count, a diverged checkout refuses the same way, offline
is fail-soft) plus `dispatchReview` coverage proving the refusal fires before the brief is read or the agent
spawned, and that a fresh checkout still dispatches.
