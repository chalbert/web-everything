---
bornAs: x2evydc
kind: story
size: 5
parent: "2356"
status: open
dateOpened: "2026-07-28"
tags: []
---

# Native Go SSR renderer foundation + if/switch directives

Stand up the greenfield Go build subtree (frontierui:plugs/webdirectives/ssr/go/) for the native SSR renderer: source parse (golang.org/x/net/html tokenizer/parser, mirroring the Node happy-dom strategy — the parser choice is a conforming black box per #2030, not a fork) + top-level template-is dispatch loop + normative space-padded marker wrapping + renderMarkerOptions + shared helpers (resolvePath, mustache interpolate), plus the Go-side cross-language conformance harness runner that reads we:conformance-vectors/webdirectives-ssr.vectors.json and byte-compares per the #2354 contract, wired into go test + repo CI. Includes if + switch (share interpolate innerHtml, resume tokens ride generic renderMarkerOptions) to prove the pipeline end-to-end. Demo: passes if, switch, state-tokens vectors byte-for-byte. Mirrors the Node reference oracle at frontierui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts. Fork-free build (#2030 black box). The foundational slice B/C ride on.
