---
type: idea
workItem: story
size: 3
parent: "746"
status: open
relatedProject: webdocs
dateOpened: "2026-06-17"
tags: []
---

# Block-Explorer WE-standards overlay — why-this-token provenance, intent→ARIA proof, provider↔consumer graph around the embed

The WE-locus half of the #755 split (#809). Around the embedded FUI workbench (workbench-host.html), render WE-owned standards panels from WE's OWN data — NOT inside the iframe: (1) why-this-token provenance trace (computed→source token + intent, #747/#364 webtheme), (2) the intent→ARIA mapping proof (authored intent attrs ⟷ the platform ARIA they resolve to), (3) the #092 provider↔consumer graph the block participates in (webregistries). A small focus/selection sync (workbench→overlay: which element/token is selected) is a build detail, not a new manipulation protocol. These panels are WE-docs chrome and do NOT travel to third-party embedders. Substrate ready: #747/#364/#092 all resolved. The FUI rendered-component inspectors half (ARIA/computed/source/event-log) shipped in #755 (frontierui/workbench/mount.ts).
