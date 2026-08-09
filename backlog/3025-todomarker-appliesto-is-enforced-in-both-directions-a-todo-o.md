---
bornAs: x4438kf
kind: task
status: open
dateOpened: "2026-08-08"
scope: ["we:scripts/lib/review-policy.mjs", "we:scripts/lib/__tests__/review-policy.conformance.test.mjs"]
tags: [review-policy, conformance, spec-based-programming]
---

# todoMarker.appliesTo is enforced in BOTH directions — a todo on a section it does not name is refused at load

The review-policy contract's `todoMarker.appliesTo` block (added by `#3027`) declares, as data, which contract
sections the not-yet-implemented marker is legal on — today exactly `["reasons"]`. The loader enforces only the
POSITIVE direction: if a *reason* carries `todo`, `appliesTo` must include `"reasons"`. Nothing checks the
negative direction, so a `todo` marker sitting on `thresholds`, `disposition.precedence`, or a `careJury` band
loads silently and means nothing. Make the loader sweep every non-`appliesTo` section and refuse a `todo` (or a
stray `owedTo`) it finds there.

## Where it is today

In [we:scripts/lib/review-policy.mjs](../scripts/lib/review-policy.mjs), the `appliesTo` walk is **inline in
`validateContract`** (lines ~185–193) — there is no separately named block validator. It checks `appliesTo` itself
(non-empty, no duplicates, every entry in the closed `TODO_MARKER_SECTIONS` set) and then, in the per-reason loop
just below (lines ~209–212, which also calls `validateTodoMarker` for the entry's own `todo`/`owedTo` shape),
checks that a `todo` implies `appliesTo` includes `"reasons"`:

```
fail(`reason "${r.token}" carries a todo marker, but todoMarker.appliesTo does not include "reasons"`)
```

That is the only marker/section check in the file. No other section is inspected for `todo`/`owedTo` at all.

## Why it is a spec-correctness gap and not a safety gap

A marker outside `reasons` is **inert**: `partitionReasons` is the only thing that reads the marker, and it runs
over `REVIEW_POLICY.reasons` alone. A `todo` on a threshold changes no derived constant, reaches no runtime
classification, and cannot flip a disposition. So nothing mis-gates today. What it does do is let the contract —
a `leash: spec`, human-gated file — carry a declaration that reads as meaningful and is not, which is exactly the
class of thing `#3027` exists to abolish: a debt declared in prose with no mechanism behind it.

The rank is also why this is a follow-up rather than part of `#3027`: closing it means touching the loader's
refusal surface, which that PR pinned with 15 load-time `validateContract` assertions (12 refusals, 3 accepts) in
the conformance suite's todo-marker block.

## Done when

- The loader walks every contract section NOT named in `todoMarker.appliesTo` and fails at load on a `todo: true`
  or an `owedTo` found there, with a message naming the offending section and key.
- `TODO_MARKER_SECTIONS` stays the closed vocabulary; adding a section to it is still a deliberate spec edit.
- Conformance fixtures cover both directions: a marker on `thresholds` FAILS; the legal `reasons` marker still
  passes; `appliesTo: ["reasons"]` with a marker only on `reasons` is unchanged.
- The existing positive-direction message and the 12 load-time refusal fixtures are unperturbed.

## Provenance

Surfaced as non-blocking observation #1 in the round-1 independent review of PR #1112 (`#3027`), re-raised in
round 2 when the promised follow-up could not be found on the board. Filed in round 3.
