---
kind: story
size: 5
parent: "912"
status: open
dateOpened: "2026-06-24"
locus: frontierui
relatedProject: webdocs
tags: [webdocs, block-explorer, workbench, polyglot, functional-adapter]
---

# Functional live-mount producer — produceFunctionalBytes emits a self-contained mountable module (jsx-runtime + DOM renderer + error boundary + mount/unmount)

The functional sibling of #1518 (the wrapper live producer). Today fui:tools/maas/functionalAuthoringForm.mjs is transform-only — it leaves a bare import of @frontierui/jsx-runtime and its own header says "the self-contained/live variant is a later slice. No bundle." This slice adds a functional-live form (its own author-form id-space, NOT a wrapper-catalog member per #1619) where produceFunctionalBytes esbuild-BUNDLES @frontierui/jsx-runtime + its DOM renderer + an ErrorBoundary into a self-contained ESM module exporting mount(el, props?) => {update, unmount} and unmount(). Foundational head of the #1746-GO realization chain that makes the functional author-mode form live-runnable, not just source-displayed.
