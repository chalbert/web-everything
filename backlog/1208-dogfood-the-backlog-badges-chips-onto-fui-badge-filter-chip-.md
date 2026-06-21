---
kind: story
size: 8
parent: "777"
status: parked
parkedReason: deferred
dateOpened: "2026-06-20"
tags: [dogfood, fui, badge, site-rework]
---

# Dogfood the backlog badges/chips onto FUI badge + filter-chip (Mode-C)

The concrete #777 slice for the badge surface the #778 inventory mapped: migrate the /backlog/ tile, Prioritisation table, and detail-page badges/chips from hand-rolled njk to the FUI badge + filter-chip components, rendered in-document via Mode-C. Groundwork is done — the badge vocabulary + macros are now a single shared seam (we:src/_includes/backlog-badges.njk + we:src/_data/backlogMeta.js, the #778 "one seam the migration consumes"), Mode-C in-document render shipped (#786), and the status-indicator/badge intent is ratified (#354).

**Parked — blocked-in-fact:** FUI must first expose the `badge` + `filter-chip` components (the #778 must-build gap, no open WE-side item) before the seam's internals can swap to render via them. Un-park once those exist. Scope: replace the macro bodies in we:src/_includes/backlog-badges.njk (and the filter pills in we:src/backlog.njk) with the FUI component calls, keeping the props = the backlogMeta vocabulary.
