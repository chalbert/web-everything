---
bornAs: xveqvbr
kind: story
size: 2
parent: "3029"
status: resolved
dateOpened: "2026-09-06"
dateStarted: "2026-09-07"
dateResolved: "2026-09-07"
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

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/review-core.test.mjs -t 3555` fails before this item
   lands and passes after: `we:scripts/workflows/review-parked-prs.mjs`'s reduce step (#2410 slice D) hand-rolled
   a `gh pr view --json statusCheckRollup` read of the single named `test` check to decide `requiredTestGreen`.
   That is exactly "a skill polling open-PR state by hand" — it now shells `node we:scripts/operations/run.mjs
   pr-status --repo=<slug> --pr=<n>` and reads its reduced `state` instead.

## Progress

- 2026-09-07 — wired the `pr-status` operation into `we:scripts/workflows/review-parked-prs.mjs`'s reduce step
  (the only manual `gh`-based check-state read found across this item's scope). The other scoped skills/scripts
  (`drain`, `merge`, `finish`, `conveyor`, `batch-backlog-items`, `we:scripts/merge-ai-prs.mjs`,
  `we:scripts/lane-resume.mjs`) either already share one `latestRequiredCheck` selector (never hand-rolled
  per-call) or delegate check-status entirely to `we:scripts/merge-ai-prs.mjs --watch`, so they carried nothing
  to rewire.
