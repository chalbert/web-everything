---
type: issue
workItem: story
size: 5
status: open
dateOpened: "2026-06-15"
tags: []
---

# Ensure ALL Frontier UI content is exposed publicly on the FUI website

Audit Frontier UI's public website against everything FUI actually contains — blocks, demos, traits, plugs, adapters, the trait tree-shaking capability, every implemented standard — and close the gaps so nothing built is invisible to the public. FUI owns the rendered display of its own content (the docs-rendering boundary: WE iframes FUI demos, FUI hosts them), so completeness of FUI's public surface is FUI's responsibility. Deliver an inventory-vs-published diff and the pages/nav to expose anything missing. General hygiene card surfaced during #713 (trait docs must be public) but applies to the whole FUI surface, not just traits.
