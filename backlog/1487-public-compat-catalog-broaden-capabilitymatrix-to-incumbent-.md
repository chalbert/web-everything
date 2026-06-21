---
kind: story
size: 5
parent: "1451"
status: open
dateOpened: "2026-06-21"
tags: []
---

# Public /compat/ catalog — broaden capabilityMatrix to incumbent libs as peer columns

Build the ratified #1450 outcome: broaden we:src/_data/capabilityMatrix.json from native substrates (face, base-select) to incumbent libraries (Floating UI, Mousetrap, TanStack, FUI, focus-trap, …) as rows, and render the public /compat/ catalog (peer column per impl, no privileged/reference column) per we:docs/agent/platform-decisions.md rule #7. Reuses the existing column-per-impl grid at we:src/capabilities.njk:21-39. Build-time schema task: library rows need a supported/partial/unsupported tier vocabulary alongside the native-first substrate tiers (native-ok/polyfill-ok/capability-hard), which are platform-relative and don't apply to a JS lib. New public surface ⇒ page + nav + authoring note + validator (Catalogs Auto-Render From JSON). The red/missing-cell count is #1451's front-A metric.
