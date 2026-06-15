---
type: issue
workItem: story
size: 5
status: open
locus: frontierui
parent: "170"
blockedBy: ["649"]
dateOpened: "2026-06-15"
relatedReport: reports/2026-06-14-plugs-runtime-audit.md
tags: [plugs, dedup, migration, frontierui, webguards, webvalidation]
---

# Port WE-only plug domains (webguards, webvalidation) + their subsystems into Frontier UI

The #649 reconciliation decided the two WE-only plug domains (`webguards`, `webvalidation`) are NOT WE-only by design: per #606 (plugs = implementation owned by Frontier UI) they are plug implementations that must port DOWN to FUI. The port is larger than the #635 audit implied — each drags in a whole sibling subsystem absent from FUI (`guard/`, `validity-merge/`, `validator-resolution/`: ~1900 LOC, 18 non-test files, 3 new FUI top-level dirs) plus bootstrap wiring. This item ports them and verifies FUI build + vitest green. Gates #449 — deleting WE's `plugs/` before this lands would lose both domains.
