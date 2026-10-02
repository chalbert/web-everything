---
kind: story
size: 3
status: open
scope: ["we:scripts/lib/review-core.mjs", "we:scripts/lib/__tests__/review-core.test.mjs", "we:scripts/operations/review-loop-cli.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Review: a finding that contradicts the PR's own goal blocks, and non-blocking findings on an accepted PR become cards

Live 2026-10-01, PR #3215 (builder round cadence): all five review seats accepted, yet the findings included that the new networked PR-count fallback (we:scripts/readiness/dispatch-plan.mjs:1054) can add GitHub calls every round, which contradicts the PR's own goal of shorter rounds; it was rated a test-coverage gap, so the panel verdict was "accept" and it reached the operator as ready. The operator sent it back. Two gaps: (1) a finding whose consequence defeats the change's declared purpose (from the card's goal / PR description) must be classed blocking, not advisory; (2) every non-blocking finding on an accepted PR must either be fixed in the advisory-fix round or auto-filed as a follow-up card with its file:line, so "accept + findings" never silently drops them. Change the finding classification and the reduce step in we:scripts/lib/review-core.mjs (and the advisory-fix path), with tests replaying #3215's finding.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
