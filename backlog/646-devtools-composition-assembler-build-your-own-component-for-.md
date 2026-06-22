---
kind: epic
status: open
dateOpened: "2026-06-14"
relatedProject: webdocs
relatedReport: reports/2026-06-15-backlog-split-analysis.md
crossRef: { url: /backlog/609-candidate-standard-reveal-navigation-menus-mega-menu-hover-d/, label: "Motivated by — reveal-nav own-thesis ruling (#609); reveal-nav is preset #1" }
tags: [devtools, composition, assembler, build-your-own-component, meta-component, zero-lock-in, scaffolding]
---

# Devtools composition assembler — build-your-own-component for pure-composition meta-components

Surfaced while ratifying #609 (the [project-protocol-bar](docs/agent/platform-decisions.md#project-protocol-bar) rule). Fork 1's own-thesis test draws a clean line — own-thesis family gets a block (menu, drawer); a pure-composition meta-component gets NO block — but that leaves authors without ergonomic help, and proliferating thin blocks is exactly what #609 declined. The complement is a zero-lock-in devtools composition assembler: a "build-your-own-component" workbench that wires intent/block primitives (nav-list + disclosure + anchor + hover-intent) into a meta-component and EMITS a plain, ejectable composition recipe — no runtime framework. Honours minimize-lock-in and impl-is-not-a-standard (the recipe it emits is the standard, the tool a deferred build). reveal-nav is preset #1.

## Shape decided, sliced

The shape decision [#652](/backlog/652-assembler-emit-format-its-relationship-to-the-623-626-workbe/) (the [constellation-placement](docs/agent/platform-decisions.md#constellation-placement) rule) **ratified
2026-06-15** (Fork 1: plain-markup ejectable payload, CEM descriptor + `registry-item` wrapper as
coexisting exports; Fork 2: standalone devtools surface reading the shared `workbench*` vocabulary + a
WE-owned preset registry in the shadcn `registry-item` shape; served tool surface → plateau-app per the [monetization](docs/agent/platform-decisions.md#monetization) rule (#091)),
and `/slice 646` (run [we:reports/2026-06-15-backlog-split-analysis.md](../reports/2026-06-15-backlog-split-analysis.md))
then decomposed the epic into:

- **[#667](/backlog/667-preset-registry-standard-presets-surface-reveal-nav-preset-1/)** — slice A, foundational
  (story·3, agent-ready): WE-owned preset registry standard + `/presets/` surface + reveal-nav preset #1.
- **[#668](/backlog/668-optional-per-preset-cem-descriptor-export/)** — slice B (task, blocked on #667 + the CEM
  protocol #653): optional per-preset CEM descriptor export.
- **[#669](/backlog/669-interactive-build-your-own-component-assembler-workbench-ser/)** — slice C (story·8,
  `locus: plateau-app`, blocked on #667): the deferred interactive workbench tool; re-slice in
  plateau-app context once #667 lands.
- **[#660](/backlog/660-optional-assembler-team-component-library-integration-submit/)** — future, optional
  assembler↔team-library integration (submit PRs, update components in place); blocked on #667.

**Preset taxonomy is not a fork** — reveal-nav is preset #1 (#667); the rest is batch-time volume authored
one `task` each *after* #667 establishes the pattern. Now carved (2026-06-17): command palette **#856**,
filter bar **#857**, hovercard **#858**, toolbar **#859**, date-range **#860**. **date-range (#860) needs a
date primitive (intent) minted first** — verify at build (the #713 temporal-block decision has since resolved).
