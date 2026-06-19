---
type: idea
workItem: story
size: 5
parent: "940"
status: resolved
blockedBy: ["960"]
dateOpened: "2026-06-18"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "fui:blocks/rich-text-editor/engines/lexical.ts"
tags: []
---

# lexical editor engine adapter (CustomEditorEngine)

Register Lexical behind the CustomEditorEngine seam (fui:blocks/rich-text-editor/editorEngine.ts:34): new fui:blocks/rich-text-editor/engines/lexical.ts using headless createEditor + lexical/@lexical/html ($generateHtmlFromNodes / $generateNodesFromDOM) to map to/from the HTML pivot; register on customEditorEngine; lexical + @lexical/html as optional peerDeps+devDeps; unit test + demo-switcher entry + Playwright e2e.

> **Re-blocked on #960 (batch-2026-06-18):** the same Quill-class Vite pre-bundle wall (`optimizeDeps.exclude` / dev-server restart) gates every library engine. #960 carries the shared fix in its resume recipe — land it there first, then this adapter follows. (Prior `blockedBy: 959` was satisfied; the live prerequisite is the Vite fix.)

## Progress (batch-2026-06-18)

Registered Lexical behind the `customEditorEngine` seam:
- `fui:blocks/rich-text-editor/engines/lexical.ts` — `LexicalEngine` binds Lexical (framework-agnostic
  core, no React) to the editable host via `setRootElement`, with `@lexical/rich-text` (inline format +
  blocks) + `@lexical/history` (undo). Maps to/from the HTML pivot via `@lexical/html`
  (`$generateHtmlFromNodes` out, `$generateNodesFromDOM` in); `format()` forwards the known inline formats
  to `FORMAT_TEXT_COMMAND` (#630). `engineIsSwappable` preserved (pivot is the only lock).
- Optional peer deps added (mirrors the quill/xstate pattern): `lexical`, `@lexical/html`,
  `@lexical/rich-text`, `@lexical/history`, `@lexical/utils` — peerDeps (optional) + devDeps. The live
  editing path needs more than the body's `lexical + @lexical/html` sketch (rich-text + history + utils).
- `fui:blocks/rich-text-editor/__tests__/lexicalEngine.test.ts` (2 unit, green) — registration-only
  (Lexical loads under happy-dom, unlike Quill).
- `fui:demos/rich-text-editor/__tests__/lexical-engine.spec.ts` (2 e2e, green) — switch → type → Ctrl+A
  (Lexical handles SELECT_ALL) → bold → assert `<strong>`; + engineIsSwappable through-lexical-back-to-native.
- Demo switcher: dynamic `import()` of the engine (keeps the optional lib out of the default bundle);
  updated the engine-list assertion to `['native','quill','plain','slate','lexical']`.
- **Finding:** `$generateHtmlFromNodes` needs an active *editor* (`getActiveEditor`), so serialize must run
  in `editor.read(...)`, not `getEditorState().read(...)` (the latter leaves the active editor null → throws).
- All 9 rte e2e + 14 unit green; no regression. Vite auto-optimized the new lib (no manual restart).
