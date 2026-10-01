---
kind: story
size: 2
status: open
scope: ["we:scripts/verify-lane.mjs", "we:scripts/operations/verify.mjs", "we:scripts/__tests__/verify-lane.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# A red verify names the failing tests in its run record and marker

Live cases 2026-10-01: the #3311 split lane and PR #3329 both got a red verify (we:scripts/operations/run.mjs verify) that named no failing test; we:scripts/verify-lane.mjs records only status and exit code in its lane marker. The #3329 fixer stood down because it could not tell which test failed, and the orchestrator re-ran tests by hand to find it. Fix: verify-lane captures the failing test files and names into the marker and the verify run record verdict, capped in size. Test: a lane with one failing test yields a red verdict naming that test.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
