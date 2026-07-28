---
bornAs: xslvqcn
kind: task
parent: "2358"
status: open
blockedBy: ["2756"]
dateOpened: "2026-07-28"
tags: []
scope:
  - frontierui:plugs/webdirectives/ssr/rust/src/renderer.rs
  - frontierui:plugs/webdirectives/ssr/rust/tests/conformance.rs
---

# Native Rust SSR renderer: resource:loader + defer directives

Add the two passthrough directives to the Rust renderer (rides slice A's scaffold): resource:loader emits the success branch with resolved data inline (zero-JS baseline), defer emits the placeholder branch only (the content branch is stamped client-side). Both are simple inner-branch emits over interpolate. Demo: passes resource-loader + defer vectors byte-for-byte. Mirrors the Node reference oracle at frontierui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts. Fork-free build (#2030 black box).

_Scope build-gated on #2756 (per `blockedBy`)_: the Rust renderer source (`src/renderer.rs`) the foundation scaffolds + the cargo `tests/conformance.rs` harness — a distinct backlog file, so scope-able now while the build rides the foundation subtree.
