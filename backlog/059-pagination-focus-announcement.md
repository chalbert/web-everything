---
type: decision
workItem: story
size: 3
status: resolved
blockedBy: ["013"]
dateOpened: "2026-06-03"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
preparedDate: "2026-06-11"
relatedReport: reports/2026-06-11-pagination-focus-announcement.md
relatedProject: webintents
crossRef: { url: /backlog/013-gap-6-focus-announcements/, label: gap-6 focus & announcements }
tags: [pagination, a11y, focus, announcements, collection-ops]
---

# Specify focus + screen-reader announcement after a page change

When the user moves to a new page, what should happen to focus and what should be announced? This is the pagination-specific instance of [gap-6 — Focus & Announcements](/backlog/013-gap-6-focus-announcements/). The verified a11y baseline is settled (`<nav aria-label="pagination">` + `aria-current="page"`, WAI-ARIA APG); what was deliberately left unverified by the [pagination standard research](../reports/2026-06-03-pagination-standard-research.md) is the *post-change* focus/announcement behavior. The owed WAI-ARIA APG / NN-g / screen-reader-practice pass is now done and published as the [Pagination Focus & Announcement](/research/pagination-focus-announcement/) research topic.

**Digest.** Grounded in the WAI-ARIA APG focus-management practice, the canonical [WebAIM screen-reader-user thread](https://webaim.org/discussion/mail_thread?thread=9022), GitHub Primer / Visa / a11ymatters, NN/g, and WE's own shipped prior art (`announce()`, the `autofocus-on-activation` + `navigation` intents). The headline: **neither half is net-new — both are already-owned intents the pagination block composes**, so #059 is a composition ruling, not an authoring build. **Fork 1 (focus):** compose `autofocus-on-activation`, default **`landing: heading`** (the APG answer; `preserve` is the rapid-paging opt-in, `auto` for full-reload `?page=n`). **Fork 2 (announcement):** compose `live-region-status`, **always announce** *"Page 2 of 10"* via the shipped clause-joined polite-status shape — a fixed mechanic, not a toggle.

**Axis-framing — the two halves are independent, and both already own a home in the tree.** Focus-movement and announcement are orthogonal axes (you can announce without moving focus, and moving focus does not announce), so the trait needs two composition notes, not one coupled "a11y" toggle. The *announcement* half has shipped prior art: `announce()` ([blocks/renderers/data-table/renderDataTable.ts:246](../blocks/renderers/data-table/renderDataTable.ts#L246)) builds a clause-joined polite-status string for one `aria-live` region (*"Sorted by Salary, descending; 3 of 6 shown"*) and its own doc comment ([renderDataTable.ts:242](../blocks/renderers/data-table/renderDataTable.ts#L242)) names pagination's *"page 2 of 10"* as the analogue to share that **pattern**. The pagination renderer is already half-wired: its range label carries `role="status"` ([blocks/renderers/pagination/renderPagination.ts:88](../blocks/renderers/pagination/renderPagination.ts#L88)) but is **not populated on a page change**, and never moves focus ([renderPagination.ts:78](../blocks/renderers/pagination/renderPagination.ts#L78)) — that single un-wired seam is the whole concrete deliverable. The *focus* half is the focus-after-view-swap question, already owned by `autofocus-on-activation` ([intents.json:1882](../src/_data/intents.json#L1882), `landing: heading|target|preserve|auto`, default `heading`), which the `navigation` intent **already composes** for view swaps ([intents.json:1194](../src/_data/intents.json#L1194)). The announcement home is `live-region-status` ([intents.json:155](../src/_data/intents.json#L155)).

### Recommended path at a glance

Ratify both rows, or override the one you'd change. The **confidence** column says where judgment is actually needed vs. where to nod.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · focus after a page change** | compose `autofocus-on-activation`, default `landing: heading` (`preserve`/`auto` opt-ins) | bake focus-stays-on-control, or a private pagination focus vocabulary *(rejected)* | **High** — APG + Navigation already composes this atom |
| **2 · announcement** | compose `live-region-status`, **always** announce *"Page 2 of 10"* (polite, clause-joined) | make announcement an opt-in toggle *(rejected)* | **High** — WCAG 4.1.3 / ARIA22 + unanimous in sources |

## Fork 1 — where does focus land after a page change?

**Crux.** A `paged` page change replaces the slice of content under the controls — it *is* a surface activation, the same shape a view swap is. The WAI-ARIA APG answer to "a new surface became active, where does focus land?" is the results region's heading, made focusable (`tabindex="-1"` + `.focus()`). WE already extracted this as `autofocus-on-activation` ([intents.json:1882](../src/_data/intents.json#L1882)) with `landing: heading|target|preserve|auto`, default `heading`, and the `navigation` intent **already composes it** for view swaps ([intents.json:1194](../src/_data/intents.json#L1194)). The sources disagree on focus-movement — and that disagreement (not a missing answer) is the signal that this is a *dimension*, already expressed by `landing`.

- **(A — recommended) Compose `autofocus-on-activation`; no private pagination focus vocabulary.** A page change fires the `landing` contract against the results region. The four values cover every option the sources debate: `heading` (default, APG — *"lines me up for reading the new records"*, the WebAIM screen-reader-user preference); `target` (an author-named element, e.g. the first result); `preserve` (stay on the control — the rapid-paging preference *"I might want to hit next-page several times"*, and the natural value for `append`/load-more); `auto` (full-document reload of `?page=n` — browser handles focus, no script). Reload-vs-dynamic (GitHub Primer's split) is absorbed by `auto` vs explicit `heading`/`target` — no separate dimension. Cost: none — the intent exists and is already composed elsewhere.
- **(B) Bake focus-stays-on-control, or coin a pagination-private focus axis.** Cheaper to state, but (1) both focus branches are legitimate end-states so baking one violates "dimension if both branches are legitimate", and (2) a private axis duplicates `autofocus-on-activation`'s exact `heading|target|preserve|auto` set across two homes. Rejected.

**Default → A, `landing: heading`** (most-flexible/APG default; `preserve` the rapid-paging opt-in, `auto` for reload).

*Rejected:* coupling focus + announcement into one "a11y" toggle (they are orthogonal axes — Finding 1); making `heading` mandatory (`preserve` is a legitimate end-state); a pagination-private focus dimension (duplicates the owned atom).

## Fork 2 — what is announced, and is announcing optional?

**Crux.** A page change is a content update the screen-reader user on the controls must learn about. The W3C-backed mechanism is `role="status"` + `aria-atomic="true"` — technique **ARIA22**, *sufficient* for **WCAG 2.1 SC 4.1.3 Status Messages (AA)** — and WE already ships the shape: the clause-joined polite-status string of `announce()` ([renderDataTable.ts:246](../blocks/renderers/data-table/renderDataTable.ts#L246)), whose doc comment ([renderDataTable.ts:242](../blocks/renderers/data-table/renderDataTable.ts#L242)) already designates *"page 2 of 10"* as the pagination analogue. Home = `live-region-status` ([intents.json:155](../src/_data/intents.json#L155)).

- **(A — recommended) Compose `live-region-status` (`urgency: polite`); always announce, via the shared clause-joined shape.** On every page change, populate the existing `role="status"` region ([renderPagination.ts:88](../blocks/renderers/pagination/renderPagination.ts#L88)) with *"Page 2 of 10"* — optionally extended with the verified range clause (*"; showing 21–40 of 500"*). Polite, never `alert` (a page change is advisory). Announcement is a **fixed mechanic**: every source agrees it is mandatory regardless of where focus goes (the WebAIM thread's one point of unanimity; the gap GitHub Primer leaves open). Cost: wire the renderer's existing region — the analogue of Data Table's shipped `announce()` + click wiring.
- **(B) Make announcement an opt-in toggle (`announce: on | off`).** Tempting for symmetry with the focus dimension, but there is no legitimate end-state where a content swap goes silently unannounced for AT — that fails WCAG 4.1.3. So this is not a real fork. Rejected.

**Default → A; always announce** *"Page 2 of 10"*, polite, clause-joined.

*Rejected:* an `announce: off` mode (no legitimate silent end-state — WCAG 4.1.3); `assertive`/`alert` urgency (a page change does not interrupt — reserve for errors); inventing a second live region (one polite region per app — the `announce()` convention).

## Resolution — ratified 2026-06-11

- **Fork 1 — compose `autofocus-on-activation`, default `landing: heading`**: a page change is a surface activation; the APG answer is the results-region heading, and the atom is already owned and already composed by `navigation` — `preserve`/`target`/`auto` cover the rapid-paging and full-reload opt-ins. No pagination-private focus vocabulary.
- **Fork 2 — compose `live-region-status`, always announce *"Page 2 of 10"***: a content swap the AT user must learn about is a fixed mechanic (WCAG 4.1.3 / ARIA22), not a toggle — populate the existing `role="status"` region polite, via the shipped clause-joined shape. No legitimate silent end-state.

This resolves #059 to a **composition ruling** (pagination composes `autofocus-on-activation` + `live-region-status`); no new intent/protocol/entity — hence `graduatedTo: none`.

**Follow-on builds (not yet scaffolded):**

- Wire the pagination renderer's existing `role="status"` region to populate *"Page 2 of 10"* (+ optional range clause) on every page change · task · blockedBy: none (region exists at `renderPagination.ts:88`). → #326
- Move focus per `landing` (default `heading`, `tabindex="-1"`+`.focus()`) on a page change · task · blockedBy: none. → #327

## Progress

**Status:** resolved 2026-06-11 — both forks ratified to their bold defaults (composition ruling). Originally prepared into fork shape 2026-06-11; owed WAI-ARIA APG / NN-g / screen-reader-practice research done and graduated to the [Pagination Focus & Announcement](/research/pagination-focus-announcement/) topic + [report](../reports/2026-06-11-pagination-focus-announcement.md). Both forks carry a high-confidence recommended default; awaiting ratification.

**Note on outcome shape.** The research finding is that both halves are *already-owned composition*, not net-new vocabulary — so ratifying these forks resolves #059 to a **composition ruling** (pagination composes `autofocus-on-activation` + `live-region-status`), and the only build it implies is the thin renderer wiring (populate the status region + move focus per `landing`), not an intent or protocol authoring task. Mirrors how [gap-6 (#013)](/backlog/013-gap-6-focus-announcements/) resolved the general concern by pointing at owned intents.
