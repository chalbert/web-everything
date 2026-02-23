# Research Report — DOM-Less Composition Patterns

**Plan file**: `plans/composition.md`
**Research page**: `/research/dom-less-composition/`
**Date**: 2026-02-23

---

## Question

React can wrap components without adding DOM elements — Fragments, Context.Provider, render props, and HOCs all compose behavior without injecting wrapper nodes. In a custom-elements framework like Web Everything, every custom element is a real DOM node. What patterns exist to solve this, and what are the gaps?

## Key Findings

### 9 Pattern Categories

Every DOM-less composition technique falls into one of these categories:

| Category | Pattern | Extra DOM Nodes | Status in WE |
|----------|---------|----------------|-------------|
| A. Compile-time erasure | Vue `<template>`, Svelte blocks, Angular `<ng-container>` | Zero | Comment-based directives adopted |
| B. Comment-based virtual elements | Comment marker pairs, CustomComment lifecycle | Two comments (layout-invisible) | **Primary pattern** — ForEach, ViewIf, ResourceLoader |
| C. Fragment-based | DocumentFragment, `<template>` content | Zero | **Already used** in JSXRenderer, template stamping |
| D. Transient elements | TransientElement self-replacement | Zero after replacement | **Already implemented** — AutoHeading |
| E. CSS layout transparency | `display: contents`, adopted stylesheets | One (layout-transparent) | Accessibility issues largely fixed (2023+) |
| F. Data association | WeakMap, Symbol-tagged metadata, Proxy | Zero | Used internally by injector system |
| G. Behavioral composition | CustomAttribute, Mixins, JSX render functions | Zero | **Core pattern** |
| H. Portals | Render children into remote DOM target | Zero at source | Documented as portal directive concept |
| I. Customized built-ins | `<div is="my-element">` | Zero | Already used for CustomTemplateDirective |

### Primary Gap: DOM-Less Context Providers

The one significant gap is **context/injector providers that do not affect CSS layout**. The injector chain walks the DOM tree — providers must be DOM nodes. React's `Context.Provider` adds zero DOM because React has a virtual tree.

**Proposed solution**: `display: contents` custom elements. They participate in the injector chain (real DOM node), are invisible to CSS layout, and events/selectors still work. Accessibility issues have been largely fixed since 2023.

### Recommendations (Ranked)

**Tier 1 — Continue investing**: Comment-based virtual elements, TransientElement, DocumentFragment

**Tier 2 — High-value additions**:
- `display: contents` provider elements (solves context provider layout problem)
- Functional components in JSXRenderer (detect function type in createElement)
- Transient-to-comments bridge (generalize TransientElement to replace itself with comment markers)

**Tier 3 — Worth considering**: Proxy-based reactive providers, DOM Parts adoption path

## Files Created/Modified

| File | Action |
|------|--------|
| `src/_data/researchTopics.json` | Added `dom-less-composition` entry |
| `src/_includes/research-descriptions/dom-less-composition.njk` | New file (~376 lines) |
