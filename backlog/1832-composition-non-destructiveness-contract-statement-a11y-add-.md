---
kind: story
size: 5
status: open
dateOpened: "2026-06-27"
tags: []
---

# Composition non-destructiveness contract statement (a11y add-only invariant)

Codify, as a citable WE contract, the ratified rule from #1795: every sanctioned HTML-first composition strategy (slot, decoration, scoped-replace, abstract-piece-split) must be ADD-ONLY to the base block's a11y contract — may extend roles/focus/keyboard/aria, never override or remove. WE owns the contract statement only; per-variant verification is a FUI/Plateau conformance concern. Rule: we:docs/agent/platform-decisions.md#composition-preserves-a11y-contract.
