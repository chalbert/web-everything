---
type: decision
workItem: story
status: open
size: 3
parent: "1173"
dateOpened: "2026-06-20"
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
