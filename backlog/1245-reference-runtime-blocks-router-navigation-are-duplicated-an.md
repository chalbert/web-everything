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
- **6 bootstrap families** (`router`, `parsers`, `text-nodes`·runtime, `for-each`, `transient`,
  `attributes`) — imported only by `we:plugs/bootstrap.ts`; the embed boundary
  (`we:docs/agent/platform-decisions.md#we-fui-embed-boundary`) forbids repointing WE at `@frontierui/*`,
  so they can drop only after FUI hosts the ~12 bootstrap-consuming demos and `we:plugs/bootstrap.ts`
  relocates (#606). Then bulk-delete in one follow-up. **(`navigation` was carved out of this group and
  pulled forward to [#1504](/backlog/1504-cold-start-bootstrap-break-navsectionbehavior-imports-delete/)** —
  its gate cleared early (FUI already hosts `fui:demos/navigation-demo.html`) and it was actively broken
  (the deleted `ViewEngine` import 500'd cold-start bootstrap), so it ships standalone ahead of the bulk
  delete.)
- **`wizard`+`workflow-engine`, `resource-loader`, `stores`, `renderers` (×11 demos)** — deleting breaks the
  consuming demo and no FUI-hosted equivalent exists yet. Action: FUI builds each hosted demo → WE swaps the
  local page to a `#701 fuiDemo` iframe → delete the family. One slice per demo as FUI ships it.
- **`view`+`tabs`** — **carved (now unblocked)** as [#1326](/backlog/1326-delete-we-blocks-view-tabs-runtime-copies-swap-we-view-tabs-/): **C** (#1312) has landed and
  `fui:demos/view-tabs-demo.html` self-bootstraps for iframe embed, so deleting `we:blocks/{view,tabs}` +
  swapping `we:demos/view-tabs-demo.html` to a `#701 fuiDemo` iframe is now deliverable.

The `#701 fuiDemo` iframe vs mode-C URL-bundle choice is a **settled per-demo menu**
(`#we-fui-embed-boundary` rule 6), not an open fork — no decision card.

## Re-slice note (2026-08-17, from the #1770 prep inventory)

**This epic needed a re-slice against the measured residual set, router first.** The 2026-08-17
constellation-placement inventory (#1770) found that all four carved children were `resolved` while step 4's
declared *first, load-bearing* target — `we:blocks/router/`, **2,843 tracked lines across 19 files**, including
a 619-line `we:blocks/router/elements/RouteViewElement.ts` — was still fully present in WE. That specific gap
was filed and owned as **#3154**
(*"Blocks/router (2,843 lines) was #1245's declared first target and was never sliced"*).

### Router: sliced 2026-08-17 (#3154) — and the deferral that held it is gone

The "6 bootstrap families" deferral above held router on one gate: *"imported only by `we:plugs/bootstrap.ts`
… they can drop only after FUI hosts the ~12 bootstrap-consuming demos and `we:plugs/bootstrap.ts` relocates
(#606)."* **That gate has cleared.** `we:plugs/bootstrap.ts` no longer exists — bootstrap relocated to FUI
(`fui:plugs/bootstrap.ts`), and it registers **FUI's** router, so the WE copy had no runtime consumer left at
all; only WE's own unit + integration suites still imported it. Step 4's "deleting `we:blocks/router/` is now
safe" and the slices section's "gated on FUI build" had been in contradiction since #606 landed; the measured
import graph settled it in favour of step 4.

What #3154 removed is the **runtime half** only — the elements, the behaviors, `registerRouter`, and the
`<template route>` parse + URLPattern match helpers — leaving what step 1 always said to leave: *the WE-side
protocol spec + conformance vectors + types*. What stays in `we:blocks/router/` is the #1684 webrouting spec
surface built long after this epic was written and with **no** FUI counterpart: the #1685/#1721 serializable
route-map schema + validator + builder, the #1687 route-config schema, the #1736 emitter contract + registry,
the #1737/#1738/#1739/#1740 concrete emitters, the #1741 param-source hook, the #1728 URL-state contract, and
their conformance-vector fixtures — every one of them pure data with no DOM dependency on the deleted half.
2,843 lines across 19 files → 1,486 lines across 13, and the block's `implementedBy`
(`@frontierui/blocks/router`) is now the only router runtime in the constellation.

**Four** WE-only deltas had no FUI counterpart and would have died with the deletion; they are carried
forward as a `frontierui`-locus child so nothing is silently lost — see *"FUI absorbs the four WE-only
router deltas orphaned by the #3154 slice"*. The load-bearing one is the **#423/#454 stamp diagnostics**
(the empty-clone `console.error` + the route-identified `try`/`catch` around the stamp `appendChild`), which
FUI has never carried — it is the fix for #423, and the e2e that documents its trigger
(`we:blocks/__tests__/e2e/router-empty-clone.spec.ts`) is kept by the slice, so its console assertion stays
vacuous until FUI absorbs the guard. The other three: the #365 `entry` normalization, the #320/#321
`viewportPresence` composition, and the `matchAllRoutes` vectors missing from FUI's own (already-existing,
351-line) helper suite.

A separate residual — the **dated records** (research summaries, research-description pages, resolved
decision items) that cite the now-deleted runtime paths — was deliberately left alone rather than
half-repointed, and is filed as its own item. It recurs on every family this epic slices, so it wants one
convention settled centrally, not a per-slice judgment call.

This epic's stale `blockedBy: [1353]` + `childlessReason: blocked` were **dropped** in the same change:
#1353 resolved 2026-06-27, so the block had been dead for seven weeks and the gate was already warning on it.

**Still residual** (unchanged by #3154): `we:blocks/resource-loader/` and `we:blocks/renderers/` — the last
two of the 16 named families. Both are genuinely gated the way the slices section describes (deleting breaks
a consuming demo and no FUI-hosted equivalent exists yet), so they need one slice per demo as FUI ships it,
not a blanket blocker on this epic.
