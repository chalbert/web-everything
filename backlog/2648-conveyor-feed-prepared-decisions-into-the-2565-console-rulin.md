---
bornAs: xtzhhcu
kind: story
size: 5
parent: "2612"
status: open
blockedBy: ["2647"]
dateOpened: "2026-07-23"
tags: []
---

# Conveyor: feed prepared decisions into the #2565 console ruling surface (autonomous present, cross-locus)

Follow-up to #2647. #2647 wired the WE-side conveyor to PREPARE cleared decisions and PRESENT their forks as a chat artefact, and surfaced state.decisions (prepared/unprepared). The remaining half is the PRODUCT/UI conveyor's present channel: an autonomous feed that pushes a prepared decision's forks into the already-built #2565 console decision-ratify (ruling) surface via the existing read/write ports #2580/#2581/#2582. That work lives in the impl repo (frontierui/plateau-app), NOT WE — it is CROSS-LOCUS and out of #2647's WE scope (we:scripts/readiness/, we:skills-src/conveyor/), so it was split out rather than half-done. Scope: the console feed + port wiring; the WE side (state.decisions, the needs-decision hold, the prepare-decision agent brief, the chat-artefact present instruction) already ships in #2647.
