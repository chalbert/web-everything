---
name: shared-index-commit-race
description: "On the shared primary checkout, a concurrent session's `git commit` sweeps YOUR staged files into ITS commit — staging is a shared-index race, not just `git add`."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2667a5f0-dbbb-4a7a-aca1-e74732a8e5f4
---

On the shared primary checkout (webeverything, before the #2123 phase-1 lane trigger lands
for interactive sessions), the git **index is shared across all sessions**. So even a
correctly path-scoped `git add <my two files>` is unsafe: between your `add` and your
`commit`, a *concurrent* session's `git commit` will bundle **your** staged hunks into
**its** commit. Observed 2026-07-02 resolving #2138 — a peer `#2127` session committed and
swept my `2138` + `platform-decisions.md` changes into `697a3bfa resolve(#2127)`.

**Why:** ownership scoping (closeout-never-infers-ownership) protects the *working tree*, but
the *index* is a single shared file with no per-session partition. This is the commit-side
twin of the `git add`-side hazard already known in the repo rule
`.claude/agent-memory/shared-file-staging-sweeps-concurrent-hunks.md`.

**How to apply:** (1) Stage and commit in the *same_* uninterrupted step — never leave files
staged across tool calls while other sessions are live. (2) After a surprise (empty index,
foreign files in `git diff --cached`, HEAD moved), check `git log --oneline -1` first — if
HEAD advanced to another session's commit, your work likely rode along; verify with
`git show HEAD:<file> | grep <marker>` before assuming loss. (3) Content-correct-but-
mislabeled is the safe resting state — do NOT `reset`/`rebase` a peer session's commit to
re-attribute; that is the destructive cross-session action the invariants forbid. (4) This is
the exact race [[single-session-should-use-a-lane]] / #2138's deferred-merge-queue kill —
landing the interactive-session lane removes it structurally.
