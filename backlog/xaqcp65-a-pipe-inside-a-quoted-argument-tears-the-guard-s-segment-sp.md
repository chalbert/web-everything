---
kind: task
status: open
dateOpened: "2026-08-08"
tags: [gate, footgun]
---

# A pipe inside a quoted argument tears the guard's segment split and false-denies

The tree-write guard splits a command on the pipe character before it tokenizes quotes, so a pipe inside a quoted argument tears the command in two. An angle bracket in the resulting fragment then reads as a real redirect and the command is denied.

## The bug

`we:scripts/guard-bash.mjs` splits a command line into segments on the pipe **before**
`shellTokens` does its quote-aware pass. So a pipe that lives *inside* a quoted argument is
treated as a real pipe. The fragment after the tear carries an unbalanced quote, and a `>`
sitting in that fragment is then read as a genuine redirect to a non-scratch path — deny.

Neither character alone trips it. Both, in the same quoted argument, always do — single or
double quotes alike.

## Measured, against `we:scripts/guard-bash.mjs` on main

| command | result |
|---|---|
| `gh pr list --jq '.[] \| .number'` (pipe only) | allow |
| `echo 'a > c'` (angle bracket only) | allow |
| `echo 'a \| b > c'` | **DENY** |
| `echo "a \| b > c"` | **DENY** |
| `gh pr list --jq '.[] \| select(.n > 5)' --state open` | **DENY** |
| `gh pr list --jq ".[] \| select(.n > 5)"` | **DENY** |
| a bare `jq` filter combining a pipe and a comparison | **DENY** |
| `gh pr list --jq 'select(.a > "x")'` (no pipe) | allow |

## Why it matters

This is not a corner case. `--jq '.[] | select(…)'` is *the* house idiom for reading GitHub
state, and the same shape appears in every standalone `jq` filter. Any filter that both pipes
and compares — "PRs merged after this timestamp", "items with size greater than N" — is
refused. It was hit live during the 2026-08-08 overnight review pass while listing PRs merged
after a cutoff.

The deny message points at the tree-write remedy (change directory into a lane first, or the
build override), which is misleading here: the command writes nothing, and running it in a
lane does not help. Cost is a wasted round trip plus a rewrite of the filter to avoid the
comparison.

## Relationship to #2986

Sibling of /backlog/2986-three-false-denies-in-the-new-tree-write-guard-arm/ — same arm, same
class, found one pass later. Worth fixing in the same sitting; this one is the higher-value
half, because it is the only one of the four an agent hits in ordinary work.

## What to consider

The fix is ordering: tokenize quotes first, then split on unquoted separators only. That
touches the same seam as the `--` and flag-cluster handling, so re-run the two-sided fixture
corpus PR #1021 added rather than eyeballing it. Note that the corpus currently proves
recall (41 of 41 must-deny spellings) — this class needs must-**allow** rows, which is the
half that catches over-denial.

## Done when

- Every `DENY` row in the table above is allowed, and no must-deny spelling regresses.
- A real unquoted redirect after a real unquoted pipe is still denied — piping into a `tee`
  that targets a tracked file must stay refused.
- The must-allow rows land in the fixture corpus alongside the must-deny ones.
