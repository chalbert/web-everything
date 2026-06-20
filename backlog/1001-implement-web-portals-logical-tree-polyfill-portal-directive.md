---
kind: epic
status: resolved
blockedBy: []
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:plugs/webportals/PortalDirective.ts"
relatedProject: webportals
tags: [webportals, build]
---

# Implement Web Portals — logical-tree polyfill + portal directive

Umbrella for building the webportals protocol now that its shape is ratified (#1000). Surfaced by #993:
the spec (`we:src/_includes/project-webportals.njk`) had zero implementation. **Unblocked 2026-06-19**
(#1000 resolved), then **sliced into the five batchable children below.** This epic resolves only when
all five resolve (no-open-slice guard) — it carries no direct build work itself.

## Carved slices (2026-06-19)

| # | Slice | Size | Blocked by |
|---|-------|------|-----------|
| [#1148](1148-web-portals-logical-tree-polyfill-node-logicalparent-logical.md) | Logical-tree polyfill — `Node.logicalParent` / `logicalInjector` / `logicalAncestors()` / `isLogicalDescendantOf()`, logical-ancestry `getContext()` | 5 | — (ready) |
| [#1149](1149-web-portals-logical-event-propagation-composedlogical-logica.md) | Logical event propagation — `composedLogical` + `composedLogicalPath()`, pre-retarget `logicalPath`, `stopLogicalPropagation()` | 5 | #1148 |
| [#1150](1150-web-portals-portal-directive-portal-outlet-deferred-target-r.md) | Portal directive + `portal-outlet` + deferred target resolution (Fork-4 residual) | 8 | #1148, #1149 |
| [#1151](1151-web-portals-ssr-contract-conformance-vectors-logical-positio.md) | SSR contract conformance vectors (logical-position emit + hydration relocate) | 3 | #1150 |
| [#1152](1152-web-portals-conformance-demo-overlay-modal-tooltip-escape-lo.md) | Conformance demo — overlay/modal/tooltip escape + context + logical bubbling | 5 | #1150 |

**Placement (corrected at carve).** This is *not* a webportals-specific WE-vs-FUI fork. The impl is a
sibling plug to `webdirectives` / `webinjectors` / `webcontexts` and extends their classes
(`CustomTemplateDirective`, `InjectorRoot`, the `Node.*.patch.ts` pattern), all of which live and run in
`we:plugs/` today. So webportals is built in **`we:plugs/webportals/`** now (runnable + demoable on WE's
dev server) and rides the **same plugs-platform-layer migration as every sibling** — the WE→FUI move
governed by the [Constellation placement](docs/agent/platform-decisions.md#constellation-placement) rule (#170 / #449 / #606: plugs = FUI-owned, WE consumes as a no-leakage client). The protocol/spec
stays `@webeverything` (the ratified `.njk` + conformance vectors). The earlier "directive runtime → FUI"
line is superseded: the directive is a plug like its siblings, not a webportals-specific FUI carve-out.

## Ratified contract shape (from #1000, 2026-06-19)

The four open questions are settled (spec edits applied to `we:src/_includes/project-webportals.njk`):

- **`logicalParent`** — a **writable element-reference property** (mirroring `popoverTargetElement`)
  reflecting a declarative `logicalparent="id"` IDREF attribute; the setter validates the graph
  (`HierarchyRequestError` on a cycle), detaches from the prior logical parent, and fires
  `logicalparentchange`. No `setLogicalParent()` method. `logicalAncestors()`/`logicalInjector` stay
  read-only.
- **Logical events** — a **separate** opt-in `composedLogical` flag + `composedLogicalPath()` (never an
  overload of native `composed`); `logicalPath` computed **pre-retarget**; the retarget host at a logical
  hop is the **declaration element** (not the mount/outlet), so `event.target` stays in the listener's
  logical tree.
- **Focus** — **not** a portal concern; compose the [Focus Containment Intent](/intents/focus-containment/)
  (no `focusscope`/`createFocusScope`).
- **Deferred targets** — **deferred-by-default** (attach-or-observe); diagnostic at a **structural**
  trigger (DOMContentLoaded / one `requestAnimationFrame`), **not** a wall-clock timeout; a `required`
  attribute opts into a synchronous throw.

**Impl residual to verify (Fork 4):** confirm the shared root `InjectorRoot` `MutationObserver` is
**document-rooted** — i.e. it sees a target appended to `document.body` by unrelated code. If it is
subtree-scoped, add **one** timer-free root-level fallback observer (never one observer per portal). This
is the only sub-decision left to the build; it does not change the contract.
