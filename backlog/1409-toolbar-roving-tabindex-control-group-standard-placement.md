---
kind: decision
size: 3
parent: "099"
status: open
dateOpened: "2026-06-21"
tags: [decision, book-candidate, toolbar, roving-tabindex, apg, accessibility, gap]
---

# Toolbar — roving-tabindex control group standard: placement

Surfaced by the ARIA-APG lens ([#1400](/backlog/1400-discovery-lens-aria-authoring-practices-apg-pattern-diff-aga/)):
a **toolbar** groups related controls (buttons, toggles, menu-buttons, separators) under one tab stop with
**roving tabindex** + arrow-key navigation between members — the APG Toolbar pattern. WE owns the member
controls (`button`, `toggle-switch`, `menu`, `segmented-control`) and a keyboard-shortcut block, but **no
standard for the roving-tabindex control-group container**.

**Decision:** own `toolbar` intent/block vs a behavior (roving-tabindex) reusable across toolbar / menubar
/ radio-group / tabs (they share the pattern) vs a `segmented-control` extension. The roving-tabindex
mechanic recurring across several APG patterns suggests a shared behavior may be the real unit. Refs:
[we:src/_data/blocks/segmented-control.json](../src/_data/blocks/segmented-control.json),
[we:src/_data/blocks/keyboard-shortcuts.json](../src/_data/blocks/keyboard-shortcuts.json). **Needs
`/prepare`.** Unsure ⇒ decision; costs nothing.
