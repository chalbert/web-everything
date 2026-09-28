---
bornAs: xee72b2
kind: story
size: 3
parent: "3383"
status: resolved
scope: ["we:scripts/operations/pr-ownership.mjs", "we:scripts/operations/pr-ownership-io.mjs", "we:scripts/conveyor/reconcile-core.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-28"
dateResolved: "2026-09-28"
relatedReport: reports/2026-09-24-plateau-observability-review.md
tags: []
---

# pr-ownership read: every open PR mapped to its owning daemon, next move, bound session and its transcript age, lane, and time in state

One read-only declared operation that answers 'who owns this PR right now and is that owner alive'. For every open PR in each constellation repo: phase (from the reconcile dry-run), the daemon that owns the next move (review, fix-dispatch, drain, dispatcher, or none), the session bound to it by bindAgents plus that session's transcript age, the lane lease, and how long the PR has sat in its current phase. Flags three shapes seen live on 2026-09-24: a stale binding (bound session with an old transcript freezes the PR, #3951), an orphan (no daemon owns the next move, e.g. a stacked PR whose base is not main), and owed-but-not-dispatched past N ticks.

## What to reuse (do not re-derive)

- Phase and refusal reason per PR: `runReconcilePass` in dry-run mode (we:scripts/conveyor/reconcile-pass.mjs), the same call the #4038 smoke gate already makes.
- Session binding: `bindAgents` in we:scripts/conveyor/reconcile-core.mjs. Add the bound session's transcript mtime age as a field. Do not change how binding decides.
- Lane: the lane lease files, as `stale-state` already reads them.
- Daemon liveness: `runner-activity`. Owner mapping is a fixed table from phase to daemon: needs review → review daemon; changes or conflict → fix-dispatch daemon; ready-to-merge → drain; base not main → fix-dispatch stacked-rebase (#4030); anything else → none (orphan).
- Card join: the PR→card map #3932 already needs. Share it; do not build a second one.

## Flags (pure function, thresholds in one config block)

- `stale-binding`: bound session's transcript untouched for more than 20 minutes while the PR is owed.
- `orphan`: owner is none, or the owner daemon is `down`/`dead` in runner-activity.
- `owed-not-dispatched`: owed for more than N reconcile ticks with no dispatch record.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/pr-ownership.test.mjs` passes with one fixture per shape: owned and healthy, stale binding (a `blocked` session whose transcript is 3 hours old, the #3951 live shape), orphan stacked PR (base not main, the #4030 shape), owner daemon down, and owed-not-dispatched. Fails before this lands (the operation does not exist).
2. **Live** — `node we:scripts/operations/run.mjs pr-ownership --json > <file>` on the laptop lists every open PR the reconcile dry-run lists across the constellation repos, each with an owner or a flag.

## Progress

- 2026-09-28 — Built. `we:scripts/operations/pr-ownership.mjs` is the declaring module and imports only `registry`/`step-kinds`. It holds the fixed phase→owner table, the three flags, and the thresholds in `PR_OWNERSHIP_THRESHOLDS`. `we:scripts/operations/pr-ownership-io.mjs` runs one `runReconcilePass` per constellation repo, with its readers wrapped only to keep the enriched PRs, agents and required checks it already read. Phase comes from `classifyPr`, binding from `bindAgents`, transcript age from `we:scripts/conveyor/hung-session.mjs#readHungInfo`, lanes from `lane-pool status --json`, and daemon liveness from runner-activity. Time in phase is the PR timeline's latest label or commit event. Registered in `we:scripts/operations/run.mjs` and added to the http-adapter read-only pin.
- `bindAgents` now carries `transcriptAgeMs` on each bound row as evidence only. Binding decisions are unchanged.
- Shared PR→card map: `we:scripts/operations/pr-ownership-io.mjs#buildPrToCardMap`, keyed `${repo}:${pr}` — the exact shape `agent-activity`'s `prToCard` input takes. It is not yet passed into the `agent-activity`/`live-work` callers, which still pass `{}`.
- Owner-table calls made while building:
  - `needs-human` → `human`, not an orphan.
  - A draft in `needs-review`/`open` → fix-dispatch `promote-draft`. A draft is never reviewed; this showed up live on PR #2840.
  - `ci-red` → fix-dispatch `ci-heal`.
  - A stacked PR is owned (by stacked-rebase) only while conflicted. Once queued, it is an orphan.
  - `drain` is not a runner-activity daemon, so its liveness reads `unknown` and never raises `orphan`.
- Done-when 1: `we:scripts/operations/__tests__/pr-ownership.test.mjs` passes 16/16, with one fixture per shape run through the real reconcile pass. Done-when 2: the live `pr-ownership --json` run through `we:scripts/operations/run.mjs` took ~47s and listed the one open PR (#2840) with no gaps.
