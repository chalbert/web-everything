---
kind: story
size: 8
parent: "2612"
status: open
scope: ["we:scripts/readiness/", "we:skills-src/conveyor/"]
dateOpened: "2026-07-23"
tags: []
---

# Conveyor: prepare open decisions and present the forks — artefact (chat) + #2565 ruling surface (UI)

The conveyor today only drives story delivery. Decisions are ignored entirely. This item extends the conveyor to also prepare open decisions and present their forks, so the conveyor drives the whole backlog lifecycle — deliver + slice + decide.

## Problem

Decisions are excluded from buildable work. In [we:scripts/readiness/engine.mjs](scripts/readiness/engine.mjs), `isBuildable = kind !== 'decision'`, so the conveyor never touches a `kind:decision` item. An open decision that is ready to be prepared and ratified just sits there — the autonomous loop can deliver and (with sibling item x254bqo) slice, but it can never move a decision forward.

## Proposed behavior

Extend the conveyor to drive decisions in two steps:

1. **Prepare** an open decision — research plus author its forks to "ready to ratify", mirroring the [we:skills-src/prepare-decision-item/](skills-src/prepare-decision-item/) `/prepare` skill.
2. **Present** the forks in two surfaces:
   - a published **artefact** in the chat / main-session conveyor (the conversational surface); and
   - the already-built **#2565 console decision-ratify (ruling) surface** for the product/UI conveyor. The ruling read/write ports (#2580 / #2581 / #2582) already exist; this item wires the autonomous feed into them.

Goal: the conveyor drives deliver + slice + decide, not just story delivery.
