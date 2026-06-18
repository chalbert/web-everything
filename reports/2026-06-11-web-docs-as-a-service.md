# Web Docs as a Service — prior-art survey & fork grounding

**Date:** 2026-06-11
**Grounds:** [backlog #091](../backlog/091-web-docs-as-a-service-plateau.md) (decision: web-docs-as-a-service on Plateau)
**Parent epic:** [#089 monetization product ideas](../backlog/089-monetization-product-ideas.md) (idea 4)
**Sibling:** [#081 Module-as-a-Service](../backlog/081-module-as-a-service-provider.md) (carries the same "home" open question)

## Why this survey

#091 promotes "Web Docs as a Service" (idea 4 in #089) into a first-class **Plateau
offering**: hosted, conformance-aware documentation for a customer's *own* design
system, generated the way this repo generates itself ("the website IS the spec"). The
item raised three open follow-ons and stopped — they are strategy decisions, not a
mechanical build:

1. the **ingestion contract** (what a customer supplies, how Plateau resolves/serves it),
2. the **conformance-dashboard surface** (reuse `/protocols/` + verification machinery, or build a bespoke dashboard),
3. the **home** (a Plateau offering vs a graduated Plateau-side project entry).

This survey grounds those three in real docs-as-a-service prior art so each can be
reshaped into a bold-defaulted fork. Per design-first, prior art is gathered before the
decision is ruled, so the forks reuse the incumbents' vocabulary instead of coining terms.

## The market splits ingestion two ways: docs-as-code vs platform-first

Every managed docs platform sits on one of two ingestion models, and the split is the
whole story for fork 1:

- **Docs-as-code (source-of-truth in the customer's repo).** Mintlify is the 2026
  archetype: content lives as MDX in the customer's Git repo with bi-directional sync;
  API reference pages are *generated* from the customer's OpenAPI 3.0/3.1 spec, and when
  they commit a changed spec Mintlify detects it, opens a preview PR, and re-publishes on
  merge. The spec — an artifact the customer already maintains for another reason — *is*
  the source; the platform never owns the content. Docusaurus is the open, self-hosted
  end of this axis: a generator you run yourself, free to download but you pay in
  hosting/CI/CD/maintenance, and critically it "doesn't know when your product changes"
  — no link back to a source of truth, so docs drift the moment you ship.
- **Platform-first (source-of-truth in the vendor dashboard).** ReadMe's onboarding is
  guided and dashboard-driven: the customer chooses to import a spec *or* author in a
  hosted API Designer *or* write Markdown in the platform. GitBook's hybrid adds a
  Notion-like block editor so non-developers contribute without Git. Here the platform
  can become the source of record, which is exactly the lock-in WE refuses.

The WE differentiator is that **the source of truth already exists and is not prose**: a
customer's `webmanifest` ([we:projects.json:217](../src/_data/projects.json#L217)) +
`webcases` ([we:projects.json:208](../src/_data/projects.json#L208)) are the same artifacts
that drive their tests and their conformance signal. `webdocs`
([we:projects.json:226](../src/_data/projects.json#L226)) is described in the registry as
"the meta-standard that orchestrates Web Manifests and Web Cases to generate
comprehensive documentation sites." So WE is structurally a **docs-as-code** platform
where the OpenAPI-spec equivalent is the manifest+cases pair — the Mintlify model, not
ReadMe's. This repo's own `we:cases.js` loader ([we:src/_data/cases.js](../src/_data/cases.js))
already does exactly this ingestion at build time: read a directory of HTML/TS cases per
block and render them into pages. The serve-time offering is that loader, hosted and
parameterized per customer.

## The conformance dashboard is the real differentiator — and it already exists here

#091's stated edge over Storybook/Chromatic is that the docs **prove conformance**: the
site shows live which protocols each component satisfies and at which tier, because the
docs are generated from the very fixtures that *are* the conformance suite. The market
validates the demand:

- Chromatic (the Storybook-Cloud analog) publishes/versions/indexes Storybooks and, with
  axe-core, surfaces an "Accessibility tests" section per component page (run set,
  Passed/Failed/Conditional, last-run timestamp). Pricing is per-snapshot-volume
  ($149/mo entry, $60K–$180K/yr enterprise).
- Design systems publish VPAT 2.5 / Accessibility Conformance Reports (USWDS assessed 44
  components, March→May 2025). Pinterest's Gestalt ships an "A11y readiness indicator"
  scorecard per component page (WCAG 2.2 conformance level). Doctolib and others run
  red/orange/green compliance dashboards (the X-Ray Chrome extension).

The whole category bolts a conformance/coverage view *onto* docs after the fact. WE has
it natively: the `/protocols/` index ([we:src/protocols.njk](../src/protocols.njk)) already
renders, per protocol, what implementations must agree on and is filterable by project +
status; the `capabilityMatrix` ([we:src/_data/capabilityMatrix.json](../src/_data/capabilityMatrix.json),
rendered by [we:src/capabilities.njk](../src/capabilities.njk)) is the static build-matrix
mapping each impl to a 3-state tier (native-ok / polyfill-ok / capability-hard); and
#089's idea 1 (continuous verification) re-runs the open suite over time. The
dashboard fork is therefore *reuse vs rebuild*, not *build from scratch* — the machinery
is on disk.

## How the home question is already framed by MaaS

#091's third follow-on ("a Plateau offering vs a graduated Plateau-side project entry")
is verbatim the open "home decision" #081/MaaS parks:
([backlog/081:75](../backlog/081-module-as-a-service-provider.md#L75)) "confirm whether
MaaS stays under `webadapters` or graduates to its own Plateau-side project entry." Both
are managed providers on the same Plateau serve-time host sharing one billing/auth/hosting
surface (#089 idea 4 explicitly puts ideas 2/4/5 under "Plateau as the enterprise web
platform"). The two items should resolve their home the same way to avoid one-off
provider taxonomies — which is what makes this a shared, not a local, decision.

## Findings reshaped into the three forks

| # | Follow-on | Prior-art split | Recommended default |
|---|---|---|---|
| 1 | Ingestion contract | docs-as-code (Mintlify/Docusaurus) vs platform-first (ReadMe/GitBook) | **docs-as-code: customer's `webmanifest`+`webcases` are the source, Plateau never owns content** |
| 2 | Conformance-dashboard surface | bolt-on a11y report (Chromatic/Gestalt/VPAT) vs reuse an existing conformance surface | **reuse `/protocols/` + `capabilityMatrix` + #089-idea-1 verification — one pipeline, not a parallel dashboard** |
| 3 | Home | own project entry now vs offering under an existing project (resolve in lockstep with MaaS) | **a managed *offering* under the Plateau umbrella, sharing MaaS's home ruling; graduate to a project entry only when a second consumer demands it** |

## Sources

- [Chromatic pricing](https://www.chromatic.com/pricing) · [Chromatic publish/index features](https://www.chromatic.com/features/publish) · [Chromatic vs Storybook](https://www.mgsoftware.nl/en/vergelijking/storybook-vs-chromatic)
- [Mintlify vs GitBook vs ReadMe (2026)](https://writechoice.io/blog/gitbook-vs-readme-vs-mintlify-comparison-2026) · [Mintlify API-docs Git integration](https://www.mintlify.com/library/api-docs-with-git-integration) · [ReadMe vs Mintlify](https://readme.com/blog/readme-vs-mintlify)
- [Docusaurus](https://docusaurus.io/) · [Docusaurus review — hidden costs](https://ferndesk.com/blog/docusaurus-review)
- [USWDS accessibility / ACR](https://designsystem.digital.gov/documentation/accessibility/) · [Supernova — a11y in design systems](https://www.supernova.io/blog/accessibility-in-design-systems-a-comprehensive-approach-through-documentation-and-assets) · [Measuring design-system compliance (Doctolib)](https://medium.com/doctolib/measuring-design-system-compliance-of-your-teams-ccbd718499f8)
