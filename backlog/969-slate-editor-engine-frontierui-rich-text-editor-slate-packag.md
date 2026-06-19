---
type: issue
workItem: story
size: 5
status: resolved
parent: "940"
locus: frontierui
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-19"
graduatedTo: "fui:packages/rich-text-editor-slate/src/SlateEditorEngine.tsx"
tags: [webediting, rich-text-editor, editor-engine, slate]
---

# Slate editor engine — @frontierui/rich-text-editor-slate package (dynamic-import, React contained)

Build the Slate CustomEditorEngine as its own published package @frontierui/rich-text-editor-slate (the #963-ratified package-split recipe): React + slate + slate-react are normal deps of THIS package only; the core @frontierui/blocks stays framework-free. The engine mounts a slate-react root inside its host element and serializes to/from the HTML pivot; consumers opt in via a dynamic import() that code-splits React out of the default bundle, then register() into customEditorEngine. No module-federation. locus: frontierui. Prioritized separately given Lexical's overlap.

## Progress — package shipped in batch-2026-06-18

Built `fui:packages/rich-text-editor-slate/` (`@frontierui/rich-text-editor-slate`, a `packages/*`
workspace package — the established FUI monorepo pattern), the #963 split: React + slate + slate-react +
slate-history are deps of **this package only**; `@frontierui/blocks` stays framework-free.

- **`fui:packages/rich-text-editor-slate/src/serialize.ts`** — the correctness-critical, framework-free
  core: bidirectional HTML-pivot ⇄ Slate serializer (paragraph blocks + bold/italic/underline/code marks;
  unknown tags degrade to text). **12 round-trip unit tests green** (the only part testable headlessly —
  happy-dom).
- **`fui:packages/rich-text-editor-slate/src/SlateEditorEngine.tsx`** — `SlateEditorEngine implements
  CustomEditorEngine`: `attach()` mounts a `slate-react` root in the host (React 19 `createRoot`), lifts
  every AST edit to the pivot via the serializer, and the handle does `getValue`/`setValue`/`format`
  (toggle marks)/`destroy` (unmount + restore host attrs). Type-checks clean against slate-react 0.124.
- **`fui:packages/rich-text-editor-slate/src/index.ts`** — exports the engine + a `registerSlateEngine()`
  helper (no top-level side effect; consumer opts in via `await import(...)` → `register()` into
  `customEditorEngine`, code-splitting React out of the default bundle).
- **`@frontierui/blocks` now exposes the editor-engine contract** via a new `./rich-text-editor` export
  (type-only consumption by the slate package; `blocks` gains no React dep).
- **Verification envelope:** serializer vitest (12) + package `tsc --noEmit` (clean) + FUI check:standards
  (0 errors). The **live `slate-react` mount** can't run headlessly (React DOM, same as quill #960's
  happy-dom limit), so the demo-switcher wiring + Playwright e2e — and any `vite.config` `optimizeDeps`
  fix the React/slate pre-bundle may need (the #960/#961/#962 hazard; a dev-server restart, off-limits
  mid-batch) — are carried to **#989**.
