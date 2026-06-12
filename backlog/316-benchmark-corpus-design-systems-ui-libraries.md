---
type: idea
workItem: story
size: 3
status: resolved
parent: "315"
dateOpened: "2026-06-11"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: research topic benchmark-corpus + benchmarkCorpus.json data file
relatedReport: reports/2026-06-12-benchmark-corpus.md
tags: [gap-analysis, competitive-analysis, design-systems, ui-libraries, corpus, research]
relatedProject: webdocs
crossRef: { url: /research/, label: "/research/ topic index" }
---

# Define the benchmark corpus — the exhaustive, maintainable list of design systems & UI libraries to analyse

Produce the canonical input to the [competitive coverage gap-analysis program](backlog/315-competitive-coverage-gap-analysis-program.md): an **explicit, reproducible list** of the leading design systems and UI libraries to benchmark, each with the metadata later phases consume (docs URL, source repo, philosophy/axis, native-alignment posture, last-checked date). "Leading" must be defined by **stated selection criteria**, not taste, so the next re-run lands on a comparable list — that reproducibility is the whole point of having a corpus instead of an ad-hoc reading list.

This phase is *just the list + criteria*. Extraction of each source's components/docs/standards is phase 2 (a separate child story); this story is what that phase iterates over.

## Build

- Extend the existing **`references.json` "Reference Design Systems"** category (MD3, Carbon, Radix, Fluent, Spectrum, HIG, GOV.UK) into the full corpus — **don't fork a second list**. If a richer schema is needed (the metadata fields below), introduce it where the analysis program reads it, but keep `references.json` the single home for the canonical set, or have the corpus file reference it.
- **Span the axes, not just the popular names.** The corpus should deliberately cover distinct categories so the gap sweep isn't biased toward one philosophy:
  - *Mature opinionated design systems*: Material 3, Carbon (IBM), Fluent 2 (Microsoft), Spectrum (Adobe), Apple HIG, GOV.UK, Atlassian, Polaris (Shopify), Primer (GitHub).
  - *Headless / primitive / a11y-first libraries*: Radix, Base UI, Ark UI, React Aria / React Spectrum, Headless UI, Melt/Bits.
  - *Web-component / framework-agnostic systems*: Shoelace / Web Awesome, Spectrum Web Components, Lion, FAST/Fluent WC.
  - *Popular component kits*: MUI, Ant Design, Chakra, Mantine, shadcn/ui.
  - (Final membership is the deliverable — this is the starting palette to refine against the criteria.)
- **Write the selection criteria** as the first artifact: the explicit, weigh-able signals that qualify a source — adoption/influence, breadth of component+pattern coverage, distinct design philosophy, native-platform alignment, quality of public docs/standards. The criteria are what make a *re-run* reproducible.
- **Per-source metadata schema:** `id`, `name`, `vendor`, `category` (one of the axes above), `docsUrl`, `repoUrl` (if open), `philosophy` (one line), `nativeAlignment` (how native-first it is), `lastChecked` date. This is the row each later phase joins against.
- **Publish as a `/research/` topic** (per design-first step 1 / research-workflow) backed by the corpus data file, with the session `reports/{date}-benchmark-corpus.md` linked via `relatedReport` — so the corpus is browsable *as research* and the next run is a dated revision (the [#192](backlog/192-longitudinal-research-freshness-system.md) chain model).

## Acceptance

- A documented corpus exists with **explicit selection criteria** and the per-source metadata schema, spanning the axes above (not a single-category list).
- It extends/links `references.json` rather than duplicating it; `npm run check:standards` green.
- The corpus is exposed on the website (a `/research/` topic), not a hidden `reports/*.md`.
- A second analyst (or a re-run) could regenerate a comparable list from the criteria alone — the list isn't an unexplained set of names.

## Outcome (2026-06-12)

Delivered. The corpus is `src/_data/benchmarkCorpus.json` — 6 selection criteria + an explicit inclusion
rule, 5 category axes, and **26 sources** spanning all axes (mature DS · headless primitive · web-component ·
component kit · platform-guidelines), each with the full metadata schema (`id`, `vendor`, `category`,
`docsUrl`, `repoUrl`, `philosophy`, `nativeAlignment`, `inReferences`, `lastChecked`). Exposed at
[`/research/benchmark-corpus/`](/research/benchmark-corpus/) (renders from the data file, no hand-kept
duplicate). `references.json` "Reference Design Systems" was **extended** (added WAI-ARIA APG, Open UI,
React Aria, Shoelace), remaining the curated subset (`inReferences: true`). Report:
`reports/2026-06-12-benchmark-corpus.md`. `check:standards` green; research page verified to render.
Unblocks #346 (extraction joins against this corpus).
