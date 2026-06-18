---
type: idea
workItem: story
size: 13
status: open
locus: frontierui
blockedBy: ["923"]
dateOpened: "2026-06-18"
tags: [webediting, rich-text-editor, editor-engine, adapters]
---

# Rich-text-editor library engine adapters (ProseMirror/Lexical/Slate/Quill) — #923 deferred slice

Register real library engines behind the `CustomEditorEngine` seam #923 shipped
(`fui:blocks/rich-text-editor/editorEngine.ts`): #923 built the editor-core (native
contenteditable+InputEvent engine, the registry, sanitize-on-paste, CSS Custom Highlight decorations).
This slice adds ProseMirror / Lexical / Slate / Quill as alternative `CustomEditorEngine` impls — each
mapping the library's doc model to/from the portable serialized pivot so swapping the engine leaves
the document model untouched (`engineIsSwappable`, #629). Keep the libraries peer/optional deps so the
native floor stays dependency-free. This is the "editor-core vs engine adapters" split #923 flagged.

## Claimed in batch-2026-06-18 — re-sized 8 → 13, needs slicing (NOT built)

The seam (`CustomEditorEngine.attach(ctx) → {getValue,setValue,format,destroy}`, pivot = **HTML**) is
clean, but "add ProseMirror/Lexical/Slate/Quill" is **four independent, heavy library integrations** —
each its own install (ProseMirror alone is ~6 packages: model/state/view/schema-basic/keymap/commands),
its own doc-model↔HTML mapping, and its own tests. That is ~4× the single-library effort #935 (XState)
took, well past a `story·8`. Re-sized to **13** so it drops from the batch pool; **slice per library**
(each an independently-deliverable `story·3–5` behind the same seam):

- **`quill` adapter** — most self-contained (one package; HTML via `getSemanticHTML()` / `dangerouslyPasteHTML`).
  Cleanest first slice.
- **`lexical` adapter** — `lexical` + `@lexical/html` (`$generateHtmlFromNodes` / `$generateNodesFromDOM`),
  headless `createEditor`.
- **`prosemirror` adapter** — schema + `DOMParser`/`DOMSerializer` from `prosemirror-model`; the multi-package one.
- **`slate` adapter** — **carries a fork:** Slate's editing surface is **React-based** (`slate-react`), so a
  Slate engine would pull **React** into FUI even as an optional dep — the same framework-runtime concern as
  the polyglot live-sandbox (#955 Fork B). File that sub-decision before building Slate (use the headless
  `slate` core + a non-React render, or accept React-optional, or drop Slate from the set).

Common to all: DOM-heavy libraries are hard to unit-test in the happy-dom test env (selection/range/layout
gaps) — each slice needs a Playwright e2e on the editor demo for real verification, not jsdom alone.
