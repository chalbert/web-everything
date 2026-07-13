---
bornAs: xqwdyl8
kind: task
parent: "2418"
status: open
dateOpened: "2026-07-13"
tags: []
---

# Harden #2434 drain helpers: required-only checks in display token, arg validation

Follow-up to #2434 (PR #474). A fresh-context review of the drain fetch/state helper
scripts (`we:scripts/fetch-parked.mjs`, `we:scripts/wait-green.mjs`,
`we:scripts/pr-state.mjs`) surfaced three minor, non-blocking hardening findings. None
block the merge — the tools are display/gate helpers, not mergers, and the current
behaviour is conservative — but each is worth tightening so the `checks=` token is honest
and the poller can't hang on a typo or wait out a no-checks PR. This item captures the
three findings precisely so a future implementer can act without re-deriving them.

## Findings

### 1. required-only vs all checks in the `checks=` display token

`fetch-parked` (`assembleParked`) and `pr-state` (`formatPrStateLine`) feed the FULL
`statusCheckRollup` (all checks) to `classifyChecks`, but `pr-land` / `wait-green` gate on
`gh pr checks --required` (required checks only). So a PR that `pr-land` would merge
(required set green) can display `checks=failed` / `checks=pending` here when a
NON-required / optional check is red or still running.

Direction is conservative (over-reports red, never under-reports), and these are display
tools that don't merge — but the PR-body claim that the token "matches exactly what
pr-land waits for" is not literally true.

Fix: filter the rollup to required checks before `classifyChecks` (or soften the claim /
document the divergence).

### 2. NaN guard on `wait-green` `--timeout` / `--interval`

`Number(flagVal('timeout'))` and `Number(flagVal('interval'))` aren't validated as finite:

- `--timeout=abc` → `NaN`, so `elapsed >= NaN` is always false → a stuck-pending PR polls
  forever.
- `--interval=abc` → `setTimeout(r, NaN)` busy-loops.

Self-inflicted operator typo, not a runtime hazard — but cheap to defend. Add a
`Number.isFinite` guard on each flag that falls back to the default when the parse yields
a non-finite number.

### 3. `wait-green` no-required-checks edge exits 3 instead of 0

For a PR with genuinely zero required checks, `gh pr checks --required` exits non-zero with
"no checks reported" (stdout not starting with `[`), so the `catch` classifies it as
`pending`. It then waits out the full timeout → exit 3, instead of reaching the pure
`classifyChecks` empty-array "passed" default (exit 0).

Harmless for lanes that always carry the `test` required check, but the genuine no-checks
case should exit 0.

Note: `fetch-parked` reads the empty rollup as `passed`, so the two tools disagree on the
no-checks case — worth reconciling as part of this fix.
