---
kind: decision
status: open
dateOpened: "2026-06-20"
tags: [reproduction, gap-sweep, shadcn]
relatedProject: webintents
relatedReport: reports/2026-06-20-1243-shadcn-first-gap-delta.md
---

# Action Intent: emphasis-style axis (fill | outline | ghost | link) orthogonal to priority level

Reproduction-conformance gap #3 from shadcn (#1243). Action Intent expresses semantic priority LEVELS, but shadcn buttons also vary on an orthogonal emphasis-STYLE axis (filled / outline / ghost / link) at the same priority — not expressible as a level. Decide whether the emphasis-style axis belongs on Action Intent as a second dimension or as a separate intent/trait. Surfaced by reproduction #1243, feeds gap-sweep #315.
