---
type: decision
status: open
dateOpened: '2026-06-02'
tags:
  - intents
  - traits
  - droplist
  - di
  - naming
relatedReport: reports/2026-06-02-intent-vs-trait-change-plan.md
relatedProject: webintents
---

# Split intent (ambient preference) from trait selection (local construction)

"Intent" is overloaded across two channels: an ambient, design-owned behavioral preference propagated via DI, vs. a local, developer-owned structural construction of a component. Leaning: keep 'intent' for the ambient/behavioral channel; rename the per-instance bundle to 'trait selection'. Structural dimensions (model, editable, which traits compose) are always local and never travel on the intent channel — so customContexts:droplistIntent="single" is removed, while the app-level droplistIntent survives, narrowed to behavioral preference. Per-dimension resolution: explicit then ambient-intent (behavioral only) then default. Open word choice: 'trait selection' vs 'DroplistConfig'.
