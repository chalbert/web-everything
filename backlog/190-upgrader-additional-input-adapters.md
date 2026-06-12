---
type: idea
workItem: story
size: 5
parent: "097"
status: resolved
blockedBy: ["094"]
dateOpened: "2026-06-08"
dateResolved: "2026-06-11"
graduatedTo: blocks/renderers/upgrader/analyzers/frameworkAnalyzers.ts — React/Lit/Vue deterministic input adapters behind the analyzer registry + shared framework-cases fixtures + Code Upgrader playground cards
tags: [upgrader, input-adapter, analyzer, react, lit, vue, breadth]
relatedProject: webadapters
crossRef: { url: /backlog/094-ai-upgrader-tools/, label: "AI upgrader MVP (#094)" }
---

# Upgrader input adapters — grow source paths beyond vanilla web components

The [#094](/backlog/094-ai-upgrader-tools/) MVP shipped **one source path** (legacy vanilla web
component → neutral IR). The engine was built so a new source dialect is **a new analyzer
registration, not a pipeline change** — the registry routes by `handles(input)` and every analyzer
emits the same `ComponentIR`. This item adds further deterministic input adapters so the upgrader
covers the frameworks teams actually want to lift off.

Candidate source paths, each its own analyzer behind the registry:

- **React function component** (JSX returning a single tree) → IR. The repo already has
  `htmlToJsx`/`jsxToHtml` to lean on for the template half.
- **Lit element** (`static styles` + `render()` returning a `html\`…\`` template) → IR.
- **Vue SFC** (`<template>` block) → IR.

Each is bounded to a tractable subset (the same "flag, don't fake" rule — reject what it can't
extract, which is where the BYO-AI provider [#188](/backlog/188-upgrader-byo-ai-model-analyzer/)
takes over). Add a shared fixture per dialect (demo + unit suite, no drift) and a playground card.
Sequence after the reference path is proven; pick the highest-demand dialect first.
