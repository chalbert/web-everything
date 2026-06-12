# Pagination: Focus + Announcement After a Page Change — Research Report

**Date:** 2026-06-11
**Scope:** The one open question the [pagination standard research](./2026-06-03-pagination-standard-research.md) deliberately left unverified: when the user moves to a new page, **what happens to focus** and **what is announced**. The verified a11y baseline (`<nav aria-label="pagination">` + `aria-current="page"`) is settled and out of scope; this report covers only the *post-change* behavior, grounding [backlog #059](../backlog/059-pagination-focus-announcement.md).
**Method:** WAI-ARIA APG focus-management practice + the focus-after-view-swap pattern already codified in WE intents; a WebAIM accessibility-list thread (the canonical screen-reader-user debate on this exact question); GitHub Primer, Visa, and a11ymatters pagination accessibility guidance; NN/g pagination usability. Cross-checked against the existing WE prior art in the tree (`announce()`, the `autofocus-on-activation` and `navigation` intents).
**Goal:** Decide where focus lands after a page change and how the change is announced — and, more importantly, decide **whether either is net-new vocabulary or already-owned composition**.

---

## Executive summary

**Neither half is net-new. Both are already-owned WE intents the pagination block composes; #059 is a composition ruling, not an authoring build.** The research splits cleanly into two independent axes — *focus* and *announcement* — and the platform (and WE's own intent set) already owns each:

- **Focus after a page change is the focus-after-view-swap question, already owned by [`autofocus-on-activation`](../src/_data/intents.json) (intents.json:1882).** A page change is a surface activation: the slice of content under the controls is replaced. The WAI-ARIA APG answer to "a new surface became active, where does focus land?" is `landing: heading` (the results region's heading, made focusable via `tabindex="-1"` + `.focus()`), and that intent already defaults to exactly that. The [`navigation`](../src/_data/intents.json) intent (intents.json:1142) *already composes* this atom for view swaps. Pagination does the same. No new focus vocabulary.

- **The announcement is the clause-joined polite-status pattern already shipped by Data Table.** `announce()` (`blocks/renderers/data-table/renderDataTable.ts:246`) emits a clause-joined string into one polite `aria-live` region — *"Sorted by Name, ascending; 6 rows"*. The pagination analogue is the same region holding *"Page 2 of 10"* — already named as the reuse target in that function's own doc comment. The intent home is [`live-region-status`](../src/_data/intents.json) (intents.json:155). The pagination renderer already has the region (`role="status"` on its range label — `blocks/renderers/pagination/renderPagination.ts:88`); it is **not yet populated on a page change**, which is the concrete gap.

- **The genuine fork is narrow and has no industry consensus: does focus *move* at all, or do we *announce only* and leave focus on the control?** The WebAIM thread is an explicit, unresolved disagreement between two expert screen-reader users (one prefers focus-to-heading, one prefers focus-stays-on-control), with universal agreement on one thing: **the change must be announced regardless.** So announcement is a fixed mechanic; focus-movement is the configurable dimension. WE resolves this by *not picking one and baking it* — it points the focus axis at `autofocus-on-activation`'s existing `landing` set (`heading | target | preserve | auto`), so an author who wants focus-stays uses `preserve`, and the default is the APG `heading`.

**Net:** #059 resolves to *"compose two existing intents; add no new vocabulary."* The only build it implies is wiring the pagination renderer to populate its existing status region and move focus per the `landing` value — a thin block-author task, not an intent or protocol.

---

## Findings

### 1. The two halves are independent axes (the structure)

> **Focus-movement and announcement are orthogonal: you can announce without moving focus, and moving focus does not announce.** *[Confidence: High]*

Every source treats them separately. Moving focus to a heading *happens* to announce that heading (a screen reader reads the newly-focused element), but the WebAIM thread is explicit that this is insufficient on its own — Jonathan Avila: *"screen readers will definitely need some information letting them know that the main context of the page indeed was updated."* And announcing via a live region does not move focus at all. So the trait model needs **two** dimensions, not one coupled "a11y" toggle. This mirrors the report's own structural finding for pagination as a whole (presentation × protocol are independent axes).

### 2. Focus-after-page-change IS the focus-after-view-swap question (grounds the focus fork)

> **A page change is a surface activation; the APG answer is `landing: heading`, and WE already owns that vocabulary in `autofocus-on-activation`.** *[Confidence: High, primary + existing WE intent]*

The WAI-ARIA APG's focus-management practice is that when a new surface becomes active, initial focus lands somewhere by a closed set — for a content region, the region's main heading made programmatically focusable (`tabindex="-1"` + `.focus()`). WE has already extracted this as the [`autofocus-on-activation`](../src/_data/intents.json) intent (intents.json:1882), whose `landing` dimension is exactly `heading | target | preserve | auto` with **default `heading`** ("The WAI-ARIA APG answer and the overwhelmingly correct default"). Crucially, the [`navigation`](../src/_data/intents.json) intent **already composes this atom** for view swaps (intents.json:1194: *"Focus reset: where focus lands after a view swap is the Autofocus-on-Activation intent… APG default: the new view's main heading"*).

A `paged` page change (`pageMode: paged` — replace the slice) is precisely a view swap of the results region. So pagination composes the *same* atom the navigation intent already does. The four `landing` values map onto every option the sources debate:

- `heading` (default) — focus the results region's heading (*"Search results, page 2 of 10"*). The APG answer; the option Isabel Holdsworth (a screen-reader user, in the WebAIM thread) *"marginally prefer[s]… as it lines me up for reading the new records."*
- `target` — an author-named element (e.g. the first result), for authors who want focus on content rather than a heading.
- `preserve` — leave focus on the pagination control. This is Glen Walker's preference in the same thread (*"I might want to hit 'next page' several times. If the focus had moved back to the table, I'd have to navigate back to the next button every time."*) — legitimate for rapid sequential paging, and the natural default for `append`/load-more (you stay on the button you keep pressing).
- `auto` — platform default (honor a URL fragment / `autofocus`, else `heading`); the right value when a `paged` change is a *full document reload* with a `?page=n` URL, where the browser handles focus and no script runs.

### 3. Announcement is the shipped clause-joined polite-status pattern (grounds the announcement fork)

> **"Page N of M" goes into the one polite live region WE already uses for status, via the same clause-joined shape Data Table shipped.** *[Confidence: High, primary W3C + existing WE prior art]*

The verified-2026-06-06 addendum to the pagination report already established the W3C-backed mandate that a content-update status (the range label) be announced via `role="status"` + `aria-atomic="true"` — W3C technique **ARIA22**, *sufficient* for **WCAG 2.1 SC 4.1.3 Status Messages (AA)**. The page-change announcement is the same mechanism. WE's prior art is concrete and self-documenting: `announce()` in `blocks/renderers/data-table/renderDataTable.ts:246` builds a clause-joined string (*"Sorted by Salary, descending; 3 of 6 shown"*) for one polite region, and its own doc comment names pagination's *"page 2 of 10"* as the analogue to share the **pattern** (region + clause string), not the wording. The intent home is [`live-region-status`](../src/_data/intents.json) (intents.json:155): `urgency: polite` (the safe default — a page change is advisory, never an `alert`).

The pagination renderer is *already* half-wired: `renderPagination.ts:88` gives the range label `role="status"`, but it is only populated at render time with the range text — it is **not updated with "Page N of M" on a page change**, and there is no focus move. That single un-wired seam is the entire concrete deliverable behind #059.

### 4. There is no industry consensus on focus-movement — and that is the signal to make it a dimension, not a baked mechanic

> **Two expert screen-reader users disagree on whether focus should move; both agree announcement is mandatory.** *[Confidence: High — the disagreement itself is the finding]*

The WebAIM list thread is the canonical airing of this exact question and it does **not** converge: focus-to-heading (Isabel Holdsworth) vs focus-stays-on-control (Glen Walker), with Isabel's closing synthesis being *"Whichever you choose to do, as long as you do it accessibly and consistently, your users will get used to it very quickly."* Design systems split the same way along a different seam — **reload vs dynamic update**:

- **GitHub Primer:** *"When Pagination reloads the page, there is no need for any focus management"* vs *"When Pagination is used for dynamic in-page updates… focus must be programmatically moved to the updated content"* — i.e. move focus *only* in the SPA case. (Primer notably does **not** prescribe a live region, which is a gap WE's `live-region-status` composition fills.)
- **a11ymatters / Visa / Mesa:** converge on a live-region announcement of the new page so a user on the control still learns it changed, *whether or not* focus moves.

Per WE's "expose a fork as a dimension only if both branches are legitimate end-states" rule, both focus branches are legitimate (rapid-paging vs read-the-new-records), so focus-movement is a **configurable dimension** — and it is already configurable, because it *is* `autofocus-on-activation.landing`. The most-flexible / APG default is `heading`; `preserve` is the rapid-paging opt-in. Announcement, by contrast, has unanimous support — it is a **fixed mechanic** (always announce), not a dimension.

### 5. Why this is composition, not new vocabulary (the load-bearing conclusion)

> **#059 adds zero intents and zero protocols; it rules that the pagination block composes `autofocus-on-activation` (focus) + `live-region-status` (announcement).** *[Confidence: High]*

The item's original phrasing ("specify focus + announcement after a page change… before the pagination a11y trait is final") predates the intents that now own both halves. With `autofocus-on-activation` (graduated, owns `landing`) and `live-region-status` (owns the polite region) both shipped, and `navigation` already demonstrating the exact focus-after-swap composition, the pagination block has nothing to *author* — only to *compose and wire*. This is the same outcome gap-6 (#013) reached for the general focus/announce concern: the pieces are owned by `focus-delegation` + `live-region-status` + `focus-containment`, leaving only specific compositions to make. #059 is the pagination-specific composition.

---

## What this means for the standard's shape

The pagination a11y trait (on the Collection Operations `page` dimension / the pagination block) gains two composition notes, no new dimensions of its own:

1. **Focus → compose `autofocus-on-activation`.** A `paged` page change fires the `landing` contract against the results region. Default `heading` (APG); `preserve` is the rapid-paging opt-in and the natural value for `append`/load-more; `auto` for full-reload `?page=n`. No private focus vocabulary on pagination.
2. **Announcement → compose `live-region-status`, `urgency: polite`.** On every page change, populate the existing `role="status"` region with the clause-joined string (*"Page 2 of 10"*, optionally *"; showing 21–40 of 500"* reusing the verified range-label clause), via the same `announce()`-shaped helper Data Table uses. Announcement is mandatory (fixed mechanic), not a toggle.
3. **The concrete build** is the renderer wiring: `renderPagination.ts` populates its status region and moves focus per `landing` on a page-change interaction — the analogue of Data Table's already-shipped `announce()` + sort-click wiring. A thin block-author task; no intent/protocol authoring.

---

## Caveats

- The focus-movement disagreement is from expert practitioner discussion (WebAIM list) and design-system convention, **not** a controlled usability study; treat "default to `heading`" as APG-grounded best practice, not measured optimum. The one measured/authority-backed claim is the *announcement mandate* (WCAG 4.1.3 / ARIA22).
- The reload-vs-dynamic split (Primer) is a real branch but it is **already absorbed** by `landing: auto` (reload) vs explicit `heading`/`target` (dynamic) — it does not need its own dimension.
- `append`/load-more and `infinite` are out of the sharp focus of this question (you are not replacing a slice, you are growing a list); their natural focus value is `preserve` and their announcement is a count (*"20 more loaded, 60 of 500"*), which composes the same `live-region-status` region. Not re-derived here.

## Sources (primary / load-bearing)

- W3C WAI-ARIA APG — [Developing a Keyboard Interface / focus management](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/), [Landmark Regions](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/)
- W3C — technique [ARIA22 (role=status for status messages)](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22), WCAG 2.1 SC 4.1.3 Status Messages
- WebAIM accessibility list — [pagination focus management thread](https://webaim.org/discussion/mail_thread?thread=9022) (the canonical screen-reader-user debate)
- GitHub Primer — [Pagination accessibility](https://primer.style/product/components/pagination/accessibility/) (reload vs dynamic-update focus rule)
- a11ymatters — [Accessible Pagination](https://a11ymatters.com/pattern/pagination/); Visa — [Pagination (NAV-007)](https://developer.visa.com/pages/accessibility/navigation/nav-007)
- NN/g — [Users' Pagination Preferences](https://www.nngroup.com/articles/item-list-view-all/)
- WE prior art (in-tree): `blocks/renderers/data-table/renderDataTable.ts:246` (`announce()`); `blocks/renderers/pagination/renderPagination.ts:88` (existing `role="status"` region); `src/_data/intents.json:1882` (`autofocus-on-activation`), `:155` (`live-region-status`), `:1142` (`navigation` composing the focus atom)
