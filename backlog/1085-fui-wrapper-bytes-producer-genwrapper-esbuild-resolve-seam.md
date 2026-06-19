---
type: idea
workItem: story
size: 3
parent: "912"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "fui:tools/maas/produceWrapperBytes.mjs"
tags: []
---

# FUI wrapper-bytes producer — genWrapper + esbuild resolve seam

The injected resolve seam (FUI analog of serveCompiled): resolve a block's CEM declaration -> genWrapper(decl, react|vue) -> esbuild JSX->ESM -> {code, language, producerVersion}. Home fui:tools/maas/. Demo: unit test that react-wrapper + vue-wrapper emit valid ESM.

## Progress

Shipped `fui:tools/maas/produceWrapperBytes.mjs` — the wrapper-bytes producer (FUI analog of
serveCompiled, MaaS epic #912): resolves a CEM `custom-element` declaration →
`generateWrapper(decl, react|vue)` (#821) → `esbuild.transform` (JSX/TS → ESM, type-strip) →
`{ code, language: 'js', producerVersion }`. `produceWrapperBytesFor(manifest, tagName, target)` is the
resolve-by-tag convenience a `serve()` routes through; `PRODUCER_VERSION` is the cache key. Pure
data-in/bytes-out, no DOM/FUI import. Unit test `fui:tools/maas/__tests__/produceWrapperBytes.test.mjs`
(4 green): react + vue wrappers emit valid type-stripped ESM (no TS syntax survives, correct framework
body + import), unknown-target rejects, manifest resolve-by-tag works. FUI `check:standards` 0 errors.
