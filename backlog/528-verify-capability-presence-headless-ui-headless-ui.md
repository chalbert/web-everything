---
type: issue
workItem: task
parent: "495"
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
tags: []
---

# Verify capability presence — Headless UI (headless-ui)

Per-source slice of #495: walk the Headless UI docs (https://headlessui.com/) and confirm presence for each of the 96 benchmark capabilities, then splice rows into we:benchmarkCapabilityPresence.json for sourceId headless-ui — upgrade the notable-inference seed rows in place to provenance verified with the deep doc URL and the vendor sourceName, and insert newly-found present capabilities. Never rewrite the whole file; splice only this source's rows so re-runs diff cleanly. Method and validator were settled by foundation #352. Independent of every other source slice.

## Progress (2026-06-13) — resolved

Walked the Headless UI docs (headlessui.com — Tailwind Labs' small headless set) and spliced **24 verified rows** into `we:benchmarkCapabilityPresence.json` for `headless-ui` (no prior seed rows; all new, deep doc URLs). As expected for a small headless library, most of the 96 are absent; verified rows cover its ~14 components plus documented cross-cutting behaviors (anchor positioning, focus-trap, type-ahead, virtualization, controlled/uncontrolled). Dropped a Transition→motion-tokens mismap (Transition is a component, not a token scale). `check:standards` green.
