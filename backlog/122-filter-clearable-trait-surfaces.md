---
type: idea
workItem: story
size: 3
status: resolved
blockedBy: ["035", "136"]
dateOpened: "2026-06-06"
dateResolved: "2026-06-10"
graduatedTo: frontierui/blocks/droplist/Filter.ts + Clearable.ts
tags: [droplist, autocomplete, filter, clearable, input, loader, traits, behavior]
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
relatedProject: webblocks
crossRef: { url: /blocks/autocomplete/, label: Autocomplete block }
---

# Build the `filter` + `clearable` trait surfaces the autocomplete block specs

The [autocomplete block](/blocks/autocomplete/) (#035) shipped the *contract*: an editable
`role="combobox"` input bound to a separate `role="listbox"`, where typing narrows the collection
(`filter`) instead of seeking within it (`type-ahead`), and DOM focus stays on the input via
`focus-delegation`'s `controller`. Of the traits it composes, only `focus-delegation` (now with
`controller`), `selection`, and `anchor` are built today — `filter`, `clearable`, `live-status`, and
`windowed` are spec-**proposed**. This item builds the two that are *autocomplete-specific*: `filter`
and `clearable`. (`live-status` and `windowed` are cross-cutting family surfaces — track separately.)

The composition report names `filter` the riskiest, most-informative next prototype. It is not a
monolith — it is a thin orchestrator over two providers that already exist:

- **`filter`** consumes the [loader intent](/intents/loader/) (`customContexts:loaderIntent`) for the
  async lifecycle: debounce (~250ms) the input text, enter a loading state, cancel stale in-flight
  responses, inject `<li role="option">` into the listbox; then push a count to the announcer on each
  settle. `filter="client"` skips the async path and hides non-matching options in place. It is
  mutually exclusive with `type-ahead` (both consume printable keys).
- **`clearable`** is the input-side X affordance — reveal once the value is non-empty, clear on
  activate, return focus to the input.

Acceptance: a `filter` behavior (async + client modes) and a `clearable` behavior exist as real
CustomAttribute behaviors (plateau/Frontier UI), composing with the proven
`focus-delegation`+`selection`+`anchor` stack so a runnable `<auto-complete>` works end-to-end — the
"par → arrow → enter" trace on the autocomplete page passes against a live source. Mind the inter-trait
invariant tracked in [#023](/backlog/023-droplist-composition-open-contracts/): `filter` and
`live-status` both write status, so route both through the one announcer region rather than two.

## Resolution (verified 2026-06-10) — done in Frontier UI; reopened in error

> **The `filter` + `clearable` surfaces this item owns are built and tested in the live project.** The
> 2026-06-07 "reopened as a fresh build" note below was wrong — it checked only the abandoned `plateau`
> repo, not the live Frontier UI tree, and concluded no reference implementation existed. It does:
>
> - `frontierui/blocks/droplist/Filter.ts` (265 lines) — the loader-intent async orchestrator this item
>   specs: `async` (debounce ~250ms, loading state, stale-cancel, inject options) + `client` modes,
>   diacritic-insensitive folding, the `controller` (focus host ≠ collection) split, and the ONE shared
>   `status` aria-live region per the [#023](/backlog/023-droplist-composition-open-contracts/) invariant.
> - `frontierui/blocks/droplist/Clearable.ts` (81 lines) — the input-side X affordance (reveal when
>   non-empty, clear + re-run `filter`, return focus).
> - `<auto-complete>` is registered and runs end-to-end composed over `focus-delegation`+`selection`+
>   `anchor`; **26 tests pass** (`AutoComplete.test.ts` + `behaviors.test.ts`), covering async source,
>   client filter, clearable, live-status, windowed, and positioning.
>
> So `src/_data/blocks.json`'s autocomplete design decision ("all now built and tested in Frontier UI's
> reference implementation") was **correct** — no change needed there; the spec-desync was this item's own
> stale note, now removed. The original `## Progress` (the abandoned plateau build) is retained below as
> history only. The cross-cutting `live-status`/`windowed` surfaces and `anchor` remained tracked
> separately (#136/#137/#138) and have since been built in that same droplist work.

## Progress

- **Status:** resolved
- **Branch:** work landed in the `plateau` repo (`src/blocks/attributes/`), not webeverything.
- **Done:**
  - `Filter.ts` — async + client modes. Async runs the loader-intent lifecycle (debounce ~250ms,
    `aria-busy`, `filter` CustomEvent carrying `{ query, signal, respond }`, inject
    `<li role="option" composite-descendant>`), with stale responses dropped via AbortController/signal.
    Client mode hides non-matching options in place. Counts route to ONE shared `role="status"` region
    (`status=<id>` option) per the #023 invariant.
  - `Clearable.ts` — input-side X affordance: reveals only when non-empty, clears + fires a bubbling
    `input` so `filter` re-runs, returns focus, and emits `clear`; decoupled from Escape.
  - Composition fixes (symmetry, kept existing tests green): added `controller` to `Selection` (commit
    reads Enter/Space from the input host) and suppressed `FocusDelegation` type-ahead when a
    `controller` is set (printable keys belong to the input/filter — they're mutually exclusive).
  - Tests: `Filter.test.ts`, `Clearable.test.ts`, and `Autocomplete.trace.test.ts` (full
    "par → arrow → enter" trace against a live, cancellable async source). 101/101 plateau tests pass.
- **Leftovers → new backlog items:** `anchor` is not actually built (the trace fakes open/dismiss with
  glue) → **#136**; `live-status` + `windowed` cross-cutting surfaces → **#137**; register a real
  `<auto-complete>` element + browser demo (+ diacritic-insensitive client match) → **#138**.
