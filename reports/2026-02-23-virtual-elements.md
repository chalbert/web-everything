# Research Report — Virtual Elements: Directives or Components?

**Plan file**: `plans/virtual-elements.md`
**Research page**: `/research/virtual-elements/`
**Date**: 2026-02-23

---

## Question

Virtual elements — comment-based DOM-less markers that delimit dynamic regions — are a foundational pattern in Web Everything. But which project *owns* them? Are they part of **Web Directives** (structural control flow) or **Web Components** (custom element patterns)?

## Recommendation

**Web Directives.** Virtual elements are comment-based structural markers. They control *what* appears in the DOM, not *which tag* it uses. This is the defining characteristic of a directive, not a component.

## Key Findings

### Historical Lineage

Comment-based virtual elements have a well-established lineage: Knockout.js (2011) → Angular (2016) → Vue (2020) → Solid (2021) → Lit (2021) → Web Everything (2026). The pattern evolved from Knockout's `<!-- ko if: condition -->` to Web Everything's `CustomComment` with full lifecycle callbacks.

**Key trend**: Angular 17's migration from structural directives to compiler-built-in `@if`/`@for` shows the pattern evolving toward *compiler erasure* — removing even the comment anchors from the DOM.

### W3C DOM Parts

The W3C DOM Parts proposal aims to standardize comment-based markers via `ChildNodePart`. Chrome filed an Intent to Prototype (January 2025). Web Everything's `CustomComment` is already architecturally aligned — migrating would be a runtime swap, not an API change.

### Transient Element Relationship

Transient elements and virtual elements solve related but distinct problems:
- **Virtual elements**: Structural control flow without wrappers (loops, conditionals, async boundaries)
- **Transient elements**: Dynamic tag resolution without wrappers (heading levels, link vs button)

The **transient-to-comments bridge** is where they overlap: `<for-each>` is a transient element that replaces itself with comment boundaries — an ergonomic authoring shortcut for what is fundamentally a directive.

### JSX Makes Transient Syntax Redundant

In JSX, function components like `AutoHeading` return native elements directly — no intermediate custom element that needs to self-replace. The `TransientElement` base class is an **HTML-first authoring pattern**. Virtual elements remain a **runtime structural pattern** needed even in JSX for lists and conditionals.

## Classification

| Pattern | Project | Rationale |
|---------|---------|-----------|
| Comment marker pairs | Web Directives | Core runtime mechanism for structural control flow |
| CustomComment (lifecycle-enabled) | Web Directives (plug) | Extends Comment with lifecycle callbacks |
| CustomCommentRegistry | Web Directives (plug) | Registry for comment-based directives |
| TransientElement | Web Components | Extends HTMLElement with self-replacement |
| Transient-to-comments bridge | Cross-referenced in both | Authoring syntax = Components; runtime result = Directives |

## Files Created/Modified

| File | Action |
|------|--------|
| `src/_data/researchTopics.json` | Added `virtual-elements` entry |
| `src/_includes/research-descriptions/virtual-elements.njk` | New file (~290 lines) |
