---
kind: story
size: 5
parent: "2005"
status: open
blockedBy: ["2063"]
dateOpened: "2026-07-01"
tags: []
---

# Node reference SSR renderer for directive regions — DOM-shim then serialize, behind a swappable ServerRenderer seam

Second slice of the SSR surface (per #2030). Ship the Node/JS reference renderer that expands comment-anchor directive regions server-side and emits the WE-standard wire format from #2063. Strategy (recorded, deps/perf axis, later-optimizable): (a) build the region tree via a lightweight DOM shim (linkedom-class) so the existing upgrade/stamp/inspector code runs unchanged, then serialize — reuses the JS client so server+client can't drift. Put it behind a swappable ServerRenderer seam so a zero-dep string renderer (b) or a non-JS renderer drops in without touching callers. MUST pass the #2063 conformance vectors byte-for-byte (markers incl. space-padding). This renderer is the vector oracle. The reuse-the-client win is JS-only and does not port to other languages.
