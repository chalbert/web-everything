---
type: idea
workItem: epic
status: open
locus: frontierui
blockedBy: ["923"]
dateOpened: "2026-06-18"
tags: [webediting, rich-text-editor, editor-engine, adapters]
---

# Rich-text-editor library engine adapters (ProseMirror/Lexical/Slate/Quill) — #923 deferred slice

Umbrella for registering real library engines behind the `CustomEditorEngine` seam #923 shipped
(`fui:blocks/rich-text-editor/editorEngine.ts`) — ProseMirror / Lexical / Slate / Quill as alternative
`CustomEditorEngine` impls, each mapping the library's doc model to/from the **HTML pivot** so swapping
the engine leaves the document model untouched (`engineIsSwappable`, #629); libraries stay peer/optional
deps so the native floor is dependency-free. The "editor-core vs engine adapters" split #923 flagged.
**Sliced 2026-06-18** (was `story·13`): the seam is clean, so this is volume not uncertainty — each
library is an independent integration (~4× a single-library effort like #935 XState).

## Slices

A shared **demo + Playwright e2e harness** lands first (DOM-heavy libraries can't be verified in the
happy-dom unit env — selection/range/layout gaps need a real browser); the three clean engine adapters
then proceed in parallel behind it. Slate is held out: it carries a real React fork, carved to its own
decision.

- [#959](/backlog/959-rich-text-editor-demo-playwright-e2e-harness-engine-switcher/) — `task·2` — demo
  page (`engine=""` switcher) + Playwright e2e harness on the native engine (foundational shared fixture).
- [#960](/backlog/960-quill-editor-engine-adapter-customeditorengine/) — `story·3` — **quill** adapter
  (most self-contained; HTML via `getSemanticHTML()` / `dangerouslyPasteHTML`). Blocked by #959.
- [#961](/backlog/961-lexical-editor-engine-adapter-customeditorengine/) — `story·5` — **lexical** adapter
  (headless `createEditor` + `@lexical/html`). Blocked by #959.
- [#962](/backlog/962-prosemirror-editor-engine-adapter-customeditorengine/) — `story·5` — **prosemirror**
  adapter (schema + `DOMParser`/`DOMSerializer`; the multi-package one). Blocked by #959.
- [#963](/backlog/963-slate-editor-engine-react-optional-dep-fork/) — `type:decision · 3` — **Slate React
  fork** (slate-react pulls React into FUI; same concern as #955 Fork B). The Slate **build** slice is
  could-not-split pending this; scaffold (or drop) it once #963 resolves.
