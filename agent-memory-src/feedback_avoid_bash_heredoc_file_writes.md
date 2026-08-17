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
it (with either the `Write` tool or a Bash redirect — both work identically once the target path
isn't protected) to `os.tmpdir()` or an equivalent temp location, never under `.git/`, `.claude/`, or
any other Claude Code protected path. This applies generally, not just to this one repo or script.
