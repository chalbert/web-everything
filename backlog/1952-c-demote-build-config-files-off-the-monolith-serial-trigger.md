---
kind: story
size: 2
parent: "1949"
status: open
blockedBy: ["1950"]
dateOpened: "2026-06-28"
tags: []
---

# C: demote build-config files off the monolith serial trigger

The probe's confident:false trigger and RESERVED_MERGE_RISK treat build-config files (we:tsconfig.json, we:vite.config.mts, plus fui:package.json and fui:vitest.config.ts) as serial-forcing monoliths. But these merge cleanly in practice — concurrent edits land on distinct lines (a scripts entry, an include, a vitest glob), exactly the optimistic-floor's wheelhouse. Move build config out of the whole-item serial trigger into the per-file-lock / optimistic-merge bucket (with slice A's machinery): a lane touching a build-config file briefly locks that one file rather than serializing the item. Verify with a fixture that two items editing different lines of the same config file merge clean under rebase-retry. Small follow-on to A.
