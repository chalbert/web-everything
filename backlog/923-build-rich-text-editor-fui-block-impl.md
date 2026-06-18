---
type: issue
workItem: story
size: 8
parent: "904"
status: open
locus: frontierui
dateOpened: "2026-06-18"
tags: []
---

# Build rich-text-editor FUI block impl

Build rich-text-editor in `fui:blocks/rich-text-editor/` (contract: we:src/_data/blocks/rich-text-editor.json). Resolve the swappable CustomEditorEngineRegistry (#629) — native contenteditable+InputEvent default, ProseMirror/Lexical/Slate/Quill as alternative engines; implement rich-text intent, compose text-formatting (#630), compose sanitizer plug on paste (#631); decorations paint via CSS Custom Highlight API (no `<span>` soup). SIZE 8 — itself a future /slice (editor-core vs the engine adapters) once the core surface exists. locus frontierui. Slice of #904 (#618/#590).
