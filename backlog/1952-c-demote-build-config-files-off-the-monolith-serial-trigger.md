---
kind: story
size: 2
parent: "1949"
status: resolved
blockedBy: ["1950"]
dateOpened: "2026-06-28"
dateStarted: "2026-06-29"
dateResolved: "2026-06-29"
tags: []
---

# C: demote build-config files off the monolith serial trigger

The probe's confident:false trigger and RESERVED_MERGE_RISK treat build-config files (we:tsconfig.json, we:vite.config.mts, plus fui:package.json and fui:vitest.config.ts) as serial-forcing monoliths. But these merge cleanly in practice — concurrent edits land on distinct lines (a scripts entry, an include, a vitest glob), exactly the optimistic-floor's wheelhouse. Move build config out of the whole-item serial trigger into the per-file-lock / optimistic-merge bucket (with slice A's machinery): a lane touching a build-config file briefly locks that one file rather than serializing the item. Verify with a fixture that two items editing different lines of the same config file merge clean under rebase-retry. Small follow-on to A.

## Progress

- 2026-06-29: Done. Removed `we:tsconfig.json` + `we:vite.config.mts` from `RESERVED_MERGE_RISK` in both the canonical module (`we:scripts/readiness/lane-partition.mjs`) and the workflow mirror (`we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js`), with a comment explaining why build config is line-structured (distinct-line edits merge clean; a real same-line clash is a git conflict the rebase-retry/serial-replay floor catches) and so belongs in the optimistic-merge bucket, not the clean-but-wrong blacklist. Stripped "build config" from the probe's `confident:false` trigger + the touchesMonolith guidance (schema + prompt) so a build-config edit no longer lowers confidence. Tests (`we:scripts/readiness/__tests__/lane-partition.test.mjs`, now 21 cases): build config is no longer merge-risk, and two confident items sharing the same WE tsconfig partition concurrent. Net with A: two items both touching build config now run as concurrent lanes instead of serial. `check:standards` green; workflow ESM syntax verified.
