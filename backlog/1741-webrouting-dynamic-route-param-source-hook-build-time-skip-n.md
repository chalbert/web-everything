---
kind: story
size: 2
parent: "1684"
status: resolved
dateOpened: "2026-06-24"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
graduatedTo: 1684
tags: []
---

# webrouting dynamic-route param-source hook + build-time skip notice

we:webrouting — the opt-in enumeration contract from #1688 Fork 1 (a). Define the author-supplied per-route param-source hook (generateStaticParams-shaped) that lets concrete-URL emitters (sitemap #sibling, prerender #sibling) enumerate parametric routes (/users/:id → /users/1, /users/2) from a real value source — never fabricated. Additive: emitters ship exclude-by-default first; this layers the enumeration capability they opt into. Also defines the build-time skip notice surfacing each parametric route a concrete-URL emitter omits for lack of a source (ergonomic, changes no artifact). Ships contract + conformance vectors. Blocked by the emitter registry+builder (#1736). Codified in #faithful-derivation-exclude-not-fabricate.

## Progress

Done (resolved 2026-06-26). Emitter-agnostic + additive — no change to the exclude-by-default sitemap (#1737) / prerender (#1739) / speculation-rules (#1740) emitters; this is the layer they opt into:

- `we:blocks/router/param-source.ts` — the contract + the expander. `ParamSource` (a `generateStaticParams`-shaped `(path) => RouteParams[]`), `ParamSourceMap` (keyed by route template), `substituteParams` (named-group + `*` substitution, url-encoded; an unsupplied token is left in place — never a partial fabricated URL), and `expandRouteMap(map, sources)` → `ParamExpansion`. A **sourced** parametric route is replaced by one concrete entry per param set (other fields preserved); an **un-sourced** parametric route stays parametric (so emitters still exclude it) and is surfaced in `skipped` + the build-time `notice`. A source yielding nothing concrete is itself a skip.
- `we:blocks/__tests__/unit/route-param-source.test.ts` — 9 vectors incl. additive composition: feeding the expanded map to the sitemap + prerender emitters now **includes** the sourced routes while un-sourced/boundary stay excluded. 9/9 green (67/67 across the webrouting cluster).
- Exported from `we:blocks/router/index.ts`. **Completes the #1684 emitter family** (registry #1736 · sitemap #1737 · nav-tree #1738 · prerender #1739 · speculation-rules #1740 · param-source #1741).
