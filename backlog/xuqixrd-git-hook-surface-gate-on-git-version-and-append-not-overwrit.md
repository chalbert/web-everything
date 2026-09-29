---
kind: story
size: 2
status: open
scope: ["we:scripts/lib/git-hook-surface.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# git-hook-surface: gate on git version and append (not overwrite) GIT_CONFIG_COUNT

Advisory follow-up from PR #2867 (WE #4291): we:scripts/lib/git-hook-surface.mjs:52 sets GIT_CONFIG_COUNT=1 unconditionally, overwriting a caller's existing GIT_CONFIG_* entries, and has no git-version gate for the env-config feature. MVP: append after any existing GIT_CONFIG_COUNT entries and refuse (or fall back) on a git too old to honor it. Must: unit tests for both.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
