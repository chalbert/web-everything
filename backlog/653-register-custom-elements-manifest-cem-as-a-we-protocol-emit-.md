---
type: idea
workItem: story
size: 5
parent: "623"
status: open
blockedBy: ["626"]
dateOpened: "2026-06-15"
tags: []
---

# Register Custom Elements Manifest (CEM) as a WE protocol + emit pipeline from blocks

Ratified by #626 Fork 1: adopt Custom Elements Manifest (custom-elements.json, schema 2.1.0) as a new WE protocol. Add the custom-elements-manifest entry to protocols.json (precedent: changelog-manifest, protocols.json:94) and stand up the emit pipeline that produces a CEM file from WE blocks' attributes/properties/events/slots/CSS-API. This is the machine-readable contract that feeds the props-table block, the Technical Configurator args panel, and autodocs — one seam, many consumers. Reuses the de-facto multi-vendor spec consumed by api-viewer/Storybook/VS Code custom-data/JetBrains web-types.
