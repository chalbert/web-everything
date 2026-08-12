---
bornAs: xu03x3d
kind: story
size: 2
parent: "3029"
status: resolved
dateOpened: "2026-08-11"
dateStarted: "2026-08-12"
dateResolved: "2026-08-12"
tags: [plateau-loop, delivery, operations, engine, dispatch]
scope:
  - we:scripts/operations/effect-executor.mjs
  - we:scripts/operations/engine.mjs
  - we:scripts/operations/run-record.mjs
  - we:scripts/operations/__tests__/effect-executor.test.mjs
---

# The effect executor cannot say "in flight by design", so a dispatch is refused on replay

`declared → pending → applied | failed` marks an entry `pending` **before** its sink runs, so a crash mid-sink
leaves the outcome unknown and a non-idempotent `pending` entry is refused on replay. That is exactly right for
a crash and exactly wrong for work that is deliberately still running — and the two share one state. Named as
owed follow-up 1 by the [#3030] spike and not filed until now.

## Why it blocks the epic

[#declare-dispatch] is the effect that **starts** something rather than completing it. Under today's states a
dispatch marks `pending`, and the replay guard then refuses to advance it — so the one operation the epic exists
to reach cannot be expressed, for a reason that has nothing to do with the four step kinds.

The spike checked the vocabulary and cleared it: `advance`'s no-resume path is idempotent, three of four kinds
suspend, so *"start work, come back later"* is already expressible. **The gap is the outcome model, not the
vocabulary.** That distinction matters because the statute says an operation appearing to need a fifth kind is
a signal the model is wrong — and the model is fine.

## The distinction to encode

| state | means | on replay |
| --- | --- | --- |
| `pending` | attempted, outcome **unknown** — the process died mid-sink | refuse unless `idempotent: true` |
| *(new)* | **started on purpose**, outcome arrives later | resume and poll; refusing is wrong |

The second is not a weaker `pending`. It carries a handle — the spike established `sessionId` is durable and
`pid` is not — and its resolution is a *later observation*, not a retry.

## Watch for

- The state is written **before** the sink runs, and must stay that way. Marking in-flight after the sink would
  reintroduce the indeterminate window this fixes.
- A dispatched effect whose handle is lost is NOT in-flight-by-design; it has become unknown. That transition
  needs to exist, or a lost handle silently reads as "still running" forever.
- The replay guard is the thing being relaxed, so it needs a test per state rather than one for the happy path.

## Done when

- [x] An effect that starts long-running work is distinguishable from one whose outcome is unknown.
- [x] Replay resumes the first and still refuses the second.
- [x] A dispatched effect that loses its handle degrades to unknown rather than staying in-flight.

## How it resolved

`in-flight` joins `EFFECT_STATUSES`, and an effect opts into it by DECLARING `dispatch: true`.

The declaration, not the sink's return value, is what makes the pre-sink write correct. The executor writes
`in-flight` with a null handle *before* calling a dispatch sink; the sink then returns `inFlight({ handle,
expectedBy })` and only the handle and the deadline are patched in afterwards.

**The [Watch for](#watch-for) rule above is right about the ordering and wrong about why**, and PR #1180's
reviewer caught the first draft repeating the error. The pre-sink write does NOT make a crash mid-dispatch
resumable: a crash between starting the work and hearing back is exactly the no-handle case, and that is
refused on replay, same as `pending`. What the ordering buys is VISIBILITY — the crash lands in
`inFlightEntries().unknown` ("something may be running and cannot be observed") and is closable through
`resolveInFlight`, where a `pending` entry is invisible to both and can only be hand-edited. Keep the
ordering; keep the reason straight.

The lost-handle degradation falls out of one rule: **in-flight is resumable because it is observable.** No
handle, no observation, so the entry is back to "might have started, cannot check" and gets the same refusal an
indeterminate `pending` gets. `inFlightEntries` reports three buckets — `running`, `overdue` (its `expectedBy`
has passed), `unknown` (no handle) — which is what a waker needs to tell healthy work from stalled work.

`resolveInFlight` is the only supported exit, so nothing has to hand-edit a run record; it refuses any entry
that is not in-flight and any non-terminal status.

**The driver had to learn to stop, too.** An in-flight halt returns `error: null`, so `driveRun`'s
`awaiting-effect` branch fell straight through to `advance` — which returns the run unchanged, because
in-flight counts as unapplied — and the loop spun to its turn cap and threw. The CLI exited 1 and the HTTP
adapter 500'd on the one operation this epic exists to reach. `driveRun` now returns a distinct
`effect-in-flight` stop, `renderOutcome` prints the handle and the deadline at exit 0, and the HTTP adapter
treats it as settled. Both are covered by adapter tests, which is what was missing: a green gate could not see
the gap because no adapter test declared a dispatch.

Nine mutations were run against the claims above — including marking the dispatch `pending` before the sink,
moving the in-flight write to AFTER the sink while preserving the end state, treating a handle-less entry as
observable, dropping the `dispatch` flag in the engine, removing the driver's park branch, and 500-ing on a
park — and each reddened named tests.

No waker is built here; [#3070] is what polls these entries.
