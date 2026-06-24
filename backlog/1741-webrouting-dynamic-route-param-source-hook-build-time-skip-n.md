---
kind: story
size: 2
parent: "1684"
status: open
blockedBy: ["1736"]
dateOpened: "2026-06-24"
tags: []
---

# webrouting dynamic-route param-source hook + build-time skip notice

we:webrouting — the opt-in enumeration contract from #1688 Fork 1 (a). Define the author-supplied per-route param-source hook (generateStaticParams-shaped) that lets concrete-URL emitters (sitemap #sibling, prerender #sibling) enumerate parametric routes (/users/:id → /users/1, /users/2) from a real value source — never fabricated. Additive: emitters ship exclude-by-default first; this layers the enumeration capability they opt into. Also defines the build-time skip notice surfacing each parametric route a concrete-URL emitter omits for lack of a source (ergonomic, changes no artifact). Ships contract + conformance vectors. Blocked by the emitter registry+builder (#1736). Codified in #faithful-derivation-exclude-not-fabricate.
