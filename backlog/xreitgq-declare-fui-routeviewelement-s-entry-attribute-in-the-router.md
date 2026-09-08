---
kind: task
parent: "3194"
status: open
scope: ["we:src/_data/blocks/router.json"]
dateOpened: "2026-09-07"
tags: []
---

# Declare FUI RouteViewElement's entry attribute in the router block vocabulary

we:blocks/router/elements/RouteViewElement.ts (frontierui repo) gained an entry attribute (#365 entry-URL normalization, ported by #3194) added to static observedAttributes and implemented as a getter + normalization, but shipped as an impl affordance only — #3194's scope was the four frontierui router files, not the block's declared vocabulary/schema file we:src/_data/blocks/router.json, which lists scroll/base/transition/keep-alive/name/route/route:*/lazy but not entry. Tooling that derives the block's public attribute surface from that declared vocabulary (editor autocomplete, generated docs, schema validation of <route-view> usage) cannot discover entry. Add entry to the declared vocabulary in we:src/_data/blocks/router.json and regenerate any docs it feeds, so the contract surface matches the runtime. Schema/documentation-surface fix, not a runtime behavior change. While touching this file, audit for any other undeclared RouteViewElement attributes.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
