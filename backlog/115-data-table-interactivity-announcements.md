---
type: idea
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-06"
dateResolved: "2026-06-06"
graduatedTo: "block:data-table"
tags: [data-table, collection-operations, a11y, interactivity, aria-live, grid, block]
relatedProject: webblocks
crossRef: { url: /blocks/data-table/, label: Data Table block }
---

# Data Table — wire the interactive axis (click-to-sort, live announcements, optional grid nav)

The [Data Table block](/blocks/data-table/) (#112) shipped the *projection* contract: it renders the
verified APG Sortable Table — `<th scope="col">` headers, the active column projecting `aria-sort`,
`Intl.Collator` ordering, SQL-aggregate group summaries — and a fixture-driven conformance demo. What
it deliberately left out is the **interactivity axis**: the static contract is verified, the live
wiring is not.

Three deferred pieces, each its own bounded build against the shipped contract:

1. **Click-to-sort wiring.** The header `<button data-action="sort" data-field>` exists but is inert
   in the reference renderer. Realize the `sort:header` behavior so a click toggles
   `none → ascending → descending` and re-runs the pipeline (this is the concrete consumer that
   would justify extracting `sort:header` into a standalone behavior block — the YAGNI seam noted in
   the Data Table block's `sortHeaderProjectionSeam` design decision).
2. **Live-region announcements** on `sortchange` / `filterchange` / `groupchange` — what a screen
   reader hears after a reorder/narrow/regroup (e.g. "sorted by Name, ascending; 12 of 48 shown").
   This is the Data Table analogue of pagination's open [#059](/backlog/059-pagination-focus-announcement/);
   reconcile so both land on one announcement pattern rather than two.
3. **`role="grid"` cell-level keyboard navigation** (optional) — the separate interactivity pattern
   beyond the read-only Sortable Table, for when arrow-key cell traversal is wanted. Compose with
   [Focus Delegation](/intents/focus-delegation/); decide if it belongs here or in a distinct block.

Acceptance: the demo gains a live (clickable) card whose interactions re-run the audit and announce
via an `aria-live` region; the conformance suite covers the toggle cycle and the announcement text.
Keep the shared renderer/audit/fixtures as the one source (anti-drift), exactly as the static
contract does.

## Progress

- **Status:** resolved — pieces 1 + 2 shipped; piece 3 carved out as a follow-up.
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - **Piece 1 (click-to-sort):** shared, CI-tested helpers in `renderDataTable.ts` — `nextSortState`
    (none→ascending→descending→none), `sortStateOf`, `applySortClick`. The `sort:header` seam stays
    realized in-block (still no second, non-table consumer to justify extraction).
  - **Piece 2 (announcements):** `announce(rows, config)` — one polite `aria-live` region carrying a
    clause-joined status string ("Sorted by Name, ascending; 3 of 6 shown"). Reconciled with #059:
    both blocks land on the same region+clause shape (note added to #059); the *focus* half and any
    hoist into gap-6 stay open there.
  - **Demo:** live interactive card in `data-table-demo.ts` (clickable headers + filter toggle +
    visible live region), counted in the playground tally (9/9). Unit tests (toggle cycle +
    announcement wording) + an E2E (click → aria-sort cycles + region announces) cover it.
- **Next:** piece 3 (`role="grid"` cell navigation) → [#123 Data Grid cell-navigation block](/backlog/123-data-grid-cell-navigation-block/)
  (decided: distinct block, not this one — different APG pattern).
- **Notes:** renderer/audit/fixtures kept as the one shared source (anti-drift), same as the static contract.
