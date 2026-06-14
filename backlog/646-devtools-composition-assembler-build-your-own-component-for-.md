---
type: idea
workItem: epic
status: open
dateOpened: "2026-06-14"
relatedProject: webdocs
crossRef: { url: /backlog/609-candidate-standard-reveal-navigation-menus-mega-menu-hover-d/, label: "Motivated by — reveal-nav own-thesis ruling (#609); reveal-nav is preset #1" }
tags: [devtools, composition, assembler, build-your-own-component, meta-component, zero-lock-in, scaffolding]
---

# Devtools composition assembler — build-your-own-component for pure-composition meta-components

Surfaced while ratifying #609. Fork 1's own-thesis test draws a clean line — own-thesis family gets a block (menu, drawer); a pure-composition meta-component gets NO block — but that leaves authors without ergonomic help, and proliferating thin blocks is exactly what #609 declined. The complement is a zero-lock-in devtools composition assembler: a "build-your-own-component" workbench that wires intent/block primitives (nav-list + disclosure + anchor + hover-intent) into a meta-component and EMITS a plain, ejectable composition recipe — no runtime framework. Honours minimize-lock-in and impl-is-not-a-standard (the recipe it emits is the standard, the tool a deferred build). reveal-nav is preset #1.

## Scope to settle (epic — before slicing)

- **Preset taxonomy.** Which big meta-components seed the assembler — reveal-nav (#1), then command palette, filter bar, hovercard, toolbar, date-range. Each is a pure composition that failed the own-thesis test.
- **Recipe-emit format.** What the tool emits — the ejectable markup + wiring (no runtime framework dependency), so the output is the standard, not a lock-in artifact.
- **Relationship to the workbench landscape (#623–626).** This is an *authoring* surface, distinct from the Web Docs *catalog/story* pipeline; reconcile homes and shared registries so they don't drift.
