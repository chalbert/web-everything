---
type: idea
status: resolved
dateOpened: "2026-06-06"
graduatedTo: "plateau/src/blocks/attributes/LiveStatus.ts + Windowed.ts (with a backward-compat defer added to Filter.ts); invariants proven by LiveStatus.test.ts + Windowed.test.ts"
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
