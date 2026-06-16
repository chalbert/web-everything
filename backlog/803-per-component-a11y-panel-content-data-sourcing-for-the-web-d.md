---
type: decision
workItem: story
size: 3
parent: "623"
status: open
dateOpened: "2026-06-16"
tags: []
---

# Per-component a11y-panel content + data sourcing for the Web Docs /blocks/ pages

Decide what a per-component a11y panel on /blocks/{id}/ surfaces and where its data comes from. There is no per-component a11y source today: #770 ships a route-level axe gate (tests/a11y/rendered-site-a11y.spec.ts), not per-component metadata, and intents.json carries no a11y fields. Options for the origin: intent/trait-derived a11y metadata, per-demo axe results, or authored notes. Settle the panel's content and its source before any build.
