---
type: issue
workItem: story
size: 3
parent: "618"
status: resolved
blockedBy: ["628"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: "intent:text-formatting + intent:rich-text (src/_data/intents.json) — webediting controls-axis + editable-surface intents, #590 Fork 5"
tags: []
---

# webediting intents — text-formatting controls axis + rich-text editable-surface UX

Add two intents to we:src/_data/intents.json (mirror the type-ahead entry shape): text-formatting (the controls axis — which format* ops are exposed, placement, overflow; composes droplist/popover/button) and rich-text (the editable/multiline/read-only surface UX; requiresCapabilities the editing-surface caps). Separate intents per #590 Fork 5 — the formatting-controls axis recurs without an editor, so it earns its own home. Blocked by #628 (rich-text requiresCapabilities the surface ids). Renders on /intents/.

## Progress

- Added two intents to [we:src/_data/intents.json](/src/_data/intents.json) (spliced, not whole-file roundtripped), mirroring the type-ahead/hover-intent entry shape:
  - **text-formatting** (`requiresCapabilities: []`, UX-only) — the controls axis ratified in #590 Fork 5. Dimensions `exposure` (minimal/standard/full/custom), `placement` (toolbar/floating/inline/contextual), `overflow` (overflow-menu/scroll/wrap — most-permissive default first). Composes droplist/anchor/button; the mechanic (execCommand vs command registry vs custom serializer) is demoted to a Technical Configurator note. Events `format-apply`, `format-state-change`.
  - **rich-text** (`requiresCapabilities: [contenteditable, editcontext, sanitizer-api, highlight-api]` — the #628 surface ids) — the editable/read-only surface UX. Dimensions `mode` (editable/read-only), `flow` (multiline/singleline), `paste` (sanitized/plain-text/raw, borrowing Sanitizer API vocab). Defers the engine to the Editor Engine protocol. Events `richtext-input`, `richtext-selectionchange`.
- Both link cross-intent (text-formatting ⇄ rich-text); rich-text links each negotiated capability page.
- `npm run check:standards` green; 11ty `--dryrun` build smoke green.
