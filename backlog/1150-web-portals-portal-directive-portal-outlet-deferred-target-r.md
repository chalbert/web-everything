---
kind: story
size: 8
parent: "1001"
status: resolved
blockedBy: ["1148", "1149"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:plugs/webportals/PortalDirective.ts"
relatedProject: webportals
tags: [webportals, build]
---

# Web Portals — portal directive + portal-outlet + deferred target resolution

Slice of #1001 (after #1148/#1149): the high-level API, built in `we:plugs/webportals/`. `PortalDirective` extends `CustomTemplateDirective` — `target`/`disabled`/`required`; resolves the outlet (present→attach; absent→deferred-by-default attach-or-observe via the shared root `InjectorRoot` observer; `required`→synchronous throw; unresolved warned at a STRUCTURAL trigger, DOMContentLoaded / one rAF, never a wall-clock timeout), sets `logicalParent` to the declaration element, wires event proxying (retarget host = declaration element), cleans up on disconnect. Plus the `portal-outlet` element (ordered portals + `onportalchange`) and the `disabled` in-place fallback. Fork-4 residual: confirm the `InjectorRoot` observer is document-rooted; if subtree-scoped add ONE timer-free root-level fallback (never one per portal). Per #1000 Fork 4.

## Resolution

Built in `we:plugs/webportals/`, per the ratified #1000 Fork 4 contract:

- **`PortalDirective`** (`we:plugs/webportals/PortalDirective.ts`) — a `<template is="portal-directive">` customized built-in extending `CustomTemplateDirective`, with reflected `target`/`disabled`/`required`. `connectedCallback` projects the template content into the resolved outlet; each projected top-level node gets `logicalParent = <the directive>` (the declaration element), which is what wires logical event retargeting via the #1149 layer. `disconnectedCallback` withdraws the nodes, clears logical links, and notifies the outlet; `attributeChangedCallback` re-evaluates placement.
- **Resolution semantics** — outlet PRESENT → attach immediately; ABSENT + `required` → synchronous `NotFoundError` `DOMException`; ABSENT (default) → deferred-by-default via ONE shared, document-rooted `MutationObserver` (never one per portal), with an unresolved warning at a STRUCTURAL trigger (`DOMContentLoaded`, else one `requestAnimationFrame`, else a microtask fallback) — never a wall-clock timeout.
- **`disabled` in-place fallback** — content renders at the declaration site (no portalling, outlet untouched).
- **`portal-outlet`** (`we:plugs/webportals/PortalOutlet.ts`) — tracks the ordered (attach-order) portal list via `registerPortal`/`unregisterPortal`, fires `portalchange`, and exposes the `onportalchange` IDL event-handler attribute (backed by `addEventListener` — browser-correct; a jsdom/happy-dom auto-wire quirk is documented).
- **Elements defined** via the separate, idempotent, irreversible `definePortalElements()` (also called by `applyPatches()`), kept off the reversible patch pair.

**Fork-4 residual resolved:** the sibling `InjectorRoot` observer IS document-rooted — `observer.observe(document.body, { subtree: true, childList: true })` (`we:plugs/webinjectors/InjectorRoot.ts:474`). So the deferred path uses one shared document-rooted observer here too; no per-portal fallback needed.

Covered by `we:plugs/webportals/__tests__/unit/webportals.portal.test.ts` (10 tests: present-attach, logical-parent wiring, deferred-then-resolve, `required` throw, `disabled` in-place, disconnect cleanup, ordered `portalchange`, `onportalchange`, structural-trigger warning). Full webportals suite green (36 tests).
