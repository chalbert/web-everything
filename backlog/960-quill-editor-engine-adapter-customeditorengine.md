---
type: idea
workItem: story
size: 3
parent: "940"
status: open
blockedBy: ["959"]
dateOpened: "2026-06-18"
tags: []
---

# quill editor engine adapter (CustomEditorEngine)

Register Quill behind the CustomEditorEngine seam (fui:blocks/rich-text-editor/editorEngine.ts:34): new fui:blocks/rich-text-editor/engines/quill.ts mapping Quill's doc model to/from the HTML pivot via getSemanticHTML() / dangerouslyPasteHTML(); register on customEditorEngine; quill as optional peerDep+devDep (mirrors #935 xstate); unit test + add 'quill' to the demo switcher + Playwright e2e. Most self-contained library (one package).
