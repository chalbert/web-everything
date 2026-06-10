---
type: idea
workItem: story
size: 8
parent: "049"
status: open
blockedBy: ["048"]
dateOpened: '2026-06-03'
tags:
  - webcomponents
  - component
  - playground
  - docs
  - demo
relatedReport: reports/2026-06-03-declarative-component-element.md
relatedProject: webcomponents
crossRef: { url: /blocks/component/, label: Component block }
---

# Author the `<component>` converter playground page

A standalone demo page at `demos/converter.html` — two-pane bidirectional editor over the `<component>` ↔ class transform, fixture picker for supported features, and inline named-rule errors for unsupported syntax. Shares its fixtures with the test suite in `frontierui/compiler/__tests__/component-transform/fixtures/` so it can't drift from what passes. Stands up once the first fixture (`x-empty`) goes green; requires a WE→FUI symlink mechanism for hot refresh.

## Sizing note (resized 3 → 5, 2026-06-10, at a batch claim-time pre-flight)

Not batchable — it's a single-item story, not a story·3. Two prerequisites the original size missed:
(1) **No WE→FUI import path exists** for the *bidirectional* transform. The existing
`demos/component-adapter-demo.html` runs WE's own **runtime twin** (`blocks/renderers/component/…`, a
*one-way* lowering); this playground needs frontierui's `compiler/src/component-transform` (`<component>`
⇄ class, byte-identical), which WE has no vite alias to. That cross-repo import is the "symlink
mechanism" called out above — it must be built first (or the page must live in `frontierui/demos/`).
(2) **`typescript`-in-browser**: the `toDeclarative` direction (`parseImperative`) uses the full TS
Compiler API, a heavy browser dependency a two-pane live editor has to bundle/serve. Plus the
interactive two-pane editor + fixture picker itself. Keep as a focused single-item build.
