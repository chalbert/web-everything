---
kind: story
size: 2
status: resolved
dateOpened: "2026-08-08"
dateStarted: "2026-08-08"
dateResolved: "2026-08-08"
scope: ["we:scripts/lib/review-policy.contract.json", "we:scripts/lib/review-policy.mjs", "we:scripts/lib/__tests__/review-policy.conformance.test.mjs"]
tags: [review-policy, conformance, spec-based-programming]
---

# A contract entry may declare itself not-yet-implemented (`todo` + `owedTo`), and the conformance gate enforces the marker

PR #1099 relaxed the review-policy conformance pin from set EQUALITY to directional CONTAINMENT — code may never
outrun the spec, but the spec may outrun the code. That made a third state legal and effectively INVISIBLE: an
entry that is *declared in the contract, absent from the code, and unmarked* now passes, in the one suite whose
job is to be the deterministic backstop. A `todo` marker makes that third state explicit, and — unlike
`test.todo`, which never checks whether the work has since been done — the gate also catches the STALE case.

## The hole, as observed rather than argued

Injecting a phantom reason token (`probe-ghost`, declared in the contract with no `REVIEW_REASONS` entry) into
[we:scripts/lib/review-policy.contract.json](../scripts/lib/review-policy.contract.json) fails exactly ONE
assertion today — `covers every token (the decorated map does not silently miss a reason)` in the conformance
suite `we:scripts/lib/__tests__/review-policy.conformance.test.mjs`. That message points the author at the
DECORATED fixture map, not at the missing implementation. Adding the one-line decorated fixture the message asks
for turns the suite **32/32 green** with the token still unimplemented. So the third state is not literally
invisible — it is worse: it is guarded by a tripwire whose own error message tells you how to step over it.

## The marker

A reason entry may carry `"todo": true` paired with `"owedTo": "<open backlog item>"`, the same honest-escape
shape #1100 gives the invariant catalogue ([we:scripts/lib/invariant-catalogue.json](../scripts/lib/invariant-catalogue.json)):
a `todo` entry is not a free pass, it points at the work that owes it. A top-level `todoMarker` block carries the
prose and declares — as data — which contract sections the marker is legal on.

The pin becomes todo-aware in three parts, replacing containment-only:

| row | verdict |
|---|---|
| code token the contract never declared | FAIL (the #1099 safety half, unchanged) |
| declared, absent from the code, **unmarked** | **FAIL** (what passes today) |
| declared, absent, marked `todo` with a valid `owedTo` | PASS (the #1099 relaxation, made explicit) |
| marked `todo` but **implemented** | **FAIL** (the stale marker `test.todo` never catches) |
