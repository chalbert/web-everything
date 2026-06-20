---
kind: epic
parent: "970"
status: resolved
blockedBy: ["971"]
dateOpened: "2026-06-18"
dateResolved: "2026-06-19"
graduatedTo: none
tags: []
---

# Author and host FUI demos for the block families that have none

Umbrella for authoring the missing FUI demos: of 37 registered blocks, 11 carry a `demoFile` (wired by #971) and **26 do not**, so they can't surface a live example under #971's slot. Author + host a #813-pattern runtime demo per demo-less block in fui:demos/ and set its `demoFile` on the `fui:src/_data/blocks.json` entry. Sliced by subsystem `category` into the 9 children below — each independent (all depend only on the resolved #971 slot) and leaving finished blocks live while the rest stay validly demo-less. The bulk of #970; the completeness gate is #973.

## Slices (by subsystem cluster — see we:reports/2026-06-18-backlog-split-analysis.md)

| # | Cluster | Blocks |
|---|---|---|
| #980 | webdocs | code-view, story-canvas, props-table |
| #981 | workflow + stepping | wizard, workflow-engine, stepper |
| #982 | webstates | draft-persistence, simple-store, audit-trail, lifecycle |
| #983 | webexpressions parsers | handler-expression-parser, double-curly-bracket-parser, double-square-bracket-parser |
| #984 | webcomponents chrome | transient-component, app-shell, button |
| #985 | droplist / selection family | selection, tree-select, type-ahead |
| #986 | disclosure nav | sectioned-nav, disclosure-nav |
| #987 | view & events | view, event-behaviors |
| #988 | behavior coordinators | master-detail, resource-loader, data-transfer |
