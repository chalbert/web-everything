---
bornAs: xbadbhx
kind: story
size: 3
parent: "2356"
status: open
blockedBy: ["2755"]
dateOpened: "2026-07-28"
tags: []
scope:
  - frontierui:plugs/webdirectives/ssr/go/renderer.go
  - frontierui:plugs/webdirectives/ssr/go/conformance_test.go
---

# Native Go SSR renderer: for-each directive (keyed + empty + count/key-hash state tokens)

Add the for-each directive to the Go renderer (rides slice A's scaffold): item expansion with data-key as the only key channel, empty-list markers-only region, and the bounded in-marker state tokens count + key-hash. Ports the DJB2 key-hash with the normative UTF-16-code-unit input subtlety (astral chars as surrogate pairs) pinned in we:conformance-vectors/webdirectives-ssr-harness-contract.md — Go strings are UTF-8, so the hash input must be re-encoded to UTF-16 code units (utf16.Encode over the rune slice) before hashing so non-ASCII keys never diverge from expectedHtml. Demo: passes for-each vectors byte-for-byte. Mirrors the Node reference oracle at frontierui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts. Fork-free build (#2030 black box).

_Scope build-gated on #2755 (per `blockedBy`)_: the Go renderer source (`renderer.go`) the foundation scaffolds + the Go `conformance_test.go` harness — a distinct backlog file, so scope-able now while the build rides the foundation subtree.
