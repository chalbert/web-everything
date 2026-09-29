---
kind: story
size: 2
status: open
scope: ["we:scripts/operations/__tests__/"]
dateOpened: "2026-09-28"
tags: []
---

# Fix flaky fake-claude-sessions test: ETXTBSY spawning the fake claude binary

CI run 36495657201 (PR #2875, 2026-09-28) failed in we:scripts/operations/__tests__/fake-claude-sessions.test.mjs ('scripted actions — writeCompletion / exit / setState, through the real completion-store') with 'spawnSync claude ETXTBSY': the test writes the fake claude executable and spawns it while a write handle is still open (a Linux race). A cards-only PR went red on it. MVP: close/fsync the file before chmod+spawn (or write to a temp name and rename), and retry once on ETXTBSY in the test helper. Must: the test passes 50 runs in a loop on Linux CI.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
