---
kind: story
size: 5
status: open
locus: frontierui
relatedProject: webdocs
parent: "912"
dateOpened: "2026-06-21"
tags: [webdocs, block-explorer, workbench, polyglot]
---

# fui: cross-origin wrapper-serve dev process — second origin + CORS + esbuild-bundle react/vue into wrapper bytes

Stand up the prerequisite cross-origin serving infra #1030 needs (and #1499 ruled): relocate maasWrapperServe off the main :3001 config onto a SECOND dev-only Vite/Node process (separate port, CORS-enabled), add react/react-dom/vue to a new fui:workbench/package.json (never root, never the shipped bundle), and switch fui:tools/maas/produceWrapperBytes.mjs from esbuild transform to a self-contained bundle so the cross-origin module carries react/vue in its bytes and needs no import-map. Per #1499 (cross-origin import keeps the dev server clean) — this is the infra half; #1030 is the mount-integration half that blockedBy this. locus frontierui; live verification owns the dev-server lifecycle.
