---
type: idea
workItem: story
size: 3
status: open
dateOpened: "2026-06-19"
tags: []
---

# G7 cite-the-rule citation re-point pass over live items

Re-point the live (non-resolved) items that `check:health` flag G7 lists: where an item cites a codified decision by `#N` as current guidance, swap the bare `#N` for a link to its statute anchor so the rule propagates, not the case number. Run SOLO (no concurrent batch) — the bulk edits race the shared git index. A careful, mostly-KEEP pass: most flags are genuine lineage and stay.

## What to do

Run a per-item agent workflow (one agent per G7 item, surgical Edit-tool changes), as proven in the #911 remediation. For each cited `#N`:

- **Re-point** when the prose leans on the decision as *current guidance* — replace `#N` with `[<rule name>](docs/agent/platform-decisions.md#<anchor>)`.
- **Keep `#N`** for genuine lineage ("supersedes #N"), structural sibling/child item links, and non-citation number matches ("primitive #4"). A trial run found only ~half the flags are real re-points.

## Preconditions

1. Anchors must be verified-correct first — **done** in #911 (all 132 `codifiedIn` resolve, 0 dangling).
2. **Run solo, no concurrent batch/session** — another session's `git add -A` swept/scattered the edits repeatedly in the first attempt; that race is the only reason this was deferred.

**Success:** G7 drops to its irreducible lineage floor; `check:health` G7 tracks the candidate pool. Origin #911; mechanism in `we:scripts/audit-backlog-health.mjs` (G7, live-scoped).
