---
type: idea
workItem: story
size: 5
parent: "623"
status: resolved
blockedBy: ["626"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: "protocol:custom-elements-manifest"
tags: []
---

# Register Custom Elements Manifest (CEM) as a WE protocol + emit pipeline from blocks

## Progress (2026-06-15, resolved)

- **protocols.json** — added the `custom-elements-manifest` protocol (`ownedByProject: webdocs`, `anchor: protocol-custom-elements-manifest`, `status: draft`), with the contract body section in `src/_includes/project-webdocs.njk` (the gate probes the anchor). Renders in `/protocols/` and on the webdocs project page (build smoke confirmed).
- **Emit pipeline** — `scripts/gen-cem.mjs` + `npm run gen:cem` projects `blocks.json` block-protocol fields (events/exports, with implementsIntent/traits/webStandards under a namespaced `x-webeverything` extension) into a CEM 2.1.0 `custom-elements.json` at the repo root (canonical location; discoverable via the new `package.json "customElements"` field). Deterministic (sorted by id, no timestamp) → no-op re-run diff. Generated for all 64 blocks (4 with events; 0 custom-element decls — see below).
- **Honest projection** — a block becomes a CEM `custom-element` declaration only with an explicit `tagName`; none carry one today (`registryName` is a DI registry class, NOT a tag), so all 64 emit as plain `class` declarations. No tags are fabricated. As blocks gain structured attribute/slot/CSS-API/tagName fields, the same pipeline emits a richer manifest — forward-compatible, status flip from draft.

Gate: `check:standards` green (31 protocols), `build:check` green. Downstream consumers (props-table block, Technical Configurator args panel, autodocs) are #627.

Ratified by #626 Fork 1: adopt Custom Elements Manifest (custom-elements.json, schema 2.1.0) as a new WE protocol. Add the custom-elements-manifest entry to protocols.json (precedent: changelog-manifest, protocols.json:94) and stand up the emit pipeline that produces a CEM file from WE blocks' attributes/properties/events/slots/CSS-API. This is the machine-readable contract that feeds the props-table block, the Technical Configurator args panel, and autodocs — one seam, many consumers. Reuses the de-facto multi-vendor spec consumed by api-viewer/Storybook/VS Code custom-data/JetBrains web-types.

**Graduated to** `protocol:custom-elements-manifest` — emit pipeline: scripts/gen-cem.mjs + custom-elements.json.
