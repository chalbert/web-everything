---
kind: task
status: resolved
dateOpened: "2026-08-05"
dateResolved: "2026-08-05"
tags: [review, jury, gate]
scope:
  - we:scripts/lib/jury-core.mjs
  - we:scripts/lib/__tests__/jury-core.test.mjs
---

# Reviewers judge by impact-if-unfixed, and the prevention gate scales to a strictness dial

Findings carried `severity` (how bad the defect looks to its lens) but nothing about what it COSTS to ship,
so the panel could only count objections, never rank them by consequence. Adds `impactIfUnfixed` to the
finding contract and gates the prevention demand on it via a tunable bar.

## Why it is owed

Observed on PR #1042. The mandate demanded prevention introspection "for EVERY finding — at every severity,
nits included", and `deriveVerdict` blocked acceptance on any uncaptured guard with no severity threshold.
A dead struct field and a stale comment each arrived carrying a proposed new `check:standards` rule, and the
mechanical verdict came back `changes` on a diff whose only mandatory-lens objection was a race requiring a
branch deleted without landing inside a ~30s window. Six of seven findings blocked; two had real cost.

The operator framing that fixed it: judge by **what is the impact if we don't fix**. That is not expressible
in a shape that records only severity, so the reduction had to change, not just the prompt.

## Build

- `IMPACT_LEVELS` (`cosmetic` < `degraded` < `broken` < `unrecoverable`) + `IMPACT_STRICTNESS`, total over the
  enum and asserted at module load, mirroring `VERDICT_STRICTNESS`.
- `impactIfUnfixed` on the `Finding` shape. An invented value adds no key, so it reads as undeclared.
- `PREVENTION_IMPACT_BAR` — the dial, shipped at `broken` for the current solo/internal-tooling context.
- `blocksAcceptance(finding, { bar })`, split from `hasUncapturedPrevention`: the notice keeps the wider
  predicate so every uncaptured guard is still surfaced and still owed a filing; only the verdict narrows.
- `deriveVerdict` / `derivePanelVerdict` gate on it, both taking `bar` so the dial is turnable per call.
- The mandate skeleton demands impact on every finding and makes prevention introspection optional below
  the bar, explicitly telling reviewers not to manufacture a gate proposal for a nit.

## Acceptance

- Undeclared or invented impact FAILS CLOSED — identical to pre-change behaviour, so this is a strict
  relaxation that can only un-block a finding which explicitly declared itself cheap. Every old-shape
  finding and every existing caller is byte-stable.
- Turning the bar to `cosmetic` restores the previous gate with a one-line change and no consumer edits.
- Replayed against the #1042 panel: blockers drop from 6-of-7 to 2-of-7, and the two are the check-then-act
  window (`unrecoverable`) and the unrecorded item state (`broken`) — the two independently ranked as
  mattering.

## Follow-up not bundled

Tightening the bar as the constellation grows is a deliberate operator call, not a schedule — the dial and
its rationale are documented at `PREVENTION_IMPACT_BAR`.
