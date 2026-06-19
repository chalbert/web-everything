---
type: idea
workItem: story
size: 3
status: open
dateOpened: "2026-06-19"
tags: []
---

# dom-less display:contents provider-element pattern

Surfaced by the #1037 deep-reports sweep (audit §13): a provider/host element that renders display:contents so it participates in the injector/provider tree without affecting layout — a dom-less wrapper for DI scoping. Distinct from the scoped-registration items (#854 et al.), which are about registries not the layout-neutral host. Confirm the pattern + a demo; relates to webinjectors provider scoping.
