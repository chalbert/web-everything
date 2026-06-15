---
type: idea
workItem: story
size: 3
parent: "049"
status: open
blockedBy: ["038"]
dateOpened: "2026-06-15"
tags: []
---

# Reverse direction + two-pane bidirectional editor for the component converter

Slice B of the <component> converter playground (frontierui/demos/, sibling under #049, blocked by #038's one-way page). Adds the class→declarative direction via transform(source,'toDeclarative') → parseImperative, which pulls the full TypeScript Compiler API (import ts from 'typescript', imperative.ts:18 — the only file needing the ~23MB bundle), and a two-pane live bidirectional editor syncing both directions over the shared fixtures. Demoable: edit either pane → the other updates live, both directions, fixtures still selectable.
