---
kind: story
size: 8
parent: "142"
status: resolved
locus: plateau-app
dateOpened: "2026-06-23"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
graduatedTo: 142
tags: []
---

# Live-element to declaration/source/owner resolver (dev browser)

The shared resolution layer the resolver-trio rides: given a clicked/selected live element in a running WE app, resolve it through the declared model (which intent/component/provider/rule produced it) to its declaration, source file:line, and owner. Built once, consumed by jump-to-source (#1652), semantic search hit-resolution (#1651), and the explain-this-element inspector (#1634). Stack-agnostic via the declared model, not a framework fiber tree. Home plateau:dev-browser.

## Progress (batch-2026-06-26-1745-1775)

Built the shared resolution layer the resolver-trio rides on (#1652 jump-to-source, #1651 semantic-search,
#1634 explain-this — none built yet). Stack-agnostic via the **declared model** (declared attributes +
registries, NOT framework fibers); composes existing pieces and builds only the owner resolver + orchestrator.
- `plateau:src/dev-browser/element-resolver/owner.ts` — `resolveElementOwner`: walks UP from a live element
  (crossing shadow boundaries via the host) to the nearest declared `data-we-owner` (+ `data-we-owner-kind`),
  returning a `ReproOwnershipEntry` (#1664 shape) with a stable `nodeId` locator (the #575 source-anchor id
  when present, else a tag + nth-of-type path).
- `plateau:src/dev-browser/element-resolver/index.ts` — `resolveElementDeclaration(element, opts)`: composes
  the **declaration** (tag + constructor + the intent profile at the nearest declaring scope, via the #1657
  intent-inspector), the **source** `file:line` (via the #575 `resolveNodeSource` anchor chain,
  `@webeverything/source-resolution`), the **owner** (above), and the **declared rules** the owning app
  enforces (via the #1689 `DeclaredRuleRegistry`). Every field degrades INDEPENDENTLY — a partial declared
  model still yields a useful resolution.
- `plateau:src/dev-browser/element-resolver/element-resolver.test.ts` — 7 tests (owner walk + shadow cross,
  source-anchor locator, full compose, independent degradation, registry-optional).
- `plateau:vite.config.mts` / `plateau:tsconfig.json` / `plateau:vitest.config.ts` — added the
  `@webeverything/source-resolution` alias (the #575 resolver chain the resolver composes).

Gate: plateau-app `vitest run` 578 pass; tsc clean for the new module. The three consumers (#1652/#1651/#1634)
now compose this one result.
