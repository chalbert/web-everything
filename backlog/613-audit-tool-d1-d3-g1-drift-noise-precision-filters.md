---
type: issue
workItem: story
size: 3
status: open
dateOpened: "2026-06-14"
tags: []
---

# Audit tool: D1/D3/G1 drift+noise precision filters

Tighten the drift and edge-gap checks in scripts/audit-backlog-health.mjs, per the #607 audit (D1: 9 hits / 0 true dead-refs; G1: 104 hits / 0 slips). D1: suppress paths governed by negation (assertion-of-absence, 'there is no plugs/package.json'), a write/emit verb (runtime output), or build-card deliverable prose ('a page at X' = will-create); resolve bare suffixes against the dir named nearby and split slash-joined enumerations against src/_data/. D3: aggregate per-project (resolved count + live surface) not per-item, and separate intentionally-pending status (webplugs correctly 'concept' pending #606) from stale drift. G1: drop per/ruled-by/after/once, keep gated-on/depends-on/requires/builds-on — 104 to single digits.
