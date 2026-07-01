---
kind: task
parent: "1522"
status: resolved
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
graduatedTo: none
tags: []
---

# Correct the explorer subtree's stale locus + refs (code moved to plateau-app)

The explorer code moved to plateau:tools/explorer/ (per #1577/#1597) but #1522 and its 11 pre-2026-07-01 children still carry locus:frontierui and plateau:tools/explorer/-style refs written as the old FUI path. Sweep the subtree: repoint locus and update the stale code-path refs so work routes to the right repo.

## Scope
- #1522 frontmatter `locus: frontierui` → `plateau-app` (verify against the code: `plateau:tools/explorer/` exists; `frontierui:tools/explorer/` does not).
- The 11 pre-2026-07-01 children (#1523/#1524/#1525/#1526/#1530/#1547/#1550/#1698/#1773/#1791/#1805) — same `locus` repoint + fix any `fui:tools/explorer/*` refs in their bodies to `plateau:tools/explorer/*`.
- #1522 body prose still references the old FUI path (`# Explorer CLI autonomy` intro + Grounding section) — update those refs too.

## Boundaries
- Metadata/reference hygiene only — no explorer code changes.
- The 2026-07-01 children (#2039–#2046) were filed without a `locus` field on purpose; add `plateau-app` to them here if the sweep standardizes the subtree, or leave locus-less — decide as part of the sweep.

## Lineage
Surfaced 2026-07-01 in the first #1522 (Explorer CLI autonomy) goal-completeness pass — the stale-reference finding recorded in the #1522 body and [we:reports/2026-07-01-program-explorer-cli-autonomy.md](../reports/2026-07-01-program-explorer-cli-autonomy.md). Verified: `frontierui:tools/explorer/` is absent; the code is in `plateau:tools/explorer/`.
