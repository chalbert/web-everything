---
bornAs: x8yzxdc
kind: task
status: open
dateOpened: "2026-08-19"
tags: []
---

# check:standards does not flag --all in a git hook, where it means the machine-global tree

`we:.githooks/post-merge` shipped a commands sync carrying --all. On that CLI --all does not mean "deploy every command" — it means "create the machine-global tree", on a machine that never opted in. A hook runs on every merge, on every clone, with nobody reading its output, so the wrong flag there is applied silently and repeatedly. It was caught by a reviewer, not by a check. Add a standards rule that flags --all appearing in any file under `we:.githooks/` and names what it actually does, so the next one is caught before it lands.

## Done when

1. **Executable** — a rule in `we:scripts/check-standards-rules.mjs` that reports an error for `--all` in any
   file under `we:.githooks/`. Re-adding the flag to `we:.githooks/post-merge` makes `npm run check:standards`
   exit non-zero; removing it passes.
2. The message says what the flag DOES ("creates the machine-global tree on a machine that never opted in"),
   not merely that it is disallowed — a rule a reader can only obey is a rule they will suppress.
3. A hook that legitimately needs the flag can say so inline, so the rule is a prompt and not a wall.
