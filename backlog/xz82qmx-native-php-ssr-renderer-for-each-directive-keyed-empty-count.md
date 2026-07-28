---
kind: story
size: 3
parent: "2357"
status: open
blockedBy: ["xofezqc"]
dateOpened: "2026-07-28"
tags: []
---

# Native PHP SSR renderer: for-each directive (keyed + empty + count/key-hash state tokens)

Add the for-each directive to the PHP renderer (rides slice A's scaffold): item expansion with data-key as the only key channel, empty-list markers-only region, and the bounded in-marker state tokens count + key-hash. Ports the DJB2 key-hash with the normative UTF-16-code-unit input subtlety (astral chars as surrogate pairs) pinned in we:conformance-vectors/webdirectives-ssr-harness-contract.md — PHP strings are raw UTF-8 bytes, so the hash input must be re-encoded to UTF-16 code units (mb_convert_encoding to UTF-16LE, iterate 16-bit units) before hashing so non-ASCII keys never diverge from expectedHtml. Demo: passes for-each vectors byte-for-byte. Mirrors the Node reference oracle at frontierui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts. Fork-free build (#2030 black box).
