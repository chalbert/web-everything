---
kind: task
status: open
scope: ["we:scripts/lib/review-skill-guard.mjs", "we:scripts/lib/__tests__/review-skill-guard.test.mjs"]
dateOpened: "2026-09-08"
tags: []
---

# Harden the #2416 review-label code-scan gate against expression-level label indirection (ternary/computed)

we:scripts/lib/review-skill-guard.mjs's checkReviewLabelSingleHomeCode / CODE_SWAP_RE (#2416) catches the ordinary raw-swap re-implementations but a round-2 panel review found it cannot catch a label value expressed as a conditional/ternary or otherwise computed expression at the call site (e.g. add: isHuman ? REVIEW_LABELS.accepted : undefined) — the same class of limitation as the documented variable-indirection residual (no bounded regex traces data flow), deliberately not chased in #2416 to avoid open-ended scope creep on a size-3 item. Decide whether to close it with a structural/token-based scan of call arguments, or formally accept it as a permanent documented limitation (same posture as #2895's actor-provenance residual); if closing it, extend we:scripts/lib/__tests__/review-skill-guard.test.mjs with a ternary/computed-label fixture.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
