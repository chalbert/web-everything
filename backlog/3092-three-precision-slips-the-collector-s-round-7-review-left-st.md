---
bornAs: x8q8ykp
kind: task
parent: "3029"
status: open
dateOpened: "2026-08-13"
tags: [plateau-loop, operations, engine, dispatch, retry, footgun]
scope:
  - we:scripts/operations/effect-executor.mjs
  - we:scripts/operations/__tests__/wake.test.mjs
---

# Three precision slips the collector's round-7 review left standing

[#3091]'s round-7 reviewer accepted the PR and named three things it deliberately did not bounce on: a
comment that says a key is "dropped" when it is only set to `undefined` in memory, a test whose name is
now vaguer than its body rather than narrower, and a sentence claiming all three entry points call
`applyPendingEffects` "directly" when only the waker does. None changes a recorded number. All three are
the same shape — prose slightly wider than the code — which is the shape that cost [#3091] six rounds, so
they are written down rather than left in a review comment.

## Why these were accepted rather than fixed

The reviewer's stated reasoning, kept because it is the useful part:

> Rounds 1–5's instances changed a threshold's answer. Round 6's was a live gap. Round 7's change no data
> at all — a comment's wording and a test name. Each round's instance is smaller than the last; at this
> granularity every further round finds one more sentence, which is the non-convergence
> `we:docs/agent/delivery-loop.md` calls the stand-down signal. The recording half is now comprehensively
> defended, and it's the half that's unrecoverable in arrears. Bouncing trades real observations for prose.

That is a judgement about *when to stop*, not a claim that the three are fine. They are cheap, and a batch
that is already editing this file should take them.

## The three

**1. The orphan key is not "dropped" from the in-memory record.**
`we:scripts/operations/effect-executor.mjs` writes `attemptedBy: undefined` into the entry patch, and
`withEntry` spreads it — which creates an OWN property whose value is `undefined`, not an absent one. The
reviewer instrumented `'attemptedBy' in entry` and got `true` on the returned object and `false` only after
`store.read` (JSON drops undefined-valued keys on the round-trip). The comment says "dropped rather than
left beside `lastAttemptBy`", which is true of the persisted record and false of the returned one.

The test asserts `toBeUndefined()`, which cannot tell the two apart — so the wording is unpinned as well as
imprecise. Either fix the sentence to say "dropped on persist", or assert on
`Object.keys(store.read(id).effects[0])` and make the stronger claim true by deleting the key.

No consumer is affected today. It matters because [#3083]'s reader will iterate these entries.

**2. `the executor told \`human\` records it, whatever the caller` is now vaguer, not narrower.**
`we:scripts/operations/__tests__/wake.test.mjs`. The old name — *"the same effect driven from the command
line is recorded as `human`"* — claimed the CLI and drove `applyPendingEffects` by hand, which was the
round-6 blocking finding. The rename made the name true, but "whatever the caller" is a claim about many
callers and the body has exactly one. It also sits under a `describe` about the waker while never touching
it. Either vary the caller so the name earns its "whatever", or narrow the name to the single case it runs.

**3. "All three entry points call `applyPendingEffects` directly" is true of one of them.**
`we:scripts/operations/effect-executor.mjs`, in the comment added to correct the previous round's false
"one production path" claim. Only `we:scripts/operations/wake.mjs` calls it directly; the CLI and the HTTP
adapter both go through `driveRun`. The load-bearing half — that none of them reaches the bound closure —
is true and is the half the comment exists for. The word "directly" is just wrong about two of the three.

## Also chased and REJECTED, recorded so it is not re-raised

`we:scripts/operations/wake.mjs`'s comment "because this is the timer" — **nothing schedules the waker
today.** The reviewer judged `auto` defensible anyway, because the label describes the ROLE (a blind sweep,
not a person) rather than the invoker. The word is ahead of the wiring, not wrong. Leave it.

## Done when

- [ ] The "dropped" claim matches what the code does to the in-memory record, or the code matches the claim.
- [ ] Test 2's name covers exactly what its body drives.
- [ ] The "directly" sentence names which entry point is direct and which go via `driveRun`.
