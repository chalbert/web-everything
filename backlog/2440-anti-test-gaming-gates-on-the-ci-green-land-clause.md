---
bornAs: x9absz3
kind: story
size: 5
parent: "2410"
status: resolved
blockedBy: ["2439"]
dateOpened: "2026-07-11"
dateStarted: "2026-07-26"
dateResolved: "2026-07-26"
tags: []
scope:
  - we:scripts/lib/
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/__tests__/
---

# Anti-test-gaming gates on the CI-green land clause

Deterministic anti-gaming gates: fail the land if coverage drops or tests are removed/skipped, require a test that fails on pre-change behavior for logic fixes, diff-gate author-peer test edits, and have the validator inspect for tampering. Lands in we:scripts/lib/pr-merge-gate.mjs + the we:scripts/merge-ai-prs.mjs gate + a validator-mandate clause in we:scripts/lib/review-core.mjs. Blocked by the validator (slice B). Slice C of epic #2410.

## Progress

- **Deterministic gate (`we:scripts/lib/pr-merge-gate.mjs`).** Added the pure anti-test-gaming scanner:
  `isTestPath`, `parseUnifiedDiff`, and `scanTestTampering({ diffText })`. The scanner reads a PR's net diff
  and flags the diff-VISIBLE tamper forms — a deleted test file (`test-file-removed`), an added `.skip`/`.only`
  (or `xit`/`fit`/…) marker (`test-skipped`), and a net removal of `it(`/`test(` cases (`tests-removed`). It
  returns the `{ tampered, findings, reasons }` shape the drain's manifest-tamper park already consumes.
  "Coverage drops" is enforced in its diff-visible proxy (cases/files removed net) — true line-coverage % needs
  a coverage artifact the drain does not have.
- **Land-clause wiring (`we:scripts/merge-ai-prs.mjs`).** The per-verdict land loop now computes the net diff
  text (same `computeNetDiffText` basis the panel/escalation share) and runs `scanTestTampering` before the
  review gate. A hit REFUSES the auto-land and parks the couple `review:human` (a test removal is a trust-chain
  concern the agent panel must not clear for itself; a human clears a legitimate removal). Best-effort/fail-open
  when no local/sibling clone is present to read the diff text — the same posture as the manifest baseline gate.
- **Validator mandate (`we:scripts/lib/review-core.mjs`).** Extended `buildValidatorMandate` with the explicit
  anti-test-gaming clause — the JUDGMENT half a script can't decide: (1) a logic fix must carry a test that
  FAILS on the pre-change behaviour, (2) reject weakened coverage even when the suite still goes green, (3)
  treat any author-peer test edit as suspect by default.
- **Tests.** Extended `we:scripts/__tests__/pr-merge-gate.test.mjs` (isTestPath / parseUnifiedDiff /
  scanTestTampering, incl. clean-add, delete, skip/only, net-removal, neutral-churn, and non-test-file cases)
  and `we:scripts/lib/__tests__/review-core.test.mjs` (the mandate clause). `check:standards` green.
