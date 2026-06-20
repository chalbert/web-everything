---
kind: epic
size: 8
status: open
dateOpened: "2026-06-20"
blockedBy: ["1246"]
childlessReason: undecided
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

## Open question — canonical home → carved to [#1246](/backlog/1246-canonical-home-for-the-reference-runtime-stay-subset-blocks-/)

The embedded fork — *are the router et al. "reference-runtime, canonical in WE, FUI consumes" or "pure
impl, FUI-canonical, WE holds only contract types"?* — is its own decision and gates everything below, so
it now lives as **[#1246](/backlog/1246-canonical-home-for-the-reference-runtime-stay-subset-blocks-/)**
(`type: decision`), with this epic `blockedBy` it. The tension is real and unreconciled: `#606`/`#817`
ruled runtime impl FUI-canonical and `#641` ruled WE holds no block-impl copy (every spec'd block already
declares `implementedBy: @frontierui`), yet `#697` (resolved *after* #641) deliberately kept a
reference-runtime subset in WE. Either way a blind file-copy is wrong — the copies carry deliberate FUI
adaptations (import style, tag defaults, the #365/#423 deltas), so the seam needs the `#817`
contract/runtime split or a real import. **Do not start dedup before #1246 rules.**

## Proposed shape (mirror #170)

1. **Decide the canonical home** per `#817` (likely: split each block at the `we:contract.ts`/types seam — types
   stay WE, runtime → FUI — consistent with the plugs reversal; confirm against the `#697` reference-runtime
   carve-out).
2. **Dedupe** to one source per the ruling (delete the redundant tree; wire the seam — import or `#872`
   `@webeverything/contracts` for the type halves).
3. **Add a drift gate** — the plugs side already has one (trait-enforcer / byte-diff in `check:standards`);
   extend or mirror it for `blocks/` so a future one-sided fix fails the gate instead of silently rotting.

## Slices (to carve on pickup)

Likely per-family or per-layer slices once the canonical-home call lands (router first — it has live evidence
and is load-bearing for every consuming app). Until then this is an umbrella; do not start dedup before the
direction decision.
