---
kind: story
size: 3
status: open
scope: ["we:scripts/lib/jury-core.mjs", "we:scripts/operations/review-pr.mjs", "we:scripts/lib/__tests__/jury-core.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# A not-real ruling on a tool-less juror finding ends the review run, so a review:human PR gets its advisory instead of looping

Live case 2026-10-02: PR #3432 (review:human) was re-reviewed about 17 times between 9 PM and 6 AM ET (51 "Mandatory review owner" comments, 3 per run, about 3 runs an hour) and never got its advisory note or advisory label. Each run an Antigravity juror reports a CONFIRMED broken finding while admitting "I have no tools to check mutation" (a claimed typo at we:scripts/operations/pr-status.mjs line 179 that the diff does not contain); the mandatory owner rules it not-real, but the run ends as "mandatory finding-specific review required" and the review daemon dispatches it again. Fix in we:scripts/lib/jury-core.mjs and we:scripts/operations/review-pr.mjs: (1) a finding from a tool-less juror cannot carry CONFIRMED status; (2) a recorded not-real ruling closes that finding for the head, so the run completes and the advisory posts; (3) the same head is never re-dispatched for review after a completed run. Replay #3432: one run, one advisory.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.

## Root cause found (orchestrator, 2026-10-02 ~7:30 AM ET)

Decoded the 51 `mandatory-referrals-v1` records on #3432. Each round writes three records under ONE fresh mandatory reviewer id (e.g. a30c21ad at 10:10Z, f6d233a7 at 09:33Z): opened, attempted, then a `not-real` ruling on the same head (495e86acb). The record then says "start a fresh review-pr"; the fresh run opens a NEW record with a NEW reviewer id and EMPTY rulings, and the referral check in we:scripts/lib/jury-core.mjs (around line 2320) reads only the current record's rulings, so the finding is pending again and the tool-less juror re-raises it. Rulings never carry across runs, so the run never reduces to a verdict and the advisory step never posts. Fix: a ruling on the same finding key for the same head carries into later runs (with the independence check still applied to the ruling's own reviewer), and a tool-less juror's finding cannot be CONFIRMED.

## Operator ruling (2026-10-02, via claude-code-chat: "ok")

Add a confirmation turn: when a juror without tools reports a finding as CONFIRMED broken, a tool-bearing verifier gets one turn to reproduce it on the PR head before it counts. Reproduced: it stays CONFIRMED and needs a ruling as today. Not reproduced: it is downgraded to an advisory note and never blocks the run. Cost is paid only when such a claim is made. Giving read-only tools to every reviewer stays a later option, not part of this card.
