---
kind: story
size: 3
parent: "940"
status: resolved
blockedBy: ["959"]
dateOpened: "2026-06-18"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "fui:blocks/rich-text-editor/engines/quill.ts"
tags: []
---

# quill editor engine adapter (CustomEditorEngine)

Register Quill behind the CustomEditorEngine seam (fui:blocks/rich-text-editor/editorEngine.ts:34): new fui:blocks/rich-text-editor/engines/quill.ts mapping Quill's doc model to/from the HTML pivot via getSemanticHTML() / dangerouslyPasteHTML(); register on customEditorEngine; quill as optional peerDep+devDep (mirrors #935 xstate); unit test + add 'quill' to the demo switcher + Playwright e2e. Most self-contained library (one package).

## Progress — resolved 2026-06-19

Shipped. Quill registers behind the `CustomEditorEngine` seam and edits live in the real (plugged)
browser demo: typing + select-all + the `bold` command round-trips through Quill's Delta model to the
shared HTML pivot as `<p><strong>hello world</strong></p>`.

**Done:**
- `fui:blocks/rich-text-editor/engines/quill.ts` — `QuillEngine implements CustomEditorEngine`: HTML
  pivot out via `quill.getSemanticHTML()`, in via `clipboard.dangerouslyPasteHTML(sanitize(v))`,
  `format()` → `quill.format(cmd, value ?? true, 'user')`, `destroy()` strips Quill's DOM/classes off
  the shared host so the next engine re-attaches clean. Self-registers on import (the opt-in module that
  imports `quill`, keeping core `fui:blocks/rich-text-editor/editorEngine.ts` dependency-free — mirrors the #935 xstate split).
- `quill@^2` as optional `peerDependency` + devDep (#935 pattern).
- Registration-only unit test `fui:blocks/rich-text-editor/__tests__/quillEngine.test.ts` (Quill can't
  instantiate under happy-dom — Parchment recurses — so the editing path is e2e-only, by design).
- Demo wires it: `fui:demos/rich-text-editor/rich-text-editor.ts` imports the adapter; switcher list is
  `['native','quill','plain']`; e2e `fui:demos/rich-text-editor/__tests__/quill-engine.spec.ts` proves
  the edit + format path and a swap-through-Quill-back-to-native pivot survival.

**The real blocker was NOT Vite** (the batch's recorded `optimizeDeps` hypothesis was wrong — verified:
`exclude: ['quill']` breaks `quill-delta`'s CJS interop, and pre-bundling was never the cause). True
cause: FUI's **`webinjectors` bootstrap patch** (`fui:plugs/webinjectors/Node.injectors.patch.ts`)
replaces global `Node` with a `PatchedNode` that **dropped Node's static constants** (`TEXT_NODE`,
`ELEMENT_NODE`, …). So `Node.TEXT_NODE` became `undefined`, which silently poisons every `x.nodeType ===
Node.TEXT_NODE` guard (`undefined === undefined` → true). Parchment's `registry.create` then mistook the
string tag `'block'` for a Node and did `WeakMap.set('block', …)` → "Invalid value used as weak map key".
A latent bug for **any** third-party lib reading `Node.*` constants off the global, not just Quill.
**Fix:** copy `OriginalNode`'s own static property descriptors onto `PatchedNode` (no Vite change — the
`optimizeDeps` churn was reverted). Root-caused by bisecting the four bootstrap patch groups on an
`-unplugged` probe page.

Verified: frontierui `tsc --noEmit` clean, full vitest **2013 passed**, the 5 rich-text-editor e2e
(3 switcher + 2 quill) pass, webinjectors 175 unit tests pass. Siblings #961 (Lexical) / #962
(ProseMirror) inherit the now-correct patch for free — no shared Vite fix needed.
