# Standards needed to support a slide deck built on WE + FUI

**Status:** research for epic #1173 (deck/slide standards). **Date:** 2026-06-19.

A slide **deck** (Reveal.js / Slidev / Spectacle / Impress.js / Keynote-on-web class) is a
demanding composition target: it exercises navigation, view transitions, theming, expressions,
keyboard input, prefetch, layout, and realtime all at once. The question this report answers is
**not** "how do we build a deck" — it is **which of those capabilities already have a WE standard
to compose, and which are genuine gaps that need a new WE contract** — so the epic's child specs
reference existing contracts instead of reinventing them, and the gaps are scoped at the right
constellation layer.

**Boundary up front (the load-bearing frame).** Per
[we:docs/agent/platform-decisions.md](../docs/agent/platform-decisions.md) and the constellation-layering precedent
(#091/#475): WE owns **contracts/protocols/intents/semantics** only. The rendered slide/deck
**components**, the authoring UI, and the magic-move/animation aesthetics are **FUI**. The hosted
deck product (export service, sharing, collaboration) is **plateau**. So this epic scopes to the
**WE-standards layer**: the deck is the forcing function, the contracts are the deliverable. A deck
"built using WE standards + FUI components" means FUI components conform to these WE contracts.

## Native-platform substrate (what the standards lean on)

The web platform now covers most deck mechanics natively — the standards should be native-first:

- **View Transitions API** (Baseline 2025; same-doc + cross-doc `@view-transition`) — slide-to-slide
  transitions and named-element morph (reveal `auto-animate`, Keynote "Magic Move", Slidev/Marp
  `view-transition`). **Caveat: VT does *not* auto-respect `prefers-reduced-motion`** — the author
  must gate it. Only Marp does this correctly out of the box → a real conformance obligation.
- **CSS Scroll Snap** (Baseline) — native slide sequencing; **CSS carousel pseudo-elements**
  (`::scroll-button()`, `::scroll-marker`, Chromium-only) for prev/next + dots with zero JS.
- **CSS Paged Media** (`@page` + `break-after: page`, Baseline 2019) — native one-slide-per-page PDF.
- **BroadcastChannel** (Baseline 2022) — the portable cross-window presenter-sync primitive. (The
  **Presentation API** *looks* right but is Chromium-only/dead in Safari+Firefox — not a dependency.)
- **History/Navigation API** — deep-link to a slide; **Intersection Observer** — lazy/preload adjacent
  slides + view tracking; **Screen Wake Lock** — keep screen on during autoplay/kiosk.
- **`prefers-reduced-motion`**, ARIA live regions, semantic sections — a11y primitives every surveyed
  framework underuses (reveal core ships *no* reduced-motion rule; Impress.js is a11y-hostile).

## REUSE — deck capabilities already covered by a WE standard

These need **no new spec**; the deck composes them (cite, don't reinvent):

| Deck need | Existing WE standard |
|---|---|
| Slide navigation / history / scroll-reset | `navigation` intent + `route`/`deep-link`/`navigation-api`/`scroll-restoration` semantics + [we:router block](../src/_data/blocks/router.json) |
| Slide visibility / conditional reveal substrate | [we:view block](../src/_data/blocks/view.json) + `view`/`view-transition` semantics |
| Slide-advance carousel mechanics (scroll-snap, APG, pause) | [we:carousel block](../src/_data/blocks/carousel.json) |
| Transition physics + reduced-motion feel | `motion` intent + `view-transition` semantic |
| Deck shell (header/main/footer landmarks) | `layout` intent + [we:app-shell block](../src/_data/blocks/app-shell.json) |
| Keyboard shortcuts (next/prev/overview), cross-shadow | [we:keyboard-shortcuts block](../src/_data/blocks/keyboard-shortcuts.json) |
| Theme tokens (colors/type/spacing/elevation) | `design-tokens` protocol + webtheme project |
| Next-slide prefetch | `prefetch` intent + [we:prefetch-behavior block](../src/_data/blocks/prefetch-behavior.json) + `viewport-presence` |
| Slide layering / depth | `surface` intent |
| Deck state (current index, presenter on, zoom) | [we:simple-store block](../src/_data/blocks/simple-store.json) |
| Slide-array rendering / data interpolation | [we:for-each block](../src/_data/blocks/for-each.json) + webexpressions (`{{ }}`) |
| Component architecture (custom elements, DI, scoped) | webcomponents project |
| Scoped sibling-component events (slide-advanced …) | webevents project + [we:broadcast block](../src/_data/blocks/broadcast.json) |
| Slide outline / navigator (optional) | [we:nav-list](../src/_data/blocks/nav-list.json) / [we:sectioned-nav](../src/_data/blocks/sectioned-nav.json) |
| Media/content/notes loading | webresources project |
| Overlay/notes panel out-of-flow | webportals project |
| Aspect-ratio fitting (base) | `fit` semantic (needs deck extension — see GAP 7) |
| Realtime transport for multiplex (base) | webrealtime + `transport-negotiation` protocol |

## GAP — deck capabilities with no WE standard (the epic's candidate slices)

Each is phrased as a candidate spec with its likely artifact kind and constellation locus. The
genuinely-hard ones (per the cross-framework survey) are flagged ⚠.

0. **Placement decision (load-bearing, `type:decision`).** Does a deck warrant deck-specific WE
   standards at all — and if so, do the new contracts live in a **new `webdecks` project** or
   **distribute across existing projects** (model→webcomponents, theming→webtheme, transitions→a
   view/motion extension)? Everything below presumes the answer. Resolve first.
1. **Slide/deck document model** — what a `slide`/`deck` *carries* at the contract level
   (deck > sections > slides; per-slide id, title, notes, fragments, layout ref, background). The
   load-bearing data model. *Kind: semantic + intent. Locus: WE (model); FUI renders; plateau adds
   import/versioning.*
2. **Fragment / incremental-reveal intent** ⚠ — finer-than-slide step reveal: ordering
   (`data-fragment-index`), trigger, reverse traversal on back-nav, each step as a View Transition
   without re-animating the slide. The overloaded "next" (advance fragment *or* slide) is subtle.
   *Kind: intent + behavior, composes `view` + `view-transition`. Locus: WE contract; FUI aesthetics.*
3. **Slide addressing / 2D-nav extension** — two-level deep-link (`#/3/2` slide+vertical, slide +
   fragment), "instant jump" restore (no transition storm on reload). *Kind: extends `deep-link` +
   `route` + `navigation` semantics. Locus: WE.*
4. **Slide-transition + reduced-motion conformance** ⚠ — composing `view-transition` for
   slide-to-slide **plus the reduced-motion gate the native API omits**. This is a conformance
   vector, not just a feature. *Kind: semantic/behavior over `view-transition`+`motion`. Locus: WE.*
5. **Presenter-mode + cross-window sync protocol** ⚠ — current+next+notes+timer in a second window,
   synced via **BroadcastChannel** (+ `window.open` postMessage handshake for late-joiner catch-up,
   heartbeat/reconnect). The presenter window must *not* render audience transitions. *Kind: protocol
   + intent. Locus: WE sync contract; FUI panels; plateau UX.*
6. **Speaker-notes semantic** — per-slide note content (text/markdown), hidden in presentation, shown
   in presenter; authoring + persistence (composes webresources/webstates). *Kind: semantic +
   storage. Locus: WE contract; FUI editor; plateau workflow.*
7. **Fit-to-viewport fixed-aspect scaling** ⚠ — extend `fit` with aspect-ratio lock + a
   `scale = min(vw/baseW, vh/baseH)` clamp contract (CSS can't derive the contain factor; needs a
   ResizeObserver `--fit` shim). Footguns: blurry sub-pixel text, broken pointer hit-testing under
   scale. *Kind: extends `fit` semantic. Locus: WE.*
8. **Overview / grid zoom-out intent** — spatial slide-sorter (grid, scale, select, drag-reorder) —
   distinct from `navigation` (it's spatial, not hierarchical/lateral); overlaps
   `collection-operations`. *Kind: intent. Locus: WE contract; FUI grid.*
9. **Autoplay / timed-advance** — per-slide timing, pause-on-interaction, resume, loop, Wake Lock.
   Extends carousel autoplay (which is single-rate). *Kind: intent/behavior. Locus: WE.*
10. **Paged-media export protocol** ⚠ — a *separate* un-scaled paged-media layout path (`@page` +
    `break-after`, all fragments materialized, notes pages) rather than printing the live scaled
    runtime — the reason every framework special-cases PDF. *Kind: protocol. Locus: WE rules; FUI
    print CSS; plateau exporter.*
11. **Scoped theming (per-slide / per-section)** — scoped design-token overrides finer than
    project/section grain + per-slide background. *Kind: extends `design-tokens` with a scoping
    mechanism. Locus: WE; webtheme.*
12. **Slide layout-template vocabulary** — title/section/two-column/code/image/quote slot-based
    templates (Slidev/mdx-deck/Spectacle all ship these). *Kind: semantic + protocol, composes
    webcomponents + webexpressions slots. Locus: WE vocabulary; FUI components.*
13. **Embedded-deck postMessage contract** — embed a live deck in another document, state isolation,
    deep-link + sync across the iframe boundary. *Kind: protocol, composes navigation + webportals.
    Locus: WE.*
14. **Deck analytics vocabulary** — slide impressions, dwell time, drop-off, interaction events
    (greenfield in every open framework; only PowerPoint Present-Live has it). *Kind: extends
    `analytics-vocabulary` protocol. Locus: WE taxonomy; plateau dashboard.*
15. **Remote-control / multiplex (follow-the-presenter)** — cross-device clicker + audience-follow
    relay command set over webrealtime/`transport-negotiation`. Lower priority / possibly deferred
    (device-specific). *Kind: protocol. Locus: WE command contract; plateau relay.*
16. **Presentation accessibility conformance** ⚠ — reading order, focus management, slide-change
    announcement, and the reduced-motion gate as **conformance vectors** (the cross-cutting a11y
    obligations every framework underuses). *Kind: conformance/semantic. Locus: WE.*
17. **Code-presentation step-through** — line-focus + token-level magic-move (a domain-specific View
    Transition); extends [we:code-view block](../src/_data/blocks/code-view.json). *Kind: block
    extension. Locus: WE contract; FUI Shiki/highlight aesthetics.*

## Recommendation

Open epic #1164 as the umbrella, scoped to the **WE-standards layer**. **Resolve GAP-0 (placement)
first** — it decides whether the rest are `webdecks` items or distributed extensions. Then slice the
remaining gaps into independently-deliverable spec items, several of which are *extensions* to
existing standards (3, 4, 7, 11, 14, 17) rather than greenfield — those are the cheapest. The
genuinely-novel WE contracts are: the **document model (1)**, **fragment intent (2)**,
**presenter-sync protocol (5)**, **paged-export protocol (10)**, **layout-template vocabulary (12)**,
and **embed protocol (13)**.

The hidden risk the survey surfaced: **reduced-motion under View Transitions** and **fit-scale
hit-testing** are correctness traps, not polish — bake them as conformance vectors (GAP 4, 7, 16),
not author options.

Open questions tracked on the backlog (#1164 and its slices), not here.
