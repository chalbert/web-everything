# Progressive loading — infinite-scroll / load-more placement survey

Prior-art survey grounding decision [#1398](/backlog/1398-progressive-loading-infinite-scroll-load-more-standard-place/)
(surfaced by the verb-axis lens [#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/)).
Per design-first step 1, prior art is gathered before the forks are framed so the dimensions reuse
platform vocabulary.

## The concern

Incrementally load more of a collection as the user reaches the end — infinite scroll, a load-more
button, scroll-triggered pagination — with a sentinel/threshold, loading + end-of-list states,
scroll-position preservation, and an a11y-safe alternative to pure infinite scroll. The card asks: is this
a **new intent**, a **composition pattern** over the existing pieces, or a **dimension of `pagination`**?

## Native grounding

The platform substrate is **`IntersectionObserver`** (the scroll sentinel — `root` / `rootMargin` /
`threshold`), the **History API `scrollRestoration`** (position preservation), and the **WAI-ARIA APG
[Feed pattern](https://www.w3.org/WAI/ARIA/apg/patterns/feed/)** (`role="feed"` → `role="article"`
children, `aria-busy` flipped during batch insert, `aria-setsize="-1"` for unknown totals,
`aria-posinset`). All three are already cited by the WE pieces below — the vocabulary is adopted, not
re-minted.

## Finding 1 (load-bearing) — every benchmark models progressive-load as a *derived composition*, not a standalone primitive

| System | Shape | Composition |
| --- | --- | --- |
| [TanStack Query + Virtual](https://tanstack.com/query/latest/docs/framework/react/reference/useInfiniteQuery) | `useInfiniteQuery` (`fetchNextPage` / `hasNextPage` / `isFetchingNextPage` / `getNextPageParam`) **+** the separate `Virtual` windowing engine | two libraries composed — "fire `fetchNextPage` when the last virtual item is visible" |
| [MUI X DataGrid](https://mui.com/x/react-data-grid/server-side-data/infinite-loading/) | a *mode of the grid's pagination* (`rowsLoadingMode="server"`, unknown `rowCount` → infinite loading, `onRowsScrollEnd`) | not a separate component |
| [Ant `List`](https://ant.design/components/list/) | plain `loadMore` render slot (button); infinite scroll delegated to `rc-virtual-list` | affordance and windowing are different components |
| [PrimeReact](https://primereact.org/scroller/) | `Scroller` / `VirtualScroller` (`lazy` + `onLazyLoad`) split from `Paginator` | windowing ≠ paging |

The load-more affordance, the windowing engine, and the async-state machine are consistently *different*
units composed together. No major system ships a single "progressive-load" primitive.

## Finding 2 — the a11y-safe alternative is load-more, and the canonical guidance is "prefer it over pure infinite scroll"

[NN/G](https://www.nngroup.com/articles/infinite-scrolling-tips/) recommends *against* pure infinite
scroll for goal-oriented / backtracking tasks (broken scrollbar, unreachable footer, keyboard
tab-through) and names three alternatives: a load-more button, pagination integrated in scroll,
traditional pages. `role="feed"` (ARIA 1.1) is the only native scaffold for a scroll-loading region but
is [documented as under-supported / browse-mode-only](https://www.deque.com/blog/infinite-scrolling-rolefeed-accessibility-issues/) —
so the safe interop floor is the underlying primitives (`aria-busy`, `aria-setsize="-1"`, an announced
loader row), with `role="feed"` as progressive enhancement.

## Finding 3 — URL / scroll restoration is load-bearing, not polish

Append-mode content needs a crawlable / back-restorable URL or the back button and footer break — see
[Google's incremental-loading guidance](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading).
This is already encoded in WE's `pagination` block (`urlSync`, self-canonical `?page=n`, `rel=next/prev`
dead).

## WE-tree decomposition — the tie *already exists*, distributed across four homes that cross-reference

- **[we:src/_data/intents/viewport-presence.json](../src/_data/intents/viewport-presence.json)** — owns
  the **scroll-sentinel trigger** (`reference` = IO `root`; `margin` = `rootMargin`; `coverage` =
  `threshold`; events `enter`/`leave`). Its summary explicitly names "fetch the next page" as a *consumer
  decision it does not own* — it is the de-triplicated trigger only.
- **[we:src/_data/intents/windowed-collection.json](../src/_data/intents/windowed-collection.json)** —
  owns **virtualization + the end-of-list / unknown-total a11y**: `dataSource: bounded | infinite`
  ("fetched progressively (infinite scroll / load-more)"); indeterminate-total contract
  `aria-setsize="-1"` + `aria-busy` following the APG Feed pattern (ratified in #018 Fork 4); events
  `rangechange` / `loadmore`.
- **[we:src/_data/intents/loader.json](../src/_data/intents/loader.json)** — owns the **progressive-load
  *state***: `loadingMore` is a first-class lifecycle state — "Fetching the next page of an infinite /
  paginated collection. Surfaces as an announced progress row at the list end, never a blocking overlay —
  composes Windowed Collection." End-of-list = the `success` / `empty` terminal with no further
  `loadmore`.
- **[we:src/_data/blocks/pagination.json](../src/_data/blocks/pagination.json)** — owns the **realized
  mechanism**. `mode: paged | append` × `advance: manual | auto` are two orthogonal axes; its
  `pageModeXAdvance` designDecision states verbatim **"infinite scroll = append + auto, never a peer
  mode"**; `withAutoAdvance` wires the IO sentinel; `withUrlSync` does History-API restoration;
  load-more = `append + manual`; `seoLoadBearing` makes append-mode URL sync load-bearing.

**Precise unowned residual: essentially nothing structural.** Sentinel (viewport-presence),
virtualization + end-of-list a11y (windowed-collection), `loadingMore` state (loader), and append+auto /
load-more / URL-restore mechanism (pagination) all exist and already cross-reference. The only genuinely
unowned thing is a **single discoverable narrative** ("to build progressive loading, compose these four
this way") plus the **UX policy** (prefer load-more; keep the footer reachable) that currently lives only
as scattered prose.

## Conclusion — this is "just composition"

All three candidate homes fail the burden-of-proof for a new home:

- **New intent — broken.** A new intent must own a dimension no neighbour owns; progressive-load owns
  *none* (every dimension is already homed). Minting a 5th intent would re-mint the very triggers
  `viewport-presence` was created to de-triplicate.
- **New `pagination` dimension — broken.** `pagination` already *has* the dimensions and already declares
  "infinite scroll = append + auto"; a "progressive-load" dimension is a redundant alias and would
  mis-home the cross-block a11y/state concerns that live in windowed-collection / loader.
- **Composition-pattern doc over the existing four — correct (~88%).** No contract changes; at most a
  one-line cross-link added to each of the four (additive, not a fork). The only residual is *where* the
  "prefer load-more" UX policy is anchored (this research topic, or a one-line citeable note on
  `windowed-collection.dataSource` / a `pagination` designDecision) — editorial, not a design fork.
