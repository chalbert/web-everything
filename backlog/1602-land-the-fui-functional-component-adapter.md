---
kind: story
size: 5
parent: "081"
status: open
locus: frontierui
dateOpened: "2026-06-22"
tags: []
---

# Land the FUI functional-component adapter

Build the Frontier UI functional-component adapter described in `we:plans/functional-component-adapter.md`
as a real, shipped FORMS source — the prerequisite that #313 (MaaS — add the adapter as a FORMS entry) has
been waiting on. The MaaS provider epic #081 resolved without this adapter being delivered as its own
artifact, so it is carved out here as the concrete blocker.

This card exists so #313 is **blocked by a real edge**, not a prose "once it lands" note (parking is not a
prioritisation escape — 2026-06-22 parked-item sweep).

## Scope

- Implement the functional-component adapter per `we:plans/functional-component-adapter.md` (the FUI
  functional/render-prop authoring form that lowers to the standard).
- Register it as a FORMS entry the MaaS `?form=…` catalog can serve.
- Then #313 (`blockedBy: 1602`) wires it into the MaaS demo and the polyglot panel.

## Blocks

- #313 — MaaS: add the Frontier UI functional-component adapter as a FORMS entry.
