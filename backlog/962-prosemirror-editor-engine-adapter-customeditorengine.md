---
type: idea
workItem: story
size: 5
parent: "940"
status: open
blockedBy: ["959"]
dateOpened: "2026-06-18"
tags: []
---

# prosemirror editor engine adapter (CustomEditorEngine)

Register ProseMirror behind the CustomEditorEngine seam (fui:blocks/rich-text-editor/editorEngine.ts:34): new fui:blocks/rich-text-editor/engines/prosemirror.ts building a schema + mapping to/from the HTML pivot via DOMParser/DOMSerializer from prosemirror-model; the multi-package one (prosemirror-model/state/view/schema-basic/keymap/commands as optional peerDeps+devDeps); register on customEditorEngine; unit test + demo-switcher entry + Playwright e2e.
