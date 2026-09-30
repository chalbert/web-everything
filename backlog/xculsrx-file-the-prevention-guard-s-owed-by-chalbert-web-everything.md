---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/probation-build-run.mjs", "we:scripts/operations/__tests__/probation-build-run.test.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3036's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/probation-build-run.mjs:379` — Add a test, and ideally a helper, that fixes the reason sanitize-and-cap in one place and asserts that every `holdWorkerDecline` entry's `reason` is at most 600 characters. That test would go red on any branch that passes a raw worker message.
2. `we:scripts/operations/probation-build-run.mjs:382` — Sanitize inside `holdWorkerDecline`, which is the single sink for hold reasons: apply `sanitizeHoldReason` there so no caller can persist raw worker text. Add a unit test that feeds an oversized, multi-line reason and asserts the stored hold reason is bounded and flat.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3036@a89d6223ca728c0f1c347ad4562aa805d2ceb86a

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
