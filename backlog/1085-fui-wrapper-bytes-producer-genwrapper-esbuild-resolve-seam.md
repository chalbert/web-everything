---
type: idea
workItem: story
size: 3
parent: "912"
status: open
dateOpened: "2026-06-19"
tags: []
---

# FUI wrapper-bytes producer — genWrapper + esbuild resolve seam

The injected resolve seam (FUI analog of serveCompiled): resolve a block's CEM declaration -> genWrapper(decl, react|vue) -> esbuild JSX->ESM -> {code, language, producerVersion}. Home fui:tools/maas/. Demo: unit test that react-wrapper + vue-wrapper emit valid ESM.
