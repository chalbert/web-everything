# Development guide & learn pathway — prior-art survey

**Date**: 2026-06-11
**Point**: Documentation-architecture and learning-pathway prior art for an opinionated "how to develop" guide surfaced as the Technical Configurator's *learn* pathway, grounding backlog #109's three shape forks (scope, content model, rendering) and surfacing one the item under-specified (navigation model — guided path vs. free browse).
**Backlog item**: `/backlog/109-development-guide-learn-pathway/`
---

## Question

The archived essay (`we:reports/2026-06-06-front-end-platform-book.md:5`) foresees exactly this split: *"This book should avoid mentioning specific libraries… Independent guides can be published with recommendations… updated much more regularly, and are more subject to preferences."* #109 turns that prediction into a concrete artifact — an opinionated development guide that is **not** the neutral standard (Web Everything) and **not** the reference implementation (Frontier UI), surfaced as a *learn* entry point over the same decision space the **Technical Configurator** (plateau-app) already serves requirement-first.

Before this is dev-ready the item flags three shape decisions (scope, content model, rendering). This survey grounds them in documentation-architecture prior art so the guide reuses an established content vocabulary instead of coining one, and locates the real machinery in the tree (configurator domains/providers + the configurator's existing no-requirements browse state).

## Where the machinery actually is (grep-verified)

The Technical Configurator is the data source and the host surface; the "learn pathway" is a second view over it, not a new app.

- **Domain content model** — a `Domain` = `{ id, name, tagline, axes[], strategies[] }`; an `Axis` carries a plain-language `question` + `description` + `policy` (correctness | fidelity) + ordered `values[]` (each with a `definition`); a `Strategy` declares `summary`, `family`, `confidence`, per-axis `capabilities`, plain-language `compromises[]`, `support`, and `links[]` (`plateau:plateau-app/src/technical-configurator/types.ts:21-62`). **This is already the "domain → axes → options → rationale" knowledge model** #109's content-model fork asks for — it exists, it just isn't yet consumed by a browse view.
- **Swap seam / data source** — domains are served through a `CapabilityProvider` (`listDomains` / `getDomain`), today a hand-authored `seedProvider` over three seed domains (change-tracking, file-upload, sorting-strategy) (`plateau:plateau-app/src/technical-configurator/provider.ts:14-28`, `we:types.ts:82-85`). A learn view reads the *same* provider — no second authoring path.
- **The browse state already half-exists** — when no requirement is set, `hasRequirements()` returns false (`plateau:plateau-app/src/technical-configurator/configurator.ts:113-115`) and the strategy cards render *without* verdict badges, showing only the plain summary, trade-offs, and a "Pick a goal above to see how this fits" hint (`plateau:configurator.ts:284-285`). That is an embryonic, requirement-free browse of the same domain content — the learn pathway is largely the act of promoting this state to a first-class, wander-friendly entry point rather than a degraded fallback.
- **Host surface / routing** — the configurator mounts on the SPA route `/technical-configurator` (`plateau:plateau-app/src/main.ts:132`, `:190`, `:288`); a learn pathway extends this surface (a browse-all-domains entry that doesn't gate on picking a requirement first), pairing the **human** front door with the **AI** front door of #096 (NL → configurator) over the same decision space.
- **What does NOT exist** — there is no rendered guide surface, no philosophy/handbook content (the essay's prose lives only in `we:reports/2026-06-06-front-end-platform-book.md`), and no `webdocs` renderer wired to the domain provider. Those are the build this item gates.

## Key findings

### 1. Diátaxis splits documentation into four needs — the guide is the Explanation+Tutorial half, the configurator is How-to, the standard is Reference

The dominant modern documentation framework, **Diátaxis** ([diataxis.fr](https://diataxis.fr/)), partitions docs by *user need* into four forms on a 2-D grid (acquisition↔application × action↔cognition): **Tutorial** (learning-oriented lesson), **How-to guide** (goal-oriented work), **Reference** (information — accurate, distraction-free facts), **Explanation** (understanding — context, the "why"). The framework's core claim is that these needs are distinct and must not be blended in one document.

Mapping #109's three-body constellation onto Diátaxis is clean and load-bearing:
- **Web Everything standard** = **Reference** — neutral facts (intents/blocks/protocols), no preference, stable cadence.
- **Technical Configurator** = **How-to** — "I have a decision in front of me", requirement-first, produces a Decision Record.
- **Development guide / learn pathway** = **Explanation + Tutorial** — "I want to understand, no use case yet": the *why*, the rationale, the opinionated recommendation; browseable.

**Implication (scope fork):** Diátaxis says Explanation and How-to are different needs but belong to the same documentation set, cross-linked. So the philosophy/handbook (pure Explanation — values, when-to-create-a-platform, prepare-early-share-late) and the decision-support learn-view (Explanation *of* each axis, linking into the How-to configurator) are **two registers of one guide surface**, not two products. Stripping the Explanation register leaves the configurator's dry option tables with no "why".

### 2. MDN's framework-docs policy is the exact standard-vs-guide split, stated independently

MDN ([Learn: JS frameworks](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Frameworks_libraries)) deliberately **does not** exhaustively teach any specific framework — "the framework teams' own docs already do that". Instead MDN answers the *decision/understanding* questions: *Why use a framework? What problems do they solve? What questions should I ask when choosing one? Do I even need one?* — delegating the prescriptive, fast-moving, preference-laden material to each framework's own (opinionated) guide.

This is the essay's split arrived at from the other direction: a **neutral reference** layer that refuses to take sides + an **opinionated guide** layer that does and updates often. It validates #109's framing that the guide is *allowed* to be personal and to update at a different cadence than the standard — and that the two must be *separate surfaces*, cross-linked, not merged.

### 3. Opinionated-framework guides prove the "voice as a feature" register works

The **Rails Doctrine** ([rubyonrails.org/doctrine](https://rubyonrails.org/doctrine)) is the canonical example of a development guide that is explicitly a *philosophy document*, not API reference — "programmer happiness over abstract perfection, sensible defaults over configuration", convention-over-configuration as a stated value. The **Vue guide** ([vuejs.org/guide](https://vuejs.org/guide/introduction.html)) pairs a narrative "walks you through every aspect" path with an interactive tutorial and lets readers *pick a learning path that suits their preference* rather than forcing one route.

Two lessons: (a) an opinionated handbook register is an established, respected form — it earns trust precisely by labeling itself as recommendation; (b) good guides offer **both** a linear narrative path *and* a free-browse/jump-in mode — they don't pick one. This surfaces the navigation fork the item under-specified.

### 4. Learning-path UIs are a guided sequence layered *over* a free reference, not a replacement

Across MDN Learn, web.dev Learn, and Vue: the pattern is a **curated ordered path** (prev/next, progress) sitting *on top of* an underlying free-browse reference — the same content reachable both ways. The learn pathway is a *projection/ordering* over the domain set, not a separate content store. This matches the configurator's existing data exactly: domains already have an order in the provider list (`we:provider.ts:14-19`) and axes are `ordered` weakest→strongest (`we:types.ts:28`), so a guided sequence is a thin curation layer over data that already exists, with free browse as the floor.

### 5. "One source, many views" is already the house pattern here

The item's "author once, render two ways" is the same shape WE already uses (webcases → docs + tests + badge; the configurator's domain seed → requirement-first verdicts today). The content model fork is therefore less a question of *whether* to share a source than of *confirming* the configurator's `Domain` type **is** that shared source (finding: it already is — `we:types.ts:21-62`) and that the learn view is a read-only second consumer of the same `CapabilityProvider`, never an independently-authored body.

## Forks (to ratify in #109)

1. **Scope** — does the guide hold the non-decision philosophy/handbook too, or only the decision-support learn-view? **Recommended: one guide surface, two registers** (Diátaxis Explanation + How-to-linking), per finding 1.
2. **Content model** — one shared knowledge base both views read, or independently authored? **Recommended: the configurator's `Domain` type is the single source; the learn view is a read-only second view over the same `CapabilityProvider`** (it already exists — `we:types.ts:21-62`, `we:provider.ts:21-28`), per finding 5.
3. **Rendering** — `webdocs` (#091) vs. hand-maintained site vs. configurator-native browse page? **Recommended: render via `webdocs` from the same source**, so the guide is generated, not hand-kept — per the essay's cadence split.
4. **(under-specified by the item) Navigation model** — guided ordered pathway vs. free browse. **Recommended: free browse is the floor, a curated prev/next path is a thin ordering layer over it** (findings 3–4); not either-or.

## Cross-references

- Decision: [#109 — development guide / learn pathway](/backlog/109-development-guide-learn-pathway/)
- Siblings over one engine: [#096 — NL → Technical Configurator](/backlog/096-nl-to-technical-configurator/) (the AI front door); [#091 — webdocs](/backlog/091-web-docs-as-a-service-plateau/) (candidate renderer)
- Source prediction: `we:reports/2026-06-06-front-end-platform-book.md:5` (the cadence split); the evergreen-app vision [#099](/backlog/099-evergreen-app-vision/)
- Host: Technical Configurator (`plateau-app/src/technical-configurator/`)

## Files Created/Modified

| File | Action |
| --- | --- |
| `we:reports/2026-06-11-development-guide-learn-pathway.md` | Created (this report) |
| `we:src/_includes/research-descriptions/development-guide-learn-pathway.njk` | Created (research topic description) |
| `we:backlog/109-development-guide-learn-pathway.md` | Restructured into prepared-fork shape |
