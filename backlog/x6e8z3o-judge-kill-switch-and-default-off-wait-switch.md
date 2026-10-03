---
kind: story
size: 3
parent: "xaojq81"
status: open
scope: ["we:scripts/lib/judge-switches.mjs", "we:scripts/conveyor/judge-switch.mjs", "we:scripts/lib/__tests__/judge-switches.test.mjs"]
dateOpened: "2026-10-03"
preparedDate: "2026-10-03"
preparedAgainstSha: "e1f0523e0881357fc863f3e88da72e0164eb7091"
tags: []
---

# Judge kill switch and default-off wait switch

A machine-local switch store with set/clear/status verbs turns the independent judge off without a PR (fail-closed: an unreadable store means judge off) and holds an optional N-hour wait before the judge may clear, default off so a judge clear is immediate.

Builds rules 5–6 of `we:docs/agent/platform-decisions.md#independent-judge-clears-review-human-outside-protected-list` (decision xne1udi). Nothing reads the switches yet; `xfnv9ay` takes the state as input and `xq3kn88` / `xfetp9j` read it.

## Design

Mirror the shape of `we:scripts/readiness/dispatch-pause.mjs` (a single advisory state file, SET / CLEAR / STATUS verbs, atomic temp-file-then-rename write, env-var path override) with one deliberate inversion: **this store fails CLOSED**. The dispatch pause fails open because a missing file must not stop work; here a missing or broken file must not let the judge clear.

- **Pure core** `we:scripts/lib/judge-switches.mjs`: `parseJudgeSwitches(raw)` → `{ judgeEnabled, waitHours, by, at, reason }`, and `planJudgeSwitchWrite(current, verb, args)`.
  - The file does not exist → `judgeEnabled: true`, `waitHours: 0`. This is the ruled default: the operator chose to turn the judge on now, and the wait defaults off. An absent file is the normal first-run state, not an error.
  - The file exists but is unreadable, not JSON, or has a wrong-typed field → `judgeEnabled: false` (fail closed), with a `parseError` field naming why.
  - `waitHours` must be a whole number from 0 to 168; anything else is refused at write time, and read as `judgeEnabled: false` if found on disk.
- **Store location:** one JSON file in the coordination root (`resolveCoordinationRoot()` from `we:scripts/operations/coordination-root.mjs`), so every lane and the conveyor read one machine-wide file. The `WE_JUDGE_SWITCHES_PATH` env var overrides it for tests.
- **CLI** `we:scripts/conveyor/judge-switch.mjs` with verbs `off --reason=…`, `on --reason=…`, `wait --hours=N --reason=…` (N=0 turns the wait off), and `status`. `--reason` is required for every write and is stored with `by` (the `CLAUDE_CODE_SESSION_ID` actor, else the OS user) and `at`. `status` prints the state and any parse error. No verb needs a PR: the file lives outside the repo.

## MVP

1. Must turn the judge off with one command and no PR, and back on the same way.
2. Must read as judge OFF when the store is unreadable, malformed or wrong-typed (fail closed). Must treat a hand-edited file as data to validate, never as trusted.
3. Must read as judge ON with no wait when the store does not exist (the ruled default).
4. Must hold an N-hour wait when set and none when N is 0; must refuse an out-of-range N at write time.
5. Must write atomically, so a reader never sees half a file.

## Done when

1. **Executable — Musts 2–5:** a Vitest run of `we:scripts/lib/__tests__/judge-switches.test.mjs` passes; the file does not exist before this item.
2. **Observable — Must 1:** in a lane with `WE_JUDGE_SWITCHES_PATH` pointing at a scratch file, the `we:scripts/conveyor/judge-switch.mjs` CLI's `off --reason=test` then `status` shows OFF; `on` then `status` shows ON. Output pasted in the PR.

## Test plan

New `we:scripts/lib/__tests__/judge-switches.test.mjs` (matching sources: `we:scripts/lib/judge-switches.mjs`, `we:scripts/conveyor/judge-switch.mjs`):

- **The kill switch blocks:** after `off`, `parseJudgeSwitches` returns `judgeEnabled: false`. Red today: the switch store does not exist.
- No file → `judgeEnabled: true`, `waitHours: 0`. Red today: the switch store does not exist.
- A store holding a truncated `{`, an array, `judgeEnabled` as a string, or a negative `waitHours` → `judgeEnabled: false` with a `parseError`. Red today: the switch store does not exist.
- **The wait switch off → immediate:** `wait --hours=0` stores `waitHours: 0`; `wait --hours=6` stores 6; `wait --hours=999` and `wait --hours=1.5` are refused at write. Red today: the switch store does not exist.
- A write without `--reason` is refused. Red today: the switch store does not exist.
- The atomic write leaves no temp file behind and never exposes partial JSON (write through an injected fs and assert one rename). Red today: the switch store does not exist.

## Proof plan

Write the test file first and capture its failure against the missing modules. After the build, run it and paste the output. Then run the CLI live against a scratch path (Done-when 2), including a hand-corrupted store to show `status` reporting OFF with the parse error. Finally `npm run check:standards`.

## Follow-ups

- A digest line saying when the judge was off for part of the day belongs to `xfbj1fa`.
- Showing the switch on the operator console is a later UI card, not part of this ruling.

## Progress

- Prepared 2026-10-03 against `we:scripts/readiness/dispatch-pause.mjs` (the existing kill-switch shape, which fails open — inverted here on purpose) and `we:scripts/operations/coordination-root.mjs` (the machine-wide state root).
