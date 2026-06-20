---
kind: story
size: 3
parent: "940"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "fui:demos/rich-text-editor/__tests__/slate-engine.spec.ts"
tags: []
---

# Wire the Slate engine into the rich-text-editor demo switcher + e2e (live slate-react mount)

Follow-up to #969 (Slate engine package). The @frontierui/rich-text-editor-slate package + serializer + engine are built and type-checked; what remains is the BROWSER-only slice the headless layer can't cover: (1) add 'slate' to the fui:demos/rich-text-editor demo switcher via a dynamic import() of registerSlateEngine (code-splits React out of the default bundle), (2) a Playwright e2e (type -> select-all -> bold -> assert <strong> in the pivot). LIKELY shares the #960/#961/#962 Vite pre-bundle hazard (a vite.config optimizeDeps.exclude that forces a dev-server restart) — land that shared fix once and the React/slate engines follow. Deferred from #969 because verifying a slate-react mount needs a real browser + may require the forbidden mid-batch server restart.

## Progress (batch-2026-06-18)

Wired the Slate engine into the demo switcher + shipped its real-browser e2e (the BROWSER-only slice #969
deferred):
- `fui:demos/rich-text-editor/rich-text-editor.ts` — dynamic `import('@frontierui/rich-text-editor-slate')`
  → `registerSlateEngine(customEditorEngine)`, awaited before the switcher populates so `slate` appears.
  The `import()` code-splits React + slate-react out of the default bundle.
- `fui:demos/rich-text-editor/__tests__/slate-engine.spec.ts` (2 e2e, green) — switch to slate → type →
  triple-click select → bold → assert `<strong>` in the pivot; + engineIsSwappable through-slate-back-to-native.
- Updated `fui:demos/rich-text-editor/__tests__/engine-switcher.spec.ts`'s engine-list assertion to `['native','quill','plain','slate']`.
- **#960 Vite-restart hazard did NOT materialize:** Vite auto-optimizes React/slate-react on first import
  (one-time page reload, cached in `node_modules/.vite`) — no manual dev-server restart needed; re-run is
  stable. The demo depends on the slate package's `dist` (gitignored; produced by its `tsc` build script).
- **Finding:** Slate syncs `editor.selection` only from genuine selection events — a synthetic `Ctrl+A` /
  `Range`/`selectText()` does not propagate into its model, so the e2e selects via a real triple-click.
  The engine's bold→`<strong>` path is correct (verified once a real selection drives it).
- All 7 rich-text-editor e2e (slate 2 + switcher 3 + quill 2) green; no regression.
