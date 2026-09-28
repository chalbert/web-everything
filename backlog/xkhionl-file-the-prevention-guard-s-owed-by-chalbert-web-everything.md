---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/run-rating.mjs", "we:scripts/conveyor/__tests__/run-rating.test.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2811's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/run-rating.mjs:1090` — Extract one shared seat-cost-summing helper used by both scanReviewJurorUsage and readReviewRunTelemetry so this initialization can only be gotten right or wrong once; short of that, a unit test asserting costUsd is null (never 0) whenever no seat in a run record prices would catch this class directly.
2. `we:scripts/conveyor/run-rating.mjs:1495` — No gate can catch an unused-but-plausible parameter path deterministically; the cheapest guard is a direct unit test for rateAndRecordReviewJob itself (currently absent — the test file imports rateReviewJobLog but never rateAndRecordReviewJob) asserting an injected runsDir reaches the join.
3. `we:scripts/conveyor/run-rating.mjs` — Add a deterministic coverage reconciliation test with one seat represented in both sources and require its tokens to appear exactly once.
4. `we:scripts/conveyor/run-rating.mjs` — Add a deterministic namespace-collision test and require an explicit item association before resolving story size for a PR.
5. `we:scripts/conveyor/run-rating.mjs` — Add an end-to-end fixture asserting that an escalated review's whole-run waste tokens equal its joined telemetry tokens.
6. `we:scripts/conveyor/run-rating.mjs` — Parameterize the A-grade gate tests over valid, excessive, null, and omitted wall time, requiring evidence for every mandatory condition.
7. `we:scripts/conveyor/run-rating.mjs` — Persist the review execution timestamp and add a deterministic test that permutes historical row insertion order while requiring identical effective grades.
8. `we:scripts/conveyor/run-rating.mjs:475` — A unit test in `classifyRunWaste` that asserts no `escalated-no-decision` waste is produced when `decisionReached` is true on the rating object (and ensuring `rateTranscript` actually propagates it).

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2811@e52307860e1308f40158e6ec13d6cab447f3bbeb

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
