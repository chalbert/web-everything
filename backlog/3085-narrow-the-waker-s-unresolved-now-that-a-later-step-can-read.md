---
bornAs: xv4ljwp
kind: story
size: 1
parent: "3029"
status: open
dateOpened: "2026-08-13"
tags: [plateau-loop, operations, engine, dispatch, waker]
blockedBy: ["3083"]
scope:
  - we:scripts/operations/effect-observer.mjs
  - we:scripts/operations/wake.mjs
---

# Narrow the waker's `unresolved` now that a later step can read an effect's outcome

`unresolved` collapses two cases that want opposite answers — *the build ran and failed* (react to it) and
*the dispatch never took* (retry it) — because when it was written the engine could express neither. #3082
just supplied half of what was missing: an effect step now writes a finding, so a later step CAN read a
failing outcome and branch on it.

So the first half is unblocked. **The second is not**, which is why this is filed rather than built.

## What is now expressible

An observer that saw the work run and fail could answer `succeeded` with a failing `result`, the entry would
record `applied`, and a declaration with a reacting step would see it:

```
findings.react: {"sawOutcome":{"exit":1,"log":"BUILD FAILED"}}
the human is asked: The build FAILED. Land anyway?
```

That is exactly the shape PR #1186 round 3 bounced as impossible, and #3082's own probe.

## Why it is not simply "do it"

**A declaration with NO reacting step still advances silently.** #3082 makes reacting POSSIBLE; it does not
make it required. A dispatch whose build failed, in a declaration that reads no finding, runs to `complete`
at exit 0 carrying `result: {exit: 1}`. Whether that is correct — the declaration's own choice, same as
ignoring any other finding — or whether the waker should refuse to advance past a failing outcome, is the
actual decision here and it wants deciding rather than assuming.

The naming needs care too: `succeeded` currently means *cleanly*, and it refuses an accompanying `error`. A
"ran, here is the outcome" answer is a different word, and this area has already produced three vocabularies
that each re-ran real work.

## Blocked on

[#3083] — the *never took* half is still a retry with no policy and no owner, so `unresolved` has to stay for
it regardless. Splitting one half out while the other keeps the collapsed word is worse than either.

## Watch for

- Three vocabularies have been measured re-running real, non-idempotent work here. Any new terminal answer
  gets the ten-tick probe and the `--resume` probe before it is believed.
- Every status is a promise about what the next caller may do. Ask what a new one licenses.

## Done when

- [ ] An observer can report an outcome a declaration reacts to, without any caller re-dispatching.
- [ ] A declaration that ignores the outcome behaves in a way this item states deliberately.
