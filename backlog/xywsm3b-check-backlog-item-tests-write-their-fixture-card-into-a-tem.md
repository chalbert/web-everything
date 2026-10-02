---
kind: story
size: 2
status: open
scope: ["we:scripts/check-backlog-item.mjs", "we:scripts/__tests__/check-backlog-item.test.mjs"]
dateOpened: "2026-10-01"
tags: []
---

# check-backlog-item tests write their fixture card into a temp backlog, never the real one

Live case 2026-10-01 (PR #3311 split lane): we:scripts/__tests__/check-backlog-item.test.mjs writes its fixture card (id x0zzzz9) into the REAL repo backlog and deletes it in afterEach. When a run is cut off (the verify gate kill, or a sandboxed worker run) the file stays, and it was then staged as a new card in a PR lane, where it would have landed as a fake backlog item. Fix: point we:scripts/check-backlog-item.mjs at a temp backlog directory in the test (a root or backlog-dir option, defaulting to the repo), so the test never touches the real tree. Add a guard test: after the file runs, git status of the backlog directory is unchanged.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
