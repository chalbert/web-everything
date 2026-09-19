---
bornAs: x4vs5xl
kind: story
size: 2
status: open
scope: ["we:.claude/hooks/guard-git-branch.mjs"]
dateOpened: "2026-09-12"
tags: []
deliveryAgent: codex
---

# gh pr checkout bypasses the branch-switch guard on the shared primary checkout

we:.claude/hooks/guard-git-branch.mjs denies a bare git checkout/git switch by branch name on the shared primary checkout (single-branch-workflow safety, moving shared HEAD would derail concurrent sessions) but its gitCall() parser in that same file only recognizes a command token matching /(^|/)git$/ — it never inspects a gh invocation. gh pr checkout <n> moves HEAD onto a PR's branch exactly like git checkout <branch> does, but is invisible to the guard and sails through unblocked. Found live 2026-09-12: an investigation task ran gh pr checkout 2149 on the shared primary checkout, landing it on lane/x37kvib-run-quality-benchmark; the agent caught it and restored main cleanly, but nothing prevented the unsafe move. Fix: extend the guard (or add a sibling arm) to recognize gh pr checkout <n>/gh pr checkout <branch> as an equivalent branch-switch op on this checkout and deny it the same way, naming the same shared-checkout rationale and recovery path. Related: #2902 (same file, a false-positive in the opposite direction — the guard over-blocking inside a throwaway clone); this item is the under-blocking counterpart — a real branch-switch op it misses entirely.

## Done when

1. **Executable** — piping a PreToolUse(Bash) JSON payload (`{"tool_input":{"command":"gh pr checkout <n>"}}`)
   through `node we:.claude/hooks/guard-git-branch.mjs` (home-relative `~/.claude/…`) on stdin currently
   prints nothing (allowed); after the fix it prints a `permissionDecision: deny` JSON naming the
   shared-checkout rationale, same as a bare `git checkout <branch>` payload does today. `gh pr checkout <n>
   --branch <name>` and `gh pr checkout <branch-name>` (no PR number) must also deny. Non-branch-moving `gh
   pr` subcommands (`gh pr view`, `gh pr checks`, `gh pr comment`, `gh pr diff`) must still pass through
   unblocked — this is a branch-switch guard, not a blanket `gh pr` denial. No repo-side test file covers
   this hook (it lives under `we:.claude/hooks/` on the home dir, outside this repo — the #2902 precedent
   notes the same), so these payload probes are the only oracle; add a fixture/test alongside the fix if a
   suitable one exists for this hook by the time it's picked up.
