---
type: decision
workItem: story
size: 3
parent: "940"
status: open
locus: frontierui
crossRef: { url: /backlog/955-decide-the-polyglot-live-test-sandbox-strategy-framework-run/, label: "#955 polyglot sandbox — framework-runtime Fork B" }
dateOpened: "2026-06-18"
tags: [webediting, rich-text-editor, editor-engine, slate, decision]
---

# Slate editor engine: React-optional-dep fork

Slate's editing surface is React-based (slate-react), so a Slate CustomEditorEngine would pull React into FUI even as an optional dep — the same framework-runtime concern as the polyglot live-sandbox (#955 Fork B). Decide before building Slate: (A) headless slate core + a non-React render, (B) accept React as an optional peerDep, or (C) drop Slate from the engine set. The Slate build slice under #940 is could-not-split pending this. Cross-ref #955.
