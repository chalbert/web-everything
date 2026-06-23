---
kind: story
size: 3
locus: frontierui
status: open
dateOpened: "2026-06-23"
tags: [fui, gap, dogfood, badge, tag-intent]
---

# FUI we-tag block — implement the draft tag intent (categorical/decorative labels) for taxonomy pills

FrontierUI implements the Status Indicator intent (badge) and filter-chip, but not the Tag intent (we:src/_data/intents/tag.json, draft) — the decorative/categorical label #1319 split out from Status Indicator and Notification Marker, with a purpose-built categorical tone for labels that map to no severity. Build a FUI we-tag transient block mirroring fui:blocks/badge/ (config factory, CSS export, transient custom element, register helper) covering its tone/emphasis/shape dimensions, decorative-only (Action/Selection compose). Unblocks the taxonomy half of the badge dogfood: backlog kind/tier/tags/size pills (#1598/#1208) have no semantic home, and #1621 ruled they map to Tag, not the status badge. locus: frontierui.

**Consumer of #1670 (ratified 2026-06-23).** Its category-consumption API — how `we-tag` resolves a `(set, value)` to colour/icon/shape — follows the categorical-taxonomy ruling (`we:docs/agent/platform-decisions.md#categorical-taxonomy`): categories are a closed-set token family, `we-tag` paints via `--cat-<set>-<value>-*` custom properties (JS-first per #1682), `status` is excluded (Status Indicator owns it). Contract now decided — unblocked.
