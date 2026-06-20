---
type: decision
workItem: story
status: resolved
size: 3
parent: "1173"
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
codifiedIn: "docs/agent/platform-decisions.md#project-protocol-bar"
preparedDate: "2026-06-20"
tags: [deck, slides, presentation, placement, constellation]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Placement: where do the novel deck contracts live — a new `webdecks` project, distributed, or hybrid?

Load-bearing placement decision gating the rest of epic #1173. The deck research (relatedReport)
found ~17 reusable standards + 17 gap slices, of which **~6 are genuinely-novel WE contracts**
(slide/deck document model, fragment/reveal intent, presenter-sync protocol, paged-export protocol,
layout-template vocabulary, embed protocol) and **~10 are extensions** to existing standards. This
decision settles **where the novel contracts are homed** — which determines every child slice's
`relatedProject`, artifact kind, and title. Resolve this before carving the other slices, so they're
filed in their correct homes once rather than re-homed after.

## The fork

**A — Dedicated `we:src/_data/projects/webdecks.json` project.** All deck-specific contracts (novel
*and* the extension surfaces) gather under one new WE project, mirroring how the chart domain got
[we:webcharts](../src/_data/projects/webcharts.json) (semantic-core + a `CustomChartRenderer`
protocol) and webediting/webcharts precedent. *Pro:* one coherent, discoverable home; one conformance
suite; the deck reads as a first-class domain. *Con:* over-claims — most of a deck is *composition +
FUI*, not new standard surface; folding the extensions in duplicates contracts that already have
homes; risks framing "a deck" as a WE mandate (cuts against *WE mandates nothing* — support all
coherent branches unless one is genuinely flawed).

**B — Fully distributed, no new project.** Each novel contract homes into the nearest existing
project (document model → webcomponents, fragment/transition → a view/motion extension, presenter
window → webportals, export → webresources, theming → webtheme, analytics → webanalytics). *Pro:*
respects that a deck is mostly composition; no new project for what's largely extensions; each
contract sits with its kin. *Con:* the irreducibly-deck-specific contracts (presenter-sync,
paged-export, document model) have **no natural existing home** — scattering them loses the single
conformance story and makes "is a deck conformant?" unanswerable in one place.

**C — Hybrid (bold default).** A **small `webdecks` project** holds only the irreducibly-deck-specific
novel contracts — document model, fragment/reveal intent, presenter-sync protocol, paged-export
protocol, layout-template vocabulary, embed protocol — and the **~10 extension slices stay in their
existing homes** (addressing → `navigation`/`deep-link` semantics; reduced-motion → `view-transition`
semantic; fit → `fit` semantic at we:src/_data/semantics/; per-slide theming → webtheme; analytics →
webanalytics `analytics-vocabulary`; code step-through → [we:code-view](../src/_data/blocks/code-view.json)).
*Pro:* gives the novel cluster a coherent home + conformance suite without over-claiming the
composition; each extension stays with the standard it extends (the cheapest, least-churn path);
matches how the repo already splits cross-cutting work. *Con:* a two-place story (some deck contracts
in `webdecks`, some elsewhere) — but that two-place split *is* the WE/composition boundary, made
explicit rather than hidden.

## Recommendation

**C (hybrid), confidence ~70%.** It draws the line exactly where the research did — novel contract vs
extension — and keeps the deck honest as "mostly composition, a little new standard." The residual
~30%: whether the two heaviest novel contracts (**presenter-sync** and **paged-export**) are better
as standalone *protocols under existing umbrellas* (presenter-sync → webportals/webrealtime;
paged-export → webresources) than as members of `webdecks` — i.e. C could collapse toward B for those
two. Settle that sub-call at ratification; it doesn't change the extensions either way.

Confidence is *soft* on the project-vs-protocol knob (a structural-grouping choice, freely revisable
with lineage if data later argues otherwise); higher on the core principle that novel deck contracts
get a coherent home and extensions stay home.

## Ratified ruling — B (fully distributed)

**RATIFIED 2026-06-20 — B (fully distributed), no `webdecks` project. Confidence ~80%.** *(Reverses the
prepared default C after a red-team surfaced the governing statute the prepared framing omitted;
codified against [#project-protocol-bar](../docs/agent/platform-decisions.md#project-protocol-bar).)*

**Why the prepared C default fell.** The decision is settled by a named statute the prepared fork
never cited: [we:docs/agent/platform-decisions.md#project-protocol-bar](../docs/agent/platform-decisions.md)
— *"Mint a **Project** only for a genuine cross-cutting domain with orchestration. 'Already homed in
an existing project' is a valid resolution — do not spawn a project per homed gap"*; and *"ship as a
Block now; extract a Protocol only once a **second** independent impl exists."* A deck is
overwhelmingly *reuse* (the report's 17-row reuse table) composed at the page level; its
cross-cutting-ness **is** composition of already-homed standards, not a new domain with its own
provider seam. The [we:webcharts](../src/_data/projects/webcharts.json) precedent **cuts against C, not
for it**: webcharts earned a project because it has a genuine renderer-swap **provider seam**
(`CustomChartRenderer` — Vega/Plotly/ECharts conform to one contract). A deck has **no equivalent
single seam**; its "novel cluster" is six unrelated contracts, several of which compose existing
projects.

**Homes (B mapping):**
- document-model (1) → **webcomponents** + webexpressions (slot/section content schema; the report's
  own line 112 frames layout as "composes webcomponents + webexpressions slots"). *The one genuine
  residual — see below.*
- fragment-intent (2) → **view / motion** extension (composes `view` + `view-transition`).
- presenter-sync (5) → **webrealtime** (extends `transport-negotiation`) + **webportals** postMessage;
  the current/next/notes/timer terms are a **semantics term** (statute rule 4), not a new project member.
- paged-export (10) → **webresources** (CSS Paged Media path; ship as rules/Block now — statute rule 3
  bars protocol-extraction before a second impl).
- layout-template-vocabulary (12) → **webcomponents + webexpressions** slot vocabulary.
- embed-protocol (13) → **webportals** (*compose-intent-don't-duplicate* — composes navigation +
  webportals, never a parallel model).
- extensions `{3, 4, 7, 11, 14, 17}` → unchanged existing homes (navigation/deep-link,
  view-transition/motion, `fit` semantic, webtheme, webanalytics,
  [we:code-view](../src/_data/blocks/code-view.json)).

**B's only con — "no single conformance story" — is already answered by the report:** the hard,
irreducibly-deck-specific obligations (reduced-motion under View Transitions, fit-scale hit-testing,
a11y reading-order/announce — GAPs 4/7/16) are framed as **conformance vectors**. "Is a deck
conformant?" is answered by a **named conformance-vector set** (tag `deck`), which needs no project
to home it. Discoverability is a docs/tag concern, not a project-minting reason.

**Residual ~20% — the document-model's home.** It is the one contract with the weakest existing kin (a
content/interchange schema; webcomponents is impl-leaning). It does **not** on its own clear the
project bar (one schema ≠ "cross-cutting domain with orchestration"; statute rule 2). Home it as a
semantic/interchange schema under webcomponents for now; **revisit only if a genuine deck-specific
provider seam later emerges** (statute rule 3 temporal) — *that* would be the event that justifies
minting `webdecks`, with lineage. Filed as the residual, freely revisable.

**On ratify:** no new project. Epic #1173 carves the gap slices into the homes above in one pass; each
slice's `relatedProject` is its existing home, artifact kind per the mapping (intent / semantic /
block / conformance-vector). Set this item `status:resolved` + record the ruling; no `graduatedTo`
entity (no new project minted). Add the deck conformance-vector set as a named slice under #1173.

## Contract inventory & homes (the #1173 carve-list, under B)

Every contract a deck-on-FUI needs, classified **New** (greenfield WE contract) vs **Updated**
(extends an existing standard), with its artifact kind and `relatedProject` home. Sourced from the
relatedReport's 17 gaps; row 16′ is the cross-cutting conformance-vector set that replaces a project
as the "single conformance story".

| # | Contract | New / Updated | Artifact kind | Home (`relatedProject`) |
|---|---|---|---|---|
| 1 | Slide/deck document model | **New** | semantic + interchange schema | webcomponents (+ webexpressions) · *residual home* |
| 2 | Fragment / incremental-reveal intent | **New** | intent + behavior (composes `view` + `view-transition`) | webintents |
| 3 | Slide addressing / 2D-nav | Updated | extends `deep-link` + `route` + `navigation` semantics | navigation |
| 4 | Slide-transition + reduced-motion conformance | Updated | conformance vector over `view-transition` + `motion` | webtraits / view-transition + motion |
| 5 | Presenter-mode + cross-window sync | **New** | protocol + intent (composes BroadcastChannel) | webrealtime (extends `transport-negotiation`) + webportals |
| 6 | Speaker-notes semantic | **New** | semantic + storage | webresources / webstates (+ webcomponents) |
| 7 | Fit-to-viewport fixed-aspect scaling | Updated | extends `fit` semantic + scale-factor shim | `fit` semantic (we:src/_data/semantics/) |
| 8 | Overview / grid zoom-out intent | **New** | intent (composes `collection-operations`) | webintents |
| 9 | Autoplay / timed-advance | Updated | intent/behavior (extends carousel autoplay + Wake Lock) | webintents / [we:carousel](../src/_data/blocks/carousel.json) |
| 10 | Paged-media export protocol | **New** | rules/Block now → protocol later (statute rule 3) | webresources |
| 11 | Scoped per-slide/section theming | Updated | extends `design-tokens` scoping | webtheme |
| 12 | Slide layout-template vocabulary | **New** | semantic + slot vocabulary | webcomponents + webexpressions |
| 13 | Embedded-deck postMessage contract | **New** | protocol (composes navigation + webportals) | webportals |
| 14 | Deck analytics vocabulary | Updated | extends `analytics-vocabulary` protocol | webanalytics |
| 15 | Remote-control / multiplex (deferred) | **New** | protocol (command set over `transport-negotiation`) | webrealtime |
| 16 | **Presentation a11y conformance** (reading-order, focus, slide-change announce — incl. the reduced-motion + fit-scale traps from 4/7) | **New** | conformance-vector set (tag `deck`) | webtraits / webaudit (cross-cutting; the "single conformance story" sans project) |
| 17 | Code-presentation step-through | Updated | block extension | [we:code-view](../src/_data/blocks/code-view.json) |
| 18 | **Content/element animation orchestration** (SVG draw-on, staggered build — *intra-element*; distinct from slide-transition #4 and fragment-reveal #2) | **New** | intent/behavior over `motion` | [we:motion](../src/_data/intents/motion.json) / webtraits — *general, not deck-specific* |
| 19 | **Fullscreen presentation mode** (Fullscreen API + cursor-hide + Screen Wake Lock) | **New** | semantic + intent | webportals / a `fullscreen` semantic — *general, not deck-specific* |
| 20 | **"Up next" / what-to-view-next preview** (shared with video playlists & carousel) | **New** | intent (member of the shared *advanceable-sequence* family) | webintents |
| 21 | **Interstitial / overlay insertion** (ads at start / mid-sequence / as overlay — pre-roll, mid-roll, banner; skippable vs forced; resume-after) | **New** | intent (scheduled-insertion) + overlay surface | webintents (insertion) + webportals (overlay); shared with video ad-breaks |

**New contracts:** 1, 2, 5, 6, 8, 10, 12, 13, 15, 16, 18, 19, 20, 21 · **Updated/extensions:** 3, 4, 7, 9, 11, 14, 17.
None mints a project (statute #project-protocol-bar); each homes with its kin or as a named vector set.

### Shared mechanics — the deck is even *more* composition than C assumed (further confirms B)

Three overlaps surfaced in discussion, all pulling toward distributed homes, none toward a `webdecks` project:

- **Carousel already owns the advance/sequence kernel.** [we:carousel](../src/_data/blocks/carousel.json)
  *is* "a set of equivalent **slides** presented one at a time, advanced by controls, pagination,
  swipe, or autoplay… composes Motion, Live-Region Status, and Navigation." So slide-advance,
  autoplay, pause-on-interaction, scroll-snap and APG announce are **reuse** (already in the report's
  reuse table), not novel deck contracts. GAP 9 (autoplay) is an *extension* of carousel autoplay, not
  greenfield.
- **A cross-media "advanceable-sequence" family.** *advance · autoplay · "up next" preview ·
  fullscreen* recur across **carousel, deck, and video playlists**. Per *harvest-cross-cutting-paradigms*,
  factor the shared intent (current/next/prev over discrete items + timed advance + up-next + present
  surface) **once in webintents**, composed by all three — never duplicated per consumer. The deck
  references it; it adds only the deck-specific bits (fragments, 2D nav, presenter view).
- **#18/#19 are general capabilities the deck consumes, not deck standards.** Intra-element content
  animation (SVG self-draw, build-ins) is a `motion` concern any page wants; fullscreen is a generic
  presentation-surface capability (video, image, app). Both home in their general projects — extra
  evidence that "a deck" is composition, and the `webdecks`-project bar (statute #project-protocol-bar)
  stays unmet.

*(These rows also patch real coverage gaps in the relatedReport, which omitted #18/#19/#20/#21.)*

### The reframe — a deck *is* a temporal/advanceable-media sequence (the headline harvest)

The discussion keeps surfacing the same thing: **deck, video player, and carousel are one family.** They
all share *advance · autoplay · up-next · fullscreen · interstitial/ad insertion · captions · narration ·
live interaction*. Per *harvest-cross-cutting-paradigms*, the high-leverage move is **not** "deck
contracts" — it's a shared **temporal/advanceable-media sequence intent family** in webintents that a
deck, a video player, and a carousel all *compose*; each adds only its specific layer (deck → fragments,
2D-nav, presenter; video → scrubbing, buffering; carousel → peek/loop). This is the strongest possible
evidence for **B** and against a `webdecks` project: the novel surface lives in a *cross-media* home, not
a deck-specific one.

### Brainstorm — adjacent capabilities a deck-on-WE needs (candidates feeding #1173)

Recorded as candidate slices (not yet committed); each homes outside any deck project. **bold** = strong / genuinely uncovered:

- **Captions / subtitles / transcript** (WebVTT) — a11y + spoken/embedded media; *shared with video*. → webresources + a11y vector set (16).
- **Per-slide audio narration / voiceover sync** to fragments/autoplay (recorded-deck / Loom-style) — *shared with video*. → webresources + advanceable-sequence timing.
- **Live polling / audience Q&A / reactions** (Slido/Mentimeter) — extends multiplex (15). → webrealtime + webevents.
- **Branching / non-linear navigation** (choose-your-path, Prezi-style) — uncovered; extends `navigation`. → navigation / webintents.
- Zoom / pan / deep-zoom within a slide (distinct from overview-grid #8). → a zoom/pan intent (webintents).
- Live annotation / laser-pointer / drawing during presentation. → an annotation input intent + webportals overlay (collab-adjacent).
- Access-controlled / gated slides (paywall, NDA). → webguards / webidentity / webpolicy (plateau-leaning).
- Recording / export-to-video of playback. → mostly **plateau** (capability), thin WE "advance-event timeline" contract only.
- Reuse (no new spec): RTL/localized decks → webintl; offline/installable deck → webmanifests; progress chrome → simple-store + sequence index.

**Next steps this feeds:**
1. **Ratify B** (unchanged by all the above — every addition reinforces it).
2. Carve #1173 slices from the inventory table (1–21) into their homes, each `relatedProject` = its existing home.
3. **Propose a new high-leverage item: the *temporal/advanceable-media sequence* intent family** (webintents) — the unifying abstraction for deck + video + carousel + ads/up-next. Likely its own small epic; it's the real novel surface and it's cross-media, not deck-specific.
4. Patch the relatedReport to add the missed gaps (#18–#21 + the brainstorm) and the reframe.
