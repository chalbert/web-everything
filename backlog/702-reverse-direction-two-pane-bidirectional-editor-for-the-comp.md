---
type: idea
workItem: story
size: 3
parent: "049"
status: resolved
blockedBy: ["038"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: frontierui/demos/component-converter-bidi.html
tags: []
---

# Reverse direction + two-pane bidirectional editor for the component converter

Slice B of the <component> converter playground (frontierui/demos/, sibling under #049, blocked by #038's one-way page). Adds the class→declarative direction via transform(source,'toDeclarative') → parseImperative, which pulls the full TypeScript Compiler API (import ts from 'typescript', imperative.ts:18 — the only file needing the ~23MB bundle), and a two-pane live bidirectional editor syncing both directions over the shared fixtures. Demoable: edit either pane → the other updates live, both directions, fixtures still selectable.

## Progress

- **Resolved 2026-06-15 (batch-2026-06-15).** New page `frontierui/demos/component-converter-bidi.html`
  + `.ts` — kept Slice A's typescript-free one-way page intact (separate lesson: the cheap direction
  needs no heavy deps) and added the full bidirectional editor here. Two `<textarea>` panes sync live
  both ways: declarative→class via `emitImperative(parseDeclarative(…))`, class→declarative via
  `emitDeclarative(parseImperative(…))` — the reverse leaf pulls the TS Compiler API as the item
  specified. Composes the leaf modules directly (not the barrel, which re-exports `plugins.ts`'s
  `node:fs`). A `syncing` flag breaks the input-echo feedback loop; parse errors surface inline per
  pane and keep the last good output legible.
- **Verified** in real Chromium on :3001: initial fixture fills both panes; fixture change re-derives
  the class (`customElements.define` present); editing the class pane regenerates the declarative
  `<component>` source via the TS parser; zero console/page errors. Frontierui `check:standards` green;
  `tsc --noEmit` reports no errors in the new file.
