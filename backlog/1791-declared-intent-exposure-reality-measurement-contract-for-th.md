---
kind: decision
parent: "1522"
status: open
dateOpened: "2026-06-26"
locus: plateau-app
tags: [explorer, intent-conformance, declared-intent, dev-browser]
---

# Declared-intent exposure + reality-measurement contract for the explorer intent-conformance oracle

Decision gating #1698 (the explorer's intent-conformance oracle). #1698 assumes a running page exposes its declared density/motion/a11y-level intents, citing #1689 — but #1689 delivered a conformance RULE registry, not an intent exposure. Two calls: **(1) Exposure** — how a page declares its density/motion/a11y-level (a #1689 DeclaredRule entry, a per-page manifest, or native root data-attrs/CSS vars). **(2) Reality measurement** — motion: animations under prefers-reduced-motion; density: measured spacing vs the declared band; a11y-level: delegate to the existing axe lane. Decide both; then #1698 builds the pure oracle over an Observation + declaredIntents. Don't invent the format inside #1698.
