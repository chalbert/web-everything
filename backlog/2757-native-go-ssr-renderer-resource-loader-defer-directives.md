---
bornAs: x5zc8zu
kind: task
parent: "2356"
status: open
blockedBy: ["2755"]
dateOpened: "2026-07-28"
tags: []
scope:
  - frontierui:plugs/webdirectives/ssr/go/renderer.go
  - frontierui:plugs/webdirectives/ssr/go/conformance_test.go
---

# Native Go SSR renderer: resource:loader + defer directives

Add the two passthrough directives to the Go renderer (rides slice A's scaffold): resource:loader emits the success branch with resolved data inline (zero-JS baseline), defer emits the placeholder branch only (the content branch is stamped client-side). Both are simple inner-branch emits over interpolate. Demo: passes resource-loader + defer vectors byte-for-byte. Mirrors the Node reference oracle at frontierui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts. Fork-free build (#2030 black box).

_Scope build-gated on #2755 (per `blockedBy`)_: the Go renderer source (`renderer.go`) the foundation scaffolds + the Go `conformance_test.go` harness — a distinct backlog file, so scope-able now while the build rides the foundation subtree.
