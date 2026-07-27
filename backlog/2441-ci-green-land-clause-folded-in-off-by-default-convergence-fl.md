---
bornAs: xesrmcc
kind: story
size: 3
parent: "2410"
status: open
blockedBy: ["2438", "2439", "2440"]
dateOpened: "2026-07-11"
tags: []
scope:
  - we:scripts/lib/jury-core.mjs
  - we:scripts/lib/__tests__/jury-core.test.mjs
  - we:scripts/review-core-cli.mjs
  - we:scripts/lib/review-core.mjs
  - we:scripts/lib/__tests__/review-core.test.mjs
  - we:scripts/workflows/review-parked-prs.mjs
  - we:scripts/lane-resume.mjs
  - we:scripts/__tests__/lane-resume.test.mjs
  - we:scripts/lane-drain.mjs
  - we:scripts/__tests__/lane-drain.test.mjs
---

# CI-green land clause folded in + off-by-default convergence flag

Capstone: fold required-test-green into deriveNegotiationOutcome's land condition and retire the lane-resume test-red strand (we:scripts/lane-resume.mjs:81); wire the whole loop behind an off-by-default flag (we:scripts/lane-drain.mjs flag parsing), scoped to small/non-security diffs first. Blocked by A+B+C. Slice D of epic #2410.
