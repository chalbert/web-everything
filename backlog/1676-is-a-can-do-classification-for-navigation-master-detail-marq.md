---
kind: decision
parent: "1442"
status: resolved
dateOpened: "2026-06-23"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: none
codifiedIn: one-off
preparedDate: "2026-06-23"
locus: frontierui
relatedProject: webcomponents
relatedReport: reports/2026-06-23-1442-slice-wave-4.md
tags: [packaging, custom-elements, block-model, conversion, behaviors, decision, frontierui]
---

# is-a/can-do classification for navigation, master-detail, marquee-select, edit-in-place, annotation, bulk-action

Apply the #1457 is-a/can-do test (codified [we:docs/agent/block-standard.md](/docs/agent/block-standard.md) Packaging governance §7) to the six remaining Wave-4 blocks under #1442. The test asks one question — *is it a thing or a capability?* A **styled noun** you instantiate / style / name / generate framework flavors of → an `is-a`, becomes a `we-*` element (then a mechanism A/B/C is picked downstream). A **headless verb** you attach to a host the author already owns → a `can-do`, stays a `CustomAttribute`/behavior and **exits #1442 scope**.

This decision **ratifies shipped code against a codified test** — it mutates no code; it tags each block's destination. The reading is forced by two independent signals that agree for every block: (1) the **standard layer** already split each concern as a UX *what* (an intent that *composes*, never a styled component) — or, for marquee-select, shipped it explicitly as a behavior with **no intent** (#1406); (2) the **FUI code** attaches every block to host markup the author owns and instantiates **no styled element of its own**. So all six resolve the same way — **can-do → exits scope** — and there is no genuine either/or fork. The one block whose name *could* read as a noun (master-detail "is a layout") is addressed in the skeptic note below.

## Recommended path at a glance — classification table

| Block | #1457 verdict | Destination | Owning standard-layer frame | Confidence |
|---|---|---|---|---|
| navigation | **can-do** (headless verb) | exits #1442 — stays `CustomAttribute` | navigation intent (UX behaviors of a view change) | high |
| master-detail | **can-do** (coordination verb) | exits #1442 — stays a coordinator behavior | master-detail intent ("composition, not a new contract") | high |
| marquee-select | **can-do** (headless verb) | exits #1442 — stays a behavior | **no intent** — shipped as a behavior block (#1406/#1463) | high |
| edit-in-place | **can-do** (thin lifecycle verb) | exits #1442 — stays a behavior | edit-in-place intent ("thin primitive… a FUI behavior block") | high |
| annotation | **can-do** (UX payload-attach verb) | exits #1442 — stays a behavior | annotation intent (UX-only payload over a host) | high |
| bulk-action | **can-do** (fan-out verb) | exits #1442 — stays a behavior | bulk-action intent ("FUI the behavior block") | high |

**Net effect on #1442:** all six exit the conversion epic. Combined with #1674 (pan-zoom-surface) and #1675 (temporal) being the only remaining `we-*` conversions, and dockable parked under #1653, this **drains the epic's catalog** down to those two converted-elsewhere blocks — #1442 resolves once #1674/#1675 land.

## Ratify (forced by the #1457 test)

Each block below is a one-line forced-invariant classification, not a weighed fork — both the standard layer and the FUI code agree. Per-block rationale with code + owning-intent citations:

- **navigation → can-do.** Three `CustomAttribute` subclasses (`nav:list`, `nav:section`, `nav:menubar`) registered onto an author's `<nav>`; the block owns **only** roving-tabindex + `aria-current` sync, no styled identity. Code: fui:blocks/navigation/NavListBehavior.ts:34 (`extends CustomAttribute`), fui:blocks/navigation/registerNavigation.ts:18-20 (`attributes.define('nav:list', …)`). Standard layer: [we:src/_data/intents/navigation.json](/intents/navigation/) frames navigation as the *UX behaviors a view change carries* (history/scroll/transition/guard/persistence) — the styled structures it names (Tabs/Wizard) are **separate** `we-` blocks (deck/tabs already converted under #1457), not this block.
- **master-detail → can-do.** A coordinator class that **composes** `SelectionBehavior` over an author-supplied master+detail; it registers **no element** — `registerMasterDetail()` is deliberately empty with the comment "No custom element — the coordinator is consumed directly." Code: fui:blocks/master-detail/MasterDetailBehavior.ts:76-79. Standard layer: [we:src/_data/intents/master-detail.json](/intents/master-detail/) states it outright — *"It is composition, not a new contract. Master-Detail has no provider and no schema of its own; it composes intents that already exist."*
- **marquee-select → can-do.** `createMarqueeSelect(surface, options)` attaches a rubber-band recognizer to an author surface and composes Selection; the only DOM it makes is an internal `aria-hidden` band overlay — not a styled component identity. Code: fui:blocks/marquee-select/MarqueeSelect.ts:45 (`createMarqueeSelect(surface, options)`), :3-12 (header: "the marquee-select **behavior block** … ratified #1406"). Standard layer: **no intent file exists** — it shipped as a behavior per #1406/#1463, so the standard never framed it as a styled noun.
- **edit-in-place → can-do.** `createEditInPlace(host, options)` swaps a host's display↔editor renderers for one atomic value; the host and its layout are the author's. Code: fui:blocks/edit-in-place/editInPlace.ts:82 (`createEditInPlace(host, options)`), :1-6 (header: "the edit-in-place **behavior block**"). Standard layer: [we:src/_data/intents/edit-in-place.json](/intents/edit-in-place/) — *"a reusable thin primitive… owns ONLY the thin residual… the contract (this intent) and its realization (a FUI **behavior block**…)."*
- **annotation → can-do.** `AnnotationBehavior` attaches a motivation payload (highlight/comment/tag/suggestion) to a selection over a host's read-only or editable content, delegating the durable anchor to the injected range-anchor contract; it owns no styled surface of its own. Code: fui:blocks/annotation/AnnotationBehavior.ts:1-8 (header: "the FUI runtime realizing the `annotation` intent… UX-only: it owns the *what*"). Standard layer: [we:src/_data/intents/annotation.json](/intents/annotation/) — *"UX-only: the durable target is delegated… this intent owns no anchor machinery,"* composing selection/rich-text/anchor.
- **bulk-action → can-do.** `createBulkActionBar(options)` binds an **author-supplied** bar element to a live selection set and fans one command across the targets; the bar is the author's, the block owns only the residual (fan-out, count binding, partial-failure contract). Code: fui:blocks/bulk-action/bulkAction.ts:72 (`createBulkActionBar`), :1-6 (header: "the bulk-action **behavior block** … binds a contextual action bar to a live selection set"). Standard layer: [we:src/_data/intents/bulk-action.json](/intents/bulk-action/) — *"WE owns the intent, FUI the **behavior block**… FUI ships the behavior block that binds the bar to the live selection set (#1462)."*

**Skeptic — could any be a real fork I wrongly collapsed?** I attacked each "deterministic" call against the other reading:

- **master-detail** is the only block whose name reads as a noun ("a master-detail *layout*") and is the natural is-a candidate. But the is-a reading requires the block to *instantiate, style, name, and generate framework flavors of* a layout — and it does none: it makes no DOM, registers no element, and the intent itself says "no provider and no schema of its own." The styled regions a master-detail *uses* are owned by the **layout** intent it composes, not by this coordinator. So the noun is the *use-site's* layout, not this block's identity — the is-a reading is incoherent here, not merely unpicked. (Worked-example check, #1457: stepper/deck/tabs each shipped **both** a `we-` element and a behavior because they have a styled coordinated surface; master-detail has no such surface of its own to style — it is the behavior floor only.)
- **navigation** could be read as "a nav *bar* is a thing," but the styled nav surfaces are the separate `disclosure-nav`/`sectioned-nav`/`app-shell` blocks already converted under Wave 3 — this block is purely the roving-tabindex capability that rides any `<nav>`, so the noun is a different, already-`we-` block.
- **edit-in-place / bulk-action** each carry a small stylesheet (`fui-edit-in-place`, `fui-bulk-action`), which is the closest thing to an is-a signal. But per the §7 codification — *"Even though a behavior can technically apply style classes, it should not… owning a styled identity is an is-a concern; folding it into a can-do behavior is a category error"* — a behavior shipping affordance CSS (a focus ring, a hidden-until-selected bar) does **not** make it a styled noun; the host element it enhances stays the author's. The CSS styles the *enhancement state*, not a packaged component.
- **annotation / marquee-select** never approach the is-a line — they paint over / attach to host content and own no element.

**Skeptic note on the set as a whole:** the risk in a six-way "all the same verdict" pass is a rubber-stamp that misses a buried noun. The mitigation here is that two **independent** signals (the standard-layer split and the FUI code shape) were checked per block and **agree** for all six — and the only block with a noun-shaped name (master-detail) was attacked directly and fails the is-a test on the no-element / no-schema fact, not on a judgment call. No block survives as a genuine `## Fork N`.

## Context

**Why no `## Fork N`.** The #1457 test is largely deterministic: a block is a fork only when *both* is-a and can-do are coherent end-states (the stepper/deck/tabs case, where a styled coordinated surface genuinely existed *and* a headless floor genuinely existed → support-both). For these six, only the can-do reading is coherent — none instantiates or styles an element of its own — so each is a forced-invariant classification, ratified as a one-liner above, not weighed.

**What "exits scope" means.** A can-do block is **not converted** to a `we-*` element. It stays a `CustomAttribute`/behavior — the #1381 "behaviors riding native elements" end-state — and leaves #1442 (the *element*-conversion epic). It needs no downstream conversion task. The only blocks needing a conversion `task` filed on pickup would be any classified is-a; here there are none.

**Lineage.** Parent epic #1442 (block-model conversion); Wave-4 split [we:reports/2026-06-23-1442-slice-wave-4.md](/reports/2026-06-23-1442-slice-wave-4.md) which flagged these six as `is-a / can-do (#1457 test)`. The test is codified at [we:docs/agent/block-standard.md](/docs/agent/block-standard.md) Packaging governance §7 (the #1457 element-over-behavior worked example). Sibling Wave-4 decisions: #1674 (pan-zoom-surface B-vs-C), #1675 (temporal A-vs-B).

**Decision turn (fast ratify).** Confirm the six can-do classifications (or contest any one as a real is-a/can-do fork), then resolve: each block exits #1442; no conversion tasks filed. On resolve, #1442 is down to #1674/#1675 plus parked dockable (#1653).
