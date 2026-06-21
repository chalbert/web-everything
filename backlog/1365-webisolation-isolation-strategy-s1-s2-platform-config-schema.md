---
kind: story
size: 2
status: resolved
blockedBy: ["1364"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:src/_data/isolationStrategies/s1-unique-class.json"
tags: []
---

# webisolation: isolation-strategy (S1/S2) platform-config schema

Ship the platform-config schema for the isolation-strategy dimension (S1 unique-class light DOM vs S2 shadow-per-component) alongside the webisolation standard. A per-deployment behavioral value with flavor default S1 (native-first floor; S2 is the author's opt-in for external-CSS immunity). The schema ships with the standard; the plateau-app Configurator UI card that consumes it is #1366. Ratified soft/revisitable in #1349.

## Progress (batch-2026-06-21-1429-1487)

Shipped the schema using the established **`renderStrategies/` precedent** — the existing per-deployment
configurable-dimension outlier (a `src/_data/<dim>/` dir where the dir *is* the dimension and each file is
a value `{id, name, default, summary}`, exactly one `default: true`). New
`we:src/_data/isolationStrategies/`:
- **`we:src/_data/isolationStrategies/s1-unique-class.json`** — `default: true`. Native-first floor:
  machine-generated unique scope class in light DOM, native a11y + form participation intact,
  SSR-trivial, L2 zero-runtime; not immune to hostile external CSS.
- **`we:src/_data/isolationStrategies/s2-shadow-per-component.json`** — `default: false`. Author opt-in:
  shadow-per-component for external-CSS immunity, re-forwarding form participation via `ElementInternals`,
  at the cost of free native light-DOM a11y. Per-deployment, soft/revisitable.

Auto-globbed by Eleventy → available as the `isolationStrategies` collection; the plateau-app Configurator
card (#1366) consumes this dir. No WE-side index/njk needed (the Configurator UI is its own card, #1366).
Gate green (0 errors).
