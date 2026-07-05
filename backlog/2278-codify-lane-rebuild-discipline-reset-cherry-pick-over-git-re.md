---
kind: task
status: resolved
dateOpened: "2026-07-05"
dateStarted: "2026-07-05"
dateResolved: "2026-07-05"
graduatedTo: none
tags: []
---

# Codify lane-rebuild discipline — reset+cherry-pick over git rebase, verify non-empty diff before force-push

A manual git rebase origin/main in a lane whose local branch is named main reset HEAD to origin/main and silently dropped the amend commit; the follow-up force-with-lease push then blanked the open PR (GitHub auto-closed it) — observed 2026-07-04 while rebuilding a behind PR. Codify the discipline into we:docs/agent/backlog-workflow.md's per-item lane arc: (1) rebuild a lane onto an advanced main with git reset --hard origin/main + git cherry-pick <commit>, NEVER git rebase (deterministic, immune to the branch-named-main footgun), and prefer letting the drain rebase-drop rebuild a behind PR; (2) before any force-push of a lane ref, verify the pushed head carries your work — a non-empty diff vs origin/main / your SHA in the log — since an empty-diff force-push blanks the PR; (3) note that force-with-lease guards a concurrent remote change to the ref, NOT pushing the wrong local state. Doc-only codification of a just-learned rule.
