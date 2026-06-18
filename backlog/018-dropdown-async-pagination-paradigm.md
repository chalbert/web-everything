---
type: decision
workItem: story
size: 3
status: resolved
dateOpened: '2026-06-01'
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
preparedDate: "2026-06-11"
tags:
  - dropdown
  - async
  - pagination
  - windowed-collection
  - loader
relatedReport: reports/2026-06-11-dropdown-async-pagination.md
relatedProject: webintents
---

# Specify async pagination beyond load-more for the dropdown family

The dropdown UX research flagged one paradigm as noted-but-unspecified: async pagination beyond load-more —
cursor vs offset, "load earlier", and windowing + async combined. **Grounded in a prior-art survey**
(pagination literature, the WAI-ARIA APG Feed pattern, React Aria `useAsyncList`, and open feature-requests
across MUI / Fluent / SAP UI5 / Radix), published as the
[Dropdown Async Pagination](/research/dropdown-async-pagination/) research topic. The central finding: **the
item is largely overtaken by work landed since it was filed**, so the forks below cover only what remains —
each with a recommended default in **bold**.

The key reframing: this is **not** "design a new async-pagination contract." Cursor-vs-offset already lives in
the [Custom Pagination](/resources/pagination/) protocol ([we:resources.json:31](../src/_data/resources.json#L31)):
`strategy: 'offset' | 'page' | 'cursor'`, with the cross-layer constraint baked in (jump-to-page and a range
label need a known `total`, so they pair only with offset/page; cursor forces append/prev-next). "Windowing +
async" is already a *composition* of two existing intents that name each other: Windowed Collection's
`dataSource: infinite` ([we:intents.json:351](../src/_data/intents.json#L351)) "composes the Loader `loadingMore`
state", and Loader's `loadingMore` ([we:intents.json:505](../src/_data/intents.json#L505)) "composes the Windowed
Collection Intent". The autocomplete member already declares **both** in its `composesIntents`
([fui:blocks.json:88](../src/_data/blocks.json#L88), `loader` at L94, `windowed-collection` at L95) and describes
`filter` as "a thin composition over loader + live-region-status" ([fui:blocks.json:101](../src/_data/blocks.json#L101)).
The bidirectional API exists too: `CustomPagination.previous()` + `hasPrevious`
([we:resources.json:35](../src/_data/resources.json#L35)). So the genuinely-open surface is three small
*family-specific* gaps, not a new standard.

### Recommended path at a glance

Ratify all four rows, or override just the one you'd change. The **confidence** column says where judgment is
actually needed vs. where to nod.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · net-new contract?** | **No new standard** — compose the existing three; #018 resolves as overtaken | author a dropdown-async-pagination intent *(rejected)* | **High** — three axes already owned |
| **2 · fetch trigger** | wire Collection Operations `advance: manual \| auto` onto autocomplete, default **`auto`** + manual fallback | auto-only / leave unspecified | **High** — 6-library default + a11y fallback |
| **3 · load-earlier** | **forward-only** for the family; load-earlier is a Feed concern | bidirectional top-loading in the listbox *(rejected)* | **High** — no library does it; reintroduces scroll-jump |
| **4 · unknown-total a11y** | adopt Feed's **`aria-setsize="-1"`** + `aria-busy` for the progressive-load case | require an estimated total *(rejected)* | **High** — APG Feed is the platform answer |

## Fork 1 — does the dropdown family need a net-new async-pagination contract?

The item's premise ("the deeper combined paradigm would need its own contract if the standard requires it") is
the crux. The survey's answer is **no**: every named gap is already owned. Cursor/offset is a *technical*
resource concern, correctly modeled in the [Custom Pagination](/resources/pagination/) protocol
([we:resources.json:31](../src/_data/resources.json#L31)) — not a UX intent, per the repo's intents-are-UX-only
rule. Windowing+async is a composition of Windowed Collection (`dataSource:infinite`,
[we:intents.json:351](../src/_data/intents.json#L351)) over Loader (`loadingMore`,
[we:intents.json:505](../src/_data/intents.json#L505)), and the autocomplete member already composes both. The
two async states a combobox fires — `filtering` (re-query on new text) vs `loadingMore` (next page of same
query) — are both already Loader lifecycle states ([we:intents.json:505](../src/_data/intents.json#L505)), and
React Aria's `useAsyncList` (`load({signal, cursor, filterText})`) is the reference implementation of exactly
that split.

- **(A — recommended) No new standard.** The dropdown *composes* the existing three (CustomPagination protocol
  + Windowed Collection `infinite` + Loader `loadingMore`); #018 resolves by reference, graduating only to
  thin touch-ups on existing standards (forks 2 & 4). Matches "composition over monolith"
  ([fui:blocks.json:35](../src/_data/blocks.json#L35)).
- **(B) Author a dedicated "dropdown async pagination" intent/contract.** Duplicates three axes the repo
  already owns, re-homes a technical concern (cursor/offset) into a UX intent against the rules, and adds a
  standards artifact for no new behavior. *Rejected.*

## Fork 2 — how does the autocomplete surface trigger the next-page fetch?

Collection Operations already has the right dimension — `advance: manual | auto` ("infinite scroll = append +
auto"; `manual` = clicked load-more row, `auto` = IntersectionObserver at the scroll boundary)
([fui:blocks.json:1651](../src/_data/blocks.json#L1651)) — but it lives on grids/data tables and was never wired
onto the autocomplete member. The family has never ruled whether an async combobox auto-loads on
scroll-near-bottom or shows an explicit affordance. Every surveyed library defaults to scroll-triggered
auto-load (React Aria `onLoadMore`; the MUI/Fluent/SAP feature-requests all assume infinite scroll), with a
manual "Load more" row as the accessible fallback.

- **(recommended) Wire `advance: manual | auto` onto the autocomplete member, default `auto`** (scroll
  sentinel) with a manual "Load more" row as the keyboard / screen-reader fallback — most-flexible default,
  the restriction (`manual`-only) being the author opt-in.
- **(alt)** Bake auto-only (no manual fallback) — simpler but fails keyboard/SR users who can't scroll-trigger;
  or leave it unspecified (status quo — the gap this fork closes).

## Fork 3 — "load earlier" / bidirectional in a dropdown

The protocol exposes `previous()` + `hasPrevious` ([we:resources.json:35](../src/_data/resources.json#L35)), so
bidirectional is *possible*. But "load earlier" (loading at the **top** as you scroll up, preserving the scroll
anchor) is a **feed / chat / inbox** paradigm — the WAI-ARIA APG models it under the
[Feed pattern](https://www.w3.org/WAI/ARIA/apg/patterns/feed/), not listbox/combobox. No surveyed dropdown
library implements top-loading in a combobox listbox: the listbox is forward-append, starting at the first
result and growing downward. Top-loading reintroduces the "scroll jumps to top on append" bug the libraries
fight hardest to avoid ([MUI #30249](https://github.com/mui/material-ui/issues/30249),
[SAP #6483](https://github.com/SAP/ui5-webcomponents/issues/6483)).

- **(recommended) Forward-only for the dropdown family.** `previous()` stays available at the protocol layer
  for prev-next *paged* surfaces (grids), but the autocomplete listbox is forward-append; "load earlier"
  belongs to a future Feed block, out of dropdown scope. Bias toward separation — don't overload the dropdown
  with a feed concern.
- **(rejected) Support load-earlier top-loading in the listbox.** No library precedent; reintroduces the
  scroll-anchor bug; conflates two paradigms.

## Fork 4 — unknown-total accessibility (`aria-setsize` during progressive load)

Windowed Collection mandates every rendered option carry `aria-setsize` = full count + `aria-posinset`
([we:intents.json:359](../src/_data/intents.json#L359)) — but that assumes the count is *known*. Under cursor
pagination the total is unknown until the last page, so the spec has no answer for the progressive case. The
WAI-ARIA [Feed pattern](https://www.w3.org/WAI/ARIA/apg/patterns/feed/) gives the platform convention:
`aria-setsize="-1"` (the standard "size unknown" sentinel) while the total is indeterminate, and
`aria-busy="true"` while a batch of rows is being inserted, flipped to `false` on completion.

- **(recommended) Adopt the Feed rule** as the progressive-load case Windowed Collection currently omits:
  `aria-setsize="-1"` while the total is unknown (switch to the real count once the last page lands),
  `aria-busy` during batch insert. A thin touch-up to the Windowed Collection spec, not a new contract.
- **(rejected) Require an estimated total** — fabricates a count AT then announces as fact; misleading and not
  what the platform sentinel is for.

## Notes

Original framing preserved: the item asked for "cursor vs offset, load-earlier, and windowing + async
combined." Each is addressed above — the first two by reference to already-shipped standards, the third
(load-earlier UX) ruled out of dropdown scope, plus two family-wiring gaps (fetch trigger, unknown-total a11y)
the survey surfaced. Net: **#018 resolves without a new artifact**, graduating at most to two thin
authoring touch-ups on existing standards (autocomplete `advance` wiring; Windowed Collection's
`aria-setsize="-1"` rule). `status: open` until the forks are ruled.

## Resolution — ratified 2026-06-11

- **Fork 1 — No new standard (A)**: every named gap is already owned — cursor/offset by the Custom Pagination protocol, windowing+async by the Windowed Collection × Loader composition the autocomplete member already declares — so #018 resolves as overtaken, graduating only to thin touch-ups on existing standards (matches composition-over-monolith).
- **Fork 2 — wire `advance: manual | auto` onto autocomplete, default `auto`**: every surveyed library defaults to scroll-triggered auto-load; `auto` is the most-flexible default with the manual "Load more" row as the keyboard/screen-reader fallback (the restriction `manual`-only is the author opt-in).
- **Fork 3 — forward-only for the dropdown family**: no surveyed library top-loads in a combobox listbox and it reintroduces the scroll-jump bug; "load earlier" is a Feed/chat concern, so `previous()` stays at the protocol layer for paged grids only (bias toward separation).
- **Fork 4 — adopt Feed's `aria-setsize="-1"` + `aria-busy` for the unknown-total case**: the APG Feed pattern is the platform convention for indeterminate totals under cursor pagination — a thin touch-up filling the case Windowed Collection currently omits, vs. fabricating an estimated total.

**Follow-on builds (not yet scaffolded):**

- Wire Collection Ops `advance: manual | auto` (default `auto` + manual fallback row) onto the autocomplete member · authoring touch-up / size 2 · blockedBy: none → #322
- Add the `aria-setsize="-1"` + `aria-busy` progressive-load rule to the Windowed Collection spec · authoring touch-up / task · blockedBy: none → #323
