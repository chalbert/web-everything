---
bornAs: xvf2vq8
kind: task
status: open
dateOpened: "2026-08-02"
tags: [governance, check-standards, review-integrity]
---

# Monotonicity conformance case in gate-invariants — humanRequired corpus can only shrink via enumerated RATIFIED_SHRINKS

Add a monotonicity conformance case to `we:scripts/lib/__tests__/gate-invariants.test.mjs`: a **frozen
corpus** of `(changedFiles, diffHunks)` inputs that are `humanRequired` under the ratified trigger set must
stay `humanRequired` under **any** new trigger set — with each **intended** narrowing enumerated in an
explicit `RATIFIED_SHRINKS` list. Any narrowing NOT in that list turns the case red and forces a
`POLICY_SPEC` edit (a deliberate, human-gated act) before the trigger set can change.

## Why (the #1002 defect this prevents)

The #2840 anchor originally claimed the new trigger set "can only ever ADD human-gating above today's line,
never shrink below it." That was false against `main`: today `we:scripts/lib/review-escalation.mjs#isStatutePath`
matches `we:docs/agent/platform-decisions.md` **whole-file** (`we:scripts/lib/__tests__/gate-invariants.test.mjs`
pins it), while the ratified trigger (1) fires only on a rule heading / ruling body and exempts
whitespace/reflow/typo — a strict NARROWING of the statute term. The prose fix (#1002) scoped the claim to the
post-#2785 baseline and named the one intended shrink, but nothing MECHANICALLY stops a future trigger-set edit
from silently dropping coverage. This conformance case is that mechanical guard: an un-enumerated shrink cannot
land green.

## Scope

- A frozen `(changedFiles, diffHunks)` corpus in `we:scripts/lib/__tests__/gate-invariants.test.mjs`, each
  case labelled with the trigger it exercises and asserted `humanRequired: true`.
- A `RATIFIED_SHRINKS` list enumerating every intended narrowing (e.g. "statute term: whole-file →
  rule-text edits") with a cite to the ratifying anchor / decision.
- The test recomputes `humanRequired` under the current trigger set and fails on any corpus case that flips to
  `false` unless that exact case is covered by a `RATIFIED_SHRINKS` entry.

Prevention filed against #1002's blocking fix 1 (false monotonicity claim). Mechanical, committee-clearable.
