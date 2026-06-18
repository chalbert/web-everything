# Dropdown Async Pagination: Prior-Art Survey & Gap Analysis

**Date:** 2026-06-11
**Scope:** "Async pagination beyond load-more" for the droplist family — cursor-vs-offset/keyset, bidirectional / "load-earlier", and windowing combined with async — the one paradigm the [2026-06-01 dropdown UX report](2026-06-01-dropdown-ux-behaviors.md) flagged as noted-but-unspecified (its open question #3).
**Method:** Web-research survey of pagination strategy literature, the WAI-ARIA APG Feed pattern, React Aria's `useAsyncList`, and the open feature-requests across MUI / Fluent / SAP UI5 / Radix; cross-checked against the repo's **existing** async/windowing/pagination standards.
**Grounding artifact for:** backlog [#018](/backlog/018-dropdown-async-pagination-paradigm/).

---

## Executive summary — the item is largely overtaken by work done since it was filed

The item was filed 2026-06-01 off the dropdown UX report's open-question #3. **Most of what it asks for now exists in the repo**, materialized by the collection-operations and windowed-collection work that landed afterward:

| Item's named gap | Where it now lives | Status |
|---|---|---|
| **cursor vs offset** | `CustomPagination` protocol — `strategy: 'offset' \| 'page' \| 'cursor'` (`we:src/_data/resources.json:31`) | **Specified.** Protocol-layer, drives Collection Operations `page`. |
| **windowing + async combined** | Windowed Collection `dataSource: infinite` (`we:src/_data/intents.json:351`) composing Loader `loadingMore` (`we:src/_data/intents.json:505`) | **Specified.** Each intent names the other in its composition section. |
| **load-more lifecycle** | Loader `loadingMore` state — announced progress row at list end, never a blocking overlay (`we:src/_data/intents.json:505`) | **Specified.** |
| **bidirectional API surface** | `CustomPagination.previous()` + `hasPrevious` (`we:src/_data/resources.json:35`) | **Protocol exists**; the *UX trigger* for "load earlier" in a dropdown does not. |
| **"load earlier" UX in a combobox** | — | **Genuinely open.** |
| **how a combobox surface triggers the fetch** | Collection Operations `advance: manual \| auto` exists for grids (`fui:src/_data/blocks.json:1651`) but is not wired onto the autocomplete member | **Open as a family wiring decision.** |
| **unknown-total a11y** (`aria-setsize` when the count isn't known) | — | **Open.** Windowed Collection mandates `aria-setsize` = full count, but says nothing about the *progressive-load* case where the count is unknown. |

So this decision is **not** "design a new async-pagination contract." It is the narrower call: **does the dropdown family need any net-new standard, or does it just compose the three that already exist — and what are the family-specific gaps those don't cover (load-earlier UX, the autocomplete fetch trigger, unknown-total a11y)?** The recommended answer is *no new contract* + close three small composition gaps on the autocomplete member.

---

## Finding 1 — cursor / offset / keyset: a backend strategy with a UX consequence, already protocol-modeled

The pagination-strategy literature is unanimous on the shape of the tradeoff:

- **Offset / page** (`LIMIT…OFFSET`) is simplest and the *only* strategy that yields a known `total`, so it is the only one that can drive **jump-to-page** and a **"showing 21–40 of 500" range label**. Its cost: it re-scans discarded rows (slow at deep pages) and, under concurrent inserts/deletes, the window shifts so rows are **skipped or duplicated** across pages.
- **Cursor / keyset** ("seek method": pass the last-seen sort key, not an opaque page number) is fast at any depth and **stable under writes**, but exposes **no `total`** — only `next()` / `previous()`. It therefore **cannot** drive jump-to-page or a range label, and forces an *append* / prev-next UX. (Keyset is the mechanism; "cursor" is the same thing with an opaque token.)

This is exactly the model already encoded in the repo's **Custom Pagination** resource (`we:src/_data/resources.json:31`), whose `CustomPaginationDefinition` is `{strategy:'offset'} | {strategy:'page'} | {strategy:'cursor'; key?}` and whose prose states the cross-layer constraint verbatim: *jump-to-page and `rangeLabel` require a known total, so they pair only with offset/page; cursor forces append/prev-next.* The Collection Operations intent states the same fact from the UX side (`fui:src/_data/blocks.json:1651`). **There is nothing left to specify here** — the strategy axis is owned, and it is correctly a *technical* (resource) concern, not a UX intent, per the repo's "intents are UX-only" rule.

**Implication for #018:** the cursor-vs-offset half of the item is *resolved by reference*. The dropdown does not re-specify it; the autocomplete member's `src`-backed resource declares a `pagination` strategy and the surface adapts (append-only under cursor; could offer counts under offset).

## Finding 2 — windowing + async is already a composition, not a new combined paradigm

The item worried that "windowed-collection composed with async would need its own contract." It does not. The repo already models the seam as a *composition of two existing intents*:

- **Windowed Collection** owns *which rows are realised in the DOM* and has a `dataSource: bounded | infinite` dimension; `infinite` is documented as "items fetched progressively (infinite scroll / load-more), **composes the Loader Intent `loadingMore` state**" (`we:src/_data/intents.json:351`, composition note at `:359`).
- **Loader** owns the *lifecycle*; its `loadingMore` state is "fetching the next page of an infinite / paginated collection… an announced progress row at the list end, never a blocking overlay — **composes the Windowed Collection Intent**" (`we:src/_data/intents.json:505`).

The two intents already reference each other; the autocomplete block already declares **both** in its `composesIntents` (`fui:src/_data/blocks.json:88`, includes `loader` at `:94` and `windowed-collection` at `:95`), and its trait notes describe `filter` as "a thin composition over loader + live-region-status" (`fui:src/_data/blocks.json:101`). So "windowing + async combined" for a dropdown is **already expressible today**: a windowed listbox with `dataSource:infinite` whose load-more fetch flows through Loader's `loadingMore`. No combined contract is owed.

## Finding 3 — `filtering` and `loadingMore` are two distinct async states, both already modeled

The 2026-06-01 report (section 8) and React Aria's `useAsyncList` both separate two async events a combobox fires, and the Loader intent already enumerates both as distinct lifecycle states (`we:src/_data/intents.json:505`):

- **`filtering`** — re-querying an already-open collection on *new filter text* (search-as-you-type). Keeps prior results visible, debounced (~250ms in the autocomplete trait, `fui:src/_data/blocks.json:101`), stale resolutions dropped via the version token.
- **`loadingMore`** — fetching the *next page* of the same query as the user scrolls. Progress row at the list end.

React Aria's `useAsyncList` is the reference implementation of exactly this split: one `load({signal, cursor, filterText})` function where a present `filterText` change means *re-filter from page 1* and a present `cursor` means *append the next page*; the `signal` AbortSignal cancels stale in-flight requests. This corroborates the repo's existing two-state model and its stale-drop version token — nothing new to add.

## Finding 4 — the genuinely-open family gaps the existing intents do NOT cover

Three things remain unspecified *for the dropdown family specifically*. These are the real forks:

### (a) How the autocomplete surface *triggers* the next-page fetch
Collection Operations has `advance: manual | auto` (`manual` = a clicked "Load more" row; `auto` = IntersectionObserver at the scroll boundary; "infinite scroll = append + auto") at `fui:src/_data/blocks.json:1651` — but that dimension lives on *grids/data tables*, not on the autocomplete member. The droplist family has never ruled whether an async combobox's listbox auto-loads on scroll-near-bottom or shows an explicit load-more affordance. Every surveyed library defaults to **scroll-triggered auto-load** (React Aria `onLoadMore`, the MUI/Fluent/SAP feature-requests all assume infinite scroll), with a manual "Load more" row as the accessible fallback.

### (b) "Load earlier" / bidirectional in a *dropdown*
The protocol has `previous()` + `hasPrevious` (`we:src/_data/resources.json:35`), so bidirectional is *possible*. But "load earlier" (loading at the **top** as you scroll up, preserving scroll anchor) is a **feed/chat/inbox** paradigm, not a dropdown one. No surveyed dropdown library implements top-loading in a combobox listbox: the listbox is **forward-append**, you start at the first result and grow downward. Top-loading reintroduces the "scroll jumps to top on append" bug (MUI #30249, SAP #6483) that the surveyed libraries fight hardest to avoid. So for the *family*, the default is **forward-only**; "load earlier" is a feed concern that belongs to a future Feed block, not the dropdown.

### (c) Unknown-total accessibility (`aria-setsize` during progressive load)
Windowed Collection mandates every rendered option carry `aria-setsize` (full count) + `aria-posinset` (`we:src/_data/intents.json:359`) — but that assumes the count is **known**. Under cursor pagination the total is unknown until the last page. The WAI-ARIA **Feed pattern** gives the platform answer: when the total is indeterminate, **`aria-setsize="-1"`** (the standard "size unknown" sentinel), and `aria-busy="true"` while a batch of rows is being inserted, flipped to `false` on completion. This is the missing a11y rule the windowed-collection spec doesn't state for the progressive case.

## Finding 5 — async option-pagination is community-driven, not native; no library treats it as solved

Across MUI ([#18450](https://github.com/mui/material-ui/issues/18450), [#30249](https://github.com/mui/material-ui/issues/30249)), Fluent ([#31261](https://github.com/microsoft/fluentui/issues/31261)), SAP UI5 ([#6483](https://github.com/SAP/ui5-webcomponents/issues/6483)), Base UI ([#3719](https://github.com/mui/base-ui/issues/3719)), and Radix ([#894](https://github.com/radix-ui/primitives/issues/894)), "paginated / infinite-scroll combobox" is an **open feature request**, not a shipped primitive. React Aria is the outlier with a first-class answer (`useAsyncList` + `onLoadMore` + `ListBoxLoadMoreItem`). The recurring implementation bug everyone hits is the **scroll-resets-to-top-on-append** problem — which is precisely why forward-append with a preserved scroll anchor (Finding 4b) is the safe family default, and why the active-always-mounted invariant Windowed Collection already mandates matters here.

---

## Recommendation (forks for #018)

| Fork | Recommended default | Alternative |
|---|---|---|
| **1 · net-new contract?** | **No new standard** — compose the existing three (CustomPagination protocol + Windowed Collection `infinite` + Loader `loadingMore`); resolve #018 as overtaken | author a "dropdown async pagination" intent *(rejected — duplicates owned axes)* |
| **2 · fetch trigger** | wire **Collection Operations `advance: manual \| auto`** onto the autocomplete member, default **`auto`** (scroll sentinel) with a manual load-more row as the keyboard/SR fallback | bake auto-only; or leave unspecified |
| **3 · load-earlier** | **forward-only** for the family; bidirectional `previous()` exists in the protocol but top-loading is a Feed/chat concern, out of dropdown scope | support load-earlier in the listbox *(rejected — no library does it; reintroduces scroll-jump)* |
| **4 · unknown-total a11y** | adopt the Feed pattern: **`aria-setsize="-1"`** while the total is unknown, `aria-busy` during batch insert; add this rule to Windowed Collection's progressive-load case | require an estimated total *(rejected — fabricates a count)* |

The net of all four: **#018 resolves without a new artifact.** It graduates to (at most) two thin authoring touch-ups on *existing* standards — wiring `advance` onto the autocomplete member's trait notes, and adding the `aria-setsize="-1"` unknown-total rule to Windowed Collection — neither of which is a new contract.

---

## Cross-references

- Decision: [#018 — specify async pagination beyond load-more for the dropdown family](/backlog/018-dropdown-async-pagination-paradigm/)
- Already owns the axes: [Custom Pagination resource](/resources/pagination/) (cursor/offset) · [Windowed Collection](/intents/windowed-collection/) (`dataSource:infinite`) · [Loader](/intents/loader/) (`filtering`/`loadingMore`) · [Collection Operations](/intents/collection-operations/) (`advance`/`pageMode`)
- Family: [droplist block](/blocks/droplist/) · autocomplete member
- Origin: [2026-06-01 dropdown UX report](2026-06-01-dropdown-ux-behaviors.md), open question #3

## Sources

- Pagination strategy surveys: [caduh — Offset vs Cursor vs Keyset](https://www.caduh.com/blog/pagination-that-scales-offset-cursor-keyset), [0x.run benchmarks](https://0x.run/pagination-offset-vs-cursor), [Halodoc scalable pagination](https://blogs.halodoc.io/a-practical-guide-to-scalable-pagination/), [oneuptime keyset guide](https://oneuptime.com/blog/post/2026-02-02-keyset-pagination/view)
- WAI-ARIA APG [Feed pattern](https://www.w3.org/WAI/ARIA/apg/patterns/feed/) (unknown-total `aria-setsize="-1"`, `aria-busy`)
- React Aria [useAsyncList](https://react-aria.adobe.com/useAsyncList.html) (cursor + filterText + AbortSignal `signal`), [ComboBox async](https://react-spectrum.adobe.com/react-aria/useComboBox.html)
- Community feature-requests: [MUI #18450](https://github.com/mui/material-ui/issues/18450), [MUI #30249 scroll-reset bug](https://github.com/mui/material-ui/issues/30249), [Fluent #31261](https://github.com/microsoft/fluentui/issues/31261), [SAP UI5 #6483](https://github.com/SAP/ui5-webcomponents/issues/6483), [Base UI #3719](https://github.com/mui/base-ui/issues/3719), [Radix #894](https://github.com/radix-ui/primitives/issues/894)
