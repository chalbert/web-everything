---
bornAs: xa2b8x5
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/backlog.mjs", "we:scripts/conveyor/land-overlap-yield.mjs", "we:scripts/conveyor/__tests__/land-overlap-yield.test.mjs", "we:scripts/__tests__/merge-ai-prs.test.mjs", "we:scripts/__tests__/backlog.test.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2887's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/merge-ai-prs.mjs:1810` — Add a wiring test that runs `buildOverlapRows` with a non-candidate Y whose PR body declares blockedBy X. Then derive Y's `dependsOn` from its listing `body` (already fetched in CONTEXT_LIST_FIELDS) via the lane-manifest parser.
2. `we:scripts/backlog.mjs:1049` — Add the two snapshot cases in `we:scripts/__tests__/backlog-cli-snapshot.test.mjs`. A broader guard would be a check-standards rule requiring every verb that mutates a tracked file to have a lane-guard refusal test.
3. `we:scripts/conveyor/land-overlap-yield.mjs:310` — Deterministic gate: comprehensive unit test coverage on IO shell modules to assert documented fallback behaviors.
4. `we:scripts/conveyor/land-overlap-yield.mjs:400` — Deterministic gate: unit tests for API parsing functions injecting fake `ghExec` responses to verify temporal ordering logic and empty states.
5. `we:scripts/conveyor/land-overlap-yield.mjs:360` — Deterministic gate: unit test providing a mocked `exec` function and asserting call counts to strictly verify memoization.
6. `we:scripts/backlog.mjs:1030` — Deterministic gate: CLI input validation tests covering all mutually exclusive and invalid inputs for new flags.
7. `we:scripts/merge-ai-prs.mjs:1814` — A unit test in `we:merge-ai-prs-overlap-yield.test.mjs` proving `planLabelDrain` does not yield when a non-candidate (Y) has `blockedBy` pointing to the candidate (X), using a raw `openPrContext` fixture that lacks a verdict for Y.
8. `we:scripts/conveyor/land-overlap-yield.mjs:256` — A unit test in `isExemptItem` specifically verifying that it correctly parses exemptions from a file named exactly `${itemId}.md` without a hyphen.
9. `we:scripts/conveyor/__tests__/land-overlap-yield.test.mjs:141` — A deterministic lint rule or review lens requiring tests that differentiate between two fallback paths to use distinct expected values for each path.
10. `we:scripts/conveyor/__tests__/land-overlap-yield.test.mjs:101` — A code review lens requiring test fixtures to instantiate the exact number of entities described in the test's prose comments.
11. `we:scripts/merge-ai-prs.mjs:1814` — A unit test in `we:merge-ai-prs-overlap-yield.test.mjs` verifying that `buildOverlapRows` correctly extracts `dependsOn` (by parsing the body) for a PR that exists in `openPrContext` but has no entry in `verdicts`.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2887@c2750804c0769a654d0b62b3685bfcdae122f7db

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
