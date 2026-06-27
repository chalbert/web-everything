---
kind: story
size: 2
parent: "1294"
status: open
blockedBy: ["1809"]
dateOpened: "2026-06-27"
tags: []
---

# Wire the webcompliance docs conformance page via the plateau iframe

C4 of the webcompliance relocation cascade (#1294). Register webcompliance in the generic EMBED_SUITES registry (plateau:src/conformance-engine/embedSuites.ts, the #1801 infra) and create the we:demos/webcompliance-conformance-demo page that embeds the plateau-hosted conformance iframe (?suite=webcompliance) running the vector suite against the FUI binding. webcompliance has no existing demo, so this creates the visible plateau-origin docs surface. Blocked on the binding + vectors (C3).
