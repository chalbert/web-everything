---
kind: story
size: 5
parent: "2005"
status: resolved
blockedBy: ["2063"]
dateOpened: "2026-07-01"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
graduatedTo: none
tags: []
---

# Node reference SSR renderer for directive regions — DOM-shim then serialize, behind a swappable ServerRenderer seam

Second slice of the SSR surface (per #2030). Ship the Node/JS reference renderer that expands comment-anchor directive regions server-side and emits the WE-standard wire format (#2063). Strategy (recorded, deps/perf axis, later-optimizable): build the region tree via a lightweight DOM shim (linkedom-class) so the existing upgrade/stamp/inspector code runs unchanged, then serialize — reuses the JS client so server+client can't drift. Sits behind a swappable ServerRenderer seam so a zero-dep string renderer or a non-JS renderer drops in without touching callers. MUST pass the #2063 conformance vectors byte-for-byte; it is the vector oracle. The reuse-the-client win is JS-only, not portable.

## Resolved (batch-2026-07-02-2113-2136) — Node reference renderer shipped in FUI, graded byte-for-byte against the #2063 vectors

The renderer is FUI impl code (WE #6 — WE ships NO renderer; it already owns the wire format + golden vectors from #2063). Deliverables, all under `frontierui:plugs/webdirectives/ssr/`:

- **Swappable `ServerRenderer` seam** (`frontierui:plugs/webdirectives/ssr/ServerRenderer.ts`) — a pure `(authoring source + render data) → wire-format HTML string` function type. The wire format is the swap boundary (#2030): a zero-dep string renderer or a per-language native (#2069) drops in behind the same caller. Purity is the contract, so the renderer is a stable oracle.
- **Node reference renderer** (`frontierui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts`) — the DOM-shim strategy the item recorded, realized with `happy-dom` (already a FUI dep; `linkedom` not needed). Parses the authoring `<template is=…>` source through the shim (real HTML-parser + serialization semantics — attribute insertion order + quoting match the goldens exactly, so building each item row as a DOM node and reading `outerHTML` yields byte-exact output), expands the live branch, and wraps it in the normative space-padded `<!-- ns:name … -->` … `<!-- /ns:name -->` markers. Covers all 7 vector directives: `for-each` (keyed + empty), `if`, `switch`/`case`, `resource:loader`, `defer` (placeholder branch only). Emits `data-key` as the only key channel; keeps resume tokens (`condition`, `value`, …) in the open marker; never serializes raw data into comment text.
- **Conformance test — the vector oracle** (`frontierui:plugs/webdirectives/ssr/__tests__/nodeReferenceRenderer.conformance.test.ts`) — grades the renderer's emitted string against the WE-owned `@webeverything/conformance-vectors/webdirectives-ssr` golden `expectedHtml` **byte-for-byte** for every vector, plus the WE structural-validator pass and a purity check. 9/9 green. WE owns the vectors + validator; FUI owns the bytes, so server + client can't drift.
- Wiring: exported from `frontierui:plugs/webdirectives/index.ts`; a vitest alias for the SSR vectors subpath added to `frontierui:vitest.config.ts`. FUI `check:standards` green (0 errors); WE `check:standards` green (0 errors).
