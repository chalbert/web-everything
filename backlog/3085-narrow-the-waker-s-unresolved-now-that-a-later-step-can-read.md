---
bornAs: xv4ljwp
kind: story
size: 1
parent: "3029"
status: resolved
dateOpened: "2026-08-13"
tags: [plateau-loop, operations, engine, dispatch, waker]
blockedBy: ["3083"]
dateStarted: "2026-08-15"
dateResolved: "2026-08-15"
graduatedTo: none
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

- [x] An observer can report an outcome a declaration reacts to, without any caller re-dispatching.
- [x] A declaration that ignores the outcome behaves in a way this item states deliberately.

## How it resolved

A fourth word, `resolved`, sits between `succeeded` and `unresolved` in `OBSERVATIONS`
(`we:scripts/operations/effect-observer.mjs`). It answers exactly the shape in "What is now expressible"
above, but through its own name instead of borrowing `succeeded`'s: it records `applied` — the effect DID
run, on the same terms `succeeded` does, so nothing re-dispatches it — but makes NO claim the outcome was
good. Unlike `succeeded`, an accompanying `error` is not refused, and `result` may itself describe a failure
(a non-zero exit, a log tail). `succeeded` is untouched and keeps meaning *cleanly*; the one production
observer that reaches it (`we:scripts/operations/dispatch-lane-io.mjs`'s merged-PR axis) never needed the new
word and is not touched.

That narrows `unresolved` to what #3083 still has no policy for: "the dispatch never took" and the genuinely
ambiguous case. "The build failed" now answers `resolved` instead — reported to a later step, not swallowed.

**The ignore question, settled:** a declaration with no step reading `findings.<step>` advances past a
`resolved` finding silently, and that is deliberate rather than an oversight this item left open. It is the
declaration's own choice, exactly like ignoring any other finding the engine ever records — `reads:` is
already the whole mechanism a declaration has for opting in to anything, and there is no mechanism anywhere
else in the engine that forces a later step to consume an earlier one's output. Making the waker refuse to
advance past a `resolved` finding nobody reads would mean the waker judging a declaration by what it
declared — a different, and bigger, call than a size-1 item narrowing a vocabulary word, and out of scope for
`we:scripts/operations/effect-observer.mjs`/`we:scripts/operations/wake.mjs` alone (it would need
engine-level enforcement, not a new observer word). Both files now say this in the load-bearing comments, so
the next reader finds the reasoning where the code is, not only here.

Covered in `we:scripts/operations/__tests__/wake.test.mjs`: `resolved` records `applied` with a failing
`result`; it permits an `error` alongside without being refused (unlike `succeeded`); and an end-to-end test
drives a dispatch through the waker into a `confirm` step whose `reads: ['findings.go']` sees the failing
outcome and asks "The build FAILED. Land anyway?" — the reviewer's probe from #3082/#1186, now reachable
through an observer rather than only a synchronous sink.
