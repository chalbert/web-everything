---
kind: story
size: 2
parent: "1933"
status: open
dateOpened: "2026-06-28"
tags: []
---

# Slice 1: git-branch guard carve-out — allow push to lane/* and batch-parallel/* temp refs

Narrow the git-branch guard hook's blanket push-deny so a push to throwaway lane/* and batch-parallel/* temp refs is allowed (incl. delete via --delete or empty-src refspec), while every other push (especially main) stays denied. Clones (own HEAD) need no branch/worktree carve-out, so those denials are untouched. Enables the #1933 clone-based parallel model's transport step. Impl = the user-global guard hook; verify by piping PreToolUse JSON payloads through it. NB: the hook also false-positives on the literal token in quoted args (this digest had to be reworded) — fix that token-scan too.
