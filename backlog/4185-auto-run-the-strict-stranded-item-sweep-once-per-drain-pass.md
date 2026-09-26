---
bornAs: xvr2o8r
kind: task
parent: "2899"
status: resolved
scope: ["we:scripts/backlog-stranded-sweep.mjs", "we:scripts/merge-ai-prs.mjs", "we:scripts/__tests__/backlog-stranded-sweep.test.mjs"]
dateOpened: "2026-09-25"
dateStarted: "2026-09-25"
dateResolved: "2026-09-25"
tags: []
---

# Auto-run the strict stranded-item sweep once per drain pass, after resolve-on-land

we:scripts/merge-ai-prs.mjs resolve-on-land step (#2899 A5) only flips a card whose OWN WE-carrier merged this pass; a card stranded by an earlier heuristic miss (we:scripts/lib/open-pr-items.mjs) or a couple that never fully landed sits open/active forever unless a human remembers to run we:scripts/backlog-stranded-sweep.mjs --apply by hand. #2661 (merged) added the --apply flag but nothing calls it automatically — we:scripts/merge-ai-prs.mjs only prints a hint. Live proof: #3916 (active, delivered by origin/main commit 092df91c4) and #4025 (open, delivered by 0417e3ed6) both sit stranded right now, outside the sweep's default log-limit window. Wire an autoStrandedSweepPass export (we:scripts/backlog-stranded-sweep.mjs) into we:scripts/merge-ai-prs.mjs sweepOnce, called once per pass after the existing resolve-on-land block, using the SAME resolveLandedItem path/commit convention (drain: resolve NUM on land, epic #2748) strict commit-subject proof only (autoResolvableStrandings), never the general report-only sweepStrandings signal. Must run under dry-run too (report-only, no write) so a plan/proof run shows what would resolve. Must never fail the pass: wrap in try/catch, log and continue. Idempotent by construction (an already-resolved card is filtered out by status before it is ever a candidate again). Unit-test the wiring (we:scripts/__tests__/backlog-stranded-sweep.test.mjs) with an injectable sweep function so the drain's own huge module isn't re-run end to end.

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/backlog-stranded-sweep.test.mjs` covers a new wiring test (fake sweep function proving the drain calls the strict auto-resolve path once per pass, respects `--dry-run` as report-only, and never throws when the sweep itself errors) that fails before this item lands and passes after.
