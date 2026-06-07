# Pagination as a UX Standard: Research Report

**Date:** 2026-06-03
**Scope:** Pagination as a *first-class* concern — deliberately excluding the infinite-scroll / async-option-list slice already covered by the [Dropdown UX Behaviors report](./2026-06-01-dropdown-ux-behaviors.md) (load-more lifecycle, debounced async filtering, virtualization a11y) and the existing Custom Pagination resource protocol (`page/offset/cursor → next()/previous()`). Focuses on the blind spots: classic numbered pagination, URL/state sync, SEO/SSR, accessibility, cursor-vs-offset UX consequences, native platform primitives, and the overall pattern taxonomy.
**Method:** Deep-research fan-out (5 angles → 23 sources → 99 claims → 25 adversarially verified, 24 surviving). Primary sources: MDN, Chrome web-platform docs, W3C WAI-ARIA APG, Google Search Central, Slack Engineering. Secondary UX: Baymard, Smashing Magazine, NN/g.
**Goal:** Decide whether pagination is its own UX intent, a facet of a broader **Collection operations** intent, or stays a resource-protocol concern — and what dimensions/traits it would expose. Feeds [gap-10](../backlog/006-gap-10-collection-ops-intent.md) and [dropdown-async-pagination-paradigm](../backlog/018-dropdown-async-pagination-paradigm.md).

---

## Executive summary

**Pagination is two independent layers that pair flexibly, not one coupled concern.** A *UX-presentation* layer (numbered / prev-next / load-more / infinite / virtualized) sits over a *resource-iteration* layer (offset/page vs cursor). The cursor-vs-offset choice is purely a data-fetch-stability / total-count concern and is orthogonal to which UI affordance is shown — a cursor protocol can sit under a load-more UI; an offset protocol under numbered pages.

**This confirms an already-made decision rather than opening a new one.** The [Collection Operations Intent](../src/_data/intents.json) already exists (`status: concept`, authored 2026-06-03 — see [its research report](./2026-06-03-collection-operations-intent.md)) and already owns pagination as its **`page` pipeline stage** (`pageMode: paged | load-more | infinite`). So pagination is *not* a "should it be its own intent" question — it **is** the `page` dimension of Collection Operations. Two consequences for this report's framing:

- **The protocol layer is NOT a trait of the intent.** Collection Operations is *UX-only by charter* ("comparator implementation and client/server execution are technical concerns handled outside the intent"). The offset/page-vs-cursor protocol therefore stays in the existing **Custom Pagination resource** ([resources.json](../src/_data/resources.json)), which already models it. The intent's `page` dimension expresses only UX preferences; the pairing constraint between them (below) surfaces as a *composition note*, not an intent dimension.
- **The genuinely new work is the presentation / URL-state / SEO / a11y enrichment** of that `page` dimension — which the current concept entry does not yet capture. That is what this report feeds.

**Native-first is fully achievable.** The History API (`pushState` + `popstate` + `scrollRestoration`), the newer Navigation API, and cross-document View Transitions provide every primitive needed to sync paginated state to shareable URLs, restore state + scroll on back/forward, and animate page-to-page navigation — *including a zero-JS path* for server-rendered numbered pagination. No library is required for the default.

**SEO/SSR is a load-bearing constraint, not an afterthought.** Each page needs its own unique, self-canonical URL (`?page=n`); `rel=next/prev` is deprecated by Google (2019); and Googlebot does not trigger user-action JS, so load-more/infinite content is *not reliably crawlable*. The SEO-safe default is therefore server-rendered `<a href>` page links — which is in direct tension with the most *usable* patterns (load-more/infinite). This tension is the heart of the decision framework.

**The pattern choice is a goal-driven tradeoff.** Baymard usability research positions **load-more (with lazy-loading and proper `history.pushState` back-button support) as the recommended e-commerce default**, with **numbered pagination preferred specifically when robust URL/back-button support is impractical**, and **infinite scroll carrying measurable harms** (footer inaccessibility, reduced per-item focus, overwhelm). Crucially, the load-more recommendation is *conditional on* the URL/state-sync dimension being built — UX and platform layers are coupled by this dependency.

---

## Findings

### 1. Structure: two independent layers

> **Pagination = presentation pattern × resource protocol, paired flexibly.** *[Confidence: High]*

The UX affordance (numbered, prev/next, load-more, infinite, virtualized) and the data-iteration protocol (offset/page vs cursor) are independent axes. The cursor-vs-offset distinction is *purely* about fetch stability and total-count availability — orthogonal to the UI. This is the core argument for a **facet-of-Collection-operations** model with two distinct traits. *(Synthesized from findings 2–3; Slack Engineering.)*

### 2. Cursor vs offset — UX consequences

> **Offset/page is unreliable under high-frequency writes; cursor is stable but cannot jump-to-page.** *[Confidence: High]*

- **Offset/page** recomputes the page window against a shifting dataset, so inserts/deletes cause rows to be **skipped or duplicated** across pages. (Slack Engineering, primary; corroborated CedarDB, EF Core, PostgreSQL guidance.)
- **Cursor** fetches the next N rows after a stable reference point — stable under writes — but **gives up `total`/`page`/`pages`**, and therefore **cannot jump-to-page**. (Slack: *"There is no concept of the total number of pages… The client can't jump to a specific page."*)

**Hard UX implication for the standard:** *"jump-to-page"* and *"showing 21–40 of 500"* affordances are **only expressible over an offset/page protocol**. A cursor protocol structurally forces a prev/next or load-more presentation. This is a real cross-layer constraint the trait model must encode — not every presentation pairs with every protocol.

### 3. Native platform primitives (the native-first defaults)

> **History API + Navigation API + cross-document View Transitions cover the whole surface.** *[Confidence: High]*

- **History API** — `pushState` updates the URL (incl. `?page=n`) with no reload and stores a serializable state object returned via `popstate` on back/forward; `scrollRestoration` (`'auto'` restores, `'manual'` hands control to the app) manages scroll on history nav. Baseline stable since Jan 2020 → **the broad-compatibility default.**
- **Navigation API** — modern SPA successor: a single `navigate` event intercepts all same-origin same-document navigations, replacing the "hijack every link click" workaround. Reached cross-browser Baseline **Jan 2026** → treat as **progressive enhancement**, not the baseline default.
- **Cross-document View Transitions** — animated transitions between *full page navigations* for server-rendered pagination with **zero JS**, opted in via the CSS `@view-transition { navigation: auto; }` rule on both pages. Native-first enhancement specifically suited to the MPA/server-rendered branch.

### 4. SEO / SSR

> **Unique self-canonical URL per page; `rel=next/prev` is dead; JS-only pagination isn't crawlable.** *[Confidence: High, primary sources]*

- **Each page = its own unique, self-referencing canonical URL** (`?page=n`). Do **not** use fragments for page numbers; do **not** canonicalize the sequence to page 1 (orphans content, cuts crawl paths). (Google Search Central, primary.)
- **`rel=next/prev` deprecated** (announced 2019-03-21; Google hadn't used it for years). Other engines may still honor it → at most an optional hint, never primary machinery.
- **Googlebot doesn't click buttons or fire user-action JS** → load-more/infinite content is not reliably crawlable; **server-rendered `<a href>` page links are the SEO-safe default**. SEO-sensitive collections must provide a crawlable paginated path regardless of the interactive UI.

### 5. Accessibility (WAI-ARIA APG)

> **`<nav aria-label="pagination">` + `aria-current="page"`.** *[Confidence: High]*

Wrap controls in a `nav` element (navigation landmark); give each navigation landmark a unique label when more than one exists; mark the active page with `aria-current="page"`. (W3C WAI-ARIA APG, primary.) **Not independently verified here** (see open questions): focus management and screen-reader announcement *after* a page change.

### 6. Pattern choice / decision framework

> **Load-more is the usability default (conditional on URL support); infinite scroll has measurable harms.** *[Confidence: High behavior finding / Medium recommendation]*

- Pattern choice changes exploration depth: **infinite scroll → most browsing (100+ items), pagination → least, load-more in between.** (Baymard 50+ site study.)
- **Load-more + lazy-loading is the recommended e-commerce default** — lower decision burden than numbered pages — **BUT requires `history.pushState` back-button support; where that's impractical, numbered pagination is preferable.** (Baymard.) This ties the UX recommendation directly to the URL/state-sync dimension.
- **Infinite scroll harms:** footer becomes unreachable, users scan more but focus less, overwhelm beyond a ~50–150 item sweet spot. Pro-infinite-scroll counterpoint is scoped to non-goal-oriented feeds (social/news), not goal-oriented collections — itself a useful decision axis.

| Pattern | Best for | Cost |
|---|---|---|
| **Numbered** | Indexable/SEO, jump-to-page, "showing X–Y of N", robust back-button without JS | Highest decision burden; needs offset/page protocol + total count |
| **Prev / Next** | Cursor protocols, simple sequential reading | No random access |
| **Load-more** | E-commerce default *with* `pushState` support; broad discovery with control | Footer/back-button only work if URL state is built |
| **Infinite scroll** | Non-goal-oriented feeds (social/news) | Footer unreachable, reduced focus, not crawlable |
| **Virtualized** | Very long lists (perf) — covered by existing `windowed-collection` | a11y `setsize`/`posinset` (already specified) |

---

## What this means for the standard's shape

The research is decisive on the **platform/SEO/a11y defaults** and confirms pagination's home (the `page` dimension of the existing Collection Operations Intent). The concrete next step is enriching that `page` dimension; the *intra-Collection-operations* dimensioning (how page/filter/sort/group share traits) stays with [gap-10](../backlog/006-gap-10-collection-ops-intent.md).

1. **Enrich the existing `page` dimension of Collection Operations** (keep it UX-only — the protocol stays in the Custom Pagination resource):
   - **Presentation, decomposed into two orthogonal axes** — `pageMode` (`paged` replace-slice / `append` grow-list) × `advance` (`manual` / `auto`, default `manual`). Infinite scroll = `append` + `auto`, a derived opt-in rather than a peer mode (resolves the seam below); `auto` native-grounds on IntersectionObserver and delegates rendering to Windowed Collection / lifecycle to Loader.
   - **URL-state preference** — new `urlSync` dimension (`none | query-param`): whether the active page is a shareable, back-button-restorable URL.
   - **Range label** — new `rangeLabel` dimension: whether to show "showing 21–40 of 500" (requires a known total → composes only with an offset/page protocol).
   - Encode the **pairing constraint as a composition note**: jump-to-page / total-count affordances require an offset/page protocol; cursor forces prev/next or load-more. This is a cross-layer fact, not an intent dimension.
2. **Native-first defaults to align to:** History API (`pushState`/`popstate`/`scrollRestoration`) as baseline; Navigation API as progressive enhancement; cross-document View Transitions (CSS `@view-transition`) for the server-rendered branch. Library page-routers are opt-in only.
3. **SEO/SSR as a first-class dimension, not optional:** unique self-canonical `?page=n` per page; server-rendered `<a href>` as the indexable default; never emit `rel=next/prev` as primary machinery.
4. **Accessibility trait:** `nav` landmark + `aria-label` + `aria-current="page"` (focus/announcement details pending the open-questions pass).
5. **Decision framework belongs in the intent** — pattern choice is goal-driven and the load-more default is *conditional on* the URL/state-sync dimension, so the framework and the dimensions are coupled and should ship together.

---

## Result-range labels & page-size selectors (verified 2026-06-06)

This fills the gap the original report flagged ("no verified claim" for these affordances). Method: a focused fan-out over NN/g, Baymard, W3C WCAG/ARIA, GOV.UK/GDS, and the documented pagination components of IBM Carbon, MUI/Material, Ant Design, Shopify Polaris, USWDS, GitHub Primer, Atlassian. **Headline:** these are mostly *de facto design-system convention*, not controlled UX research — with **one exception that has real W3C/WCAG backing** (the live-region announcement). Each claim is tagged accordingly.

### Result-range labels ("showing 21–40 of 500")

> **The range+total label is a fragmented convention, not a researched usability win — but its a11y announcement is a WCAG mandate.** *[Convention: High / Research: Low / A11y: High]*

- **Show-by-default is split by list type, not universal.** Data/enterprise tables ship it by default (Carbon `1–10 of 40 items`; MUI `1–10 of 50`; Ant `showTotal` → `1-20 of 85 items`); content/government systems **omit it entirely** (USWDS, GOV.UK pagination are page-navigation-only). No controlled NN/g or Baymard study backs "showing it improves usability" — the rationale (orientation / sense of scale) is principle, not measurement. *(Convention High, research Low.)*
- **Format convention:** `{from}–{to} of {total} {noun}`. The `Showing` prefix is prose-only — the component libraries omit it. **En-dash** for the range is typographically correct and is MUI's default; Ant uses an ASCII hyphen — adopt the en-dash. Run all three numbers through **`Intl.NumberFormat`** (MUI does; aligns with the intent's existing Intl-vocabulary stance). *(Convention/typography, Medium-High.)*
- **Degradation when total is unavailable (the key question — cursor protocols have no total):** ranked recommendation, drawn from convergent convention since no authority covers it —
  1. **Best — drop the total, keep the range:** `showing 21–40`, with next/prev driven by a `hasNextPage` boolean (Shopify Polaris is cursor-native and total-free by design; n+1 / fetch-`size+1` is the standard way to know "is there more" without a `COUNT`).
  2. **If a floor is cheaply known:** MUI's documented `count={-1}` → `21–40 of more than 40`, or the `500+` form.
  3. **Avoid `of many`** — folklore, no system or authority backs it.
  *(Engineered convention, Medium; explicitly not researched UX.)*
- **A11y — the one authority-backed mandate:** wrap the label in **`role="status"` + `aria-atomic="true"`** so the new range is announced politely after a page/filter change. This is W3C technique **ARIA22**, a *sufficient* technique for **WCAG 2.1 SC 4.1.3 Status Messages (AA)**. The pagination components themselves do **not** ship this wiring — it is an APG/WCAG-derived practice you apply yourself. *(High, primary W3C.)*
- **Structure/placement:** the label sits **outside** the `<nav aria-label="pagination">` landmark (the nav holds only page links); tables place it **below** the table (Material, Carbon, GOV.UK-after-content). Above-vs-below for search results is unsettled convention, no authority. *(Medium.)*

### Page-size selectors ("10 / 25 / 50 / 100 per page")

> **The 10/25/50/100 ladder is one fragmented convention, contradicted by NN/g; persistence is the one clearly-recommended behavior.** *[Convention: High / Ladder: fragmented / Persist: High]*

- **No canonical ladder.** `10/25/50/100` is MUI's default but not universal: Ant Design defaults to `[10, 20, 50, 100]`, Carbon demos `[10, 15, 20]`, and **USWDS, Polaris, Primer, GOV.UK, and Atlassian's core pagination ship no page-size selector at all** (items-per-page is left to app logic). Treat `10/25/50/100` as a *defensible default*, not a researched optimum. *(Convention High, fragmented.)*
- **Default size:** convention clusters at **10–25** (Ant/MUI default 10; Material example 25). NN/g's actual *research* recommendation: a single sensible default of **10 or 20**, and if you offer choices, **offer only two** (one substantially bigger) — which directly contradicts the ubiquitous 4-option dropdown. Honest framing: design systems ship 4 options; NN/g research argues for fewer. *(Default Medium-High; "fewer options" is a real NN/g claim but general item-list context.)*
- **Persistence — recommended.** NN/g is explicit: "almost always respect the user's stated preference and employ it as the default the next time around" (Atlassian concurs). **So the standard's default should be: persist the chosen page size.** The *mechanism* (URL query param vs localStorage vs server profile) has **no UX authority** — it's an implementation choice; a hybrid (query param for shareability + localStorage/server for the cross-session default) is reasonable engineering, not a researched rule. *(Persist: High; mechanism: unsettled.)*
- **A11y:** it is a native `<select>` — no bespoke APG pattern exists. Give it a visible label + `aria-label` (Carbon: "Items per page"). On change, announce the content update via the same live region as the range label; for focus/scroll there is **consensus on consistency, not on a specific target** (move focus to the first new row *or* keep it on the control — either is fine if done consistently and announced). Scroll-to-top is sensible but uncited. *(Labeling High; focus Medium.)*
- **Caveats:** very large page sizes hurt performance/perceived load (USWDS) and are only safe paired with lazy-loading (Baymard); **lower the ceiling on mobile** (Baymard ~15–30 loaded at once); an **"All" option** is appreciated when present but should be capped (~100 items) to avoid a scan/perf footgun (NN/g). *(High.)*

### What this changes in the standard

The `page` dimension of [Collection Operations](../src/_data/intents.json) gains a **`pageSize` dimension** (`fixed` | `selectable`) with the persistence default and ladder/default-size guidance in its prose, and the **`rangeLabel`** dimension's description is enriched with the no-total degradation ladder and the `role="status"` + `aria-atomic` WCAG-4.1.3 announcement mandate. Both stay **UX-only** (the offset/page-vs-cursor protocol remains in the Custom Pagination resource); the cross-layer constraint is unchanged — both affordances need a known total, so they compose only over an offset/page protocol.

## Open questions

Registered on the [backlog](../backlog/) — see those items, not restated here:

1. Focus + screen-reader announcement after a page change → [pagination-focus-announcement](../backlog/059-pagination-focus-announcement.md) (instance of [gap-6](../backlog/013-gap-6-focus-announcements.md)).
2. Result-range labels + page-size selectors → **resolved 2026-06-06** (see *Result-range labels & page-size selectors* above); folded into the Collection Operations `page` dimension.
3. The `infinite`/`virtualized` seam with windowed-collection/loader → [pagination-windowed-collection-seam](../backlog/062-pagination-windowed-collection-seam.md) — **resolved**: `infinite` = `append` + `advance:auto`, `virtualized` stays Windowed Collection.
4. Shared-vs-distinct dimensions across filter / sort / page / group — already owned by [gap-10](../backlog/006-gap-10-collection-ops-intent.md) (its "still open" per-dimension vocabulary).

## Caveats

UX-pattern recommendations rest on the Baymard/Smashing lineage (~2016, single research lineage, reaffirmed through 2024–2025, corroborated by NN/g) — treat load-more-as-default as **strong-but-domain-scoped** (e-commerce product/category lists), not universal. The load-more default and the "unique labels *must*" claim were 2-1 splits over *over-generalization* (lazy-loading on mobile; "should" vs "must"), not the core assertions. All platform-primitive and SEO claims are high-confidence primary-source, current as of 2026. One proposed claim — ">90% of load-more sites implement `pushState` incorrectly" — was **refuted 0-3** and excluded; the qualitative point that history/back-button support is commonly under-built survives, but do not cite a failure-rate statistic.

## Sources (primary)

- Slack Engineering — [Evolving API Pagination](https://slack.engineering/evolving-api-pagination-at-slack/) (cursor vs offset)
- MDN — [History.pushState](https://developer.mozilla.org/en-US/docs/Web/API/History/pushState), [History.scrollRestoration](https://developer.mozilla.org/en-US/docs/Web/API/History/scrollRestoration), [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API), [View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)
- Chrome — [scroll restoration](https://developer.chrome.com/blog/history-api-scroll-restoration), [cross-document view transitions](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document)
- Google Search Central — [Pagination & incremental page loading](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading)
- W3C WAI-ARIA APG — [Landmark regions](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/)
- Baymard — [Load More vs Pagination vs Infinite Scrolling](https://baymard.com/blog/external-load-more-vs-pagination-vs-infinite-scrolling)
