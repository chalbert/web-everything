---
kind: story
size: 5
parent: "x0hvbwx"
status: open
blockedBy: ["xcs4nce"]
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/__tests__/merge-ai-prs.test.mjs", "we:scripts/__tests__/merge-ai-prs-main-red-halt.test.mjs", "we:scripts/operations/live-state.mjs", "we:scripts/operations/live-state-io.mjs", "we:scripts/operations/__tests__/live-state-io.test.mjs", "we:scripts/operations/__tests__/live-state.test.mjs"]
dateOpened: "2026-10-03"
preparedDate: "2026-10-03"
preparedAgainstSha: "838e849ab8b35fa4b94216b7d474b3138d979ba5"
tags: [policy, drain, main-red, wip]
---

# Halt merging while main is red and publish a main-red signal the WIP page can show

While main's CI is red, the drain lands only PRs proven green against the red main, and publishes a main-red
signal in the live-state snapshot. Governed by `mergeGate.onMainRed` (default `halt`).

## Progress

Prepared 2026-10-03 against `838e849ab`.

| Premise | Checked against the code |
| --- | --- |
| The drain already stops on a red main. | **Only on paper.** `we:scripts/merge-ai-prs.mjs:5858-5884` refuses to land when a freeze marker exists, and re-checks it every watch pass (`:5928`). But the only writer of that marker is the CLI of `we:scripts/readiness/red-main-remediation.mjs:140` (`freezeDispatch`). Its header (`:28-31`) says it fires only with the opt-in diff-shrink. So on 2026-10-03 the drain kept merging onto a red main. |
| "Main is red" is computable. | Yes. `computeMainRedWindows` and `isMainCurrentlyRed` (`we:scripts/conveyor/main-red-recovery.mjs:96`, `:140`) work over main's recent CI runs, read by `defaultReadMainRuns` (`we:scripts/conveyor/reconcile-pass.mjs:323`). An open window has `end: null`. |
| The WIP page has a high-alert band to feed. | **Not yet.** Nothing in WE or plateau-app matches `high-alert`. The WIP page reads `machineHealth.sections` from one `we:scripts/operations/run.mjs live-state --json` call (`we:../plateau-app/src/wip/wip-read.ts:251-277`, types at `we:../plateau-app/src/wip/types.ts:125-153`). WE computes the sections in `assessLiveState` (`we:scripts/operations/live-state.mjs:185-196`). So this story adds the field and a plateau-app follow-up adds the band. |

## Design

1. **Main-red read, once per pass.** Next to `redMainFreezeStop` (`we:scripts/merge-ai-prs.mjs:5869`), read
   main's runs with `defaultReadMainRuns` and compute `{ red, redSince, redSha }` with `computeMainRedWindows`
   and `isMainCurrentlyRed`. Run it before the one-shot land and at the top of every watch pass, like the
   freeze check.
2. **Pure gate** `decideMainRedGate({ policy, mainRed, pr })` returns `land` or `skip` with a reason.
   - `halt` (default): while main is red, skip every PR with reason `main-red-halt`, **except** a PR whose
     latest required `test` run started after `redSince` and succeeded. That PR was tested against the red
     main and passed. PR CI checks out the merge ref by default (`we:.github/workflows/ci.yml:168-172`), so
     that PR fixes main or at least does not depend on the break. Without this exemption, the PR that fixes
     main could never land.
   - `warn`: land as today, but record the signal.
   - `off`: today's behaviour.
3. **Bypass kept.** `--no-red-main-freeze` and `WE_MERGE_BREAK_GLASS` (`we:scripts/merge-ai-prs.mjs:5868`)
   also bypass this gate.
4. **Event.** Under `halt` and `warn`, call `recordPolicyEvent` once per red window: key
   `mergeGate.onMainRed`, event `main-red`, subject is the red SHA, detail is `{ redSince, halted }`.
5. **Snapshot field.** In `we:scripts/operations/live-state-io.mjs`, collect `read.mainState` with the same
   main-run read. In `assessLiveState`, add a section:
   `mainState: { status, reason, redSince, redSha, policy, halted }`.
   - `status` is `red` while main is red, under any policy. It reports a fact, not a policy.
   - `halted` is true only under `halt`.
   - `overall` picks it up through `worstStatus`.

**The field the Plateau WIP high-alert band should read: `machineHealth.sections.mainState`.** It comes
from `sections.mainState` in `we:scripts/operations/run.mjs live-state --json`. Show the band when `status` is `red`, and say
"merging halted" when `halted` is true.

Interaction with `prCi.mainStateParity` (card #2940): with parity `on`, a PR that does not fix main goes red
too, so the exemption admits exactly the fix. With parity `off`, the exemption is weaker. It still admits only
PRs tested after main went red.

## MVP

Steps 1 to 5 in WE. The band itself is a plateau-app follow-up.

## Test plan

- **Capability (RED today, fails before this lands):** `we:scripts/__tests__/merge-ai-prs-main-red-halt.test.mjs` (pure gate plus the pass wiring with injected
  reads):
  - `halt`: with main red, a PR green on a run that started before `redSince` is skipped with
    `main-red-halt`. A PR green on a run that started after `redSince` lands.
  - `warn`: both land, and one `main-red` event is recorded.
  - `off`: both land; no event.
  - Default (no config): behaves as `halt`.
  - Main green: every policy lands both PRs; no event.
  - Break-glass set: lands under `halt`.
  - One event per red window, not one per pass.
  - **Replay of 2026-10-03:** a main-run fixture with the red window open, plus three ready PRs tested before
    it and one tested after it (the PR #3788 shape). Before this story: all four land. After it: only the
    fourth lands.
- **Capability (RED today, fails before this lands):** `we:scripts/operations/__tests__/live-state.test.mjs`: `mainState` is `red` with `halted` true under
  `halt`; `red` with `halted` false under `warn`; `green` when main is green; `overall` becomes `red`.

## Proof plan

1. Read the real 2026-10-03 main runs with `gh run list --branch main --workflow CI` and save them as the
   fixture. Run the drain in dry-run mode with that fixture against the PRs that were ready that day.
   **Before:** it would land them. **After:** it halts them and lists the exemption, if any.
2. Run `node we:scripts/operations/run.mjs live-state --json` with the fixture. Show `sections.mainState`
   with `status` `red`, `redSince`, `redSha` and `halted` true.
3. Paste both outputs in the PR.

## Follow-ups

- plateau-app: add `mainState` to `WipHealthSectionKey` and render the high-alert band from
  `machineHealth.sections.mainState`.
- Card #4236 (an owed CI rerun waiting on a red main is bounded and surfaced) is related. It stays separate:
  it is about the CI-heal side, and this story is about landing.

## Done when

1. **Executable:** the replay case in `we:scripts/__tests__/merge-ai-prs-main-red-halt.test.mjs` fails before
   this lands (all four land) and passes after (only the post-red PR lands).
2. `we:scripts/operations/run.mjs live-state --json` carries `sections.mainState`, shown in the PR.
