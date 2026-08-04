---
kind: story
size: 5
parent: "2572"
status: open
blockedBy: ["2864", "2893"]
dateOpened: "2026-08-04"
tags: []
---

# Care-band park routing — none/low stop parking, elevated/high stay machine-clearable

Part 2 of #2572, reshaped by the 2026-08-04 ruling. Route the park by care band instead of demoting every scored signal: none/low stop parking and land immediately, elevated/high keep review:pending (now clearable by the converge daemon, not only a human), gate-self/statute stay review:human. Touches producerReviewLabel + decideReviewGate in we:scripts/lib/review-escalation.mjs. Gated behind the enforce flip — before the flip the converge daemon writes nothing, so unparking any band would let the drain land scored PRs with zero review.

## The table

| Band | Park | Cleared by |
|---|---|---|
| `none` / `low` | none — lands immediately | n/a |
| `elevated` / `high` | `review:pending` | the converge daemon (post-flip); a human until then |
| gate-self / statute (`humanRequired`) | `review:human` | a human, always |

Bands come from `deriveCareLevel`
([`we:scripts/lib/review-escalation.mjs:201-213`](scripts/lib/review-escalation.mjs)) — single-sourced, per
[#build-lane-self-review-non-zero-floor](../docs/agent/platform-decisions.md#build-lane-self-review-non-zero-floor).
Weights/bands are unchanged by this slice; only the *routing* off the band changes.

## Why it is blocked, concretely

- **#2864** — the jury ledger carries no head SHA, so a verdict written at head A folds to *clear* at head B.
  Only bites in enforce mode; shadow's "no ledger → keep parked" path fails closed.
- **#2893** — the `enforceFlipReady` predicate, CI-status probe, durable review-seam ledger, and the
  `check:standards` write gate that refuses `landMode: enforce` until the predicate is ready. Enforces
  [#enforce-flip-triple-gated](../docs/agent/platform-decisions.md#enforce-flip-triple-gated) (#2838).

Both must land, and the flip itself must be thrown, before `none`/`low` may stop parking. Unparking earlier is
not a smaller version of this slice — it is the zero-review hole.

## Scope

- `we:scripts/lib/review-escalation.mjs` — `producerReviewLabel` (`:307-311`), `decideReviewGate` (`:626-687`)
- `we:scripts/lib/__tests__/review-escalation.test.mjs` — lock the per-band routing table
- `we:scripts/__tests__/merge-ai-prs.test.mjs` — an unparked `low` PR lands; an `elevated` PR does not

## Done when

- A `low`-band PR (e.g. size-only, care weight 2) opens with **no** review label and the drain lands it.
- An `elevated`/`high` PR still opens `review:pending` and the drain refuses it until cleared.
- `humanRequired` still opens `review:human`; no path lets a machine clear that.
- Tests lock the table, and the gate refuses the change while `landMode` is still `shadow`.
