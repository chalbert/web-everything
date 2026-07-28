---
bornAs: x2m32h6
kind: story
size: 5
parent: "2358"
status: open
scope:
  - frontierui:plugs/webdirectives/ssr/rust/
  - frontierui:.github/workflows/ci.yml
scopeRationale: "Greenfield: stands up a whole new language subtree (frontierui:plugs/webdirectives/ssr/rust/) from scratch — a genuinely dir-spanning build whose exact file set is created here, so a file-level enumeration would under-scope and breach the lease. Mirrors the .NET foundation #2383 scope. The only shared-file touch is frontierui:.github/workflows/ci.yml (adds the Rust conformance-harness CI step, alongside the existing JVM step)."
dateOpened: "2026-07-28"
tags: []
---

# Native Rust SSR renderer foundation + if/switch directives

Stand up the greenfield Rust build subtree (frontierui:plugs/webdirectives/ssr/rust/) for the native SSR renderer: source parse (html5ever/scraper, the Servo HTML5 parser, mirroring the Node happy-dom strategy — the parser choice is a conforming black box per #2030, not a fork) + top-level template-is dispatch loop + normative space-padded marker wrapping + renderMarkerOptions + shared helpers (resolve_path, mustache interpolate), plus the Rust-side cross-language conformance harness runner that reads we:conformance-vectors/webdirectives-ssr.vectors.json and byte-compares per the #2354 contract, wired into cargo test + repo CI. Includes if + switch (share interpolate innerHtml, resume tokens ride generic renderMarkerOptions) to prove the pipeline end-to-end. Demo: passes if, switch, state-tokens vectors byte-for-byte. Mirrors the Node reference oracle at frontierui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts. Fork-free build (#2030 black box). The foundational slice B/C ride on.
