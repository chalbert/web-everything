---
kind: story
size: 8
parent: "904"
status: resolved
locus: frontierui
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: frontierui/blocks/rich-text-editor/RichTextEditorElement.ts
tags: []
---

# Build rich-text-editor FUI block impl

Build rich-text-editor in `fui:blocks/rich-text-editor/` (contract: we:src/_data/blocks/rich-text-editor.json). Resolve the swappable CustomEditorEngineRegistry (#629) — native contenteditable+InputEvent default, ProseMirror/Lexical/Slate/Quill as alternative engines; implement rich-text intent, compose text-formatting (#630), compose sanitizer plug on paste (#631); decorations paint via CSS Custom Highlight API (no `<span>` soup). SIZE 8 — itself a future /slice (editor-core vs the engine adapters) once the core surface exists. locus frontierui. Slice of #904 (#618/#590).

## Built — editor-core (batch-2026-06-18)

Shipped in **frontierui** at `fui:blocks/rich-text-editor/`:

- **`fui:editorEngine.ts`** — the swappable `CustomEditorEngine` seam (#629) + `CustomEditorEngineRegistry`
  + `customEditorEngine` (native default) + `NativeContentEditableEngine` (contenteditable + InputEvent
  floor: beforeinput/input → onChange, Range-based paste insertion, getValue/setValue/format/destroy).
- **`fui:sanitize.ts`** — the conservative default paste sanitizer (`sanitizeOnPaste`, #631): strips
  scripts/styles, event-handler attrs, `javascript:` URLs, dangerous tags. Swappable for #631's policy.
- **`fui:RichTextEditorElement.ts`** — the `<rich-text-editor>` element + `registerRichTextEditor`
  (parameterized #841): builds the editable surface, resolves the engine (attribute `engine`, default
  native), routes paste through `this.sanitizer`, emits `rich-text-change`, and `decorate()` paints via
  the **CSS Custom Highlight API** (`paintHighlight`, feature-detected — no `<span>` soup). Formatting
  is the composed text-formatting intent (#630), not owned here.
- **FUI `fui:src/_data/blocks.json`** — new `rich-text-editor` family entry (protocol webediting).

Scope = editor-core + the engine SEAM (per #923's "editor-core vs engine adapters" split); the real
ProseMirror/Lexical/Slate/Quill adapters are the deferred slice **#940** (`blockedBy: 923`). Gate:
`check:standards` green (0 errors; 35 blocks), 10 vitest specs pass, `tsc` clean.
