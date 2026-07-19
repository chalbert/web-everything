---
bornAs: xcbcsft
kind: story
size: 8
status: active
blockedBy: ["2563"]
dateOpened: "2026-07-18"
dateStarted: "2026-07-19"
tags: []
---

# Extract the review-escalation policy into a machine-checkable contract-spec + conformance suite

Fork-1 prerequisite of #2563 (codified #blast-radius-advisory-care-not-a-gate) and the first concrete instance of spec-based programming (#2564). Extract the escalation policy — DEFAULT_THRESHOLDS + the reason sets + deriveReviewDisposition's branches — into an explicit typed/executable CONTRACT (schema, not prose) plus a conformance suite, so the trust-chain human gate can fire on a *spec* diff (deterministic) while an implementation change that keeps the conformance suite green is agent-clearable. Until the contract exists, the gate fails safe to the status-quo path test. Schema-not-prose is ratified; contract-as-spec is the only machine-diffable option (deep research).

## Progress

- **Status:** resolved
- **Branch:** lane/2566 (lane-1 clone)
- **Done:**
  - `we:scripts/lib/review-policy.contract.json` — the machine-diffable CONTRACT: thresholds
    (diffLines/sampleNth), the reason vocabulary with each reason's `family` + `clearance`, and the
    strictest-wins disposition decision table — each entry carrying prose (schema skeleton + first-class prose
    layer, #2564).
  - `we:scripts/lib/review-policy.mjs` — the loader (validates the contract shape, deep-freezes it) + the
    executable spec-oracle `derivePolicyDisposition` (computes the disposition purely from the contract data).
  - Single-sourced the impl: `DEFAULT_THRESHOLDS` (`we:scripts/lib/review-escalation.mjs`) and the reason
    family sets (`we:scripts/lib/review-core.mjs`) now derive from the contract — a value lives exactly once, so
    a threshold flip or a reason re-classification is necessarily a diff to the contract.
  - `we:scripts/lib/__tests__/review-policy.conformance.test.mjs` — the conformance suite: proves the
    hand-written `deriveReviewDisposition` branches realize the contract table over the ENTIRE powerset of
    reasons (+ the drain's decorated strings), plus vocabulary/threshold/shape conformance. Green ⇒ impl conforms.
  - Registered the contract + loader + conformance test on the trust-chain **policy tier**
    (`we:scripts/lib/gate-config.mjs` + gate-invariants `POLICY_CORE_FILES`): a diff to the contract file forces
    `review:human` — "the gate fires on a spec diff." Verified: a diff touching
    `we:scripts/lib/review-policy.contract.json` (even relocated) → `humanRequired`.
  - All 112 script suites / 2212 tests green; `check:standards` 0 errors; behaviour preserved (the existing
    review-core / review-escalation / gate-invariants suites pass unchanged).
- **Next:** none — resolved. The remaining payoff (narrowing `we:scripts/lib/review-core.mjs` /
  `we:scripts/lib/review-escalation.mjs` from whole-file human-gate to *spec-diff* gate, so an impl refactor
  that keeps conformance green is agent-clearable) is deliberately out of scope per the item's "until the
  contract exists, the gate fails safe to the status-quo path test" — filed as a follow-on.
- **Notes:** `deriveReviewDisposition` (impl) and `derivePolicyDisposition` (oracle) are DELIBERATELY separate
  realizations of the same table — the conformance suite proving them equal is the point; do not collapse them.
