---
kind: story
size: 3
status: open
dateOpened: "2026-06-23"
tags: []
---

# Intent inspector — surface the active intent(s) on a rendered page

A dev-tool overlay that shows which intent(s) a page's elements were resolved under, by READING attributes already in the DOM — the webintents standard emits the active profile as data-intent-* on the root/scope (data-intent-density/-motion/-mode) and elements carry semantic intents (action-intent=...). Inert, near-zero cost: it stamps nothing, just surfaces what is there. Carved from #947 sibling (3) (read-only intent surfacing). The overlay UI is dev-tooling (FUI/Plateau dev-browser); the attribute contract is WE's. Wanted feature, not a parked residual.
