---
kind: task
status: resolved
blockedBy: ["1473"]
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: none
tags: []
---

# G3 subject-dedup: collapse same-entity parent/child graduations in the ungoverned-arch count

The G3 ungoverned-arch gate (we:scripts/audit-backlog-health.mjs) now counts every non-decision kind incl. epic (#1473). When an epic and a child both graduate to the SAME entity noun (#351↔#436 project:webcompliance, #618↔#629 project:webediting), G3 double-counts the one architectural noun. The fix is subject-axis, not kind-axis: dedup graduatedTo entity nouns across the parent/child closure before tallying G3 candidates, so the umbrella + leaf collapse to one. Only 2 of 6 epic→entity graduations are affected (4 are unique to the epic, so the kind gate stays as-is). Residual carved from #1473 Fork 2's skeptic; sits on #1498's G3 subject predicate axis.

## Progress (resolved 2026-06-22, batch-2026-06-22-1556-1557-1559)

Added a post-loop subject-dedup in `we:scripts/audit-backlog-health.mjs` (after the per-item gate loop):
drop a G3 candidate only when **every** standard-entity noun it declares is already covered by a
**G3-candidate ancestor** (transitive parent/blockedBy closure) — the umbrella. Implemented at the
**noun-set** level, not whole-string: a `graduatedTo` can list several `+`-joined nouns, so a child that
introduces any noun the umbrella lacks keeps its flag for those unique nouns (whole-string compare would
mis-handle a compound umbrella + single-noun child). Reused the imported `isEntityGraduation` to qualify
nouns.

**Verified:** G3 **41 → 40**. The current backlog's only same-entity parent/child double-count is
`#351↔#436` (`project:webcompliance`): #436 (leaf) collapses, #351 (umbrella epic) is kept — confirmed in
`we:audits/backlog-health-audit.md`. The card's other cited pair (#618↔#629 `project:webediting`) is **not**
currently a double-count: neither is a live G3 candidate anymore (backlog drift since authoring), and #629's
`graduatedTo` is compound (adds `protocol:editor-engine`/`plug:…`) so it would correctly retain its flag for
those unique nouns regardless. So 1 collapse, not the card's estimated 2 — the estimate predated the drift;
the noun-set logic is the robust general form. `check:standards` green.
