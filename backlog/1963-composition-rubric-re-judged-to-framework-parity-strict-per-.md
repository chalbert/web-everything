---
kind: decision
status: open
dateOpened: "2026-06-29"
tags: []
---

# Composition rubric re-judged to framework-parity — strict per-case mechanism selection at a zero-compromise bar

WE already ships the composition MECHANISMS (we:block-standard.md §7 families A transient / B persistent / C shadow, ratified #1321/#1381/#1456/#1457; comment-based virtual elements via CustomComment #1130; display:contents DI provider #1044; JSX fragments + functional components; CustomAttribute behaviors; is= customized built-ins) and a catalog research (/research/dom-less-composition A-I). What is MISSING is a single strict per-case selection rubric re-judged against a raised acceptance bar: (1) ergonomics >= frameworks (React/Vue/Svelte/Solid), (2) ZERO compromise on layout/CSS/accessibility, (3) a great solution for EVERY case (no gaps), (4) open to NET-NEW mechanisms (a plug / proposed standard) where nothing existing clears the bar, (5) authoring-surface-agnostic (clean in plain HTML AND JSX AND other valid approaches). This decision consolidates the §7 families with the A-I catalog into ONE case->mechanism matrix, re-judges every cell against the 5-point bar (clears / compromise / invent), threads #1962 (transient viability) as the worked facet and #1381/#1456/#1457 + dom-less-composition as inputs, and emits invent-case child items where no current mechanism clears the bar (e.g. stacked zero-DOM STRUCTURAL composition, is= Safari parity). Adoption-critical: without framework-grade composition DX, native-first WE does not win first-level developer adoption. Supersedes the distributed §7 rule by consolidating + raising its bar; does not re-derive the built mechanisms.
