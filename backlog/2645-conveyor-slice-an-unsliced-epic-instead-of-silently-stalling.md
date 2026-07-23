---
bornAs: x254bqo
kind: story
size: 5
parent: "2612"
status: open
scope: ["we:scripts/readiness/", "we:skills-src/conveyor/"]
dateOpened: "2026-07-23"
tags: []
---

# Conveyor: slice an unsliced epic instead of silently stalling it

Today a cleared **epic** is not buildable, so a cleared epic just sits `cleared-but-not-ready`: the conveyor silently never dispatches it AND never slices it. This item makes the conveyor slice an unsliced epic instead of stalling it.

## Problem

Readiness classifies `kind:epic` as a `/slice` candidate, not as agent-ready. In [we:scripts/readiness/engine.mjs](scripts/readiness/engine.mjs) epics are excluded from the agent-ready set — agent-ready is `task | story≤8`. So when an epic clears its blockers it can never be dispatched, and nothing routes it to slicing either. It falls into a silent hole: not built, not sliced, no signal.

## Proposed behavior

Add explicit epic handling at dispatch:

- Detect a cleared epic when the dispatcher considers it, and hold it in a `needs-slice` state (a first-class dispatch outcome, not a silent skip).
- Either surface it for a human `/slice`, or auto-run the split-backlog-item / slice flow to produce buildable child stories, then dispatch those children.
- Never silently stall an epic — a cleared epic must always end up either sliced-and-dispatched or explicitly surfaced as awaiting slice.

The rule: a cleared epic is a slice trigger, not a dead end.
