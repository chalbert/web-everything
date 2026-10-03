---
kind: story
size: 3
parent: "xaojq81"
status: open
blockedBy: ["xq3kn88", "xfbj1fa", "x6prrg3"]
scope: ["we:scripts/conveyor/judge-pass.mjs", "we:skills-src/conveyor/runner.mjs", "we:scripts/conveyor/__tests__/judge-pass.test.mjs", "we:skills-src/conveyor/__tests__/runner.test.mjs"]
dateOpened: "2026-10-03"
preparedDate: "2026-10-03"
preparedAgainstSha: "e1f0523e0881357fc863f3e88da72e0164eb7091"
tags: []
---

# Conveyor judge pass: run the judge and the arbiter on eligible PRs each tick, and the digest once a day

A conveyor pass finds open review:human PRs that only wait on the human gate and stood-down PRs awaiting a ruling, runs the judge seat runner or the arbiter on each (bounded per tick, held by the kill switch), and sends the daily judge digest once per local day.

Makes the ruling at `we:docs/agent/platform-decisions.md#independent-judge-clears-review-human-outside-protected-list` run unattended. Blocked on the runner (`xq3kn88`), the ledger and digest (`xfbj1fa`) and the arbiter (`x6prrg3`), so nothing clears unattended before every clearance is recorded and the arbiter limits exist.

## Design

**Pass** `we:scripts/conveyor/judge-pass.mjs sweep [--repo=…] [--dry-run]`:

1. Read the switches first. Judge OFF → log "judge off" and exit 0 with no `gh` calls.
2. List open PRs (`gh pr list --json number,labels,headRefOid`). Candidates:
   - **clear candidates** — `review:human` plus `advisory:accepted` (the cheap label pre-filter; the runner re-checks everything);
   - **arbitrate candidates** — PRs carrying the stood-down label `review-status:stood-down` (`STAND_DOWN_LABEL` in `we:scripts/conveyor/stand-down.mjs`), and PRs whose same finding was bounced twice (two `review:changes` verdicts on one finding id in the verdict ledger).
3. Call the matching runner for each, in a child process, up to a per-tick cap (default 2 judge spawns per tick, `WE_JUDGE_PASS_MAX`), oldest first. A PR the runner refused on the current head is not retried until its head or labels change (a small state file in the coordination root, keyed by PR and head), so a protected PR does not burn a judge call every tick.
4. Once per local day (America/New_York) call the digest (`we:scripts/conveyor/judge-digest.mjs`).
5. Every failure is printed with the PR number; the pass never throws out of the tick.

**Runner registration** in `we:skills-src/conveyor/runner.mjs`: add `judge-pass` to `MECHANICAL_PASS_NAMES` and run it after `advisory-label-sweep` (so advisory labels are fresh), skippable with `--skip-pass=judge-pass` like every other pass. `we:scripts/conveyor/tick-core.mjs` is not touched: dispatch planning has no part in this.

## MVP

1. Must run no judge call at all while the kill switch is off.
2. Must cap judge spawns per tick and not re-judge a refused PR until its head or labels change.
3. Must send the digest at most once per local day.
4. Must be skippable by name like the other mechanical passes, and an unknown skip name still refuses the runner start.
5. Must never throw out of the tick; failures are printed with the PR number.

## Done when

1. **Executable — Musts 1–3, 5:** a Vitest run of `we:scripts/conveyor/__tests__/judge-pass.test.mjs` passes (new file).
2. **Executable — Must 4:** a Vitest run of `we:skills-src/conveyor/__tests__/runner.test.mjs` passes with `judge-pass` in the pass list.
3. **Observable — live:** one `sweep --dry-run` against the real repo lists the candidates and what it would run; then one real tick with the judge on shows the runner outcome per candidate. Output pasted in the PR.

## Test plan

New `we:scripts/conveyor/__tests__/judge-pass.test.mjs` (matching source: `we:scripts/conveyor/judge-pass.mjs`), with injected `gh`, runners, switches and clock:

- **The kill switch blocks:** switches OFF → zero `gh` calls, zero runner calls. Red today: the judge pass does not exist.
- **The wait switch off → immediate:** with `waitHours: 0`, a PR that became a clear candidate this tick is handed to the runner this tick. Red today: the judge pass does not exist.
- Five clear candidates, cap 2 → the two oldest are run. Red today: the judge pass does not exist.
- A PR refused on head A is skipped on the next tick; after its head moves to B it is run again. Red today: the judge pass does not exist.
- **A protected-list PR is never judge-cleared:** a protected-path candidate reaches the runner, the runner refuses, and the pass records the refusal and does not retry it on the same head. Red today: the judge pass does not exist.
- A stood-down PR → the arbiter runner is called, not the clear runner. Red today: the judge pass does not exist.
- Digest called once on the first tick of a day and not on the second. Red today: the judge pass does not exist.
- A runner that throws → printed, the next candidate still runs, the pass returns normally. Red today: the judge pass does not exist.

Extend `we:skills-src/conveyor/__tests__/runner.test.mjs`: `judge-pass` is in `MECHANICAL_PASS_NAMES`, `--skip-pass=judge-pass` skips it, and an unknown skip name still refuses.

## Proof plan

Tests first, red. After the build: both files green. Live: a `sweep --dry-run` on the real repo, then one real tick with the judge on, pasting each candidate's runner outcome (cleared, or the refusal reason); then turn the judge off with the switch CLI and run a second tick showing zero judge calls. `npm run check:standards` last. `we:skills-src/conveyor/runner.mjs` is a trust-chain member, so this PR is on the protected list and the human clears it.

## Follow-ups

- If the per-tick cap proves too low or too high, tune `WE_JUDGE_PASS_MAX`; no ruling needed.

## Progress

- Prepared 2026-10-03. Scope corrected: the filed scope named `we:scripts/conveyor/tick-core.mjs`, but mechanical passes are registered in `we:skills-src/conveyor/runner.mjs` (`MECHANICAL_PASS_NAMES` and its `run(...)` calls for `we:scripts/operations/operator-notify.mjs` and `we:scripts/conveyor/parked-pr-conflict-watch.mjs`), with tests in `we:skills-src/conveyor/__tests__/runner.test.mjs`. The tick core plans dispatch and is not touched.
