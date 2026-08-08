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

A reason entry may carry `"todo": true` paired with `"owedTo": "<open backlog item>"`. It is the same FAMILY of
honest escape the invariant catalogue already carries — `status: "judgment-only"`, 6 entries in
[we:scripts/lib/invariant-catalogue.json](../scripts/lib/invariant-catalogue.json) — but deliberately stronger:
that escape records only that a guarantee is unenforced and names nobody who owes it, so nothing there goes stale
when the work lands. A `todo` entry is not a free pass; it points at the work that owes it, and the gate fails
once that work exists. A top-level `todoMarker` block carries the prose and declares — as data — which contract
sections the marker is legal on.

The pin becomes todo-aware in three parts, replacing containment-only:

| row | verdict |
|---|---|
| code token the contract never declared | FAIL (the #1099 safety half, unchanged) |
| declared, absent from the code, **unmarked** | **FAIL** (what passes today) |
| declared, absent, marked `todo` with a valid `owedTo` | PASS (the #1099 relaxation, made explicit) |
| marked `todo` but **implemented** | **FAIL** (the stale marker `test.todo` never catches) |

## Follow-ups filed out of this item

- **`#x4438kf`** — `todoMarker.appliesTo` is enforced only in the POSITIVE direction (a `todo` on `reasons`
  requires `appliesTo` to name `"reasons"`). Nothing refuses a `todo` sitting on a section `appliesTo` does *not*
  name; it loads silently and means nothing. Inert today (only `partitionReasons` reads the marker, and it walks
  `reasons` alone), so it is a spec-correctness gap rather than a safety gap — and closing it means touching the
  loader's refusal surface, which this item pinned with 35 load-time fixtures.
