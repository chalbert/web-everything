---
type: issue
workItem: story
size: 3
status: open
dateOpened: "2026-06-14"
tags: []
---

# Audit tool: G3/G2 governance-lineage precision — walk epic+prose decision refs, trust git dates

Harden scripts/audit-backlog-health.mjs governance checks, per the #607 audit. G3 (ungoverned-arch) only walks blockedBy/parent frontmatter, so it false-positives when a governing type:decision lives one epic-hop up or is named in prose: adversarial verification refuted 2 of 3 G3 'confirmed slips' (#355 by #409, #357 by the #314 charter). Fix: walk parent->epic->decision transitively and extract prose #NNN refs, clearing any resolving to a resolved decision. G2 compares two backfilled frontmatter dates (7 artifacts, 0 real); derive resolved-at from the commit flipping status:resolved, exclude repo-first-commit imports, and require the lineage edge to exist. Consumed by #608.
