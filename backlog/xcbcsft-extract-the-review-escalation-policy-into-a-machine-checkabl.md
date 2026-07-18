---
kind: story
size: 8
status: open
blockedBy: ["2563"]
dateOpened: "2026-07-18"
tags: []
---

# Extract the review-escalation policy into a machine-checkable contract-spec + conformance suite

Fork-1 prerequisite of #2563 (codified #blast-radius-advisory-care-not-a-gate) and the first concrete instance of spec-based programming (#2564). Extract the escalation policy — DEFAULT_THRESHOLDS + the reason sets + deriveReviewDisposition's branches — into an explicit typed/executable CONTRACT (schema, not prose) plus a conformance suite, so the trust-chain human gate can fire on a *spec* diff (deterministic) while an implementation change that keeps the conformance suite green is agent-clearable. Until the contract exists, the gate fails safe to the status-quo path test. Schema-not-prose is ratified; contract-as-spec is the only machine-diffable option (deep research).
