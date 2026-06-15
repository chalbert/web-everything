---
type: idea
workItem: story
size: 8
status: resolved
dateOpened: "2026-06-06"
dateStarted: "2026-06-08"
dateResolved: "2026-06-08"
graduatedTo: frontierui/blocks/droplist/LiveStatus.ts
tags: [droplist, autocomplete, live-status, windowed, virtualization, traits, behavior, a11y]
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
relatedProject: webblocks
crossRef: { url: /blocks/autocomplete/, label: Autocomplete block }
---

# Build the cross-cutting `live-status` + `windowed` trait surfaces

The autocomplete composition (#035) names four spec-**proposed** traits. #122 built the two
autocomplete-specific ones (`filter`, `clearable`) and explicitly deferred the two **cross-cutting
family surfaces** to here: `live-status` and `windowed`. Both are reused well beyond autocomplete
(any async collection, any long list), so they earn their own item.

- **`live-status`** — the polite announcer surface: routes result counts, loading, and error states
  to a single `aria-live` region. **Critical inter-trait invariant** (from
  [#023](/backlog/023-droplist-composition-open-contracts/)): `filter` and `live-status` both write
  status, so they MUST share **one** region, not two. `filter` (#122) already announces through a
  configurable shared region (`status=<id>`); `live-status` must adopt that **same** node — make the
  region a provider both consume, and prove the no-double-announce contract with a test.
- **`windowed`** — virtualize a long option collection (render only the visible slice). The binding
  invariant (#023): windowing must **not** unmount the option `focus-delegation`/`selection` marks
  active — the active option is always mounted. Coordinate with `filter`'s inject path so injected +
  windowed options agree on the live `[composite-descendant]` set. See also
  [#062](/backlog/062-pagination-windowed-collection-seam/) for the pagination seam.

Acceptance: `live-status` and `windowed` exist as real CustomAttribute behaviors composing with the
`filter`/`focus-delegation`/`selection` stack; the shared-announcer and active-always-mounted
invariants are enforced by tests, not convention.

## Progress (fresh build — Frontier UI live repo)

- **Status:** resolved
- **Branch:** `frontierui` working tree (droplist behavior family, `blocks/droplist/`).
- **Done:**
  - `live-status` (found already-landed in the live repo): `blocks/droplist/LiveStatus.ts` owns the
    one shared region, stamps `data-live-status` to claim it, bridges
    `filter-request`/`filter-resolved`/`filter-error`, and exposes `announce()`. `Filter.ts` defers its
    inline write when the region carries the marker. One-region / no-double-announce invariant proven in
    `__tests__/behaviors.test.ts` (LiveStatus suite + "Filter defers" test).
  - `windowed` (built this session): `blocks/droplist/Windowed.ts` — keeps the full set as a private
    model, mounts only a recentred window slice as `[composite-descendant]`, stamps ABSOLUTE
    `aria-setsize`/`aria-posinset`/`data-index` from the full model, and keeps the active option always
    mounted (recentre + atomic `appendChild` moves, plus an active-index removal backstop). Coordinates
    with `filter` on `filter-resolved` by harvesting the injected set into the model and collapsing to a
    window. `overscan` keeps the next/prev item mounted before focus can arrow onto it.
  - Tests (`__tests__/behaviors.test.ts`, Windowed suite, 2): against the **real** FocusDelegation —
    49 ArrowDowns over a 50-item model, active stays connected at every step, window bounded ≤ size,
    absolute posinset, head of model unmounted (genuinely virtualized); and the **real** Filter
    coordination seam — 50 injected collapse to one window of 10, no duplicate descendants. Full
    frontierui suite **1256 pass / 7 skipped**; webeverything `check:standards` **0 errors**.
- **Leftovers → items:** opt-in wiring of `windowed` into `<auto-complete>` (gate + attach-before-focus)
  → **#201** (#138 wired the other seven traits but not this). Scroll/height-driven window path already
  tracked by **#145**; the `filter` error channel (#148) is already implemented + tested in the live
  Filter/LiveStatus, so #148 looks satisfiable on its own verification.
- **Notes:** behaviors are standalone modules proven by tests (filter/clearable aren't registered in
  bootstrap either; no trait-manifest registration needed). happy-dom has no layout, so windowing here
  is active/count-driven, not scroll/height (that's #145). The plateau Progress block below is retained
  only as history — it describes the abandoned-repo build, **not** this one.

## Correction (reopened 2026-06-07)

> **Was resolved in error.** The only implementation of this surface was built in the **legacy `plateau` repo**, since confirmed **abandoned** — the initial single-repo prototype, superseded by Web Everything + Frontier UI + plateau-app. It is **not in the live project**: the WE *spec* exists, but there is **no reference implementation** in Frontier UI or the WE `plugs/`, and the (now-removed) `graduatedTo` pointed into dead code. Reopened as a **fresh build** against the live reference implementation (Frontier UI / WE `plugs/`, per AGENTS.md) — **do not migrate or consult plateau** (explicitly not a model). The original `## Progress` below describes the void plateau build and is retained only as history.

## Progress

- **Status:** resolved
- **Branch:** work landed in the `plateau` repo (`src/blocks/attributes/`), mirroring #122.
- **Done:**
  - `LiveStatus.ts` — the dedicated polite announcer. Adopts the SAME region node `filter`'s
    `status=<id>` points at (`region` option), ensures it is a configured live region, and stamps it
    `data-live-status` to **claim** it. Consumes `filter-request` → loading and `filter-resolved` →
    ready/empty with zero glue, plus a generic `live-status` event / public `announce()` for any async
    collection (loading / ready / empty / error). Text matches filter's conventions.
  - `Filter.ts` — minimal backward-compat edit: `#announce` returns early when the region carries the
    `data-live-status` marker, so a `live-status` owner is the single writer. All 9 existing Filter
    tests stay green (unowned region → unchanged behavior).
  - `Windowed.ts` — model-backed virtualization. Keeps the full set as a private model, renders only a
    window slice as `[composite-descendant]` (the live set focus/selection read), and stamps
    `aria-setsize`/`aria-posinset`/`data-index` from the FULL model. The active option is ALWAYS
    mounted — included in the render even when it scrolls outside the pure window slice; reorders via
    atomic DOM moves so the active node never leaves the document. Shifts the window on
    `activedescendantchange` (≥overscan neighbours each side) and re-collapses on `filter-resolved`
    (injected set → new model). Public `setModel()` / `getWindow()`.
  - Tests: `LiveStatus.test.ts` (12) proves the one-region / no-double-announce invariant against the
    **real** Filter (write counted exactly once per settle; filter resumes inline when the owner
    releases). `Windowed.test.ts` (7) proves active-always-mounted against the **real**
    FocusDelegation (50 arrow-downs, active stays connected, window bounded, absolute posinset) and the
    filter-coordination seam (50 injected → window of 10). Full plateau suite: **147/147 pass**.
- **Leftovers → new backlog items:** scroll / height-driven windowing (the pointer path happy-dom
  can't test) → **#145**; a `filter` error channel so `live-status` announces fetch failures →
  **#148**. (Wiring the full trait stack into a runnable `<auto-complete>` + browser demo is already
  tracked by **#138**.)
- **Notes:** behaviors are standalone modules proven by tests (filter/clearable aren't registered in
  bootstrap either). happy-dom has no layout → windowing is active-driven/count-based here, not
  scroll/height (that's #145). The pre-existing `check:standards` "AGENTS.md inventory stale" error is
  unrelated in-flight tree work — it reproduces without this item's edits.

**Graduated to** `frontierui/blocks/droplist/LiveStatus.ts` — shared-region announcer (Filter.ts defers via data-live-status) + Windowed.ts active-always-mounted virtualization; invariants in blocks/droplist/__tests__/behaviors.test.ts.
