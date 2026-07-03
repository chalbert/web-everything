---
kind: decision
status: open
dateOpened: "2026-07-03"
tags: []
---

# Reclassify what the lane guard enforces — allow bookkeeping-class primary writes, block only source/content

`we:scripts/guard-lane.mjs` blocks ALL primary-tree Edit/Write with one deny, escaping via `LANE_GUARD_OFF` — a
blunt gate that tempts primary-tree drift (once overridden, real code edits follow) and only nudges anyway (a
Bash node-fs write bypasses the Edit/Write hook entirely). Fork: (a) reclassify — allow the sanctioned
bookkeeping class (backlog metadata via CLI, the `we:.claude/agent-memory` tree) and reserve the hard block for
source/content; vs (b) keep the blunt guard + the sanctioned-CLI path shipped in #2197 (retype/yield, memory
carve-out). Weigh enforceability (the Bash bypass) vs simplicity. Surfaced by the 2026-07-03 parallel
`/workflow` batch.

> Re-filed from the stranded local commit `95c10c94` (was mis-numbered #2198, which collides with the
> lander-rebase-drops-manifest story on origin/main). Yielded to the next free id per the id-collision rule.
