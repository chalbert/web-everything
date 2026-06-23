---
kind: story
size: 5
parent: "081"
status: open
blockedBy: []
locus: frontierui
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
tags: []
---

> **Blocked on a design fork (2026-06-22, batch-2026-06-22-764-1602 pre-flight/work).** Surfaced as
> mis-flagged Tier-A: reads as "register a FORMS entry" but landing it forces three unprepared design
> calls — (1) the FUI MaaS catalog **ratified-retired `functional`** (#974/#977 resolved), so the
> authoring form's catalog identity is undecided; (2) the #700 boundary means FUI MaaS never imports
> WE's `serve()`, yet WE already emits the functional source — so FUI re-emit vs consume-WE-data-emit
> (#954 axis) is undecided; (3) the plan is a brain-dump, not a buildable contract. Filed
> **[#1619](/backlog/1619-decide-the-fui-functional-component-adapter-shape-catalog-id/)**
> (`blockedBy: 1619`). #313 stays blocked behind this. The `@frontierui/jsx-runtime` runtime already
> exists; this is the adapter/emit layer around it.

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
