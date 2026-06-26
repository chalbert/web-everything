---
kind: task
parent: "1684"
status: resolved
dateOpened: "2026-06-24"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
graduatedTo: 1684
tags: []
---

# webrouting Speculation-Rules emitter

we:webrouting — derive a native Speculation Rules manifest (`<script type=speculationrules>`) from the route-map projection for declarative prefetch/prerender. Native-first per #1688: the Speculation Rules API is the committed substrate (we:src/_data/blocks/router.json:192), inventing no prefetch format. Pattern-preserving via document rules (`where: { href_matches: /users/* }`) that match in-DOM links by pattern — needs no URL enumeration; a URL-list variant honors Fork-1 exclude-by-default for concrete entries. Ships derivation + conformance vectors. Blocked by #1736. Codified in #faithful-derivation-exclude-not-fabricate.

## Progress

Done (resolved 2026-06-26). A concrete `RouteMapEmitter` over the #1721 route-map, mirroring the sitemap/prerender emitters:

- `we:blocks/router/speculation-rules-emitter.ts` — `createSpeculationRulesEmitter({ action?, eagerness? })` → `SpeculationRulesResult` (`rules`, `json`, `listed[]`, `patterns[]`, `skipped[]`). Emits the **native** Speculation Rules shape (the `<script type="speculationrules">` body): **static** routes → a `list` rule of concrete `urls`; **parametric** routes → a `document` rule whose `where.href_matches` passes the URLPattern template through unchanged (pattern-preserving, no enumeration, never fabricated — single pattern = bare `href_matches`, multiple = `or`); error-boundary routes excluded (surfaced in `skipped`). `action` (prefetch/prerender) + `eagerness` are options.
- `we:blocks/__tests__/unit/route-speculation-rules-emitter.test.ts` — 8 vectors (list/document split + no-fabrication + single-vs-or + boundary exclusion + action/eagerness + valid-JSON + empty-map + registry-peer). 8/8 green.
- Exported from `we:blocks/router/index.ts`; plugs into the #1736 `RouteEmitterRegistry` as a peer.
