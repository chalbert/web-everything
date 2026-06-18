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

# lexical editor engine adapter (CustomEditorEngine)

Register Lexical behind the CustomEditorEngine seam (fui:blocks/rich-text-editor/editorEngine.ts:34): new fui:blocks/rich-text-editor/engines/lexical.ts using headless createEditor + lexical/@lexical/html ($generateHtmlFromNodes / $generateNodesFromDOM) to map to/from the HTML pivot; register on customEditorEngine; lexical + @lexical/html as optional peerDeps+devDeps; unit test + demo-switcher entry + Playwright e2e.
