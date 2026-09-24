---
kind: story
size: 3
status: resolved
scope: ["we:scripts/conveyor/parked-pr-conflict-watch.mjs", "we:scripts/conveyor/stand-down.mjs", "we:scripts/conveyor/reconcile-core.mjs", "we:skills-src/conveyor/fix-agent-brief.md"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
tags: []
---

# Route a review:human statute-tier conflict to the fixer when it does not overlap main's own edits

we:scripts/conveyor/parked-pr-conflict-watch.mjs stands down ANY non-append-only statute-tier conflict forever, even on a PR that already carries review:human (a human reviews the result regardless). Add a review:human statute-amendment exception (#xu2krte Fork 2): route to the fixer when main did not independently touch the same diff hunk since the merge base (verified via hunk-range comparison, fail-closed on any ambiguity); keep standing down a true overlapping-hunk clash. Never clears/downgrades review:human. Re-check an already-labelled, already-stood-down parked PR that now qualifies, and supersede (comment, not delete) the watch's own stale marker via we:scripts/conveyor/stand-down.mjs. Narrow we:scripts/conveyor/reconcile-core.mjs dispatch gate (countTerminalStandDowns) to exclude only the watch's own conflict-reason marker. Update we:skills-src/conveyor/fix-agent-brief.md with the conflict-only/before-after-evidence scope note. Live case: chalbert/web-everything#2549.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
