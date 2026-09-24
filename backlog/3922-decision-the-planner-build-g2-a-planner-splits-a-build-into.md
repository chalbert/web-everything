---
bornAs: xxxraos
kind: decision
parent: "3383"
status: resolved
relatedTo: ["3575", "3801", "3717", "3730", "3857", "3784", "3850", "3690", "3783", "3748", "3621", "3996", "4003", "4004", "4001", "3994", "4008", "3997", "4006", "4007", "4011", "4009", "3993", "4010"]
relatedReport: reports/2026-09-22-planner-build-g2-prep.md
scope: ["we:scripts/lib/dispatch-contracts.mjs", "we:scripts/lib/provider-routing.mjs", "we:scripts/operations/dispatch-task.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/deliver-item-wrapper.mjs"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-22"
dateResolved: "2026-09-23"
codifiedIn: "docs/agent/platform-decisions.md#planner-build-plan-and-execute"
preparedDate: "2026-09-22"
preparedAgainstSha: "47302a3ce171b1039078e65677e9ac4bb71a8e3b"
tags: [dispatch, delegation, planner, conveyor, decision-prep]
---

# Decision: the planner build (G2): a planner splits a build into a JSON plan of typed steps, each run by a script or dispatched to the cheapest capable model

**The operator's ask, repeated on 2026-09-19, 09-20, 09-21 and 09-22:** a build should not be one worker writing
the whole card. A planner writes a plan of steps, each with its dependencies, a task type and a size. The
mechanical orchestrator runs each step itself when a script can do it, or sends it to the cheapest model that
can. It favours Gemini Flash once Flash has earned trust for that kind of step. Steps with no dependency between
them run in parallel.

Until 2026-09-22 this lived only as follow-up 1 ("G2") of #3801 and as tracker item 6 in the prototype branch's
copy of #3383. This card rules how that build works. It is prototype work under #3383: build on
`lane/mechanical-dispatcher`, then graduate through #3443.

*Prepared 2026-09-22 (session prepare-planner-build). Research topic:
[/research/planner-build-plan-and-execute/](/research/planner-build-plan-and-execute/). Session report:
`we:reports/2026-09-22-planner-build-g2-prep.md`.*

*Every citation was read on the prototype tip `da085d438` with `git show da085d438:<path>`. Most of these files
exist only on the prototype branch, so their `we:` cites resolve there. Two skeptic rounds (Opus) and two
fresh-context screens ran on the prepared version.*

*Rewritten 2026-09-22 after the operator discussion (session decision-3922). The discussion changed Fork 2 (step
lanes), Fork 5 (separate planner and checker), and added how a step runs (its permissions, its commands, its
requests) and when checks run. Those changes are written into the forks below, not appended. Two independent
skeptic rounds then ran at ratification (`judgePanel`, runs `ratify-3922` and `ratify-3922-r2`); their amendments
are marked "skeptic, ratify round".*

## Why this is on the critical path

Delegation is the operator's first stated goal for #3383. Today the whole card goes to one worker, so the router
can only pick one model for the whole build. A cheap model gets either the whole card or nothing, and in practice
it gets nothing.

## FOUND (checked 2026-09-22 on the prototype tip `da085d438`)

- **The plan format already exists, and nothing calls it.**
  - `PLAN_OUTPUT_SCHEMA` (`we:scripts/lib/dispatch-supervisor-contract.mjs:19`) is a plan of tasks. Each task has
    `id`, `title` and `dependsOn`, plus a profile: `taskType`, `estimatedLoc`, `filesTouched`,
    `acceptanceTestable` and `risk` (`:12-15`).
  - `planFromSupervisorOutput` (`:53-62`) validates a planner's JSON and checks the plan for cycles.
  - `VERDICT_OUTPUT_SCHEMA` (`:21`) is the supervisor's verdict on a task: `accept`, `rework` or `reject`, with
    optional new tasks.
  - Every export is tagged "contract for the G2 dispatcher wiring (no runtime caller in slice G1)".
- **The planner role is built but unused.** `routeDispatch` (`we:scripts/lib/dispatch-contracts.mjs:440-491`) has
  two stages. At the story stage, a `build` returns the `build-supervisor` role from `selectSupervisor`
  (`:447`, `:608-631`). At the task stage it returns a `task-agent` routed by `selectProvider`. Nothing calls the
  story stage. #3801 Fork 1 ratified `stage: 'task'` for `build`, and its follow-up 1 says a planned build "flips
  to the story stage". So this card extends that ruling for planned builds.
- **One role both plans and checks today.** `selectSupervisor` reads only `role: 'supervise'` records (`:614`) and
  serves both the `plan` and the `verdict` phase. Its ladder climbs from `agy-sonnet-4-6` to `claude-opus-5`
  (`:596-601`). Every rung except the last needs `supervise` trials, and there are none, so every call falls
  through to Opus (`:614-623`). A cheaper rung only runs as a *shadow* next to it (`:626-627`).
- **Nothing would be delegated yet.** A build step's task type is `doc-fix` or `build-new-feature`
  (`we:scripts/lib/dispatch-task-type.mjs:168-182`). `main`'s `we:scripts/conveyor/run-scorecards.json` has **no
  non-Claude `build-new-feature` trial**. All five Gemini Flash trials are `conflict-resolution`.
  `selectProvider` requires at least one verified clean trial for the same provider, model and task type
  (`we:scripts/lib/provider-routing.mjs:349-373`). So under today's data every code step routes to Claude. How a
  cheap model earns its first trials on build steps is Fork 4.
- **The trust rules are statute.** `#delegation-trial-record-graduation`:
  - Trust is per `{provider, model, taskType}` and never carries across triples.
  - The bar is a trailing clean streak plus a positive control. A confirmed miss is a hard veto.
  - "A concurrent-baseline comparison (the same task run through Claude and through the delegated provider,
    judged on the difference) is the preferred evidence shape over raising N."
  - Changing what counts as a clean trial is a governed change (rule 1).
  - Promotion to lighter checking is an explicit ratified act (rule 6).
  - At every level, the orchestrator reads the real diff (rule 7).
- **The executors clone into unmanaged temp folders.** `we:scripts/gemini-direct-task.mjs` and
  `we:scripts/codex-direct-task.mjs` default to a fresh clone of the committed tip made with `mkdtemp` under the OS
  temp folder: no lease, no reaper, no entry in `lane-pool status`. Both also take `--dir=<existing checkout>`.
  They **never commit**; each hands back a diff.
  - agy's own file tools can write outside the target folder, so a Gemini run is not confined
    (`we:scripts/gemini-direct-task.mjs:18-26`).
  - `EXECUTOR_PROVIDERS` (`we:scripts/lib/dispatch-contracts.mjs:46-50`) maps each executor to the providers it
    may claim.
- **A Claude session's permissions can be passed at launch, and they work in any folder** (probed 2026-09-22 with
  headless `claude -p` on Haiku, in fresh `git init` folders that were never trusted):
  - An allow rule passed with `--settings <file>` let the command run. Without it, the command was refused. It did
    not hang.
  - A `PreToolUse` hook passed the same way fired and blocked the call.
  - An `Edit` rule naming one file allowed that file and refused the other.
  - A session resumed with `--resume` and a widened settings file could edit the newly allowed file.
  - So a folder's trust flag only decides whether Claude reads that folder's own `we:.claude/settings.json`. The
    trust flag is written only by the operator: the trust dialog, or `npm run bootstrap install`
    (`we:scripts/bootstrap-session.mjs`). The delivery wrapper already launches its worker with `--settings`
    (`we:scripts/operations/deliver-item-wrapper.mjs:1277`).
- **Today's build is one blocking worker.** `deliverItem` (`we:scripts/operations/deliver-item-wrapper.mjs:284-449`)
  acquires the lane, claims the item, runs **one** agent turn (`runAgentToCompletion`, `:337`), then runs the
  gate, converge, the park-mode choice and the PR. Four places are tied to that single agent:
  - The lane lease names that agent's session as occupant (`:307`).
  - The gate's one retry resumes that same session (`:376`, `:1089` onward).
  - The park-mode choice reads that agent's own report (`:396`).
  - A mid-build block releases the claim and the lane (`:357-363`), which throws away work already done.
- **CPU is already capped in two places.** The lane-dispatch ceiling (`we:scripts/lib/lane-concurrency.mjs`,
  `WE_MAX_CONCURRENT_LANES`, default 8) caps running sessions. Heavy-command admission
  (`we:scripts/readiness/heavy-admission.mjs`) caps concurrent heavy commands inside lanes.
- **`dispatch-task` is not the step executor.** It launches a detached, Claude-only worker from a brief file. Its
  `kind` is a free label (`we:scripts/operations/dispatch-task.mjs:170`).
- **No in-lane declared operation exists for a step to call.** The registry (`we:scripts/operations/run.mjs:29-101`)
  has about 30 operations. Almost all of them act outside the lane: PRs, claims, dispatch, the board.
- **Stale premise in #3575.** Its Fork 1 reuses the parallel workflow's "one integration worktree, one merge".
  That model was dropped on 2026-07-03 (`we:skills-src/batch-backlog-items/parallel-execute.workflow.js:13-18`).
  Today every item opens its own PR. The correction is noted on #3575.

## Recommended path at a glance

| Fork | Recommended default | Main alternative |
| --- | --- | --- |
| 1: who runs the plan | **(a) the build wrapper (code) runs the plan** | (b) the planner agent spawns its own workers (excluded: a model picks the models) |
| 2: where a step works | **(a) each step in its own leased lane from the shared pool; its diff lands in the item lane only after it is accepted, in dependency order** | (c) parallel agents in the item lane's working tree (excluded: shared index and files) |
| 3: a step's task type | **(a) derived mechanically: from why the step exists (planned, apply clash, failed gate), then from its files (doc or code)** | (b) declared by the planner from the enum, checked against the files |
| 4: how a cheap model earns build-step trials | **(b) exploration as one router rule: while a task type has no qualifying non-Claude model, low-risk steps go to the next model on an ordered table (Flash first), capped per day; the existing cascade takes over once one qualifies** | (a) a concurrent baseline (the target, once #3783 and a statute amendment exist); (c) no in-build trials |
| 5: checking each step | **(a) a separate checker role (Sonnet by default, moved up to Opus only on recorded misses) checks every step a non-Claude model built; the PR parks for review if any step was delegated** | (b) the PR panel only, as #3850 rules for a single worker |
| 6: which builds get planned | **(b) every build, so every build shows live steps; a small card gets one or a few steps and a Sonnet planner, size 8 and up gets Opus** | (a) only size 8 and up |
| 7: the `deliveryAgent:` marker | **(a) that vendor builds the whole card as one worker; no plan runs** | (b) the marker pins the planner; (c) it pins every step |

## Settled by statute or earlier rulings — not forks

- **A step is an agent task; anything it runs is a typed declared operation, never a command string.**
  `#agent-mutations-through-typed-operations` already rules that operation parameters are strictly typed and
  rejects a `run(script, args)` that passes strings to a shell. A plan step that "runs a script" therefore names a
  declared operation, typed by that operation's own input schema. No in-lane operation exists yet, so child 5
  builds the first ones; until then every step is an agent step.
- **Routing stays the router's.** Each agent step is routed by `decideDispatchRoute` at the task stage, and "favour
  Gemini" is its existing cascade order. The router picks Flash for a task type only once Flash's trials qualify.
  Promotion to `spot-check` stays #3784's ratified act.
  - The one exception is a Fork 4 exploration step. Its candidate comes from an ordered table, not the cascade.
  - Its routing record keeps the router's `routed` (Claude), sets `executed` to the candidate, and marks
    `exploration: true`. So the router's own choice is never overwritten (#3848).

## Supported by default — not forks

- **The plan format is the built `PLAN_OUTPUT_SCHEMA`,** with two changes:
  - Fork 3 removes the planner's `taskType`.
  - The profile's `risk` passes through the existing raise-only `raiseRisk` (`we:scripts/lib/dispatch-contracts.mjs:148`).
  The planner may return a one-step plan.
- **A step's size is recorded as coming from the plan.** Its `estimatedLoc` is passed to `decideDispatchRoute`
  with a new `sizeSource: 'plan'`. Today any passed estimate is recorded as `'card'`
  (`we:scripts/lib/dispatch-contracts.mjs:1069-1070`), which would mislabel where the size came from (#3801 Fork 4).
- **A step's executor follows its routed provider** through `EXECUTOR_PROVIDERS`: `gemini-direct-task`,
  `codex-direct-task`, or a headless Claude session. Every executor runs in the step's lane (Fork 2).
  - The model comes from the router, never from `WE_DISPATCH_AGENT_ARGS` (#3857).
  - `dispatch-task` keeps its role of launching a hand-written brief (#3730).
  - **Every step is launched through one launch function.** That is the single place a later container layer
    (#3621) wraps, without touching the plan runner.
- **The wrapper's four single-agent seams become plan-aware.**
  - **The lane occupant.** Each Claude session is adopted with `lane-pool adopt` as occupant of the lane it edits
    (its step lane, or the item lane for the fallback worker and the converge editor) for its turn, and released
    after. The lane guard's foreign-occupant check (#2997) stays on for every edit.
  - A red gate becomes a `rework` step, planned by the planner, instead of resuming one session.
  - The park-mode choice reads a report the plan runner assembles from its steps.
  - **When `maxRounds` runs out,** the item lane keeps every accepted step. The remaining work goes to one Claude
    worker on that partly built lane, which is today's single-worker path, with its own time budget.
    - This is not a fork, because the two alternatives are broken. Dropping the lane throws away accepted,
      paid-for work, which is today's `blocked-mid-build` placeholder. Opening a PR for a half-built card
      invites the early-resolve bug #3820 fixed.
- **A rework's type follows its cause** (Fork 3's table). `self-fix` stays unproduced (#3801 Fork 2).
- **The PR is still one per card.** After the plan, the gate, converge and PR-open steps run on the item lane.

### How a step session runs: its files, its commands, its requests

Operator direction, 2026-09-22. A step is launched with its own settings file, so it never depends on the lane's
trust flag, and a new, untrusted lane works as a step lane with no operator action (FOUND).

- **Files.** The step may edit and write only its own `filesTouched`. Everything else is refused. Reading stays
  free.
- **Commands.** The step may run only a short pre-approved list of declared operations through
  `we:scripts/operations/run.mjs`, such as running its related tests. There is no free shell, so the file limit
  holds. Every call is a declared operation, so every call is tracked on that operation's run record.
- **Anything else is a request the wrapper runs.** The step calls a `request-run` operation naming the declared
  operation it needs and its typed input. That call only records the request. The step then ends its turn. The
  wrapper checks the request against the gate schedule (below) and the operation catalog, runs it, and resumes the
  step with the result. The wrapper already resumes a session for its gate retry.
  - A request for a check the gate schedule keeps for the whole build (the full suite, `verify-lane`) is refused
    with that reason.
  - Every request and its outcome goes on the step's record, so the pre-approved list grows from evidence of what
    steps actually ask for.
- **More files are also a request.** A step that needs a file outside its list calls `request-scope`. The wrapper
  grants it when no other running step of the build, and no other lane's scope lease, holds that file; otherwise
  it refuses and names the holder. The step resumes with a settings file that includes the new files (probed:
  a resumed session honours a widened settings file). Each grant is also recorded on the planner's record: the
  plan missed a file.
- **The leftover gap is small and caught.** An allowed operation, such as a test run, could write a file itself.
  Fork 2's apply check sends back any diff that touches a file outside the step's list.
- **Gemini and Codex steps** are not bound by Claude's permission rules. They get `--gate=none`, their brief, and
  the same apply check. Codex's own sandbox limits writes to its working folder; agy has no such limit, which is
  Fork 2's accepted residual risk.
- A synchronous request tool (an MCP server the step calls mid-turn) is a later option if the resume round trip
  proves slow. Not built first.

*Example only, to show the shape; the real file is generated per step by the runner:*

```json
{
  "permissions": {
    "allow": [
      "Read", "Grep", "Glob",
      "Edit(//<step lane>/<each file in filesTouched>)",
      "Write(//<step lane>/<each file in filesTouched>)",
      "Bash(node <step lane>/<operations runner> test-related:*)",
      "Bash(node <step lane>/<operations runner> request-run:*)",
      "Bash(node <step lane>/<operations runner> request-scope:*)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "node <guard-bash> (WE_DISPATCH_KIND=step)" }] },
      { "matcher": "Edit|Write", "hooks": [{ "type": "command", "command": "node <guard-lane>" }] }
    ]
  }
}
```

### Gate schedule: splitting a card never multiplies the heavy checks

Operator direction, 2026-09-22. A planned build runs the expensive checks the same number of times as a
single-worker build: once, on the item lane. The schedule is a checked-in table in `we:scripts/lib/plan-policy.json`,
owned by the plan runner, never chosen by a step.

| When | Runs | Never runs |
| --- | --- | --- |
| per step, in its step lane | the step's related tests only, and only when the step is `acceptanceTestable`; executors get `--gate=none` | the full test suite, `check:standards`, `verify-lane`, converge |
| per step, on apply | the runner's mechanical checks: `git apply --3way`, the file list, the size overrun | any test run |
| per batch, after commit | nothing | — |
| once per build, on the item lane | today's gate (`runGateWithOneRetry`), converge, `verify-lane`, PR open | — |

- **Enforced, not advised.** A Claude step runs with a new `WE_DISPATCH_KIND=step`, and `we:scripts/guard-bash.mjs`
  refuses the "never runs" column for it, extending the existing `dispatchKind === 'delivery'` deny table. Gemini
  and Codex steps get the schedule through `--gate=none` and their brief.
- **Dependencies.** Step lanes keep their installed deps. The runner installs only when the item lane's lockfile
  differs from the step lane's (the pool's existing `ensureDeps` check).
- **A red build gate** becomes one `rework` step planned by the planner, then the build gate runs once more. It
  does not re-run every step's checks.
- Accepted cost: a step can pass its related tests and still break something the full gate catches. That is found
  at the build gate, once, which is where a single-worker build finds it today.

### Settings

Checked into `we:scripts/lib/plan-policy.json`, next to `we:scripts/lib/dispatch-size-policy.json`:
- `planBuild: off | shadow | on`, default **`shadow`**. In shadow mode the planner writes a plan and the routes are
  recorded, but the single worker builds as today, so plans can be judged before any step runs. `on` takes a
  ratified settings change.
- The planner's size split (Fork 6, default 8), `maxParallel` (default 2), `maxRounds` (default 3), the overrun
  factor (default 1.5).
- A time budget for the planned steps (default 60 minutes), and a separate one for the fallback worker (default 60
  minutes, today's single-agent limit).
- Fork 4's `explorationPerDay` and candidate table.
- The gate schedule and each step kind's pre-approved operation list.

These are values, changed by a ratified settings change. The only behaviour switch, `planBuild`, starts at
`shadow`, because `on` changes what every build does. That mirrors rule 6: lighter checking and wider scope need
an explicit act.

### Probation: the ruling is provisional and re-checked from its own records

Operator direction, 2026-09-22: this will need ironing out, so the system must re-check the ruling over time
instead of treating it as settled. The planner build ships **on probation**, the way a new model does
(`#model-probation-graduation-criteria`), but for a design instead of a model.

- **Every build already leaves the evidence.** The step records this card requires hold, per build: planned
  versus actual files (`request-scope` grants), overruns, rework counts by cause, checker verdicts and misses, PR
  panel findings, time and cost, and how many steps were delegated.
- **Shadow mode sets the baseline.** While `planBuild` is `shadow`, the single worker still builds, so each card
  has a plan and a real result side by side. That gives the numbers probation compares against: single-worker
  time and cost, and how well plans predicted the files actually changed.
- **Tripwires are scripted; the verdict is judgment.** A mechanical check in the conveyor compares each week's
  numbers with the baseline. When one crosses its line it files a review card. It never switches anything off by
  itself. Starting lines, all settings: cost per card more than 30% above baseline over 10 builds; rework above
  one step in three; any checker miss; plans missing files on more than half the cards.
- **A dated review regardless.** The ruling carries a review date, 30 days after `planBuild` goes `on`. On that
  date the watch runs (the standing-program pattern, `/review-program`): read the records, re-check each fork
  against them, and either confirm, change a setting, or reopen a fork.
- **What each kind of change takes.** A setting (caps, sizes, the planner split) changes by a ratified settings
  change. A design fork (1, 2, 3, 5) changes only by reopening this decision with the records as evidence.
- **Exit from probation** is the operator's explicit act at a review, like every promotion (rule 6).
- **This should be one general system, not a one-off** (operator, 2026-09-22). Probation already exists for
  models (`we:scripts/lib/model-probation.mjs`: `unvalidated` → `probation` → `trusted`, promotion always an
  explicit human act). Child 10 decides generalising it to any new system or ruling: one registry entry per subject
  (its metrics source, baseline, tripwires, review date, exit criteria), one scheduled watcher that runs every
  entry's tripwires and files review cards, and one review routine. The planner build is its first subject. The
  lines above are that entry's starting values. Until child 10 is built, child 7c records the metrics and the
  review date is tracked on this card.

## Fork 1 — Who runs the plan

*Fork-existence:* (b) is excluded, not merely dispreferred. A model would pick which models do the work, the
routed-versus-executed record would lose its meaning, and it would escape the mechanical routing path that
`#delegation-trial-record-graduation` binds. #3383 tracker item 6 measured that "you may delegate" advice produced
0 delegations in about 12 workers. #3717's acceptance test is supporting context only. It was written for one
dispatch, and every planner branch puts some model judgment (the plan itself) upstream of routing.

- **(a) The build wrapper runs the plan — recommended.** `deliverItem` asks the planner for a plan and validates it
  with `planFromSupervisorOutput`. It then routes each ready step through `decideDispatchRoute`, runs it, collects
  the result, and asks the checker for a verdict where Fork 5 requires one. The orchestration is code. The planner
  and the checker only write JSON that is checked against a schema.
- **(b) The planner agent orchestrates** by spawning its own subagents. Rejected (above).
- **(c) A conveyor-level split into several lane jobs with their own PRs.** That is child-card delivery, and it
  belongs to #3575 Fork 5, not to this card.

Occurrences: LLMCompiler's task-fetching unit, Magentic-One's orchestrator loop, and the cloud agents Codex, Jules
and the Copilot coding agent, which run the loop in the harness, not in the model.

```js
// Fork 1 (a) — the wrapper's plan loop (built pieces cited; NEW pieces marked)
const planner = routeDispatch(profile, { stage: 'story', kind: 'build', role: 'plan', scorecards });   // built :447; NEW role split (Fork 5)
const { ok, plan } = planFromSupervisorOutput(await invokeRole(planner, { phase: 'plan', story }), { supervisor: planner }); // NEW invoke; built :53-62
if (!ok) return singleWorkerFallback(itemLane);                                                         // today's path
for (const batch of readyBatches(plan, settings.maxParallel)) {                                         // NEW: dependsOn walk
  const results = await Promise.all(batch.map((t) => runStep(t, routeStep(t))));                         // Fork 2 / Fork 3
  await applyInOrder(itemLane, results);                                                                 // Fork 2
}
```

**Skeptic (prepared version):** SURVIVES-WITH-AMENDMENT → applied. The four single-agent seams are listed and
handled, and the exclusion rests on the mechanical-routing statute. Round 2 added the occupant rule and a separate
time budget for the fallback worker. **Screen:** clear.

## Fork 2 — Where a step works, and how its result joins the card

*Fork-existence:* (c) is excluded. Parallel agents in the item lane's own working tree share the git index, the
verify marker and untracked files, and a step's file list is the planner's claim, not a guarantee. Running steps
one at a time is not a rival design: it is (a) with `maxParallel: 1`.

- **(a) Each step works in its own leased lane; its diff lands only after it is accepted — recommended.**
  1. **The item lane is home.** The card gets one lane, as today. Only accepted work lands there, and the PR opens
     from it.
  2. **Each step gets a step lane from the shared pool,** leased with `purpose: plan-step` and the parent item.
     That marker keeps lane tools that assume every lane is an item lane (`/finish`, the stale-claim sweeps, the
     health-stall scan) from taking a step lane over. The step lane starts at the item lane's latest commit,
     fetched locally from the item lane's folder, with no push. `acquire --base=<ref>` takes only a pushed ref
     today, so it gains a local-source form. Executors run with `--dir=<step lane>`; nothing clones into a temp
     folder.
  3. **The step's model works there** (Gemini, Codex or Claude) and never commits. The runner takes its diff with
     `--binary`, so binary changes can be applied.
  4. **The runner tries the diff on the item lane without committing:** `git apply --3way` into a temporary index
     (`GIT_INDEX_FILE`). An apply conflict, a file outside the step's list, or a diff above its size estimate times
     the overrun factor sends the step back as `rework`.
  5. **The checker looks at the applied result** where Fork 5 asks for it. On `accept` the runner commits it to the
     item lane. On `rework` or `reject` the item lane is untouched, so there is nothing to undo.
  6. **Steps with no dependency between them run side by side,** each in its own step lane, up to `maxParallel`,
     **but only when their file lists do not overlap.** Steps sharing a file run one after the other. Because the
     apply check refuses any change outside a step's list, two parallel steps never edit the same file, so a clean
     apply can never hide a merged-but-wrong edit inside one file (skeptic, ratify round). A clash across different
     files is caught by the build gate, as it is for any two changes today. Results are applied one at a time in
     dependency order, and the next batch starts only after the previous one is committed, because a step lane
     starts from the item lane's committed tip.
  7. **When a step finishes,** its lane is released, reset, and keeps its installed deps.
  - **Why the shared pool, not a separate one** (operator, 2026-09-22): the lane count is a soft limit that costs
    disk, and `provision --acquirable` grows the pool. A separate pool would add setup and a `--pool` flag to every
    lane command for no gain the marker does not already give.
  - **CPU is limited by the existing ceilings, not by lanes.** A step session counts toward the lane-dispatch
    ceiling, because it is a running session. So a build never waits on itself, the build's own slot always covers
    one running step, and each extra parallel step needs a free slot or waits. The build-level heavy checks stay
    under heavy-command admission as today.
  - **Claude steps can run in parallel from the start.** They launch with their own settings file (see *How a step
    session runs*), so a step lane's trust flag does not matter.
  - This avoids everything a worktree inside the lane would hit: the lane guard, the global deny on
    `git worktree add`, a nested checkout polluting the lane's tests, and leftovers after a crash.
  - **Residual risk, narrowed:** agy can write outside its folder, which the diff check cannot see. Until a
    container (#3621) closes it, the launch function checks every constellation checkout (the primary, the item
    lane, other leased lanes) for changes before and after each Gemini step, and fails the step and flags it if any
    changed. That is detection, not prevention. Writes outside those checkouts (the home folder, other repos) stay
    the named, accepted risk of `gemini-direct-task`, now at conveyor volume rather than by hand. The skeptic's
    round 2 held this NOT-CLOSED; the operator accepted it at ratification rather than hold Gemini back until #3621.
    A detected change trips probation review at once.
- **(c) Parallel steps in the item lane's working tree.** Rejected (above).

Occurrences: the practitioner rule of one isolated checkout per agent, and the per-task containers in Codex, Jules
and the Copilot coding agent, where conflicts are handled at an explicit merge.

```js
// Fork 2 (a) — run in a step lane, apply to the item lane, commit only after accept (NEW: we:scripts/operations/plan-runner.mjs)
const stepLane = await acquireStepLane({ item, from: itemLane });                               // NEW: shared pool, purpose plan-step, local base
const { diff } = await launchStep(step, route, { dir: stepLane });                             // NEW: the one launch function; never commits
const staged = await gitApply3wayToTempIndex(itemLane, diff);                                  // NEW: git apply --3way on a temp GIT_INDEX_FILE
if (!staged.ok || outside(staged.files, step.profile.filesTouched)) return { verdict: 'rework', findings: [staged.reason] };
const v = await invokeRole(checker, { phase: 'verdict', results: [staged] });                 // Fork 5, on the diff as applied
if (v.verdict === 'accept') await commitStaged(itemLane, staged, step);                        // commit only after accept
```

**Skeptic (prepared version):** REFUTED in the first draft → rewritten (worktrees inside the lane and
cherry-picked commits could not work), then round 2 moved the verdict before the commit and added `--binary`. The
step-lane design above replaces the prepared version's temp clones; it has not been through a skeptic pass yet.

## Fork 3 — Where a step's task type comes from

*Fork-existence:* a real either/or. The type decides which triple's trust a step borrows, and a step has one type.
Both branches work mechanically. They differ in whose judgment sets the route.

- **(a) Derived mechanically from why the step exists, then from its files — recommended** (restated at discussion,
  2026-09-22: files alone cannot tell a repair from new work). The runner knows why each step exists, so the type
  never needs the planner's word. The planner declares only files, size, `acceptanceTestable` and risk.

  | Why the step exists | Type |
  | --- | --- |
  | a planned step, every file a doc | `doc-fix` |
  | a planned step, any other file | `build-new-feature` |
  | a rework because its diff clashed with an accepted step on apply | `conflict-resolution` |
  | a step made because checks fail on already-accepted work (the build gate, or a later step's related tests) | `bugfix` (repairs code already written, the rule `fix` and `ci-heal` use) |
  | any other rework (out-of-list file, overrun, checker's `rework`) | the step's original type |

  This extends `taskTypeFor`'s existing shape, where the cause is checked first and the files second
  (`we:scripts/lib/dispatch-task-type.mjs:141-182`).
  - **The doc test is tightened** (discussion, 2026-09-22). Today a path is a doc when it ends in `.md`, `.mdx`,
    `.markdown` or `.txt`, or sits under `docs/` (`we:scripts/lib/dispatch-task-type.mjs:99-101`). In this repo
    many `.md` files steer agents or work, not readers (`we:AGENTS.md`, `we:CLAUDE.md`, skill files,
    `we:agent-memory-src/`, `we:.claude/`, `we:backlog/`). So the test becomes an **allowlist** of reader-facing
    doc places: doc-type files under `docs/` (outside `docs/agent/`, which is statute and goes to Opus anyway) and
    `README` files. Everything else is code, so a new instruction file is never misread as a doc (skeptic, ratify
    round: a denylist would decay).
  - **Files decide doc versus code; they cannot show a conflict repair.** That comes from the cause, as today.
  - This is what the statute's trust unit requires. "Trust never carries across triples", and a code step
    labelled `bugfix` or `conflict-resolution` would borrow trust earned on different work.
  - An overrun is handled after the step runs (Fork 2 step 4). The overrun is recorded on the **planner's** plan
    record, never on the executor's trial.
  - The 1.5 factor is a starting setting, to be adjusted from measured step diffs.
  - The overrun record is **informational only** for now. `routingRecords` keeps a fixed list of keys
    (`we:scripts/lib/dispatch-contracts.mjs:433`), so no router reads it. Grading planners by it would be a
    follow-up.
  - `decideDispatchRoute` ignores a passed `sizeSource` and sets `'card'` itself (`:1070`), so child 1 makes it
    honour `'plan'`.
- **(b) Declared by the planner from the enum, and checked against the files.** More steps would route to triples
  that already have trials (Codex `bugfix`, Flash `conflict-resolution`), so delegation would start sooner. But a
  checker can only catch doc-versus-code, and every other label is the planner's choice, which the router would
  then trust.

```js
// Fork 3 (a) — built derivation, NEW post-run check
const { taskType } = taskTypeFor({ kind: 'build', scopePaths: step.profile.filesTouched });    // we:scripts/lib/dispatch-task-type.mjs:141
const route = decideDispatchRoute({ kind: 'build', scopePaths: step.profile.filesTouched, estimatedLoc: step.profile.estimatedLoc, sizeSource: 'plan' }, { scorecards });
if (overran(applied, step.profile, settings.overrunFactor)) plan.calibration.push({ stepId: step.id, overrun: applied.stats }); // planner's record, not the executor's trial
```

**Skeptic (prepared version):** REFUTED in the first draft → rewritten. Recording an overrun on the executor's
triple would permanently exclude it from routing, so the overrun moved to the planner's record. Round 2 said it
survives. **Screen:** clear.

## Fork 4 — How a cheap model earns its first build-step trials

*Fork-existence:* a real either/or about what evidence a planned build produces. Under Fork 3 (a), no non-Claude
triple has a `build-new-feature` trial. `selectProvider` needs at least one verified, clean, **landed** trial
before it will route to a triple (`we:scripts/lib/provider-routing.mjs:257-260`, `:361-373`). So without a
trial path nothing is ever delegated. (c) is coherent. It just leaves delegation where it is today.

*What the router lacks today:* its cascade (Gemini, then Codex, then both, then Claude) routes to a model only after
that model already has a clean trial for the task type. Even the "both" branch needs existing trials. Nothing
produces the **first** trial. Once one exists, the cascade already sends every matching in-envelope step to that
model with no new code. So exploration only has to seed a few trials.

- **(b) Exploration, as one rule in the router — recommended** (restated at discussion, 2026-09-22).
  1. **The rule:** when a task type has no qualifying non-Claude model, a step that is low-risk,
     `acceptanceTestable`, not statute-tier and inside the proven envelope goes to the next model on a checked-in,
     ordered **candidate table**, up to a cap. It applies at the task stage, so it covers every step, whether the
     card has one step or many (Fork 6).
  2. **The cap:** `explorationPerDay` (default 3) per task type, counted **fleet-wide** in one shared record, not
     per build, so many concurrent builds cannot each spend their own budget (skeptic, ratify round). The
     check-and-increment is one atomic step under a lock, so two builds cannot both take the last slot. It stops once a
     model qualifies. After that the existing cascade takes over.
  3. The table starts as Gemini Flash (`antigravity`), then Codex (`codex/gpt-6-astra`): the operator's "favour
     Gemini", written as the explicit ordered table #3383 tracker item 6's caution (a) asks for. The router's
     `getExplorationHint` reads a ratings registry that is empty today, so it can't serve.
  4. The step runs in its step lane (Fork 2) and gets the checker's verdict on the diff as applied (Fork 5). It
     lands in the item lane only on `accept`.
  5. Any exploration step parks the PR `review:pending` (Fork 5). #3850's review panel is then the independent
     reviewer.
  6. `makeTrial` takes `verifiedBy` only from an independent PR review
     (`we:scripts/lib/dispatch-contracts.mjs:662-700`), so the row is an ordinary trial:
     - `outcome: 'landed'` is honest;
     - `verifiedBy` comes from the panel;
     - `informative` is reachable when the panel's finding is fixed.
  7. Exploration steps count toward `maxParallel`.
  - This needs no statute change. It is the same path every marker-driven Codex build already takes under #3850.
  - **Watch:** the cascade trusts after one clean trial. Safety after that comes from the checker, the PR panel and
    the hard veto on a miss. That is existing router behaviour, not added here.
  - Occurrences: FrugalGPT's cascade tries the cheap model first and escalates on failure. RouteLLM found routers
    near random on kinds of work they had no labelled examples for.
- **(a) A concurrent baseline: the target, not today's default.** Claude's diff lands. The candidate runs the same
  step, and the difference is judged. The statute calls this "the preferred evidence shape over raising N"
  (rule 3), and it risks nothing on the main line. It is blocked today:
  - Its diff never lands, so it cannot be a clean trial without a rule-1 amendment to
    `#delegation-trial-record-graduation`.
  - No independent reviewer sees it.
  - `routingRecords` would drop its fields (`:433`).
  - #3783 already owns the baseline harness and its row shape.

  So (a) is the target once #3783 lands **and** the statute is amended. It is recorded here as that follow-up,
  `blockedBy` #3783.
- **(c) No trials inside planned builds.** Trials come only from manual delegation and `deliveryAgent:` markers,
  as today. Delegation stays near zero.

**Skeptic (prepared version):** REFUTED (a) in round 2 → flipped to (b). A baseline row can satisfy neither
routing fitness (it never lands) nor the supervision bar (no independent review). (b) works under today's code and
statute; it is exactly #3850's ratified path for marker-driven Codex builds. **Screen:** clear.

## Fork 5 — Who checks each step before the build moves on

*Fork-existence:* a real merit choice. (b) is not broken. #3850 Fork 1 (a) records the PR review panel as the
supervisor, which clears `supervisionHold`, and a planned build still opens one PR. The difference is **when**
problems are caught.

- **(a) A separate checker gives a verdict on every step a non-Claude model built — recommended.**
  - **Which steps.** Every step whose executed vendor is not Claude, and every Fork 4 baseline once it exists, gets
    `accept`/`rework`/`reject` on the diff as applied. That satisfies rule 7: the orchestrator reads the real diff.
    Claude steps get none (below). Under Fork 4's cap that is at most a few checked steps a day per task type until a model qualifies.
  - **The planner and the checker are two roles,** `plan` and `supervise`, each with its own ladder and its own
    trust record. Today one role does both (FOUND), which would let a model that earns trust at checking diffs
    become the planner. Trust never carries between the two, the same rule the statute applies across task types.
  - **Planner: Sonnet below size 8, Opus at 8 and up** or when high-risk or statute-tier (Fork 6).
  - **Checker: Sonnet by default, moved up only on evidence** (operator, 2026-09-22: data, not a feel).
    `claude-sonnet-5` is the checker ladder's no-data rung and acts from day one. There is no fixed "high-risk →
    Opus" rule. The one fixed exception is the one the code already has: statute-tier paths and
    `architectural-decision` go to Opus (`hard`, `we:scripts/lib/dispatch-contracts.mjs:615`).
  - **The evidence is the PR panel's review of the same diff.** When the panel finds a real defect in a step the
    checker accepted, that is a checker miss on its `{model, taskType, risk}` cell. A miss moves that cell's
    checker one rung up (Sonnet → Opus), under the statute's hard-veto rule. The step's risk picks the cell; the
    data picks the model.
  - **Moving back down is recorded, then ruled.** A raised cell shows its clean panel reviews since the miss on the
    probation record. Moving it back to Sonnet is lighter checking, so it is the operator's explicit act at a
    review (rule 6), offered once the cell has 5 clean reviews in a row (skeptic, ratify round: no one-way ratchet).
  - **Only the planner replans.** The checker returns a verdict with findings. Its `newTasks` is refused, and any
    replanning goes back to the planner.
  - **The PR parks `review:pending`** if any step's executed vendor is not Claude. #3850's panel then reviews the
    whole diff once. So a Sonnet verdict is never the last line.
  - Early `rework` saves a whole-PR round trip and can trigger replanning, the per-step feedback that Magentic-One's
    progress ledger and Devin's failure analysis argue for.
- **(b) The PR panel only.** Cheaper, but a bad delegated step is found only after every step has run. It is then
  fixed by a whole-card round trip, with no step-level replanning.

**Why Claude steps get no per-step verdict,** argued on merit (#3850 Fork 2 (a) ruled it for single-worker lanes,
supporting context only here):
- A Claude step is the native path every build takes today, and Sonnet is the default builder, so a check would
  mostly be Sonnet re-reading Sonnet.
- Its diff is reviewed as part of the whole PR under the existing escalation rubric.
- A per-step verdict on it would add cost and catch nothing the panel does not already see.

Who fills `verifiedBy`: under Fork 4 (b), the PR panel, because an exploration step parks the PR. Under Fork 4 (a),
once it is unblocked, #3783's harness and the statute amendment say. Under Fork 4 (c), nothing new.

**Skeptic (prepared version):** REFUTED in the first draft → rewritten as a merit fork bound to delegated steps
only, with the PR-level parking rule. The two-role split and the evidence-driven checker were added at discussion
and have not been through a skeptic pass yet.

## Fork 6 — Which builds get planned

*Fork-existence:* a real merit choice about what a plan is for. If it is only for splitting work, small cards skip
it. If it is also how work is seen, every card needs one.

- **(b) Every build gets a plan; a small card's plan has one or a few steps — recommended** (operator, 2026-09-22).
  - **Visibility.** A build without steps is opaque: the Plateau WIP dashboard can only show "running". With steps,
    it shows each step's live state (planned, running, checking, accepted, rework). A one-step plan still gives
    that.
  - **Small cards benefit too.** A size-3 card with a code change and a doc change becomes two steps, which can run
    side by side or go to different models.
  - **The planner's model follows the card's size, so small cards stay cheap.** Sonnet plans cards below size 8;
    Opus plans size 8 and up, and anything high-risk or statute-tier. That uses the size field every card already
    carries, not a judgment call. Like the checker (Fork 5), a planner cell moves up when its plans are measured to
    go wrong: a plan whose steps needed `request-scope` grants or overran, recorded on the planner's record.
  - **No planner call when a plan can only be one step.** A card whose scope is a single file gets a one-step plan
    built by code, with no model call. It still shows as a live step (skeptic, ratify round).
  - `planMinSize` goes away. The `deliveryAgent:` marker still skips planning (Fork 7).
- **(a) Only size 8 and up.** Cheaper, since small cards skip the planner call. But small cards stay opaque on the
  dashboard, and their parts never run apart.

**Known cost, stated:** until cheap models have trust, a planned build costs somewhat more than one worker (a plan
call, then the steps). The savings arrive as delegation grows. `planBuild: shadow` means no step runs until the
operator switches it on; in shadow mode the plan still exists, so the dashboard can show the plan beside the single
worker.

**Skeptic (prepared version):** the prepared default was (a) at 8. It was flipped at discussion for visibility and
has not been through a skeptic pass yet.

## Fork 7 — What a `deliveryAgent:` marker means under a planner build

*Fork-existence:* a real either/or. #3801's ruling on Fork 5 left this open in so many words: "Carried, not ruled:
what the marker means under a planner build".

- **(a) That vendor builds the whole card as one worker, and no plan runs — recommended.** This keeps the meaning
  24 marked cards on `main` already carry, and keeps their trials on the triple they name. The routing record
  shows `planned: false` with the reason `delivery-agent-marker`.
  - Confirmed at discussion (2026-09-22): the marker is the hand override, so it skips the plan. Accepted cost:
    a marked card shows no live steps on the dashboard, only the single worker's state.
- **(b) The marker pins the planner.**
- **(c) The marker pins every step's agent.** That would force one vendor across steps the router would split,
  and mix the marker's trials with the step trials.

**Skeptic (prepared version):** SURVIVES-WITH-AMENDMENT → applied: presented as a real fork, (a) kept on its
merits. **Screen:** clear.

## Build after the ruling (prototype, graduates through #3443)

Predicted touch-set (#2619):
- `we:scripts/operations/deliver-item-wrapper.mjs`
- `we:scripts/operations/plan-runner.mjs` (new), plus its `-io` module
- `we:scripts/operations/supervisor-invoke.mjs` (new)
- `we:scripts/lib/dispatch-supervisor-contract.mjs`
- `we:scripts/lib/dispatch-contracts.mjs`
- `we:scripts/lane-pool.mjs`
- `we:scripts/guard-bash.mjs`
- `we:scripts/operations/run.mjs` and the new in-lane operations
- `we:scripts/conveyor/run-quality-record.mjs`
- `we:scripts/lib/plan-policy.json` (new)
- their tests

Children to carve at the ruling, in build order:
1. **Schema and routing inputs** (Fork 3, the tightened doc test, `sizeSource: 'plan'` honoured by
   `decideDispatchRoute`, `raiseRisk`). Scope: `we:scripts/lib/dispatch-supervisor-contract.mjs`,
   `we:scripts/lib/dispatch-contracts.mjs`, `we:scripts/lib/dispatch-task-type.mjs`.
2. **The planner and checker roles** (Fork 5): split `plan` from `supervise` with their own ladders and records,
   Sonnet as the checker's no-data rung, the checker-miss record, and the plan and verdict calls through
   `SUPERVISOR_INVOCATIONS` (verifying the two flags marked UNVERIFIED there). Scope:
   `we:scripts/lib/dispatch-contracts.mjs`, `we:scripts/operations/supervisor-invoke.mjs`.
3. **The plan runner in `shadow` mode:** plan, record routes, then the single worker. Scope:
   `we:scripts/operations/plan-runner.mjs`, `we:scripts/operations/deliver-item-wrapper.mjs`.
4. **Step lanes** (Fork 2): the `plan-step` lease marker, the local-source base, the lane tools skipping
   `plan-step` leases, and step sessions counted under the lane-dispatch ceiling. Scope: `we:scripts/lane-pool.mjs`,
   `we:scripts/lib/lane-concurrency.mjs`.
5. **Step operations and permissions:** the first in-lane operations (at least `test-related`), `request-run` and
   `request-scope`, the per-step settings file, and the `step` deny table in the Bash guard (the gate schedule).
   Scope: `we:scripts/operations/run.mjs`, `we:scripts/guard-bash.mjs`, `we:scripts/lib/plan-policy.json`.
6. **Step execution with verdict-before-commit** (Forks 2 and 5): the one launch function, `--dir` into the step
   lane, `--binary` diff capture, apply to a temporary index, commit after `accept`, and the request and resume
   loop. `blockedBy` 3, 4 and 5. Scope: `we:scripts/operations/plan-runner.mjs`, `we:scripts/codex-direct-task.mjs`,
   `we:scripts/gemini-direct-task.mjs`. Acceptance includes one real headless Sonnet step end to end in a pool lane
   under its settings file, with the file rule and the operation list each refusing what they should.
7. **Exploration in the router** (Fork 4 (b)): the one rule, the candidate table, `explorationPerDay`, and a
   routing record with `executed ≠ routed`. Scope: `we:scripts/lib/provider-routing.mjs`,
   `we:scripts/lib/dispatch-contracts.mjs`, `we:scripts/lib/plan-policy.json`,
   `we:scripts/conveyor/run-quality-record.mjs`.
7b. **Live step status** (Fork 6): the plan runner writes each step's state (planned, running, checking, accepted,
   rework) to a record, and the Plateau WIP dashboard shows it per card. Two children: the record in WE (scope
   `we:scripts/operations/plan-runner.mjs`), and the dashboard view in Plateau (locus `plateau-app`).
7c. **The planner build's probation metrics:** the per-build record the tripwires read, and its probation entry
   (baseline, tripwires, review date) in the shape child 10 rules. Scope:
   `we:scripts/conveyor/run-quality-record.mjs`, `we:scripts/lib/plan-policy.json`.
8. **Later:** the concurrent baseline (Fork 4 (a)), `blockedBy` #3783 plus the rule-1 statute amendment.
9. **Decision (follow-up): permission profiles for all agent work.** Amend `#agent-mutations-through-typed-operations`
   so every agent session, not only a plan step, runs under a profile chosen by its kind of work. The default is
   scoped: reserved files, declared operations only, and `request-run` and `request-scope` handled by the wrapper.
   Some kinds get a wider profile, for example an unscoped investigation that may read or edit any file. The
   decision rules the profile list, which work gets which, and who may widen a profile. It must weigh the
   statute's measurement that 72.2% of agent commands are reads with no comparable risk.
10. **Decision (follow-up): one probation system for any new system or ruling.** Generalise model probation
   (`we:scripts/lib/model-probation.mjs`, `#model-probation-graduation-criteria`) from models to any subject: a
   registry entry per subject (metrics source, baseline, tripwires, review date, exit criteria), one scheduled
   watcher that runs every entry's tripwires and files review cards (never switching anything off itself), and one
   review routine. Exit stays an explicit operator act. The planner build is the first subject.

## Not in this decision

- Splitting a card into separately landing pieces, and each card's delivery strategy: #3575 Fork 5.
- #3575 Forks 1 to 3: their integration premise is stale, so re-prepare them against Fork 2 here.
- Promoting any triple to `spot-check`: #3784.
- `dispatch-task`'s kind vocabulary: #3730. The single-worker model table: #3857.
- Containers around a step's process (CPU and memory caps, file and network limits): #3621. A container would
  mount the step lane; this card only requires the one launch function it would wrap.
- Permission profiles for agent work beyond plan steps: child 9. Plan steps adopt the strict profile now; they are
  new, and a stricter setup does not conflict with the statute's floor.
- #3748 (background workers stalling in untrusted checkouts): FOUND's probe suggests the same fix, passing
  `--settings` at launch. Noted here; #3748 rules its own fix.

## Ruling

Ratified 2026-09-23 by the operator at an interactive review (session decision-3922), with the discussion's
amendments and two independent skeptic rounds folded in. Codified as
`we:docs/agent/platform-decisions.md#planner-build-plan-and-execute`.

- **Fork 1 — (a).** The build wrapper runs the plan in code.
- **Fork 2 — (a), amended.** Each step works in its own lane leased from the shared pool (`purpose: plan-step`),
  started from the item lane's tip; its diff lands only after it is accepted, in dependency order. Parallel steps
  only with non-overlapping file lists (skeptic round 1 REFUTED the unguarded 3-way apply; closed in round 2).
  Gemini steps get a before/after check of every constellation checkout; writes outside them stay an accepted
  residual until #3621 (skeptic round 2 held this open; accepted).
- **Fork 3 — (a), restated.** Type from why the step exists, then from its files; doc test is an allowlist.
- **Fork 4 — (b), restated.** Exploration as one router rule, capped `explorationPerDay` (3) per task type,
  counted fleet-wide under a lock.
- **Fork 5 — (a), amended.** Separate planner and checker roles; Sonnet checker moved up on recorded misses;
  moving back down is the operator's act, offered after 5 clean reviews.
- **Fork 6 — (b), flipped from the prepared (a).** Every build gets a plan, for live visibility; single-file cards
  get a code-built one-step plan; planner model by card size.
- **Fork 7 — (a).** The `deliveryAgent:` marker is the hand override: no plan.
- **Also ruled:** step permissions and wrapper-run requests, the gate schedule, and probation with scripted
  tripwires and a 30-day review after `planBuild: on`.

Children filed (all `parent: 3383`):
1. `3996` — plan schema and routing inputs.
2. `4003` — separate planner and checker roles.
3. `4004` — plan runner in shadow mode (`blockedBy` 1, 2).
4. `4001` — step lanes from the shared pool.
5. `3994` — step operations and permissions.
6. `4008` — step execution with verdict-before-commit (`blockedBy` 3, 4, 5).
7. `3997` — exploration as one router rule (`blockedBy` 1).
8. `4006` — live step status record (`blockedBy` 3); `4007` — the Plateau WIP dashboard view (`blockedBy` it).
9. `4011` — probation metrics and entry (`blockedBy` 3 and the probation decision).
10. `4009` — later: concurrent-baseline trials (`blockedBy` #3783, 6).
11. `3993` — decision: permission profiles for all agent work.
12. `4010` — decision: one probation system for any new system or ruling.

## Done when

1. **Executable** — `grep -l '^## Ruling' we:backlog/3922-*.md` lists this card. It fails until the operator has
   reviewed it and a `## Ruling` section names the outcome of each of Forks 1 to 7.
2. The ruling names the children to carve, with their scopes, and files children 1 to 10.

### Review jury (provisional — pre-registered #2638)

Care level: `elevated`. This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |
