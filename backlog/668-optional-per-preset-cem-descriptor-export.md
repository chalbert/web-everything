---
type: issue
workItem: task
parent: "646"
status: resolved
blockedBy: ["667", "653"]
relatedProject: webdocs
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: src/_data/assemblerPresets.json (optional per-preset cem export) + src/presets.njk (API-descriptor panel) + validatePreset cem validation
tags: [devtools, composition, assembler, cem, descriptor, emit-format]
---

# Optional per-preset CEM descriptor export

Optional polish on the #646 assembler preset registry (after #667): emit a CEM (custom-elements-manifest) descriptor of each preset's composed-API surface — attributes/props/events/slots — as a coexisting export alongside the plain-markup recipe (#652 Fork 1's three layers: payload vs API descriptor vs distribution wrapper). Rides the CEM protocol from #653; never re-mints it. Extends we:src/_data/assemblerPresets.json with an optional cem export and renders it beside the recipe on /presets/. Blocked on #667 (registry + surface must exist) and #653 (CEM must be a registered WE protocol). Describes API surface, never internal wiring — it complements, never replaces, the recipe.
