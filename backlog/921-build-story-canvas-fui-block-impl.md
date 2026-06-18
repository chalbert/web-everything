---
type: issue
workItem: story
size: 5
parent: "904"
status: resolved
locus: frontierui
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: frontierui/blocks/story-canvas/StoryCanvasElement.ts
tags: []
---

# Build story-canvas FUI block impl

Build story-canvas in `fui:blocks/story-canvas/` (contract: we:src/_data/blocks/story-canvas.json). Render a single WebCase ({id,title,description,code}) in an isolated style/script frame so the demoed component and docs chrome don't leak into each other; interaction-tests fold in as webcases carrying an interaction script. One fixture serves the conformance loop + docs. locus frontierui. Slice of #904 (#626 Fork 2).

## Built (batch-2026-06-18)

Shipped in **frontierui** at `blocks/story-canvas/`:

- **`fui:StoryCanvasElement.ts`** — the `<story-canvas>` element + `registerStoryCanvas` (parameterized
  #841) + the `WebCase` type ({id,title,description,code} + optional order/prose). Renders one WebCase
  in isolation: a same-origin **srcdoc iframe** by default (strongest style/script boundary,
  `isolationIsTheContract`), a **shadow-only** tier via `isolation="shadow"` for trusted cases; the
  frame chrome (title/description) lives in the element's own shadow root. Case resolves from the
  `.case` property or a `case-id` attribute against the page webcases (`globalThis.webcases`).
- **FUI `fui:src/_data/blocks.json`** — new `story-canvas` family entry (protocol webdocs).

One fixture serves both the conformance loop and the docs surface (#626 Fork 2 — examples ARE
webcases). Gate: `check:standards` green (0 errors; 33 blocks), 5 vitest specs pass, `tsc` clean.
