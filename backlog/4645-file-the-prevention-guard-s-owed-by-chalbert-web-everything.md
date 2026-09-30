---
bornAs: xjhjcjn
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/review-set-label.mjs", "we:scripts/__tests__/review-set-label.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3158's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/review-set-label.mjs:918` — Add the missing `--to=accepted --only-if=accepted` case to we:review-set-label.test.mjs. A coverage-diff gate requiring each new `fail(...)` branch in a CLI to have a matching test would catch this class.
2. `we:scripts/review-set-label.mjs:905` — Reject any `--only-if*` argv token that is not exactly `--only-if=accepted`. A small unknown/malformed-flag check in runReviewLabelCli would cover the whole class.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3158@1c243215e6e2783dab69073214f1e0196c493994

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
