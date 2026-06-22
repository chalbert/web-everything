---
kind: story
size: 3
parent: "1585"
status: open
priority: low
locus: plateau-app
relatedProject: webaudit
blockedBy: []
dateOpened: "2026-06-22"
tags: []
---

# Weight-tuning editor for design-knowledge tier-weights (plateau panel)

`priority: low` build green-lit by decision #1592. A small plateau-app panel (mirroring vision-review's edit pattern) that loads the WE default credibility flavor (we:src/_data/credibilityWeighting.js) and lets a project retune tier numbers + add custom source-kinds/modifiers, emitting the PORTABLE opts shape ({sourceKinds, weightModifiers, floor, stalenessHorizonYears}) consumed by computeCredibilityWeight(source, opts). NOT a Technical Configurator domain (that is a selection ranker, category mismatch — #1592 Fork 2). Low-value-now: the opts override path has zero consumers today, so this stays demoted/visible until a real consumer appears (a non-WE project needs a retuned flavor, or the #1586 ledger starts calling the function with modifiers). Lineage: #1588 Fork-3 → #1591 → #1592.
