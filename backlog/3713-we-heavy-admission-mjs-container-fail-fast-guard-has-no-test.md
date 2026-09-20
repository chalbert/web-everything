---
bornAs: xj9554r
kind: story
size: 2
parent: "3621"
status: open
scope: ["we:scripts/readiness/heavy-admission.mjs", "we:scripts/readiness/__tests__/heavy-admission.test.mjs"]
dateOpened: "2026-09-14"
tags: []
---

# we:heavy-admission.mjs: --container fail-fast guard has no test coverage (PR #2206 review)

Independent jury review of PR #2206 (heavy-command-pool container POC) marked a test-coverage gap OWED (owed = should become a tracked item, not just a review comment). we:scripts/readiness/heavy-admission.mjs's run CLI mode has an upfront --container fail-fast guard (around line 425) that PR #2206's own description promises fails with a clear, actionable message when the container CLI or image is unavailable, but no test exercises that guard path at all -- the reviewing juror noted breaking the guard block would not redden any named test, because the CLI execution paths there are completely uncovered. Fix: add a test in we:scripts/readiness/__tests__/heavy-admission.test.mjs that invokes the --container guard logic (factored into a testable validation function if it is not already) with a mocked unavailable container CLI/image, and asserts it yields the promised actionable failure message rather than a raw subprocess error. PR #2206 is still OPEN (review:accepted, ready-to-merge) as of this filing, not yet drained onto main.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
