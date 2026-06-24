---
kind: story
size: 5
parent: "1684"
status: open
blockedBy: ["1725", "1721"]
dateOpened: "2026-06-24"
tags: []
---

# webrouting route-config schema + conformance vectors

Build the webrouting route-config schema (the #1687 ruling's serializable settings) and its WE conformance vectors. The schema admits every route-config setting with merit + real-app use, placed by serializability: app-global deploy-shaped settings (base, history mode, prerender, 404 fallback, trailing-slash, redirects/aliases, locale-prefix, case-sensitivity) as webeverything.config.* fields; per-route settings (lazy, scroll policy) as route-entry fields; a named vocabulary unifies the router block's already-owned base/scroll/lazy. Conformance vectors lock the shape, presentation-free, for any conforming generator. Code-shaped forms (scrollBehavior fn, per-route import) stay on the block, out of scope.
