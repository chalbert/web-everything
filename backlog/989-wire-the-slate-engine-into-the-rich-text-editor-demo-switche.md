---
type: idea
workItem: story
size: 3
parent: "940"
status: open
dateOpened: "2026-06-19"
tags: []
---

# Wire the Slate engine into the rich-text-editor demo switcher + e2e (live slate-react mount)

Follow-up to #969 (Slate engine package). The @frontierui/rich-text-editor-slate package + serializer + engine are built and type-checked; what remains is the BROWSER-only slice the headless layer can't cover: (1) add 'slate' to the fui:demos/rich-text-editor demo switcher via a dynamic import() of registerSlateEngine (code-splits React out of the default bundle), (2) a Playwright e2e (type -> select-all -> bold -> assert <strong> in the pivot). LIKELY shares the #960/#961/#962 Vite pre-bundle hazard (a vite.config optimizeDeps.exclude that forces a dev-server restart) — land that shared fix once and the React/slate engines follow. Deferred from #969 because verifying a slate-react mount needs a real browser + may require the forbidden mid-batch server restart.
