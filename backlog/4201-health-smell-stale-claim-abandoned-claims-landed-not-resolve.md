---
bornAs: x4axhga
kind: story
size: 5
parent: "4075"
status: resolved
scope: ["we:scripts/conveyor/health-smells/stale-claim.mjs", "we:scripts/conveyor/health-smells/index.mjs", "we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/__tests__/health-watch.test.mjs", "we:scripts/conveyor/health-smells/__tests__/stale-claim.test.mjs"]
dateOpened: "2026-09-25"
dateStarted: "2026-09-25"
dateResolved: "2026-09-26"
tags: []
---

# Health smell: stale-claim (abandoned claims + landed-not-resolved), shadow mode

Operator 2026-09-25 21:45 ET: the Plateau WIP page shows old claimed items and merged-but-unresolved cards. Add a stale-claim health-watch smell (we:scripts/conveyor/health-smells/, #4077 framework): (A) abandoned claims — status:active/preparing, no open PR names it (we:scripts/lib/open-pr-items.mjs's itemNumsFromPr), no live same-host claim pid (we:scripts/operations/stale-state.mjs), older than staleAfterDays (default 3) — proposes un-claim to open. (B) landed-not-resolved — a merged PR already delivers the active card per we:scripts/backlog-stranded-sweep.mjs's own sweepStrandings (matched tier), plus a lower-confidence body-mention tier for a coordinated multi-card PR whose ref/title names only its lead card (the exact shape PR #2668/#2689 hit) — proposes resolve. SHADOW MODE ONLY: proposes, never un-claims or resolves a real card. Also traces and reports (does not fix) why resolve-on-land (we:scripts/merge-ai-prs.mjs's landedIdsForCandidate calling we:scripts/lib/open-pr-items.mjs's deliveredItemNumsFromPr/deliveredHashFromPr) missed #4169/#4172/#4175/#4127/#4134/#4121 — we:scripts/merge-ai-prs.mjs is concurrently edited by open PRs #2708/#2709, so any fix there is out of scope for this item; report only.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
