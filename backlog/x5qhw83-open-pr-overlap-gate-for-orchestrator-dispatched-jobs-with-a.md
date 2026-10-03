---
kind: story
size: 5
parent: "x0hvbwx"
status: open
blockedBy: ["xcs4nce", "xq4p21a"]
scope: ["we:scripts/readiness/overlap-chain.mjs", "we:scripts/readiness/__tests__/overlap-chain.test.mjs", "we:scripts/codex-direct-task.mjs", "we:scripts/gemini-direct-task.mjs", "we:scripts/__tests__/codex-direct-task.test.mjs", "we:scripts/__tests__/gemini-direct-task.test.mjs", "we:scripts/__tests__/direct-task-overlap-gate.test.mjs", "we:scripts/conveyor/health-smells/overlap-override-used.mjs", "we:scripts/conveyor/health-smells/__tests__/overlap-override-used.test.mjs"]
dateOpened: "2026-10-03"
preparedDate: "2026-10-03"
preparedAgainstSha: "838e849ab8b35fa4b94216b7d474b3138d979ba5"
tags: [policy, dispatch, overlap, wip]
---

# Open-PR overlap gate for orchestrator-dispatched jobs, with a logged override mode

A job whose declared scope touches a file of another open PR is refused, unless policy allows an override.
In `logged` mode an override needs a named reason, writes a durable record, and shows on the WIP page.
Governed by `dispatchGate.overlapOverride` (default `off`, meaning no override).

## Progress

Prepared 2026-10-03 against `838e849ab`.

| Premise | Checked against the code |
| --- | --- |
| Dispatch already checks open-PR overlap. | **For conveyor builds only.** `we:scripts/conveyor/build-dispatch-policy.mjs:271-274` holds a build whose scope overlaps an open PR's files (rule `scope-vs-open-prs`, declared at `:77`). Conveyor fix and CI-heal jobs compare only against live claims, not open PRs (`filterFixesByInFlightScope`, `we:scripts/conveyor/reconcile-fix-dispatch.mjs:1484`). The orchestrator's direct jobs (`we:scripts/codex-direct-task.mjs`, `we:scripts/gemini-direct-task.mjs`) take no scope and check nothing. |
| An override exists and is logged. | **No.** There is no flag to override the dispatch-time check, and no durable override record. The only overlap overrides are land-time yield flags (`we:scripts/conveyor/land-overlap-yield.mjs:103-127`), resolved in memory. So on 2026-10-03 the orchestrator overrode by judgment, about five times on open PR #3507's files, and each time #3507 needed another conflict-fix and review round. |
| The pieces to reuse exist. | `firstScopeOverlap` (`we:scripts/readiness/overlap-chain.mjs:96`), the open-PR fetch with files (`fetchOpenPrsRest` and `BUILD_DISPATCH_PR_FIELDS`, `we:scripts/conveyor/open-pr-fetch.mjs:48`, `:88`), and the policy-event journal and its health probe (stories #xcs4nce and #xq4p21a). |

The detached codex-job runner the orchestrator used on 2026-10-03 is not on main. When it lands, it calls the
same gate (follow-up).

## Design

1. **Pure gate** in `we:scripts/readiness/overlap-chain.mjs`:
   `openPrOverlapGate({ scope, openPrs, selfPr, policy, overrideReason })` returns
   `{ allowed, hits: [{ file, pr }], mode, record }`.
   - It ignores `selfPr`, the PR this job repairs: a repair must touch its own PR's files.
   - `off` (default): any hit refuses. The message names each file and PR. A reason does not help.
   - `logged`: a hit refuses unless `overrideReason` is a real reason (non-empty after trimming, at least 15
     characters). When allowed, it returns `record` set to true.
   - `free`: allowed, and `record` is still true, so the WIP page still shows the overlap.
2. **Direct-job wiring.** `we:scripts/codex-direct-task.mjs` and `we:scripts/gemini-direct-task.mjs` gain
   `--scope=<repo:path,…>` (required), `--pr=<n>` (the PR being repaired, optional) and
   `--overlap-override-reason=<text>`. Before any model is spawned, they fetch open PRs with files, run the
   gate, and exit non-zero on a refusal. A refused run costs nothing.
3. **Record.** When `record` is true, call `recordPolicyEvent`: key `dispatchGate.overlapOverride`, event
   `overlap-override`, subject `<repo>#<pr>`, the reason, and detail `{ files, dispatcher, mode }`.
4. **WIP.** Add `we:scripts/conveyor/health-smells/overlap-override-used.mjs` on the `policyEvents` probe from
   story #xq4p21a: severity `medium`, action `alert`, one row per overlapped PR. It breaches when an override
   for that PR was recorded in the last 24 hours, and the summary quotes the reason. A medium episode turns the
   live-state health section yellow and lists on the WIP page (`we:../plateau-app/src/wip/progress-health.ts:65-75`).

## MVP

Steps 1 to 4 for the two direct-job entry points.

## Test plan

- **Capability (RED today, fails before this lands):** `we:scripts/readiness/__tests__/overlap-chain.test.mjs`, gate cases. The open-PR fixture is #3507 with its
  four files (`we:scripts/lib/jury-core.mjs`, `we:scripts/operations/review-pr-io.mjs`,
  `we:scripts/operations/review-pr.mjs`, `we:scripts/review-set-label.mjs`):
  - `off`: a scope with `we:scripts/lib/jury-core.mjs` is refused and names #3507, even with a reason.
  - `logged`: no reason is refused; a too-short reason is refused; a real reason is allowed with `record`.
  - `free`: allowed with `record`.
  - `selfPr` 3507: allowed under every mode, with no record.
  - A disjoint scope: allowed, no record.
  - Default (no config): behaves as `off`.
  - **Replay of #3507:** five sequential fix jobs on #3507's files. Before this story: all five dispatch.
    After it, under the default: all five are refused before spawning, so #3507 needs no extra rounds.
- **Capability (RED today, fails before this lands):** `we:scripts/__tests__/direct-task-overlap-gate.test.mjs`: a missing `--scope` exits with a usage error; a
  refusal exits non-zero before the spawn function is called (spawn injected and asserted unused); an allowed
  override writes one journal line.
- **Capability (RED today, fails before this lands):** `we:scripts/conveyor/health-smells/__tests__/overlap-override-used.test.mjs`: the shape is valid; an event in
  the last 24 hours breaches; an older one does not.

## Proof plan

1. Live refusal: run `node we:scripts/codex-direct-task.mjs --scope=<a file of a currently open PR> --task="noop"`
   against real open PRs. **Before:** it spawns Codex. **After:** it refuses at once, naming the PR.
2. Live logged override: with a temp config set to `logged` and a real reason, show the journal line, then one
   health-watch tick showing the `overlap-override-used` episode, then `we:scripts/operations/run.mjs live-state --json` with the
   health section yellow.

## Follow-ups

- The detached codex-job runner (not on main) calls `openPrOverlapGate` when it lands.
- Conveyor fix dispatch (`we:scripts/conveyor/reconcile-fix-dispatch.mjs:1484`): check other open PRs' files.
  This needs its own design, because a fix's scope is its own PR's files.

## Done when

1. **Executable:** the #3507 replay case fails before this lands (all five dispatch) and passes after (all
   five refused).
2. Proof steps 1 and 2 are pasted in the PR.
