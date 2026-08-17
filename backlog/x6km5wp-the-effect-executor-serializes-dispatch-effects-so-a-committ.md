---
kind: story
size: 5
parent: "3029"
status: open
scope: ["we:scripts/operations/effect-executor.mjs", "we:scripts/operations/engine.mjs"]
dateOpened: "2026-08-17"
tags: [operations, epic-3029, executor, dispatch]
relatedTo: ["3150", "3037", "3073"]
---

# The effect executor serializes dispatch effects, so a committee investigates one panelist at a time

`applyPendingEffects` halts at the first effect whose sink returns an in-flight marker — its guarantee is
*"effect N+1 is never attempted before N is applied"*. Right for two ordered writes, wrong for a fan-out: the
`explore` committee (#3150) declares one dispatch effect per panelist so each carries its own handle and its own
in-flight/resolved status, so panelist 2 starts only once panelist 1 has resolved and a three-seat committee
costs three times the wall clock of the hand-run pattern it generalizes. Decide whether a step may declare its
effects as an unordered GROUP — dispatch them all, halt only once every one is in-flight — and, if so, how a
partial-failure replay stays safe.

## Where it was found

`we:scripts/operations/explore.mjs`'s header states the cost rather than working around it, and
`we:scripts/operations/__tests__/explore.test.mjs` PINS the current behaviour — *"the executor applies the
seats ONE AT A TIME"* asserts one in-flight entry and two still `declared` after a single `applyPendingEffects`.
That test is deliberately the tripwire: it fails the moment fan-out lands, which is where the reader is sent to
update the header note too.

## What must not regress

The three properties that made per-panelist effects the right shape in the first place, and that any fan-out
must keep:

- **One handle per panelist.** A group that shares one handle is a group whose members cannot be observed,
  attributed or closed out apart — the degradation `inFlightEntries().unknown` exists to make visible.
- **`in-flight` is written BEFORE the sink runs** (#3073), per member, so a process death lands in
  `inFlightEntries().unknown` rather than in `pending`.
- **A non-idempotent effect is never replayed on an indeterminate attempt.** Fanning out must not become a
  reason to relax that: two investigators on one seat write one report path, and two delivery agents on one
  lane clone corrupt a working tree.

## Done when

1. **Executable** — `npx vitest run scripts/operations/` passes with a test that applies a step declaring N
   `dispatch: true` effects and asserts all N are in-flight after ONE `applyPendingEffects` call, while an
   ORDERED step (`review-pr`'s `record`, two writes whose order is the whole point) still halts at the first
   failure.
2. The ordering guarantee's scope is stated where it is made (`we:scripts/operations/effect-executor.mjs`'s
   header, guarantee 1): which steps keep strict ordering, which may fan out, and how a declaration says so.
