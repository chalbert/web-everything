---
type: decision
workItem: story
size: 3
status: open
dateOpened: "2026-06-06"
tags: [development-guide, guidance, opinionated, technical-configurator, learn-pathway, plateau-app, decision-support, philosophy, webdocs, one-source-many-views]
relatedReport: reports/2026-06-06-front-end-platform-book.md
crossRef: { url: /backlog/096-nl-to-technical-configurator/, label: "NL → Technical Configurator (#096)" }
---

# Development guide — opinionated "how to develop" guidance, surfaced as the configurator's learn pathway

A **development guide**: the author's opinionated recommendations on *how to develop* on the Platform — when to create a library, prepare-early-share-late, uniformity-is-a-tool-not-a-goal, deprecation strategy, team profiles, change management, etc. The archived essay (`reports/2026-06-06-front-end-platform-book.md`) **predicts this exact split**: it opens by saying the standard should *avoid* naming specific libraries, and that *"independent guides can be published with recommendations… updated more regularly, more subject to preferences."* So the guide is the **opinionated layer the book foresaw** — deliberately *not* the neutral standard (Web Everything) and *not* the reference implementation (Frontier UI). It carries a voice and a recommendation; the standard does not.

## The core shape: one guidance source, two views

The guide is not a separate body of content from the **Technical Configurator** (plateau-app) — it's the **same knowledge** (domains, axes, options, trade-offs, the recommendation) rendered two ways:

| View | Entry point | For | Status |
|---|---|---|---|
| **Configurator** | "I have a technical decision in front of me" | concrete use case → pick + wire a strategy | **exists** (plateau-app) |
| **Learn pathway** | "I want to understand / learn, no use case yet" | browse a domain, read the rationale, explore options without selecting a requirement first | **missing — this item** |

Author the guidance **once**; the configurator filters it interactively, the guide lets you wander. Same "one source, many outputs" pattern already used elsewhere (webcases → docs + tests + badge). The missing piece is the **learn pathway** + the **shared content model** both views consume.

## Where it lives

**Plateau-side, extending the Technical Configurator** (which lives in plateau-app). The configurator gains a "browse all domains / learn this decision" entry that doesn't require selecting a requirement first — each option page already holds the rationale the guide needs. This is the **human** front door that pairs with the **AI** front door ([#096](/backlog/096-nl-to-technical-configurator/), NL → configurator) over the same decision space.

## Open decisions (recommendations in bold)

> **Flagged for a design pass before this is dev-ready.** The three decisions below set the
> guide's *shape* (what content it holds, how it's sourced, how it's rendered) — settle them in a
> short design pass first; the bold defaults are the starting recommendation, not a settled call.

- **Scope — does the guide hold the non-decision content too?** Much of the essay's guidance has *no* decision shape: values, team profiles, when-to-create-a-platform, freedom-vs-uniformity, maintenance philosophy. **Recommendation: one guide surface holds both** — decision-support sections (which link into the configurator) *and* a philosophy/handbook section. Stripping the philosophy leaves dry option tables; the philosophy is what makes the recommendations make sense. (Alternative held open: philosophy stays the standalone essay, the guide is strictly the decision-support learn-view.)
- **Content model — confirm "one source, two views."** **Recommendation: a single guidance knowledge base (domain → axes → options → rationale → recommendation); the configurator and the guide are both views over it**, not independently authored. This is what makes "author once" real and keeps the two from drifting.
- **Rendering.** **Recommendation: render the guide via `webdocs`** ([#091](/backlog/091-web-docs-as-a-service-plateau/)) so it's generated from the same source as everything else, not a hand-maintained site.

## Relationship to existing work

- **[#096](/backlog/096-nl-to-technical-configurator/)** — AI front door to the configurator; this is the human/browsable front door to the same decision space. Siblings over one engine.
- **Technical Configurator** (plateau-app) — the existing concrete-decision view; its domain seeds + compat engine are the guide's data source.
- **[#091](/backlog/091-web-docs-as-a-service-plateau/) webdocs** — candidate renderer for the guide surface.
- **[#099](/backlog/099-evergreen-app-vision/) + the essay** — the guide is where the essay's *prose* recommendations land (the standard items #100–#107 capture its *mechanisms*; this captures its *advice*).

## Note on voice

This is explicitly **personal, opinionated guidance** — the author's recommendations, not neutral spec. That's a feature: the standard stays preference-free and stable; the guide is allowed to take sides and update often (exactly the cadence split the essay called for). Label it honestly as recommendation, not standard.
