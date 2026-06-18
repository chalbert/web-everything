---
type: idea
workItem: story
size: 3
parent: "940"
status: open
blockedBy: ["959"]
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
tags: []
---

# quill editor engine adapter (CustomEditorEngine)

Register Quill behind the CustomEditorEngine seam (fui:blocks/rich-text-editor/editorEngine.ts:34): new fui:blocks/rich-text-editor/engines/quill.ts mapping Quill's doc model to/from the HTML pivot via getSemanticHTML() / dangerouslyPasteHTML(); register on customEditorEngine; quill as optional peerDep+devDep (mirrors #935 xstate); unit test + add 'quill' to the demo switcher + Playwright e2e. Most self-contained library (one package).

## Blocked + released — needs a Vite-config prerequisite (batch-2026-06-18)

Attempted in batch-2026-06-18 and **released** (stop-rule: outgrew a story·3 into a toolchain-config
fix that restarts the running dev server). The adapter design is **sound and verified at the seam** — the
blocker is purely Vite's dependency pre-bundle.

**What was built (and works):** `fui:blocks/rich-text-editor/engines/quill.ts` — `QuillEngine implements CustomEditorEngine`, mapping
the HTML pivot via `quill.getSemanticHTML()` (out) / `clipboard.dangerouslyPasteHTML(sanitize(v))` (in),
`format()` → `quill.format(cmd, value, 'user')`, `destroy()` restores the host. Registration-level unit
test green (engine registers behind the seam). `quill@^2` wired as an optional `peerDependency` (mirrors
the #935 xstate pattern). Quill **cannot** instantiate under happy-dom (Parchment recurses → stack
overflow), so the unit layer stays registration-only and the editing path is e2e-only — as designed.

**The blocker (verified):** in the real browser, `new Quill(host)` throws **`TypeError: Invalid value
used as weak map key`** at Parchment's `ShadowBlot` constructor (`WeakMap.set(domNode, …)`), inside
Vite's pre-bundled `fui:node_modules/.vite/deps/quill.js`. Single hoisted `parchment@3.0.0` (not a duplicate)
— it's esbuild's pre-bundle of Quill 2.0.3 breaking Parchment's registry/class init. **Fix:** a
`vite.config.mts` change — `optimizeDeps: { exclude: ['quill'] }` (serve Quill as native ESM, preserving
class semantics) — which forces Vite to **restart the dev server** + re-optimize. Deferred because the
batch must not restart the user's running server.

**Resume recipe (fast):** (1) add `optimizeDeps.exclude: ['quill']` to `fui:vite.config.mts`; (2)
reinstate `fui:blocks/rich-text-editor/engines/quill.ts` + the registration unit test (both reverted clean); (3) `npm i -D quill` +
re-add the optional `peerDependency`; (4) register `QuillEngine` in `fui:demos/rich-text-editor/rich-text-editor.ts`
+ extend the `engines()` assertion in `fui:demos/rich-text-editor/__tests__/engine-switcher.spec.ts` to `['native','plain','quill']`; (5)
re-add `fui:demos/rich-text-editor/__tests__/quill-engine.spec.ts` (type → keyboard select-all → bold →
assert `<strong>` in the pivot). **Likely shared by siblings #961 (Lexical) / #962 (ProseMirror)** — same
Vite pre-bundle class — so land the `optimizeDeps` fix once and the three adapters follow.
