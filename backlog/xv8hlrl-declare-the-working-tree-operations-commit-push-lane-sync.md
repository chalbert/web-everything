---
kind: story
size: 5
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# Declare the working-tree operations: commit, push, lane-sync

Operations cover the arc that faces the juror and stop at the working tree. A 1786-call session audit on 2026-08-21 found 10.2 percent of shell went through we:scripts/operations/run.mjs, with the undeclared half concentrated in git: 124 add + 95 commit, 133 push, 155 checkout + 154 fetch. Three of that session four real defects originated there — a branch pointer left stale so a PR opened without its main commit, an unrelated regenerated artifact drifting into a staged diff, and five commits pushed to a branch whose PR had already merged. Each is what a declared move would refuse.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
