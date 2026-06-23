---
kind: task
status: open
dateOpened: "2026-06-23"
tags: []
---

# Reclassify the live layout intent into the composition-intent tier

Per #1680 Fork 2b, the shipped we:src/_data/intents/layout.json (app-shell region mechanics) is the charter member of the page-archetype composition-intent tier, not a primitive layout role. Mark it as a composition-intent (distinct from the per-role primitive taxonomy) so it is not mistaken for a role-set entry. Pure metadata/classification edit on the existing intent; no behavior change.
