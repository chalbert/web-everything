---
type: issue
workItem: story
size: 5
parent: "364"
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: "project:webtheme"
tags: []
---

# Establish the webtheme project + DTCG to native-CSS mapping

Forks 1-2 of the #364 ruling: stand up webtheme as a new Web Project (peer of webintents) and define the DTCG 2025.10 to native-CSS-runtime mapping. Register the project in we:projects.json; define the token data model (DTCG $type/$value/aliasing) and the compile step to CSS custom properties + @property. This is the foundation the token tiers and theming runtime build on. Adopts the external DTCG standard (no WE-native schema); native CSS as the runtime tier.

## Progress

**Resolved 2026-06-12** (batch). Established the `webtheme` Web Project (Forks 1–2):
- `we:src/_data/projects.json` — registered `webtheme` (category `standard`, status `concept`), describing the concrete-value layer, 3-tier taxonomy with the semantic tier owned by the intents, DTCG-adopted-not-coined, native-CSS runtime, complete default set + `extends` override.
- `we:src/_data/protocols.json` — registered the **Design Tokens (DTCG ↔ CSS)** protocol (`design-tokens`, `ownedByProject: webtheme`, anchor `protocol-design-tokens`): DTCG 2025.10 authoring/interchange + native CSS compile (custom properties, `@property`, `light-dark()`, relative-color/`color-mix()`, WCAG/APCA contrast gate).
- `we:src/_includes/project-webtheme.njk` — project page body: Mission, Feature Surface (3-tier + format/runtime + theming-axis tables), the Design Tokens protocol section with DTCG + compiled-CSS examples, Composition, Status + open questions.
- `src/assets/icons/webtheme.svg` — house-style token-palette icon.

Forks 3 (primitive/component tiers + default set) and 4 (scheme/accent runtime) remain as the graduated follow-ups #404 and #405. Gate: `check:standards` 0 errors, `scripts/__tests__` 93 pass.
