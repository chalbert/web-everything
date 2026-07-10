---
kind: story
size: 3
parent: "2360"
status: open
blockedBy: ["2383"]
dateOpened: "2026-07-10"
tags: []
---

# Native .NET SSR renderer: for-each directive (keyed + empty + count/key-hash state tokens)

Add the for-each directive to the .NET renderer (rides slice A's scaffold): item expansion with data-key as the only key channel, empty-list markers-only region, and the bounded in-marker state tokens count + key-hash. Ports the DJB2 key-hash directly — C# string is natively UTF-16 code units (like the JS oracle), so no extra re-encoding step is needed for the normative UTF-16-code-unit hash input (astral chars as surrogate pairs) pinned in we:conformance-vectors/webdirectives-ssr-harness-contract.md, so non-ASCII keys never diverge from expectedHtml. Demo: passes for-each vectors byte-for-byte. Mirrors the Node reference oracle at frontierui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts. Fork-free build (#2030 black box).
