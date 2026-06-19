---
type: idea
workItem: story
size: 3
parent: "1001"
status: open
blockedBy: ["1150"]
dateOpened: "2026-06-19"
relatedProject: webportals
tags: [webportals, build]
---

# Web Portals — SSR contract conformance vectors (logical-position emit + hydration relocate)

Slice of #1001 (after the directive #1150): conformance for the SSR contract (spec §ssr-contract). Web Portals ships NO SSR runtime — it ships the spec — so this slice is WE-owned conformance VECTORS, not a server impl. The contract: server emits portal content at its LOGICAL position wrapped in `<!-- portal:ID -->` markers with `data-portal=ID`; emits the empty `data-portal-target` container; resolves injector context from logical (not target) ancestors; multiple portals to one target order by logical source order; client finds the markers on hydration and relocates into the target. Progressive baseline: zero-JS shows content inline at its logical position.
