---
name: shared-file-staging-sweeps-concurrent-hunks
description: "git add on a shared hot file stages foreign hunks — a concurrent session's commit can carry your edits (or yours theirs); diff for unauthored hunks before staging, verify post-commit which sha holds yours"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 47bf4327-fd7c-4f79-ae4a-f07d766d8bf7
---

`git add <file>` stages the **whole file**, including hunks a concurrent session wrote. With
multiple sessions committing to shared statute files (`docs/agent/block-standard.md`,
`we:platform-decisions.md`), whichever session commits first sweeps the other's unstaged hunks
into its commit. Observed 2026-07-02: #1960's block-standard rider hunks landed inside the
concurrent `ratify(#1989)` commit (6ca9d644), not the session's own `efbfb815` — content correct,
attribution off.

**Why:** tight *pathspec* staging (never `git add -A`) does not protect *within* a file; hunk-level
interactive staging isn't available in this environment. The failure is silent — the commit
succeeds and the tree is right, so only a post-commit check catches it.

**How to apply:** before staging a shared hot file, `git diff <file>` and check for hunks you
didn't author — if present, either commit anyway and say so, or wait/coordinate. After committing,
verify your hunks are in **your** sha (`git show HEAD --stat`, grep the content); if they rode a
foreign commit, report the attribution quirk — never rewrite shared-main history to fix it. Related:
[[closeout-never-infers-ownership-from-dirty-tree]], commit-tightly ([[104]] commit-on-current-branch).
