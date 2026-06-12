# Benchmark corpus — design systems & UI libraries for competitive coverage analysis

**Date:** 2026-06-12
**Backlog:** #316 (phase 1 of epic #315, the competitive coverage gap-analysis program)
**Research topic:** [/research/benchmark-corpus/](/research/benchmark-corpus/)
**Data:** `src/_data/benchmarkCorpus.json`

## What this is

Phase 1 of the gap-analysis program: the **canonical, reproducible list** of leading design systems and
UI libraries that later phases (extraction #346, mapping #347) analyse for gaps in the Web Everything
platform. The deliverable is *the list plus the criteria that produce it* — not a survey of any one
system. Extraction of each source's components/docs/standards is phase 2.

## Selection criteria (the reproducibility key)

A source qualifies if it scores on **≥3** of these AND occupies a category axis:

1. **Adoption / influence** — used in production or widely copied.
2. **Coverage breadth** — many component + pattern categories, not a single widget.
3. **Distinct philosophy / axis** — adds a perspective the corpus would otherwise miss.
4. **Native-platform alignment** — tracks web standards / WAI-ARIA APG / native elements.
5. **Public docs / standards quality** — browsable, citable per-component docs (the extraction source).
6. **Maintenance / currency** — actively maintained or a living standard.

## Category axes (span, not popularity)

The corpus deliberately spans five axes so the gap sweep isn't biased toward one philosophy:

| Axis | Sources |
|---|---|
| Mature opinionated design system | Material 3, Carbon, Fluent 2, Spectrum, Polaris, Atlassian, Primer, Lightning |
| Headless / a11y-first primitive | Radix, React Aria, Base UI, Ark UI, Headless UI |
| Web-component / framework-agnostic | Shoelace, Spectrum Web Components, FAST, Lion |
| Popular styled component kit | MUI, Ant Design, Chakra, Mantine, shadcn/ui |
| Platform guideline / standards body | Apple HIG, GOV.UK, WAI-ARIA APG, Open UI |

26 sources total. The **platform-guidelines** axis is load-bearing for the program's *native-first*
discipline: WAI-ARIA APG and Open UI are the anchors that decide whether a library capability is a real
platform gap or something the web platform already provides natively (`dialog`, `popover`, `selectlist`,
anchor positioning, `Intl.*`).

## How it integrates

- **`src/_data/benchmarkCorpus.json`** is the single source of truth: criteria, axes, and per-source
  metadata (`id`, `name`, `vendor`, `category`, `docsUrl`, `repoUrl`, `philosophy`, `nativeAlignment`,
  `inReferences`, `lastChecked`).
- **`references.json` "Reference Design Systems"** was *extended* (added WAI-ARIA APG, Open UI, React Aria,
  Shoelace) — it remains the curated docs-surface subset, flagged `inReferences: true` in the corpus. The
  corpus is the superset; neither is a blind copy of the other.
- **`/research/benchmark-corpus/`** renders the criteria, axes, and corpus table directly from the data
  file (no hand-maintained duplicate).

## Re-running (feeds #349 repeatability)

Each run is a dated revision (the #192 longitudinal-freshness model). Refresh = re-apply criteria,
add/remove sources, bump `lastChecked`/`lastSwept`, record the diff. Keyed by stable source `id` so a
re-run yields a clean added/dropped/re-categorised diff, not a rewrite.

## Open / deferred

- **Final membership is defensible, not fixed** — the criteria are the contract; the list will move as the
  landscape does. Notable judgement calls: Ant/MUI/Mantine kept despite low native-alignment (adoption +
  breadth), USWDS/Bootstrap/PatternFly considered but cut as adding no axis the corpus lacks.
- The **per-source extraction depth** (which doc sections count as a "component" vs "pattern") is decided in
  #346, not here.
