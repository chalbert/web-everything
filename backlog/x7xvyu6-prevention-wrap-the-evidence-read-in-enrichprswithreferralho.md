---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/review-referral-hold.mjs", "we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/__tests__/review-referral-hold.test.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs"]
dateOpened: "2026-10-03"
tags: []
---

# Prevention — Wrap the evidence read in enrichPrsWithReferralHolds in try/catch and fall back to no holds, which fail… (from chalbert/web-everything#3696 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/review-referral-hold.mjs:43` — Wrap the evidence read in enrichPrsWithReferralHolds in try/catch and fall back to no holds, which fails open to the old behaviour. Add a test where readRuns throws.
2. `we:scripts/conveyor/review-referral-hold.mjs:112` — Write the receipt atomically (temp file plus rename), or treat a SyntaxError as a missing receipt and rely on the PR-thread marker dedupe. Add a test with a truncated receipt file.
3. `we:scripts/conveyor/reconcile-core.mjs:323` — Make countFindings use countTrustedLeadingMarker, or add an isTrustedMarkerAuthor check, for every bookkeeping marker. Add a test that an untrusted author's marker-prefixed comment still counts as a finding. A lint that flags raw head.startsWith(marker) matches outside we:marker-authorship.mjs would catch the whole class.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3696@df031bf51d73ee7a39be3c14526cb94dc6bf8d6d

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
