---
type: idea
workItem: story
size: 8
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
