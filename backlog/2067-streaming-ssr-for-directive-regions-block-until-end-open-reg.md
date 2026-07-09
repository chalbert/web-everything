---
kind: story
size: 3
parent: "2005"
status: resolved
blockedBy: ["2066"]
dateOpened: "2026-07-01"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
graduatedTo: "fui:plugs/webdirectives/CustomCommentRegistry.ts"
tags: []
---

# Streaming SSR for directive regions — block-until-:end open-region adoption (+ defer-dimension gated on #1977)

Fifth slice of the SSR surface (per #2030). For open regions whose closing marker hasn't yet arrived in the byte stream, the client blocks until the :end marker before reconstructing/adopting — matching the inspector's complete-pair assumption; the server may still stream earlier regions first (loading template first). Conservative, always-consistent default; progressive open-region adoption is a larger mechanism deferred until a real large-region case demands it. SEPARATE sub-part — the eager/deferred hydration dimension (per-region hydrate-on-trigger reusing #2066 + #1977 defer triggers) is gated on #1977 landing; split it out when #1977 resolves rather than assuming it here.
