---
kind: story
size: 3
parent: "2356"
status: open
blockedBy: ["x2evydc"]
dateOpened: "2026-07-28"
tags: []
---

# Native Go SSR renderer: for-each directive (keyed + empty + count/key-hash state tokens)

Add the for-each directive to the Go renderer (rides slice A's scaffold): item expansion with data-key as the only key channel, empty-list markers-only region, and the bounded in-marker state tokens count + key-hash. Ports the DJB2 key-hash with the normative UTF-16-code-unit input subtlety (astral chars as surrogate pairs) pinned in we:conformance-vectors/webdirectives-ssr-harness-contract.md — Go strings are UTF-8, so the hash input must be re-encoded to UTF-16 code units (utf16.Encode over the rune slice) before hashing so non-ASCII keys never diverge from expectedHtml. Demo: passes for-each vectors byte-for-byte. Mirrors the Node reference oracle at frontierui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts. Fork-free build (#2030 black box).
