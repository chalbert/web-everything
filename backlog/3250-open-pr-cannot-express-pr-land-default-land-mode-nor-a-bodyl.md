---
bornAs: x6ry8mf
kind: story
size: 3
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# open-pr cannot express pr-land default land mode, nor a bodyless dry run

Two remaining mismatches keep three of the six skill call sites on the raw home. (1) `we:scripts/pr-land.mjs` DEFAULT path opens, waits, labels AND MERGES; `open-pr` offers only park / label-on-green / no-wait, so it cannot express the home most consequential mode — rewiring `we:skills-src/pr/SKILL.md` line 99 to any existing mode would silently stop the merge. (2) `open-pr` requires `bodyFile` unconditionally, but the home #2332 producer guard exempts `--dry-run`, so a rehearsal before the body is written (that same skill line 89) is expressible on the home and refused by the operation. Add a `land` mode and relax `bodyFile` for `dryRun`, then the last three sites can name the operation.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
