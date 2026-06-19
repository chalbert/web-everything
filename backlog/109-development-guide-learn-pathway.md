---
type: decision
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-06"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
codifiedIn: "one-off"
preparedDate: "2026-06-11"
tags: [development-guide, guidance, opinionated, technical-configurator, learn-pathway, plateau-app, decision-support, philosophy, webdocs, one-source-many-views]
relatedReport: reports/2026-06-11-development-guide-learn-pathway.md
crossRef: { url: /backlog/096-nl-to-technical-configurator/, label: "NL → Technical Configurator (#096)" }
---

# Development guide — opinionated "how to develop" guidance, surfaced as the configurator's learn pathway

A **development guide**: the author's opinionated recommendations on *how to develop* on the Platform — when to create a library, prepare-early-share-late, uniformity-is-a-tool-not-a-goal, deprecation strategy, team profiles, change management, etc. The archived essay (`we:reports/2026-06-06-front-end-platform-book.md:5`) **predicts this exact split**, saying the standard should *avoid* naming specific libraries and that *"independent guides can be published with recommendations… updated much more regularly, and are more subject to preferences."* So the guide is the **opinionated layer the book foresaw** — deliberately *not* the neutral standard (Web Everything) nor the reference implementation (Frontier UI). It carries a voice and a recommendation; the standard does not.

The three forks below set the guide's **shape** — what content it holds (scope), how it's sourced (content model), how it's rendered. Each is grounded in a documentation-architecture prior-art survey (Diátaxis, MDN's framework-docs policy, Rails Doctrine, Vue/MDN learning-path UIs), published as the [Development Guide & Learn Pathway](/research/development-guide-learn-pathway/) research topic. The survey surfaced a fourth the item under-specified (navigation model — guided path vs. free browse). Each fork names a recommended default in **bold**.

## The core shape: one guidance source, two views

The guide is not a separate body of content from the **Technical Configurator** (plateau-app) — it's the **same knowledge** (domains, axes, options, trade-offs, the recommendation) rendered two ways:

| View | Entry point | For | Status |
|---|---|---|---|
| **Configurator** | "I have a technical decision in front of me" | concrete use case → pick + wire a strategy | **exists** (plateau-app) |
| **Learn pathway** | "I want to understand / learn, no use case yet" | browse a domain, read the rationale, explore options without selecting a requirement first | **missing — this item** |

Author the guidance **once**; the configurator filters it interactively, the guide lets you wander. Same "one source, many outputs" pattern already used elsewhere (webcases → docs + tests + badge). The missing piece is the **learn pathway** + the **shared content model** both views consume.

## Where it lives

**Plateau-side, extending the Technical Configurator** (which lives in plateau-app). The configurator gains a "browse all domains / learn this decision" entry that doesn't require selecting a requirement first — each option page already holds the rationale the guide needs. This is the **human** front door that pairs with the **AI** front door ([#096](/backlog/096-nl-to-technical-configurator/), NL → configurator) over the same decision space.

## Axis-framing — the machinery already exists (grep-verified)

The three forks are not about building a new app — they're about *which existing seam* the learn view reads and renders through. The Configurator is both the data source and the host surface:

- **Domain content model** — a `Domain` = `{ id, name, tagline, axes[], strategies[] }`; an `Axis` carries a plain-language `question` + `description` + correctness/fidelity `policy` + ordered `values[]` (each with a `definition`); a `Strategy` declares `summary`, `family`, `confidence`, per-axis `capabilities`, plain-language `compromises[]`, and `links[]` (`plateau:plateau-app/src/technical-configurator/types.ts:21-62`). **This is already the `domain → axes → options → rationale → recommendation` knowledge model** the content-model fork asks for.
- **Swap seam** — domains are served through a `CapabilityProvider` (`listDomains` / `getDomain`), today a hand-authored `seedProvider` over three seed domains (`plateau:plateau-app/src/technical-configurator/provider.ts:14-28`, `we:types.ts:82-85`). A learn view reads the *same* provider.
- **Browse state already half-exists** — when no requirement is set, `hasRequirements()` returns false (`plateau:plateau-app/src/technical-configurator/configurator.ts:113-115`) and strategy cards render *without* verdict badges, showing plain summary + trade-offs + a "Pick a goal above to see how this fits" hint (`plateau:configurator.ts:284-285`). The learn pathway largely promotes this requirement-free fallback to a first-class wander entry point.
- **Host / routing** — the configurator mounts on the SPA route `/technical-configurator` (`plateau:plateau-app/src/main.ts:132`, `:190`, `:288`); the learn view extends this surface (a browse-all-domains entry that doesn't gate on a requirement).
- **What does NOT exist** — no rendered guide surface, no philosophy/handbook content (the essay's prose lives only in `we:reports/2026-06-06-front-end-platform-book.md`), no `webdocs` renderer wired to the provider. That is the build this item gates.

### Recommended path at a glance

Ratify all four rows, or override just the one you'd change. The **confidence** column says where judgment is actually needed vs. where to nod.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · scope** | one guide surface, two registers (decision-support + philosophy/handbook) | philosophy stays the standalone essay *(rejected)* | **High** — Diátaxis + config-extends-platform-default |
| **2 · content model** | the Configurator's `Domain` type IS the single source; learn view = read-only second view | independently-authored guide body | **High** — source already exists; house pattern |
| **3 · rendering** | render via `webdocs` (#091) from that single source | hand-maintained site / configurator-native page | **Med-high** — depends on #091 maturity |
| **4 · navigation** | free browse is the floor; curated prev/next path is a thin ordering layer over it | guided-path-only, or free-browse-only | **Med** — both are layers, not a true either-or |

## Fork 1 — scope: does the guide hold the non-decision content too?

Much of the essay's guidance has *no* decision shape: values, team profiles, when-to-create-a-platform, freedom-vs-uniformity, maintenance philosophy. Does the guide surface hold this philosophy/handbook material, or only the decision-support learn-view (option tables that link into the configurator)? Diátaxis ([diataxis.fr](https://diataxis.fr/)) frames this precisely: the configurator is the **How-to** quadrant, the neutral standard is **Reference**, and the guide is **Explanation + Tutorial** — distinct *needs* that nonetheless belong to one cross-linked documentation set. MDN's framework-docs policy ([MDN Learn](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Frameworks_libraries)) is the same standard-vs-opinionated-guide split stated independently.

- **(A — recommended) One guide surface, two registers.** Decision-support sections (linking into the configurator) *and* a philosophy/handbook section, on the same surface, cross-linked. The philosophy is the **Explanation** register that makes the recommendations make sense; stripping it leaves the configurator's dry option tables with no *why*. Aligns with **config-extends-platform-default** — the neutral decision-support content is the platform layer, the opinionated philosophy is the *extended flavor* that takes sides and updates often.
- **(B — rejected) Philosophy stays the standalone essay; the guide is strictly the decision-support learn-view.** Cleaner boundary, but it severs the rationale from the recommendations and leaves the essay's prose with no rendered home — re-creating exactly the "dry tables" problem Diátaxis warns against. *Rejected.*

**Default: A — one guide surface, two registers.**

*Rejected:* B (philosophy-as-standalone-essay) — severs rationale from recommendation.

## Fork 2 — content model: one source, two views, or independently authored?

Is there one shared guidance knowledge base both the configurator and the learn view read, or are the two authored independently? This is what makes "author once" real and keeps the views from drifting. The survey's load-bearing finding: **the shared source already exists** — the Configurator's `Domain` type *is* the `domain → axes → options → rationale → recommendation` model (`plateau:plateau-app/src/technical-configurator/types.ts:21-62`), served through one `CapabilityProvider` (`we:provider.ts:21-28`). "One source, many views" is already the house pattern (webcases → docs + tests + badge).

- **(A — recommended) The Configurator's `Domain` type is the single source; the learn view is a read-only second view over the same `CapabilityProvider`.** No second authoring path; the learn view consumes `listDomains` / `getDomain` exactly as the configurator does, rendering the requirement-free browse state as a first-class entry rather than a degraded fallback. Drift is structurally impossible.
- **(B — rejected) Author the guide as an independent body, kept in sync by hand.** Allows guide-specific phrasing/depth not constrained by the configurator's schema, but reintroduces the drift the whole "one source" framing exists to kill, and duplicates rationale already captured in `Axis.description` / `Strategy.compromises`. *Rejected.*

**Default: A — `Domain` type is the single source; learn view is a read-only second view.**

*Rejected:* B (independently-authored guide body) — reintroduces drift; duplicates existing rationale fields.

## Fork 3 — rendering: how is the guide surface produced?

How is the guide rendered — generated from the shared source, or maintained as a separate site? The essay's whole premise is that the guide updates *often*; a hand-maintained site fights that cadence.

- **(A — recommended) Render via `webdocs`** ([#091](/backlog/091-web-docs-as-a-service-plateau/)) from the same `CapabilityProvider` source as everything else, so the guide is *generated*, not hand-kept — matching the essay's "updated much more regularly" cadence and keeping it in lockstep with the configurator data.
- **(B) Configurator-native browse page** (a second view inside plateau-app's existing configurator UI, no separate doc renderer). Cheapest path and reuses the existing mount/route, but produces a tool-page rather than a documentation surface — weaker for the philosophy/handbook register (Fork 1) which is prose, not interactive cards. Viable as an **interim** while #091 matures.
- **(C — rejected) Hand-maintained standalone site.** Maximum editorial freedom, but fights the update cadence the guide exists to enable and re-introduces a drift surface. *Rejected.*

**Default: A — render via `webdocs` from the single source** (B acceptable as interim until #091 is ready).

*Rejected:* C (hand-maintained standalone site) — fights the cadence; new drift surface.

## Fork 4 — navigation model (surfaced by research; the item under-specified it)

The learning-path survey (MDN Learn, web.dev Learn, Vue) shows a consistent pattern: a **curated ordered path** (prev/next, progress) sitting *over* an underlying **free-browse** reference — the same content reachable both ways. The Vue guide explicitly lets readers *pick the path that suits their preference*. The Configurator's data already supports both: domains have an order in the provider list (`we:provider.ts:14-19`), axes are declared `ordered` weakest→strongest (`we:types.ts:28`).

- **(A — recommended) Free browse is the floor; a curated prev/next path is a thin ordering layer over it.** Most-flexible default — the wander-anywhere mode is always available (the item's stated "explore without a requirement first"), and a guided sequence is added as curation, not a gate. Matches every surveyed learning-path UI.
- **(B) Guided path only** (forced ordered sequence) — better onboarding for total newcomers, but contradicts the item's "let you wander" premise. *Rejected.*
- **(C) Free browse only** (no curated path) — simplest, but drops the onboarding ramp that the learning-path models all provide. *Rejected.*

**Default: A — free browse floor + thin curated path layer.**

*Rejected:* B (guided-only) — contradicts the wander premise; C (browse-only) — drops the onboarding ramp.

## Relationship to existing work

- **[#096](/backlog/096-nl-to-technical-configurator/)** — AI front door to the configurator; this is the human/browsable front door to the same decision space. Siblings over one engine.
- **Technical Configurator** (plateau-app) — the existing concrete-decision view; its domain seeds + compat engine are the guide's data source.
- **[#091](/backlog/091-web-docs-as-a-service-plateau/) webdocs** — candidate renderer for the guide surface.
- **[#099](/backlog/099-evergreen-app-vision/) + the essay** — the guide is where the essay's *prose* recommendations land (the standard items #100–#107 capture its *mechanisms*; this captures its *advice*).

## Note on voice

This is explicitly **personal, opinionated guidance** — the author's recommendations, not neutral spec. That's a feature: the standard stays preference-free and stable; the guide is allowed to take sides and update often (exactly the cadence split the essay called for). Label it honestly as recommendation, not standard.

## Resolution — ratified 2026-06-11

All four forks ratified to their bold defaults.

- **Fork 1 — A (one guide surface, two registers):** decision-support + philosophy/handbook on one cross-linked surface; the Explanation register (Diátaxis) is what makes the recommendations make sense, so it stays attached rather than stranded as a standalone essay.
- **Fork 2 — A (`Domain` type is the single source; learn view is a read-only second view):** the Configurator's `Domain`/`CapabilityProvider` already IS the `domain → axes → options → rationale → recommendation` model, so authoring once and reading twice makes drift structurally impossible.
- **Fork 3 — A (render via `webdocs` from the single source):** generated, not hand-kept, matching the essay's "updated often" cadence; the configurator-native browse page (B) is accepted as the interim fallback until #091 matures.
- **Fork 4 — A (free-browse floor + thin curated path layer):** most-flexible default — wander-anywhere is always available and the guided prev/next sequence is added as curation, not a gate, matching every surveyed learning-path UI.

**Follow-on builds (not yet scaffolded):**

- Build the learn-pathway view + wire the shared `CapabilityProvider` content model (interim configurator-native render) · story/size 3 · blockedBy: none → #335
- Migrate the rendered guide surface onto `webdocs` once it ships · task · blockedBy: #091 → #336

## Status

**Resolved 2026-06-11.** The four shape forks are ratified to their bold defaults; the remaining work (build the learn-pathway view + wire the shared content model, then migrate to `webdocs`) is recorded as follow-on builds above and is agent-ready, not scaffolded here.
