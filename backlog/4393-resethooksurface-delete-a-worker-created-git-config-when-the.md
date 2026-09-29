---
bornAs: xst3fyp
kind: story
size: 1
status: open
scope: ["we:scripts/lib/git-hook-surface.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# resetHookSurface: delete a worker-created .git/config when the baseline had none

Advisory follow-up from PR #2867 (WE #4291): we:scripts/lib/git-hook-surface.mjs resetHookSurface restores .git/config only when the baseline had one; a .git/config the worker created from nothing survives the reset. MVP: delete it when the baseline recorded none. Must: regression test.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
