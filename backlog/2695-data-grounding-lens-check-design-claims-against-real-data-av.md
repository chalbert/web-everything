---
bornAs: xly5h33
kind: story
size: 5
parent: "2676"
status: open
dateOpened: "2026-07-27"
tags: []
---

# Data-grounding lens: check design claims against real data availability

A lens that verifies a design's claims against the data we actually store — e.g. velocity needs dateStarted/dateResolved, a design-increment filmstrip needs captured snapshots. Flag or refuse designs that silently assume uncaptured data, and emit the missing-capture work as follow-up items.

This session the red-team's data-model-truth lens found the design assumed a feature tier and snapshot store that do not exist; those became filed capture items. The tool should do this automatically and emit the follow-ups.

Captured from the **feature-tracking-screen** design session — a capability the design-studio tool (#2676) should productize, drawn from methodology we ran by hand. Decision-view artifact: https://claude.ai/code/artifact/ba98baf4-3430-47bd-b90b-386be86d529d
