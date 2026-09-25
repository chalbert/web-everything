---
bornAs: x4kc80i
kind: task
parent: "3383"
status: resolved
scope: ["we:skills-src/review/review-agent-brief.md", "we:skills-src/conveyor/fix-agent-brief.md"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
tags: []
---

# Raise review/fix lane-acquire wait-ms backstop (scan-vs-wait decoupling already fixed on main via #2607)

the wait-vs-scan fix in we:scripts/lane-pool.mjs (decouples the shared acquirable scan's own timeout budget from a caller's --wait-ms, distinguishes 'scan itself never finished' from 'genuinely all held/dirty') already landed on origin/main via PR #2607 (merged 2026-09-24, commit 4d80c72ed). Live incident: review-2599/review-2587 still failed at 19:02 with the scan-timeout error because the wev-review-daemon clone runs an older, partially-decoupled version of the same fix and had not yet self-synced past it. Remaining, in-scope product change: raise the --wait-ms=30000 backstop in we:skills-src/review/review-agent-brief.md and we:skills-src/conveyor/fix-agent-brief.md so a caller's own wait budget cannot undercut a slow shared scan under concurrent load.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
