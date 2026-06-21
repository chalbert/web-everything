---
kind: decision
size: 3
parent: "099"
status: open
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
tags: [decision, book-candidate, infinite-scroll, load-more, progressive-loading, gap]
relatedReport: reports/2026-06-21-progressive-load-composition.md
preparedDate: "2026-06-21"
---

# Progressive loading — infinite-scroll / load-more standard: placement

Candidate latent standard surfaced by the verb-axis lens
([#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/)): incrementally
loading more of a collection as the user reaches the end — infinite scroll, load-more button,
scroll-triggered pagination — with sentinel/threshold, loading + end-of-list states, scroll-position
preservation, and an a11y-safe alternative to pure infinite scroll
([prior-art survey](/research/progressive-load-composition/)).

The prep finding is decisive and reframes the card: **the tie already exists.** Decomposed against the
real tree, every piece of progressive loading is already owned by four cross-referencing homes — the
sentinel by [we:src/_data/intents/viewport-presence.json](../src/_data/intents/viewport-presence.json)
(`reference`/`margin`/`coverage` = IO `root`/`rootMargin`/`threshold`, explicitly *not* the fetch
decision); virtualization + the unknown-total a11y by
[we:src/_data/intents/windowed-collection.json](../src/_data/intents/windowed-collection.json)
(`dataSource: bounded | infinite`, `aria-setsize="-1"` + `aria-busy` per the APG Feed pattern, ratified
in #018 Fork 4); the `loadingMore` state by
[we:src/_data/intents/loader.json](../src/_data/intents/loader.json) ("an announced progress row at the
list end, composes Windowed Collection"); and the realized mechanism by
[we:src/_data/blocks/pagination.json](../src/_data/blocks/pagination.json), whose `pageModeXAdvance`
designDecision already states verbatim *"infinite scroll = append + auto, never a peer mode"* (`mode:
paged | append` × `advance: manual | auto`; `withAutoAdvance` wires the IO sentinel; `withUrlSync` does
History-API restoration; `seoLoadBearing`). Every benchmark agrees this is a *derived composition*, not a
primitive: TanStack pairs `useInfiniteQuery` with a separate windowing engine; MUI X makes it a *mode* of
the grid's pagination; Ant/PrimeReact split the load-more affordance from the windowing engine. The
**precise unowned residual is nothing structural** — only a discoverable narrative and the "prefer
load-more, keep the footer reachable" UX policy currently scattered as prose.

### Triage context

- **Kind**: Composition pattern (no new standard) · **Native grounding**: IntersectionObserver, History API `scrollRestoration`, WAI-ARIA APG Feed (`role="feed"`, `aria-busy`, `aria-setsize="-1"`)
- **Native-first**: ▽ low · **Gap**: ▽ low (pieces all exist) · **Effort**: ▽ low (doc + optional one-line note) · **Surfaced by**: #1390 (verb-axis lens) — flagged "likely the lightest of the harvest"

### Recommended path at a glance

Ratify the row, or override the placement you'd change. **Confidence** says where judgment is actually needed.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · placement** | **publish a composition-pattern `/research/` topic** over the four existing homes (no new standard) | a new intent *(rejected — owns no unowned dimension)* · a `pagination` dimension *(rejected — `append+auto` already covers it)* | **~88%** — pieces all shipped + cross-referencing; benchmarks unanimous |

## Fork 1 — where does the progressive-load pattern live?

*Fork-existence:* the two excluded branches are **"a new intent"** and **"a new `pagination`
dimension,"** and both are **broken**. A new intent must own a dimension no neighbour owns — progressive
loading owns *none* (sentinel/window/state/mechanism are each already homed), so it would re-mint the very
triggers `viewport-presence` exists to de-triplicate. A `pagination` dimension is a redundant alias of the
already-declared `append + auto`, and would wrongly pull the *cross-block* a11y/state concerns (which live
in windowed-collection / loader) into the pagination block. That a home cannot exist without either
re-minting or mis-homing is the genuine either/or.

**Fork 1 (a) — publish a composition-pattern research topic over the existing four (recommended, ~88%).**
Name the four homes, the canonical recipe (sentinel fires → `fetchNextPage`-equivalent → loader
`loadingMore` row → windowed insert with `aria-busy` / `aria-setsize="-1"` → terminal end-of-list), and
the load-more-vs-infinite UX policy. No contract changes; at most a one-line additive cross-link on each
of the four. This is the separate-and-decouple call inverted: the concept does *not* recur without its
neighbours — it *is* its neighbours composed — so it earns a pattern doc, not a home.

**Fork 1 (b) — mint a new `progressive-load` intent (rejected).** Re-mints owned vocabulary; duplicates
viewport-presence's de-triplicated trigger; burden-of-proof for a new home unmet.

**Fork 1 (c) — add a `pagination` dimension (rejected).** Redundant alias of `append + auto`; mis-homes
the windowed-collection / loader concerns.

*The residual (~12%):* the "prefer load-more / keep the footer reachable" UX policy is real *normative*
guidance a pure research topic states weakly. If the decider wants it enforced, the single defensible
contract touch is **one additive note** on `windowed-collection.dataSource` or a `pagination`
designDecision making "pure auto-infinite is discouraged; load-more is the a11y-safe default" citeable.
That is editorial anchoring, not a second placement fork — see below.

---

### Supported by default (not forks)

- **WE intent contract + FUI block realization coexist.** The intent layer (viewport-presence /
  windowed-collection / loader) and the FUI realization (`resource-loader`, `pagination`'s
  `PaginationBehavior` / `<page-nav>`) are different layers by construction.
- **Infinite scroll AND load-more AND pagination-in-scroll all coexist** as `append+auto` /
  `append+manual` / `paged` over the existing `mode` × `advance` axes — already supported.
- **`role="feed"` (where supported) AND the primitive a11y floor** (`aria-busy` / `aria-setsize="-1"` /
  announced loader row) coexist — feed is progressive enhancement over the primitives.
- **Where to anchor the UX policy** (this research topic vs a one-line citeable note on
  `windowed-collection.dataSource` / a `pagination` designDecision) is an *editorial* choice the decider
  may make either way — both coexist; it is not an excluded branch.

### Realizing work (post-ratification, separately prioritized)

If Fork 1 (a) ratifies: the research topic is already published; the only follow-up is the optional
additive cross-links / UX-policy note. No new intent, block, or demo. File via `/new-standard` only if the
decider overrides toward (b)/(c).
