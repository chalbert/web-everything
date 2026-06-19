---
type: idea
workItem: story
size: 13
parent: "912"
status: open
dateOpened: "2026-06-19"
locus: frontierui
relatedProject: webdocs
tags: [webdocs, block-explorer, maas, polyglot]
---

# FUI /_maas/ wrapper-serve endpoint — Vite middleware conforming to servePathIR

FUI Vite configureServer middleware serving generated React/Vue wrappers conforming to the servePathIR + maas-versioning contract (302 floating→pin ladder, content-hash + SRI, X-MaaS-* headers, error set), running the fui:tools/gen-wrapper/genWrapper.mjs generator + esbuild; own conformance test against the we:blocks/renderers/module-service/servePathIR.ts contract.

## Re-sized 5 → 13 + released (batch-2026-06-18 pre-flight)

Claimed in batch-2026-06-18; on reading the full `we:blocks/renderers/module-service/servePathIR.ts`
contract, the one-line body materially under-estimates the work. The handler must implement all **6**
enumerated responses (200 hash-pin + ETag + SRI + producer / 302 floating→pin / 304 If-None-Match / 400
unknown-form / 404 / 500), integrate `fui:tools/gen-wrapper/genWrapper.mjs` + esbuild, and content-hash /
SRI / ETag each artifact — plus a full 6-response conformance test against `SERVE_PATH` (~250 lines,
correctness-sensitive). It also carries an **unspecified design point**: the 302 floating→pin ladder needs
a current-hash *resolution* mechanism (regenerate-and-hash on every floating hit vs cache the
current-artifact id) that the body does not pin down. That is a focused single-item (with a small design
nod), not a batch-packable size-5 slice. Released for a focused session; the design point should be settled
first (or carved to a `type:decision`).
