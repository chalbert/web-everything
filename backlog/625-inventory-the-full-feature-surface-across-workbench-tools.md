---
type: idea
workItem: story
size: 5
parent: "623"
status: resolved
blockedBy: ["624"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
relatedProject: webdocs
tags: [webdocs, feature-inventory, matrix, capabilities, storybook]
---

# Inventory the full feature surface across workbench tools

Cross-tabbed **feature matrix** (tool × capability) over the landscape from
[#624](/backlog/624-inventory-the-component-workbench-docs-tool-landscape-storyb/). The union of capabilities a
Web-Everything-native docs surface must cover or consciously omit — this is the raw material the derivation decision
([#626](/backlog/626-map-workbench-features-to-we-standards-which-intents-blocks-/)) classifies.

## Candidate feature axes (to confirm/expand during the sweep)

- **Example/story rendering** — isolated component render, multiple states per component.
- **Args / controls** — live prop editing, control types.
- **Viewport / responsive** — breakpoint switcher, device frames.
- **Theming** — dark mode, token switching, brand themes.
- **A11y panel** — axe/contrast checks inline.
- **Interaction tests** — play functions, assertions.
- **Visual regression** — snapshot/diff, hosted review.
- **Autodocs** — generated from types / CEM / prop tables.
- **Long-form docs** — MDX/Markdown pages interleaved with examples.
- **Search** — across components + docs.
- **Source / code view** — show source, copy snippet, sandbox/embed.
- **Design-token tables** — color/spacing/type scales rendered from tokens.
- **Versioning** — multiple library versions side by side.
- **Navigation / IA** — sidebar tree, tags, grouping.

## Deliverables

- [ ] A feature-matrix artifact (extend `workbenchTools.json` with a `features` map, or a sibling `workbenchFeatures.json`).
- [ ] For each feature: which tools have it, maturity, and a one-line "what a WE-native version would need".
- [ ] Flag features that **already map to existing WE standards** (e.g. theming→webtheme, a11y→webcompliance,
      search/data-table→existing blocks) vs genuinely new surface — pre-work for #626's dedupe.

## Notes

Mostly research; the dedupe-against-existing-registry hint here de-risks the #626 decision. Blocked on #624.

## Progress

- **Status:** resolved
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - `src/_data/workbenchFeatures.json` — sibling matrix (separation bias over extending workbenchTools.json):
    20 features in 7 groups (render/authoring/controls/testing/theming/discovery/distribution), each with the
    tools that ship it (cross-tab), ubiquity, `weNativeNeed`, and the load-bearing `weStatus` dedupe column
    (reuse-existing / extend-existing / new-surface / out-of-scope) + `weStandards` refs.
  - `/research/` topic `workbench-feature-surface` + render partial.
- **Next:** #626 (map features → WE standards, the derivation decision) is unblocked.
- **Notes:** Headline finding for #626 — ~two thirds of the surface REUSES/EXTENDS standards WE already has
  (viewport→breakpoint, theming/tokens→webtheme+data-table, a11y→webcompliance, nav→nav-list/tree-select,
  i18n→webintl, analytics→webanalytics, access-control→access-control+web-identity (powers #398 open-core),
  extensibility→webplugs/webregistries; args→Technical-Configurator, stories/interaction→webcases,
  long-form→webediting, versioning→webadapters). Genuinely NEW core is small: isolation renderer,
  CEM-driven autodocs, search index, source/code view. OUT-OF-SCOPE: visual-regression (CI/hosted → #398),
  Figma design↔code bridge. So #626 is a dedupe-and-compose exercise, not a greenfield mint.
