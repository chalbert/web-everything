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

The WE-locus half of the #755 split (#809). Around the embedded FUI workbench (`workbench-host.html`), render WE-owned standards panels from WE's OWN data, NOT inside the iframe: (1) why-this-token provenance (computed→source token + intent, #747/#364), (2) the intent→ARIA mapping proof (authored intent attrs ⟷ resolved platform ARIA), (3) the #092 provider↔consumer graph the block participates in. A focus/selection sync (workbench→overlay) is a build detail, not a manipulation protocol. These panels are WE-docs chrome and don't travel to third-party embedders. Substrate (#747/#364/#092) all resolved. The FUI inspectors half shipped in #755.
