---
name: avoid-writing-under-git-for-scratch-files
description: .git/ is a Claude Code hardcoded protected path, never auto-approved by an allow rule; write scratch files inside the repo's working directory instead (not .git/, not os.tmpdir())
metadata:
  type: feedback
---

Never write scratch files (PR-body text, temp content, etc.) under a repo's `.git/` directory —
with any tool, not just Bash. Write them to a plain path inside the repo's working directory
instead — not `.git/`, not `.claude/`, and not `os.tmpdir()` (see below for why not tmpdir).

**Why `.git/` specifically:** `.git` is one of Claude Code's hardcoded "protected paths"
(https://code.claude.com/docs/en/permission-modes#protected-paths) — writes there are never
auto-approved by any `permissions.allow` rule, in any mode except `bypassPermissions` (and a
plan-mode session with bypass permissions available): "the safety check runs before Claude Code
evaluates allow rules from settings." This applies to the `Write` and `Edit` tools, not just Bash —
the mechanism is the target path, not the tool or command shape.

**Prefer the `Write` tool over a Bash heredoc/redirect for scratch files in general**, not only
because of the protected-path check. The two are not interchangeable across permission modes:
`acceptEdits` auto-approves file edits in the working directory directly, but still prompts most
non-read-only Bash commands regardless of target path; `auto` mode (the built-in default on
Pro/Max/Team plans) auto-approves working-directory file edits directly too, but routes Bash
commands through a classifier instead — the classifier's default-allowed list does cover local
working-directory file operations, so a Bash write there is *often* silent in `auto` mode, but it
is going through an extra evaluation step a `Write` call skips entirely. Prefer `Write` structurally
rather than assuming a Bash redirect behaves identically.

**Why not `os.tmpdir()`:** an earlier version of this note recommended `os.tmpdir()` as the fix.
It resolves OUTSIDE the repo's working directory (confirmed live: `os.tmpdir()` is
`/var/folders/.../T` on macOS, not the literal path `/tmp` — never hardcode `/tmp`, always call the
function), so `acceptEdits`/`auto` mode's working-directory auto-approval scope does not cover it.
A path inside the repo's working directory is the one location that is simultaneously outside every
protected directory AND inside the auto-approval scope both modes give file edits directly.

**The original motivating case:** `we:scripts/review-set-label.mjs`'s `--body-file` validation (not
`pr-land.mjs`, which has no such restriction) allows `resolve(process.cwd())` or
`resolve(os.tmpdir())` only (`scripts/review-set-label.mjs:1059`) — note this is *wherever the
script is invoked from*, not necessarily the repo root; confirm before assuming a bare relative
path satisfies it. `.git/tmp-review-bodies/` was an unnecessary detour into a guarded directory when
a plain path under the invoking directory would have worked from the start.

**One more thing to watch:** an untracked scratch file inside the repo's working directory will show
up in `git status` and could be swept into a commit by a broad `git add -A`/`git add .` — this repo's
own `guard-git-branch.mjs` hook already denies exactly that pattern for this reason, but don't rely
on that existing elsewhere; clean up scratch files explicitly when done with them.

This applies generally, not just to this one repo or script. This note went through several rounds
of independent review before landing, each catching a genuine error (wrong mechanism, a remediation
that reproduced the bug, a false macOS `/tmp` claim, a false Write/Bash-redirect equivalence claim,
a false "still prompts in `auto` mode" claim, and a stale `os.tmpdir()` recommendation left in the
description after the body was corrected). If citing this note, re-verify its claims against current
source rather than trusting them by default — the docs and code it cites can change.
