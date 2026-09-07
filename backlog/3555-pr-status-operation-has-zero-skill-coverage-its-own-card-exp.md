---
bornAs: xveqvbr
kind: story
size: 2
parent: "3029"
status: open
dateOpened: "2026-09-06"
tags: []
scope:
  - we:skills-src/drain/
  - we:skills-src/merge/
  - we:skills-src/finish/
  - we:skills-src/conveyor/
  - we:skills-src/batch-backlog-items/
  - we:scripts/conveyor/
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/lane-resume.mjs
  - we:scripts/workflows/review-parked-prs.mjs
---

# pr-status operation has zero skill coverage — its own card explicitly deferred wiring it

we:scripts/operations/pr-status.mjs (#3247, resolved 2026-08-21) declares the three-valued green/red/pending/unchecked check-state-per-open-PR question, built to catch #1510/#1511 sitting 12 hours with total_count: 0 while the review label claimed checking. Its own card states plainly under "Not this item": "Rewiring the skills that poll by hand, and any daemon that calls this on a schedule" — and that follow-up was never filed. Distinct from we:scripts/pr-status.mjs (the raw `npm run pr-status` CLI, which asks who is WORKING a PR, not whether CI ran) — the two share a basename but answer different questions, per this operation own header. No skill currently instructs `node we:scripts/operations/run.mjs pr-status`; a session checking on a stalled PR (during /drain, /merge, or /finish work) has no discoverable path to the operation that exists to answer exactly that. Wire it into whichever skill polls open-PR state by hand.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
