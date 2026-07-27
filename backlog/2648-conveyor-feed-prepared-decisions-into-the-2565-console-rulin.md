---
bornAs: xtzhhcu
kind: story
size: 5
parent: "2612"
status: open
blockedBy: ["2647"]
scope:
  - plateau:src/backlog-view/
dateOpened: "2026-07-23"
tags: []
---

# Conveyor: feed prepared decisions into the #2565 console ruling surface (autonomous present, cross-locus)

Follow-up to #2647. #2647 wired the WE-side conveyor to PREPARE cleared decisions and PRESENT their forks as a chat artefact, and surfaced state.decisions (prepared/unprepared). The remaining half is the PRODUCT/UI conveyor's present channel: an autonomous feed that pushes a prepared decision's forks into the already-built #2565 console decision-ratify (ruling) surface via the existing read/write ports #2580/#2581/#2582. That work lives in the impl repo (frontierui/plateau-app), NOT WE — it is CROSS-LOCUS and out of #2647's WE scope (we:scripts/readiness/, we:skills-src/conveyor/), so it was split out rather than half-done. Scope: the console feed + port wiring; the WE side (state.decisions, the needs-decision hold, the prepare-decision agent brief, the chat-artefact present instruction) already ships in #2647.

## Scope note (backfilled per #2620)

`scope:` is a **directory floor** (`plateau:src/backlog-view/`), not a file-level list, on purpose: this is a
cross-locus item whose impl is a **new** autonomous present-feed module wired into the existing `#2580` ruling
surface (`plateau:src/backlog-view/ruling-surface.ts`) and the `#2581`/`#2582` write ports
(`plateau:src/backlog-view/write.ts` / `plateau:src/backlog-view/write-action.ts`). The exact new file(s) are
**build-time-determined** — the delivery agent creates them as it wires the feed — so a file-level list would
risk under-scoping (a build-time breach) by omitting a not-yet-created file. The floor covers every file the
feed can touch. The `active→resolved` flip lands on the WE half of the couple (impl-first / WE-last).
