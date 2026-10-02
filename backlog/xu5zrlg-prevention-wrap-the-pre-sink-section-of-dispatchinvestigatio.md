---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/health-investigate-dispatch.mjs", "we:scripts/conveyor/health-watch-core.mjs", "we:scripts/conveyor/__tests__/health-watch.test.mjs", "we:scripts/conveyor/__tests__/health-investigate-dispatch.test.mjs", "we:scripts/conveyor/__tests__/health-watch-core.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# Prevention — Wrap the pre-sink section of dispatchInvestigation (readBrief/fillBrief/route) so its errors are rethro… (from chalbert/web-everything#3284 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/health-investigate-dispatch.mjs:259` — Wrap the pre-sink section of dispatchInvestigation (readBrief/fillBrief/route) so its errors are rethrown via notApplied, plus a test per pre-spawn step asserting 'dispatch-failed'. A lint is not practical here; a table-driven failure-classification test is the cheapest guard.
2. `we:scripts/conveyor/health-watch-core.mjs:589` — Collapse whitespace to a single line for the command in `validateFindings` or at render time, and add a render test using a hostile multi-line command. Better still, a lint or test helper that feeds a corpus of markdown-breaking strings through every untrusted-text renderer.
3. `we:scripts/conveyor/__tests__/health-watch.test.mjs:475` — Advance through the initial healthy ticks without findings, create the findings immediately before the closing tick, and assert their preservation; verify that removing the closedEpisodes argument makes this named integration test fail.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3284@005694098da2cd999fcf046dacdfde1389c33d93

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
