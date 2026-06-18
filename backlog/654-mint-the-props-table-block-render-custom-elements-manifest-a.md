---
type: idea
workItem: story
size: 3
parent: "623"
status: resolved
blockedBy: ["653"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: "block:props-table"
tags: []
---

# Mint the props-table block — render Custom Elements Manifest API tables

## Progress (2026-06-15, resolved)

- **blocks.json** — `props-table` (Component, concept, relatedProject webdocs), `composesIntents: collection-operations` (sortable), `implementedBy @frontierui/blocks/props-table/...`. Consumes the CEM (#653) as input, not a bespoke shape; member kinds with no data are omitted.
- **block-descriptions/props-table.njk** — contract: `tag` resolved against the page CEM (or inline `manifest`), projects members/attributes/events/slots/cssProperties into a sortable table.
- regen we:AGENTS.md inventory + we:custom-elements.json (68 blocks).

Capstone of the webdocs CEM cluster — props-table joins story-canvas (#655) + code-view (#656) feeding the catalog surface (#627), all fed by the CEM protocol (#653). check:standards + build:check green; block page renders.

Ratified by #626 Fork 1 (sub-decision): the component API-table renderer is a props-table block that renders Custom Elements Manifest output — attributes, properties, events, slots, CSS custom-properties/parts — as a sortable reference table. Blocked on #653 (the CEM protocol + emit pipeline must exist to feed it). Powers the autodocs capability in the Web Docs catalog surface (#627). Not a new control standard; the args/controls panel is the Technical Configurator fed by the same CEM.

**Graduated to** `block:props-table` — also ships we:block-descriptions/props-table.njk.
