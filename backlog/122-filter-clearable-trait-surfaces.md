---
type: idea
workItem: story
size: 3
status: open
blockedBy: ["035", "136"]
dateOpened: "2026-06-06"
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

## Correction (reopened 2026-06-07)

> **Was resolved in error.** The only implementation of this surface was built in the **legacy `plateau` repo**, since confirmed **abandoned** — the initial single-repo prototype, superseded by Web Everything + Frontier UI + plateau-app. It is **not in the live project**: the WE *spec* exists, but there is **no reference implementation** in Frontier UI or the WE `plugs/`, and the (now-removed) `graduatedTo` pointed into dead code. Reopened as a **fresh build** against the live reference implementation (Frontier UI / WE `plugs/`, per AGENTS.md) — **do not migrate or consult plateau** (explicitly not a model). The original `## Progress` below describes the void plateau build and is retained only as history.

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
