---
type: idea
workItem: story
size: 5
status: open
blockedBy: ["562"]
dateOpened: "2026-06-14"
locus: webeverything
tags: [dev-browser, source-awareness, standard, self-description, resolver, source-map]
---

# Source-anchor self-description contract + resolver provider registry (DOM node → file:line)

The keystone build graduating from [#562](562-dev-browser-source-awareness-ide-bridge-map-deployed-dom-bac.md)
(ratified 2026-06-14). Two coupled pieces, both WE-standard-owned (the Plateau dev-browser is the consumer):

1. **Source-anchor self-description contract** — a build-emitted, minification-surviving anchor that maps a
   rendered DOM node back to its source construct. Per #562 Fork 1 (ruling **A**): an **opaque-id `data-*`
   attribute + a separately-served sidecar manifest** (`id → file:line`), authored as an **extension of the
   app's introspectable self-description** (reuse the capability-manifest vocabulary; do **not** coin a
   protocol — no swappable-vendor interop story). **Fixed invariant: emission is opt-in, off by default** — a
   build ships no anchors unless the author enables the flag; the manifest can be access-gated to an authorized
   session.
2. **Resolver provider registry** — a runtime-DI provider set the browser consults, precedence: **build-emitted
   source anchor** (only cold-deployed-capable) → **framework debug metadata** (`__source`/LocatorJS — dev-only,
   React-19-fragile; don't build on framework internals) → **source maps** (ECMA-426; JS-position granularity,
   usually stripped). Degrades to *inert* when none is present.

Grounded in the [`source-awareness-substrate`](/research/source-awareness-substrate/) research topic.
**Constellation:** the anchor contract + resolver registry are the **WE standard** (#475/#091 split). Pairs
with the bridge registry [#576](576-ide-bridge-provider-registry-passive-file-line-jump-file-sys.md); any
resolver composes with any bridge.
