---
kind: epic
status: open
dateOpened: "2026-06-20"
tags: [blocks, duplication, drift, single-source, frontierui, maintenance, runtime]
relatedProject: webblocks
---

# Reference-runtime blocks (router, navigation, …) are duplicated and drifting between WE and FUI

The blocks kept in WE per [#697](/backlog/697-delete-we-s-vendored-blocks-and-repoint-we-imports-build-to-/)
still exist as full runtime in **both** WE and FUI, with no import seam and no drift gate — they silently
desync. This is the [#170](/backlog/170-plugs-duplicated-across-webeverything-frontierui/) hazard, but for
`blocks/` instead of `plugs/`, and it is currently **untracked**.

## Live evidence (the motivating bug, 2026-06-20)

plateau-app's routing was fully broken on client-side navigation: clicking a sidebar link changed the URL
but the view never swapped, and the 404 ("Page Not Found") template stamped onto every page. Root cause: the
app runs **FUI's** copy of the router (`@frontierui/plugs/bootstrap` → `fui:blocks/router`), which had
drifted behind WE's source on two fixes that landed only in `we:blocks/router`:

- **catch-all guard** — `we:blocks/router/types.ts` `matchAllRoutes` skips later in-place matches (the `/*`
  fallback); the FUI copy lacked it, so `/*` stamped on every route.
- **#423 accumulate-vs-overwrite** — `we:blocks/router/elements/RouteViewElement.ts` `#stampAllRoutes`
  uses `#stampedContent.push(...)`; the FUI copy did `= nodes`, orphaning the first of multiple stamps so
  old views could never be un-stamped → content piled up across navigations.

Hotfixed both into `fui:blocks/router/` (2 edits; 83/83 FUI router tests + live browser pass). That fix is a
**band-aid on an unsourced duplicate** — nothing prevents the next divergence.

## Scope — the duplicated reference-runtime families

`#697` only ever classified the **block-impl** families (MOVE vs STAY). The **reference-runtime STAY subset**
was never deduped and is what drifts. Duplicated `blocks/` dirs present in both `we:blocks/` and `fui:blocks/`
(2026-06-20): `router`, `navigation`, `parsers`, `text-nodes`, `for-each`, `transient`, `attributes`,
`draft-persistence` (plus the STAY families `#697` named: `view`, `tabs`, `wizard`, `workflow-engine`,
`resource-loader`, `data-transfer`, `renderers/*`, `stores/simple`). The copies have **already diverged on
multiple files** (router alone: all 5 source files differ — import style `@frontierui/plugs/*` vs relative,
`we-route-view` tag defaults, the `registerRouteView/Outlet` split, plus WE's #365 `entry`-URL normalization
and the `RoutePrefetchBehavior` viewport-presence refactor missing in FUI).

## Canonical home — RESOLVED by [#1246](/backlog/1246-canonical-home-for-the-reference-runtime-stay-subset-blocks-/) (2026-06-20)

**Ruling: WE holds zero implementation — delete *all* WE block runtime copies; FUI is the sole home.**
Codified `we:docs/agent/platform-decisions.md#constellation-placement` (rule 1 reference-impl tier
*withdrawn*) + `#we-fui-embed-boundary` (rule 4 reference-vs-impl partition *withdrawn*); reverses #1078
+ #697. The "reference-runtime stays in WE" premise this epic was built on is gone — so the duplication
is resolved by **elimination, not by a dedup-to-track + drift-gate**. Consequences for this epic:

- **There is no second copy to keep in sync** → the drift gate (old step 3) is **moot**; with one home
  there is nothing to drift. (The `#659` gate still hard-fails a *missing* FUI impl — unchanged.)
- The ~14 WE demos/tests that consume the WE copies today (`we:plugs/bootstrap.ts` + `we:demos/*` +
  `we:blocks/__tests__/unit/*`) lose their in-repo runtime, so their consumption must **relocate**, not
  break — that relocation is the bulk of the new work.

## Re-scoped plan (per the #1246 ruling)

1. **Delete the 16 WE block runtime copies** (`we:blocks/{router,navigation,parsers,text-nodes,for-each,
   transient,attributes,draft-persistence,view,tabs,wizard,workflow-engine,resource-loader,data-transfer,
   renderers,stores}/`), leaving the WE-side **protocol spec + conformance vectors + types** only. FUI is
   canonical (every block already declares `implementedBy: @frontierui/…`).
2. **Re-host the consuming demos as FUI-hosted** — the ~14 `we:demos/*` + `we:plugs/bootstrap.ts`-driven
   pages become **FUI-hosted demos embedded via the #701 `fuiDemo` iframe** (or consumed as a mode-C
   runtime URL-bundle per `#we-fui-embed-boundary` rule 6); `we:plugs/bootstrap.ts` itself follows the
   runtime to FUI (the #606 move it was a leftover of).
3. **Convert the WE block unit tests to conformance vectors** (`we:blocks/__tests__/unit/{parsers,
   text-nodes,…}` → WE-owned vector data executed FUI-side, per #817/#899) — WE keeps the *vectors*, FUI
   runs them against its impl.
4. **Router first** (live evidence, load-bearing): its WE copy + the #365/#423 deltas already landed
   FUI-side (the 2026-06-20 hotfix), so deleting `we:blocks/router/` is now safe and removes the
   recurrence surface for that bug class outright.

## Slices — sliced 2026-06-20 (`/slice 1245`, post-#1246)

Investigation of the **real runtime import graph** (code imports, not the doc-text refs the Scope section
counts) split the work into *deliverable-in-WE-now* vs *gated-on-FUI-build*. Full analysis:
`we:reports/2026-06-20-backlog-split-analysis.md` (§"RE-RUN — post-#1246").

**Carved (deliverable now — independent, batchable):**
- **A — delete `we:blocks/draft-persistence/`** ([#1310](/backlog/1310-delete-we-blocks-draft-persistence-runtime-copy-fui-canonica/)) — 0 runtime importers, 0 unit tests, FUI canonical.
- **B — delete `we:blocks/data-transfer/`** ([#1311](/backlog/1311-delete-we-blocks-data-transfer-runtime-copy-fui-canonical/)) — same shape.
- **C — pilot block-test → conformance-vector conversion on `text-nodes`** ([#1312](/backlog/1312-pilot-block-unit-test-to-conformance-vector-conversion-text-/)) — establishes the
  vector pattern items (a)/(d) below reuse; does *not* delete runtime yet.

**Deferred — could-not-split-here (gated on FUI build, not a decision — re-`/slice` as each gate clears):**
- **7 bootstrap families** (`router`, `navigation`, `parsers`, `text-nodes`·runtime, `for-each`,
  `transient`, `attributes`) — imported only by `we:plugs/bootstrap.ts`; the embed boundary
  (`we:docs/agent/platform-decisions.md#we-fui-embed-boundary`) forbids repointing WE at `@frontierui/*`,
  so they can drop only after FUI hosts the ~12 bootstrap-consuming demos and `we:plugs/bootstrap.ts`
  relocates (#606). Then bulk-delete in one follow-up.
- **`wizard`+`workflow-engine`, `resource-loader`, `stores`, `renderers` (×11 demos)** — deleting breaks the
  consuming demo and no FUI-hosted equivalent exists yet. Action: FUI builds each hosted demo → WE swaps the
  local page to a `#701 fuiDemo` iframe → delete the family. One slice per demo as FUI ships it.
- **`view`+`tabs`** — **carved (now unblocked)** as [#1326](/backlog/1326-delete-we-blocks-view-tabs-runtime-copies-swap-we-view-tabs-/): **C** (#1312) has landed and
  `fui:demos/view-tabs-demo.html` self-bootstraps for iframe embed, so deleting `we:blocks/{view,tabs}` +
  swapping `we:demos/view-tabs-demo.html` to a `#701 fuiDemo` iframe is now deliverable.

The `#701 fuiDemo` iframe vs mode-C URL-bundle choice is a **settled per-demo menu**
(`#we-fui-embed-boundary` rule 6), not an open fork — no decision card.
