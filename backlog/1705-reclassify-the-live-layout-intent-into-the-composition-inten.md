---
kind: task
status: resolved
dateOpened: "2026-06-23"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: 1680
tags: []
---

# Reclassify the live layout intent into the composition-intent tier

Per #1680 Fork 2b, the shipped we:src/_data/intents/layout.json (app-shell region mechanics) is the charter member of the page-archetype composition-intent tier, not a primitive layout role. Mark it as a composition-intent (distinct from the per-role primitive taxonomy) so it is not mistaken for a role-set entry. Pure metadata/classification edit on the existing intent; no behavior change.

## Progress (batch-2026-06-23-1725-1665)

Reclassified `we:src/_data/intents/layout.json` into the page-archetype composition-intent tier (#1680 Fork 2b):

- Added `layoutTier: "composition"` — the machine-readable marker introduced by this slice to distinguish the two altitudes #1680 ratified. The per-role primitive taxonomy (stack/cluster/grid/box/center/sidebar/… minted under #1704) carries the complementary `layoutTier: "region-role"`.
- Rewrote the summary to lead with the classification (charter member of the composition-intent tier; app-shell mechanics are a page-spanning arrangement of multiple region roles, not a primitive role). Reclassified, not retracted — dimensions/behavior unchanged.

Pure metadata/classification edit, no behavior change. Establishes the `layoutTier` convention the #1708–#1719 role mints consume.
