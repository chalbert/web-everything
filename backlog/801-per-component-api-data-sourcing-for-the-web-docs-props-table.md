---
type: decision
workItem: story
size: 3
parent: "623"
status: open
dateOpened: "2026-06-16"
tags: []
---

# Per-component API data sourcing for the Web Docs props table (WE-authored vs FUI CEM analyzer)

Decide where structured per-component API data (attributes/properties/slots/CSS custom-properties) for the /blocks/ props table originates: hand-authored blocks.json fields (WE-side declared contract) vs an FUI-side CE-manifest analyzer over FUI block source shipped to WE as data — a WE/FUI boundary/placement call. The renderer (block:props-table, #654) and CEM protocol + emit pipeline (scripts/gen-cem.mjs, #653) already exist; gen-cem.mjs:43-93 projects only events/exports/tagName and custom-elements.json carries 0 members/attributes. On ratification, extend gen-cem to project the chosen fields and spin out the props-table page-integration build.
