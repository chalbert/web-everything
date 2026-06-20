---
kind: story
size: 5
parent: "940"
status: resolved
blockedBy: ["960"]
dateOpened: "2026-06-18"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "fui:blocks/rich-text-editor/engines/prosemirror.ts"
tags: []
---

# prosemirror editor engine adapter (CustomEditorEngine)

Register ProseMirror behind the CustomEditorEngine seam (fui:blocks/rich-text-editor/editorEngine.ts:34): new fui:blocks/rich-text-editor/engines/prosemirror.ts building a schema + mapping to/from the HTML pivot via DOMParser/DOMSerializer from prosemirror-model; the multi-package one (prosemirror-model/state/view/schema-basic/keymap/commands as optional peerDeps+devDeps); register on customEditorEngine; unit test + demo-switcher entry + Playwright e2e.

> **Re-blocked on #960 (batch-2026-06-18):** the same Quill-class Vite pre-bundle wall (`optimizeDeps.exclude` / dev-server restart) gates every library engine. #960 carries the shared fix in its resume recipe — land it there first, then this adapter follows. (Prior `blockedBy: 959` was satisfied; the live prerequisite is the Vite fix.)

## Progress (batch-2026-06-18)

Registered ProseMirror behind the `customEditorEngine` seam:
- `fui:blocks/rich-text-editor/engines/prosemirror.ts` — `ProseMirrorEngine` builds an `EditorView` over a
  `prosemirror-schema-basic` schema (strong/em/code + paragraph), base keymap + history. Maps to/from the
  HTML pivot via `DOMSerializer.fromSchema` (out) / `DOMParser.fromSchema` (in) from prosemirror-model;
  `format()` runs `toggleMark` for the composed text-formatting commands (#630). `engineIsSwappable`
  preserved (pivot is the only lock, never a vendor doc/Step).
- Optional peer deps added (mirrors the quill/lexical pattern): prosemirror-model/state/view/schema-basic/
  keymap/commands + -history — peerDeps (optional) + devDeps.
- `fui:blocks/rich-text-editor/__tests__/prosemirrorEngine.test.ts` (2 unit, green) — registration-only.
- `fui:demos/rich-text-editor/__tests__/prosemirror-engine.spec.ts` (2 e2e, green) — switch → type →
  Ctrl/Cmd+A (baseKeymap selectAll) → bold → assert `<strong>`; + engineIsSwappable through-PM-back-to-native.
- Demo switcher: dynamic `import()` of the engine; engine-list assertion now
  `['native','quill','plain','slate','lexical','prosemirror']`.
- All 11 rte e2e (5 engines) + 16 unit green; no regression. Vite auto-optimized the 7 new packages on
  first import (one-time ~32s optimize + reload, then cached — no manual restart).
