---
kind: story
size: 3
parent: "1327"
status: open
dateOpened: "2026-06-21"
tags: []
---

# Backfill capability glossary terms (~20 in-scope capabilities)

Slice A3 of #1327. The #1343 ratification's premise that capabilities are 'already 0-gap (21/21)' was a measurement error — the #1371 coverage gate finds only 1/21 capability labels match a glossary term (20 missing: Popover API, Dialog, Anchor Positioning, contentEditable, Sanitizer API, Invoker Commands, showPicker(), …). Capabilities ARE in the required wholesale set per #1343, so author a we:src/_data/semantics/<slug>.json { term, definition, usage } for each missing capability concept. Sibling of A1 (#1369 intents) / A2 (#1370 protocols). Warn-level gate already live (#1371).
