---
kind: decision
status: open
locus: webeverything
dateOpened: "2026-06-29"
tags: [webblocks, block-standard, composition, dom-less, framework-parity, adoption, decision]
---

# Composition rubric re-judged to framework-parity — strict per-case mechanism selection at a zero-compromise bar

WE already ships the composition **mechanisms** and a ratified per-*family* rule — but it has never been
consolidated into one strict **per-case** rubric, nor re-judged against a framework-parity bar. This decision
does that. It is **adoption-critical**: a native-first system that can't match framework composition DX never
wins first-level developer adoption, no matter how good its standards are.

**This card does not re-derive the mechanisms** (they're built — see Inputs). It (a) unifies the two existing
taxonomies into one matrix, (b) re-judges every cell against the bar below, and (c) emits *invent-case* child
items where nothing clears it.

## The acceptance bar (every per-case solution must clear all five)

1. **Ergonomics ≥ frameworks** — authoring DX competitive with React/Vue/Svelte/Solid, not "good for web
   components."
2. **Zero compromise** — no breakage of **layout** (flex/grid direct-child), **CSS** (selector/cascade), or
   **accessibility** (AX tree + HTML content-model). See the cost enumeration in #1962.
3. **A no-compromise solution for *every* case** — an uncovered case is not allowed to stand; it becomes a
   build/invent item.
4. **Open to net-new mechanisms** — where no existing option clears the bar, **invent a plug** (proposed
   standard, per *Plug = Proposed Missing Standard*), don't settle for a compromised one.
5. **Authoring-surface-agnostic** — clean in **plain HTML** (declarative/SSR) **and JSX** (and other valid
   approaches: imperative DOM, templates). No mechanism may force a single authoring mode.

## Two taxonomies to reconcile (the reason this isn't already done)

- **§7 block families A/B/C** ([we:block-standard.md](../docs/agent/block-standard.md), ratified
  #1321/#1381/#1456/#1457) — covers only a *block's runtime shape* (transient → native vs persistent light-DOM
  vs shadow). ~80% confidence; chosen "by what the consumer needs," **never benchmarked to framework parity**.
- **`/research/dom-less-composition` A–I catalog** ([research topic](/research/dom-less-composition/)) — covers
  the *broader* composition surface (comment/virtual elements, fragments, `display:contents` providers,
  behaviors, mixins, portals, `is=`). A **catalog**, not a strict ratified per-case rule.

No single artifact spans both. An author choosing a mechanism for a *non-block* composition case today has a
catalog to read, not a rule to apply.

## Draft case → mechanism matrix (re-judged — to be finalized at `/prepare`)

Verdict key: ✅ clears the bar · ⚠️ compromise (named) · 🔧 invent-case (no current option clears it).

| # | Composition case | Current mechanism (built) | Bar verdict |
|---|---|---|---|
| 1 | Behavior-free presentational control (button, badge, chip) | (A) transient → native ([fui:blocks/transient/TransientElement.ts](../../frontierui/blocks/transient/TransientElement.ts)) | ⚠️ **facet #1962** — true native semantics ✅ but detached-node/stale-ref cost (#1960/#1961) + unsanctioned; re-judge vs persistent+mixins / `is=` |
| 2 | Grouped / reactive control (checkbox-group, stepper) | (B) persistent light-DOM (#1456/#1457) | ✅ the host *is* a semantic node; native semantics via the element |
| 3 | Hostile / unknown host CSS | (C) shadow (#1349 S2) | ✅ for that case (pays `::part`/`ElementInternals` tax — scoped, opt-in) |
| 4 | Structural grouping, no wrapper (multi-root / fragment) | DocumentFragment · JSX `<>` ([fui:packages/jsx-runtime/src/JSXRenderer.ts](../../frontierui/packages/jsx-runtime/src/JSXRenderer.ts)) | ✅ zero node; HTML via `<template>`, JSX native |
| 5 | Conditional / list / switch region | comment-marker virtual elements — `CustomComment` (#1130) → `ForEach`/`ViewIf`/`ViewSwitch` | ✅ zero layout node (comments invisible); HTML + JSX both |
| 6 | Context / DI provider, no layout impact | `display:contents` custom element (#1044) | ⚠️ layout-transparent ✅ but node stays in DOM/AX (generic role); `display:contents` a11y "mostly fixed 2023+"; confirm zero-compromise |
| 7 | Behavioral composition (N behaviors on one element) | `CustomAttribute` behaviors · class mixins | ✅ zero node, the HOC analog; HTML attr-driven + JSX both |
| 8 | Attach behavior to a *native* element, no wrapper | `is=` customized built-in | ⚠️ **Safari foreclosed** (#97) → needs polyfill or alternative; not zero-compromise cross-browser |
| 9 | Teleport / portal | portal directive (documented) | ⚠️ confirm built + parity |
| 10 | **Deep STRUCTURAL composition** (10 layers, each needs its own node) | behavioral layers → mixins ✅; structural layers → `display:contents` per layer or accept nodes | 🔧 **likely invent-case** — no single primitive gives framework-grade *stacked* zero-DOM structural composition; the original concern in #1962 |

## Likely invent-cases (🔧 — net-new plug candidates)

- **Stacked zero-DOM structural composition** (case 10). React stacks N structural HOCs/providers at zero DOM
  cost; WE has per-layer `display:contents` (works, but every layer is still a node in DOM/AX and authors must
  opt each in). A *true* parity primitive may need inventing — a plug. This is the headline gap.
- **`is=` cross-browser parity** (case 8) — a polyfill, or a blessed autonomous-element alternative, so the
  "behavior on a native element, no wrapper" case clears the bar in Safari.
- **(watch) DOM Parts** — the W3C proposal would standardize comment-marker regions; adopt-path, not invent.

## Outcome shape (what ratifying this produces)

- A **single strict per-case rubric** in `we:block-standard.md` (consolidating §7 + the catalog), each case
  naming the one bar-clearing mechanism, with the worked examples cross-linked.
- For each ⚠️/🔧 cell: either a confirmed clearance after `/prepare` benchmarking, or a **child build/invent
  item** (the gap becomes tracked work, honoring bar-rule 3).
- The bar itself codified as the standing test for *future* mechanism choices.

## Inputs & relationships

- **Inputs (built, ratified):** §7 families #1321/#1381/#1456/#1457 · `CustomComment` #1130 · view directives
  #1217 · `display:contents` provider #1044 · JSX strategy #052 · `/research/dom-less-composition`.
- **Facet:** **#1962** (transient viability) is case 1's worked re-judgment — engages the WebKit #97 argument
  and the composition-cost analysis. Resolve under this card's bar.
- **Downstream:** the block-conversion epic **#1442** inherits whatever this ratifies.
- **No `blockedBy` on #1960/#1961** — those mitigations stand regardless; if case 1 re-judges away from transient,
  they're superseded.
- Not yet prepared: `/prepare` must benchmark each ⚠️ cell against the named frameworks, confirm or refute the
  🔧 invent-cases with a prototype, and shape the finalized matrix + defaults + skeptic.
