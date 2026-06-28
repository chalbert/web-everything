---
kind: story
size: 2
parent: "1933"
status: resolved
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
graduatedTo: none
tags: []
---

# Slice 1: git-branch guard carve-out — allow push to lane/* and batch-parallel/* temp refs

Narrow the git-branch guard hook's blanket push-deny so a push to throwaway lane/* and batch-parallel/* temp refs is allowed (incl. delete via --delete or empty-src refspec), while every other push (especially main) stays denied. Clones (own HEAD) need no branch/worktree carve-out, so those denials are untouched. Enables the #1933 clone-based parallel model's transport step. Impl = the user-global guard hook; verify by piping PreToolUse JSON payloads through it. NB: the hook also false-positives on the literal token in quoted args (this digest had to be reworded) — fix that token-scan too.

## Progress

- **Status:** resolved
- **Impl:** `we:.claude/hooks/guard-git-branch.mjs` (home-relative `~/.claude/…`; user-global PreToolUse(Bash) guard — outside this repo, so no repo gate covers it).
- **Done:**
  - Push carve-out: `git push` is allowed iff EVERY refspec's destination ref is in `lane/*` or `batch-parallel/*` (optional `refs/heads/` prefix). Covers `--delete <ref>`, empty-src `:<ref>` delete, `src:dst` and `+force` forms (dst is checked), and skips space-separated option values (`-o`, `--push-option`, `--repo`, `--receive-pack`, `--exec`). Bare `git push` / remote-only push (defaults to current branch) stays denied; any non-temp dst (esp. `main`) stays denied.
  - Quoted-arg false-positive fix: replaced the naive operator split with a quote-aware `splitSegments()` walker so shell operators inside quotes no longer shred a quoted argument into command-position fragments (e.g. a `--digest="…; git push …"` arg is no longer mis-read as a git call).
  - Branch/checkout/worktree denials and add/commit hygiene denials untouched.
- **Verify:** 16 PreToolUse-JSON cases piped through the hook (carve-out allows; main/mixed/bare deny; real chained push denies; quoted-arg FPs allow) — all pass. Repo `check:standards` green (0 errors).
- **Notes:** The verification harness was run from the session scratchpad (ephemeral); the hook lives under `~/.claude/`, which has no repo-side test surface.
