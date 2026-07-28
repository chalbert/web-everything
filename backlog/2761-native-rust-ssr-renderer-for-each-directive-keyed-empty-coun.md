---
bornAs: xmeto2s
kind: story
size: 3
parent: "2358"
status: open
blockedBy: ["2756"]
dateOpened: "2026-07-28"
tags: []
---

# Native Rust SSR renderer: for-each directive (keyed + empty + count/key-hash state tokens)

Add the for-each directive to the Rust renderer (rides slice A's scaffold): item expansion with data-key as the only key channel, empty-list markers-only region, and the bounded in-marker state tokens count + key-hash. Ports the DJB2 key-hash with the normative UTF-16-code-unit input subtlety (astral chars as surrogate pairs) pinned in we:conformance-vectors/webdirectives-ssr-harness-contract.md — Rust String/str are UTF-8, so the hash input must be re-encoded to UTF-16 code units (str::encode_utf16) before hashing so non-ASCII keys never diverge from expectedHtml. Demo: passes for-each vectors byte-for-byte. Mirrors the Node reference oracle at frontierui:plugs/webdirectives/ssr/nodeReferenceRenderer.ts. Fork-free build (#2030 black box).
