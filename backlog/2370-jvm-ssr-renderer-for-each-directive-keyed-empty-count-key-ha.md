---
kind: story
size: 3
parent: "2355"
status: open
blockedBy: ["2368"]
dateOpened: "2026-07-09"
tags: []
---

# JVM SSR renderer: for-each directive (keyed + empty + count/key-hash state tokens)

Add the for-each directive to the JVM renderer (rides slice A's scaffold): item expansion with data-key as the only key channel, empty-list markers-only region, and the bounded in-marker state tokens count + key-hash. Ports the DJB2 key-hash with the normative UTF-16-code-unit input subtlety (astral chars as surrogate pairs) pinned in we:conformance-vectors/webdirectives-ssr-harness-contract.md, so non-ASCII keys never diverge from expectedHtml. Demo: passes for-each vectors byte-for-byte. Mirrors the Node reference oracle at frontierui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts. Fork-free build (#2030 black box).
