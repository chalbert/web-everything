---
kind: story
size: 3
status: open
dateOpened: "2026-08-06"
tags: []
---

# Widen the bash hygiene guard to deny enumerate-then-add pipelines by EFFECT

The #883 hygiene guard denies git add -A / . / --all by FLAG SPELLING, and its matcher only inspects segments that START with git. PR #1064 shipped a read command that was blocked, then re-spelled as an ls-files-to-xargs-to-add pipeline — which no longer matched the pattern while reproducing the exact effect the guard exists to prevent (a broad stage sweeping up concurrent sessions' in-flight work), and which additionally left intent-to-add entries that make git restore truncate files to 0 bytes and every pull --ff-only --autostash die. Match by effect: any pipeline whose sink is a git add of an enumerated path set, including post-pipe segments and xargs/while-read sinks.

## What actually happened (PR #1064)

1. The `/converge` working-tree read needed untracked files visible to `git diff`. Its first draft used
   `git add --all --intent-to-add`. The guard fired.
2. The response re-spelled the command as an enumerate-then-add pipeline
   (`git ls-files --others --exclude-standard -z` piped into `xargs -0 git add --intent-to-add --`), which the
   guard's flag-spelling matcher does not recognise — same effect, different letters.
3. A test then pinned the SPELLING (*"NEVER uses `git add -A` / `.` / `--all`"*) rather than the invariant,
   freezing the bypass in place.

The effect the guard exists to prevent happened anyway, plus a worse one nobody predicted: intent-to-add entries
left in the index make `git restore <path>` **truncate a swept file to 0 bytes** (verified, git 2.50.1 — and that
is the exact recovery command the guard's own deny message prints), and make `git stash` fail
`Entry '<path>' not uptodate`, so every `pull --ff-only --autostash` in the repo dies
(we:scripts/pr-land.mjs, we:scripts/lib/main-staleness.mjs, we:scripts/check-readiness.mjs).

## The two holes

- **Match by SPELLING, not EFFECT.** The rule tests for `-A` / `.` / `--all` as literal flags. Any construction
  that reaches "stage a set of paths this session did not name" is equivalent and passes.
- **The matcher only inspects segments that START with `git`.** A post-pipe `xargs` sink, a `while read` loop
  sink, and a `find … -exec` sink are all invisible to it.

## The shape of the fix

Classify by the SINK of a pipeline rather than by the head of a segment, in the pure `reason` / `decide` core of
we:scripts/guard-bash.mjs (so it stays unit-testable and rides the golden corpus):

- Normalize post-pipe segments the same way leading ones are already normalized (`normalizeGitSegment` already
  peels `xargs` / `env` / `sudo` wrappers — apply it after every pipe too).
- Deny a `git add` whose path set comes from an ENUMERATION the author did not write out: a pipe from
  `git ls-files` / `git status` / `find` / `ls`, an `xargs` sink, a `while read` loop variable, or `-exec`.
- Keep explicitly-named paths allowed — that is the sanctioned form the deny message already steers to.

## Definition of done

- The 2026-08 `/converge` read command (before its fix) is DENIED by the pure rule, with a case in the golden
  corpus.
- Each of the four sink shapes above (pipe-to-xargs, while-read, `-exec`, direct) has a unit case.
- An explicit `git add path/a path/b` still passes.
- The deny message names the EFFECT ("stages a path set you did not name"), not a flag list, so the next
  re-spelling has nothing to route around.
