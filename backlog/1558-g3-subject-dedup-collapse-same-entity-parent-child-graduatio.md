---
kind: task
status: open
blockedBy: ["1473"]
dateOpened: "2026-06-22"
tags: []
---

# G3 subject-dedup: collapse same-entity parent/child graduations in the ungoverned-arch count

The G3 ungoverned-arch gate (we:scripts/audit-backlog-health.mjs) now counts every non-decision kind incl. epic (#1473). When an epic and a child both graduate to the SAME entity noun (#351↔#436 project:webcompliance, #618↔#629 project:webediting), G3 double-counts the one architectural noun. The fix is subject-axis, not kind-axis: dedup graduatedTo entity nouns across the parent/child closure before tallying G3 candidates, so the umbrella + leaf collapse to one. Only 2 of 6 epic→entity graduations are affected (4 are unique to the epic, so the kind gate stays as-is). Residual carved from #1473 Fork 2's skeptic; sits on #1498's G3 subject predicate axis.
