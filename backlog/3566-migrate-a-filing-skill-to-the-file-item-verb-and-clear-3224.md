---
bornAs: xn91nge
kind: story
size: 3
parent: "3383"
status: open
dateOpened: "2026-09-07"
tags: []
---

# Migrate a filing skill to the file-item verb and clear #3224's skill-wiring scan

we:scripts/operations/file-item.mjs graduated to main in #3548/#1991, but Done-when item 2 of that (now-resolved-by-scope-match) card was never done: no skill among we:skills-src/next-backlog-item, prepare-decision-item, new-standard, split-backlog-item, batch-backlog-items, consolidate-backlog-items yet names we:scripts/operations/run.mjs's file-item verb instead of a raw we:scripts/backlog.mjs scaffold call, and we:scripts/check-standards.mjs's #3224 skill-wiring scan has not been confirmed clean for it. #3548 auto-resolved on landing the code because its scope only listed the 5 code files, not this skill-migration follow-up — filed separately so it is not silently dropped.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
