---
bornAs: xcnjqcn
kind: task
status: open
dateOpened: "2026-08-05"
tags: [review, jury, gate, security]
---

# Gate that a relaxation's compensating control is wired on the outcome path it opens

A gate relaxation is defended by naming a compensating control. The defence is only real if that control
actually RUNS on the path the relaxation opens. Twice now the control was built as a pure RENDERER, tested
in isolation, and never called from the branch that newly needed it — so the relaxation shipped with an
argument for its safety and none of the safety.

## Why it is owed

Observed on PR #1046, twice in the same feature, one layer apart.

- Round 1 (blocker 3B): `PREVENTION_IMPACT_BAR` let a below-bar uncaptured guard ride a clean `accept`.
  The defence was the operator notice (`renderPreventionSummary`) — which fires only on the `escalated`
  event, i.e. exactly the path a below-bar finding no longer takes. The fix moved the facts into
  `renderFindingLine` (`we:scripts/lib/review-render.mjs`).
- Round 2 (blocker 1): `renderFindingLine` renders correctly, but the drain's `land` / `autoLand: true`
  branch (`we:skills-src/drain/SKILL.md`) posted NO comment at all — it applied `redteam:accepted` +
  `review:accepted` and re-ran. Only the `autoLand: false` gate-self branch posted anything. The renderer
  was right and unreachable. Worse, prose asserting the opposite shipped alongside it, in both the
  reviewer-facing mandate and the JSDoc.

Both rounds passed their unit tests, because a pure renderer is trivially testable in isolation and its
call site is a natural-language instruction in a skill document that no test reads.

## The guard

A `check:standards` rule over the drain skill's TERMINAL BRANCHES — the review-skill guard in
`we:scripts/lib/review-skill-guard.mjs` (§15) is the working model: it already parses `skills-src/` +
`docs/agent/` prose for a forbidden instruction, so it can parse for a REQUIRED one.

1. Identify the terminal branches — every place the skill instructs an accept-label application
   (`--add-label review:accepted`) or an escalation. These are the outcome paths.
2. Require that each terminal branch reachable with findings in hand names a findings-EMITTING call
   (`renderPanelComment` / `renderReviewNotice` / an explicit `gh pr comment`) before the label
   application, or carries a marker documenting why that branch is legitimately silent.
3. Derive the branch set from the document, not a hand list — a new terminal branch someone adds must
   enrol itself, exactly as `we:scripts/lib/verdict-totality.mjs` derives its consumer set.

The rootCause worth encoding in the error message: the reviewer and the author both check that the control
EXISTS and is correct, because that is the part that lives in code and has tests. Nobody re-checks that the
newly-opened branch CALLS it, because that call site is prose. A relaxation must therefore be argued at the
outcome path, never at the renderer in isolation.

**Related:** the same PR's prose claimed a below-bar guard was "always visible … including on a clean accept
that auto-lands" while the emission was in fact conditional. Whatever this rule enforces, the wording of the
claim must match the wiring — an unconditional claim over a conditional emission is the same defect in
prose.

**Prevention for:** PR #1046 review, round 2 blocker 1 (`#2942`).

**Locus:** `we:scripts/check-standards.mjs`, `we:scripts/lib/review-skill-guard.mjs`,
`we:skills-src/drain/SKILL.md`
