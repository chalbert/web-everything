---
kind: story
size: 5
parent: "1442"
status: open
blockedBy: ["1457"]
dateOpened: "2026-06-21"
tags: []
---

# Convert tabs to we-tabs element (persistent light-DOM B) over retained TabGroupBehavior + CEM

Per #1457 (element-over-behavior, can-do/is-a): give tabs its styled is-a form. Add a persistent light-DOM we-tabs element (B-family) hosting the existing fui:blocks/tabs/TabGroupBehavior.ts CustomAttribute kernel, carrying FUI styling and a CEM surface (the #463/#855 framework-flavor generation target). Retain the tab-group behavior as the headless can-do capability (attach to author markup). Triggers/panels stay light-DOM ([tab-trigger]/[tab-panel]), never shadowed; in-leak isolation via #1349 webisolation. Codified in we:docs/agent/block-standard.md §7.
