---
type: idea
workItem: story
size: 5
parent: "912"
status: open
blockedBy: ["1029"]
dateOpened: "2026-06-19"
locus: frontierui
relatedProject: webdocs
tags: [webdocs, block-explorer, workbench, polyglot]
---

# Workbench same-document live-test mount + react/vue devDeps

fui:workbench/live-test/: await import('/_maas/<block>.js?form=react-wrapper'), mount into the workbench document (no iframe — #955-A2), React error boundary + window.onerror/unhandledrejection runtime-error surfacing, wired to inspector/event/anatomy panels; add react/react-dom/vue as workbench devDeps (never the shipped @frontierui bundle — framework-free, #955-B).
