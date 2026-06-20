---
kind: task
parent: "495"
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
tags: []
---

# Verify capability presence — React Aria (react-aria)

Per-source slice of #495: walk the React Aria docs (https://react-spectrum.adobe.com/react-aria/) and confirm presence for each of the 96 benchmark capabilities, then splice rows into we:benchmarkCapabilityPresence.json for sourceId react-aria — upgrade the notable-inference seed rows in place to provenance verified with the deep doc URL and the vendor sourceName, and insert newly-found present capabilities. Never rewrite the whole file; splice only this source's rows so re-runs diff cleanly. Method and validator were settled by foundation #352. Independent of every other source slice.

## Progress (2026-06-13) — resolved

Walked the React Aria docs (react-aria.adobe.com — the relocated domain; the old react-spectrum.adobe.com/react-aria redirects there) and spliced **51 verified rows** into `we:benchmarkCapabilityPresence.json` for `react-aria` (15 seed rows upgraded in place + 36 new, deep doc URLs). Headless library — verified rows include FocusScope (focus-trap/return), Virtualizer, Drag and Drop, and the Quality-page a11y commitments (APG, contrast, hit-target, focus rings). Conservatively omitted per-component-only patterns with no standalone page. `check:standards` green.
