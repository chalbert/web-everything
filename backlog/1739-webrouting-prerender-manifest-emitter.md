---
kind: task
parent: "1684"
status: open
blockedBy: ["1736"]
dateOpened: "2026-06-24"
tags: []
---

# webrouting prerender manifest emitter

we:webrouting — derive a prerender path-manifest (the list of routes to statically pre-render) from the route-map projection. A facade over routes[].path. Per #1688 Fork 1 (a), parametric routes are excluded by default (never fabricated) with a build-time skip notice; concrete dynamic paths arrive via the opt-in param-source hook, or a crawl-discovery variant consumes the pattern. Ships derivation + conformance vectors. Blocked by the emitter registry+builder (#1736). Codified in #faithful-derivation-exclude-not-fabricate.
