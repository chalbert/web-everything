---
type: idea
workItem: story
size: 3
status: open
dateOpened: "2026-06-19"
tags: []
---

# G7 cite-the-rule citation re-point pass over live items

Re-point the live (non-resolved) backlog items that check:health flag G7 lists: where an item cites a codified decision by #N as current guidance, swap the bare #N for a link to its statute anchor (docs/agent/platform-decisions.md#<anchor>) so the RULE propagates, not the case number. Conservative per-cite judgment: KEEP #N for genuine lineage ("supersedes #N"), structural sibling/child item links, and non-citation number matches ("primitive #4") — a trial run found most flags are keep-as-is, only ~half are real re-points. Run via a per-item agent workflow (one agent per G7 item, Edit-tool surgical citation-only changes), proven in the #911 remediation. PRECONDITIONS: (1) anchors must be verified-correct first (done — all 132 codifiedIn resolve, 0 dangling); (2) run SOLO with NO concurrent batch/session — the bulk edits race the shared git index and another session's `git add -A` will sweep/scatter the changes (hit repeatedly in the original attempt). Success = G7 count drops to its irreducible lineage floor; check:health G7 tracks the candidate pool. Origin: #911 statute-layer codification; mechanism in scripts/audit-backlog-health.mjs (G7, live-scoped).
