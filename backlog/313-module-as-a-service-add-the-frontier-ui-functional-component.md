---
kind: story
size: 2
parent: "081"
status: parked
parkedReason: deferred
dateOpened: "2026-06-11"
tags: []
---

# Module-as-a-Service — add the Frontier UI functional-component adapter as a FORMS entry

Spun out of #081. Adds the Frontier UI functional-component adapter (we:plans/functional-component-adapter.md) as a new FORMS entry once it lands, replacing the WE-internal generator stub. Independent of the other #081 follow-ons.

> **Parked (2026-06-12).** Gated on a prerequisite that hasn't landed: the FUI functional-component adapter itself is still a plan (`we:plans/functional-component-adapter.md`) with **no implementation in `frontierui/`** (no `FunctionalComponent` source, no tracked build item). This task is "add it as a FORMS entry *once it lands*" — there is nothing to register yet. Surfaced and parked during batch pre-flight (mis-flagged Tier-A). Un-park when the adapter ships in Frontier UI.
