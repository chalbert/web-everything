---
bornAs: xqpio1t
kind: task
status: open
dateOpened: "2026-08-05"
tags: [review, drain, conveyor]
scope:
  - we:scripts/workflows/review-parked-prs.mjs
  - we:scripts/lib/review-core.mjs
---

# Convergence loop's reduce and its returned ledger disagree on the disposition

On the first live run of `we:scripts/workflows/review-parked-prs.mjs` (PR #1049), the round-2 reduce step
recorded `disposition: { mode: converge, autoLand: true }` while the ledger the workflow returned for the
same PR recorded `{ mode: human, autoLand: false }`. Both carried the same `verdict: changes`. Nothing
consumed the field this time — a human acted on the verdict — but the disposition is exactly what an
automated caller would route on, so the two must not disagree. Establish which is authoritative and make the
other follow it.

## Why it is owed

`deriveReviewDisposition` (#2285) is the seam that decides whether a parked PR may be cleared by an agent or
must reach a human. The loop's boundary (epic #2418) is that it returns a verdict and the CALLER decides what
the verdict does — so the ledger's `disposition` is the field that decision reads. If the reduce step and the
ledger can disagree, then a caller wiring `autoLand` to a real land action could land on a disposition the
loop's own reduce never reached, or park something the reduce cleared.

The direction of this instance was safe (`human` / `autoLand: false` is the more conservative of the two), so
the risk is a future run where the disagreement points the other way. That is the case worth pinning before
`we:scripts/review-runner.mjs` or the conveyor consumes the field unattended.

Observed in the run's journal at
`.claude/projects/…/subagents/workflows/wf_33cfe58f-954/journal.jsonl` — the round-2 reduce result and the
final ledger entry for PR #1049.

## Build

- Trace where the ledger's `disposition` is set relative to the per-round reduce: is it recomputed at the
  Ledger phase from the escalation reasons (which for #1049 were `blast-radius` → `converge`), or carried
  from the last reduce, or overwritten by the `escalate` outcome's human fallback?
- Make the ledger's `disposition` derive from ONE place. If an `escalate` outcome is meant to force a human
  disposition regardless of the reason's own band, then the reduce's disposition should be recomputed the
  same way rather than left stale — the loop already treats a round-cap deadlock as `escalate` → human.
- Cover it with a case that pins reduce and ledger to the same value for both the converge-band and
  human-band reasons.

## Acceptance

- For a PR whose escalation reason is agent-clearable (`blast-radius`) but whose loop outcome is `escalate`,
  the reduce's disposition and the returned ledger's disposition are identical.
- A test fails if the two are computed independently again.
