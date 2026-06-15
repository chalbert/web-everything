---
type: issue
workItem: story
size: 3
parent: "618"
status: resolved
blockedBy: ["629", "630"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: "block:rich-text-editor"
tags: []
---

# webediting editor Block — blocks.json entry + block-description, resolves the engine registry

Add the rich-text editor Block to src/_data/blocks.json (mirror the droplist entry: id/name/status/type/summary/implementsIntent/composesIntents) plus its block-description partial under src/_includes/block-descriptions/. The block resolves the CustomEditorEngineRegistry (#629), implementsIntent rich-text, composesIntents text-formatting (#630), and composes the sanitizer plug on paste. Decorations via the CSS Custom Highlight API by default. Blocked by #629 (engine registry) + #630 (intents). Renders in the blocks catalog.

**Graduated to** `block:rich-text-editor` — also ships block-descriptions/rich-text-editor.njk.
