---
kind: task
parent: "1684"
status: open
blockedBy: ["1736"]
dateOpened: "2026-06-24"
tags: []
---

# webrouting IA nav-tree emitter

we:webrouting — derive a hierarchical information-architecture nav-tree (nested menu / breadcrumb structure, mirroring @11ty/eleventy-navigation) from the route-map projection. Per #1688 Fork 2 (a), the emitter REALIZES the Navigation Intent structure axis (we:src/_data/blocks/router.json:146) rather than re-deriving an independent tree — one composed home, no second source of truth for the nav hierarchy; it falls back to pure path-nesting only when no navigation intent is declared. Pattern-preserving: consumes the /users/:id template form directly, needs no concrete URLs. Ships derivation + conformance vectors. Blocked by #1736. Codified in #faithful-derivation-exclude-not-fabricate.
