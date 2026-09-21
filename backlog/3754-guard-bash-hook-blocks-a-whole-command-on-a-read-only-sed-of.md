---
bornAs: xknliwo
kind: story
size: 2
parent: "3383"
status: open
scope: ["we:scripts/guard-bash.mjs", "we:scripts/golden-corpus/hook-guard-bash/append-backlog-shell.json"]
dateOpened: "2026-09-20"
tags: []
---

# guard-bash hook blocks a whole command on a read-only sed of a backlog card

FOUND 2026-09-20. A read-only sed -n line range read of a backlog card, chained with git add and commit, was refused as an in-place edit or append of a backlog file, and because a refusal blocks the whole command nothing in the chain ran (the collateral message named the git steps as discarded). The rule targets append and in-place edits (redirect append, tee -a, sed -i, perl -pi). FIX: match the in-place flag, not the command name; add a golden case for the read-only sed that must pass and keep the sed -i case that must block. ACCEPTANCE: both golden cases pass.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
