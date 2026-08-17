---
name: avoid-writing-under-git-for-scratch-files
description: .git/ is a Claude Code hardcoded protected path — writes there are never auto-approved by an allow rule; use Node's os.tmpdir() (NOT the literal path /tmp) for scratch files instead
metadata:
  type: feedback
---

Never write scratch files (PR-body text, temp content, etc.) under a repo's `.git/` directory —
with any tool, not just Bash. Use Node's `os.tmpdir()` instead — call the function, don't hardcode
`/tmp`: on macOS `os.tmpdir()` resolves to a per-user path under `/var/folders/.../T`, not `/tmp`
itself, and the literal path `/tmp` fails `we:scripts/review-set-label.mjs:1059`'s own allow-list
check on this platform (confirmed live: `resolve('/tmp')` is not in `[cwd, resolve(tmpdir())]` on
macOS). Always resolve the path at runtime; never write the string `/tmp` into a script or command.

**Why:** `.git` is one of Claude Code's hardcoded "protected paths"
(https://code.claude.com/docs/en/permission-modes#protected-paths) — writes there are never
auto-approved by any `permissions.allow` rule, in any mode except `bypassPermissions`: "the safety
check runs before Claude Code evaluates allow rules from settings." This applies to the `Write` and
`Edit` tools too, not just Bash — the mechanism is the target path, not the tool or command shape.
An earlier version of this note wrongly attributed the prompt to "Bash heredocs bypass Edit/Write
hooks" and recommended switching to the `Write` tool while still targeting `.git/tmp-review-bodies/`
— that recommendation reproduces the exact prompt it was meant to prevent, since the `Write` tool
hits the identical protected-path check. Caught by independent review before landing (2026-08-17).

The original motivating case: `we:scripts/review-set-label.mjs`'s `--body-file` validation (not
`pr-land.mjs`, which has no such restriction) allows `resolve(process.cwd())` or `resolve(tmpdir())`
only (`scripts/review-set-label.mjs:1059`) — `os.tmpdir()` was a valid, protected-path-free location
the whole time; `.git/tmp-review-bodies/` was an unnecessary self-inflicted detour into a guarded
directory.

**How to apply:** Whenever a script needs a `--body-file`/`--content-file`-style scratch file, write
it with the `Write` tool to a plain path under the repo's working directory that is NOT `.git/`,
`.claude/`, or another protected directory (e.g. a scratch file directly at the repo root, or a
non-dotfile subdirectory there) — never under `.git/`. Two things this note previously got wrong,
now corrected:

- **The `Write` tool and a Bash heredoc/redirect are NOT interchangeable in general** — only the
  protected-path check treats them identically. In `acceptEdits` and `auto` modes (`auto` is the
  built-in starting mode on Pro/Max/Team plans), a file edit in the working directory auto-approves
  silently, but "all other Bash commands except the built-in read-only set still prompt" — so a
  `cat > file` still prompts on a perfectly safe, unprotected path where a `Write` call would not.
  Prefer the `Write` tool structurally; don't rely on a Bash redirect being equally silent.
- **`os.tmpdir()` is not actually the safer default** — it resolves OUTSIDE the repo's working
  directory, and `acceptEdits`/`auto` mode auto-approval is scoped to the working directory (and any
  `additionalDirectories`). A path there can still prompt or route to the classifier even though it
  passes `we:scripts/review-set-label.mjs:1059`'s own cwd-or-tmpdir check. A plain, non-protected path
  *inside* the repo root satisfies the protected-path check, the working-directory auto-approval
  scope, AND `review-set-label.mjs`'s `cwd` branch all at once — it is the actually-safe default, not
  `os.tmpdir()`.

This applies generally, not just to this one repo or script.
