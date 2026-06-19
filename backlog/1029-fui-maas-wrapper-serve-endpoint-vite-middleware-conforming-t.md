---
type: idea
workItem: story
size: 5
parent: "912"
status: open
dateOpened: "2026-06-19"
locus: frontierui
relatedProject: webdocs
tags: [webdocs, block-explorer, maas, polyglot]
---

# FUI /_maas/ wrapper-serve endpoint — Vite middleware conforming to servePathIR

FUI Vite configureServer middleware serving generated React/Vue wrappers conforming to the servePathIR + maas-versioning contract (302 floating→pin ladder, content-hash + SRI, X-MaaS-* headers, error set), running the fui:tools/gen-wrapper/genWrapper.mjs generator + esbuild; own conformance test against the we:blocks/renderers/module-service/servePathIR.ts contract.
