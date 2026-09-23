---
bornAs: xxxraos
kind: decision
parent: "3383"
status: open
relatedTo: ["3575", "3801", "3717", "3730", "3857", "3784", "3850", "3690", "3783"]
relatedReport: reports/2026-09-22-planner-build-g2-prep.md
scope: ["we:scripts/lib/dispatch-contracts.mjs", "we:scripts/lib/provider-routing.mjs", "we:scripts/operations/dispatch-task.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/deliver-item-wrapper.mjs"]
dateOpened: "2026-09-22"
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
exist only on the prototype branch, so their `we:` cites resolve there. Two skeptic rounds (Opus) and two fresh-context screens ran on it; the
body is the version that survived them.*

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
- **In practice the planner is always Opus today.** `selectSupervisor` climbs a ladder of candidates. Every rung
  except the last needs `role: 'supervise'` trials, and there are none, so every build falls through to
  `claude-opus-5` (`:614-623`). A cheaper rung only runs as a *shadow* next to it (`:626-627`). Shadow rows alone
  cannot promote it (see Supported by default).
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
- **The executors already isolate each step.** `we:scripts/gemini-direct-task.mjs` and
  `we:scripts/codex-direct-task.mjs` both default to a fresh scratch clone of the committed tip, outside `.lanes/`.
  They **never commit**; each hands back a diff.
  - agy's own file tools can write outside the target folder, so a Gemini run is not confined
    (`we:scripts/gemini-direct-task.mjs:18-26`).
  - `EXECUTOR_PROVIDERS` (`we:scripts/lib/dispatch-contracts.mjs:46-50`) maps each executor to the providers it
    may claim.
- **Today's build is one blocking worker.** `deliverItem` (`we:scripts/operations/deliver-item-wrapper.mjs:284-449`)
  acquires the lane, claims the item, runs **one** agent turn (`runAgentToCompletion`, `:337`), then runs the
  gate, converge, the park-mode choice and the PR. Four places are tied to that single agent:
  - The lane lease names that agent's session as occupant (`:307`).
  - The gate's one retry resumes that same session (`:376`, `:1089` onward).
  - The park-mode choice reads that agent's own report (`:396`).
  - A mid-build block releases the claim and the lane (`:357-363`), which throws away work already done.
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
| 2: isolating parallel steps | **(a) delegated steps in their executor's own scratch clone, Claude steps one at a time in the lane; the wrapper applies each diff only after its verdict, in dependency order** | (c) parallel agents in the lane's working tree (excluded: shared index and files) |
| 3: a step's task type | **(a) derived from the step's files** | (b) declared by the planner from the enum, checked against the files |
| 4: how a cheap model earns build-step trials | **(b) exploration: a capped number of low-risk steps go to the next candidate on an ordered table, land after the supervisor accepts, and the PR panel verifies** | (a) a concurrent baseline (the target, once #3783 and a statute amendment exist); (c) no in-build trials |
| 5: checking each step | **(a) a supervisor verdict on every delegated or baseline step; the PR parks for review if any step was delegated** | (b) the PR panel only, as #3850 rules for a single worker |
| 6: which builds get planned | **(a) sized cards at or above `planMinSize`, default 8** | (b) every build |
| 7: the `deliveryAgent:` marker | **(a) that vendor builds the whole card as one worker; no plan runs** | (b) the marker pins the planner; (c) it pins every step |

## Settled by statute or earlier rulings — not forks

- **A step is an agent task, or a typed declared operation, never a command string.**
  `#agent-mutations-through-typed-operations` already rules that operation parameters are strictly typed. It
  rejects a `run(script, args)` that passes strings to a shell. So a plan step that "runs a script" names a
  declared operation, and its input is typed by that operation's own declared input schema.
  - No in-lane operation exists today, so **the operation-step schema is deferred.** It is filed as a follow-up
    when the first in-lane operation exists.
  - Until then, every step is an agent step.
- **Routing stays the router's.** Each agent step is routed by `decideDispatchRoute` at the task stage, and "favour
  Gemini" is its existing cascade order. The router picks Flash for a task type only once Flash's trials qualify.
  Promotion to `spot-check` stays #3784's ratified act.
  - The one exception is a Fork 4 exploration step. Its candidate comes from an ordered table, not the cascade.
  - Its routing record keeps the router's `routed` (Claude), sets `executed` to the candidate, and marks
    `exploration: true`. So the router's own choice is never overwritten (#3848).

## Supported by default — not forks

- **The planner is the built `build-supervisor`.** At the story stage, `selectSupervisor`'s ladder picks it. Today
  that is Opus, with a cheaper rung running as a shadow. No new selection code is needed.
  - The shadow rows are evidence only.
  - A cheaper planner rung becomes the acting planner only through the ladder's own `spot-check` bar and #3784's
    ratified promotion. It never moves by shadow runs alone.
- **The plan format is the built `PLAN_OUTPUT_SCHEMA`,** with two changes:
  - Fork 3 removes the planner's `taskType`.
  - The profile's `risk` passes through the existing raise-only `raiseRisk` (`we:scripts/lib/dispatch-contracts.mjs:148`).
  The planner may return a one-step plan.
- **A step's size is recorded as coming from the plan.** Its `estimatedLoc` is passed to `decideDispatchRoute`
  with a new `sizeSource: 'plan'`. Today any passed estimate is recorded as `'card'`
  (`we:scripts/lib/dispatch-contracts.mjs:1069-1070`), which would mislabel where the size came from (#3801 Fork 4).
- **A step's executor follows its routed provider** through `EXECUTOR_PROVIDERS`: `gemini-direct-task`,
  `codex-direct-task`, or a Claude session in a scratch clone.
  - The model comes from the router, never from `WE_DISPATCH_AGENT_ARGS` (#3857).
  - `dispatch-task` keeps its role of launching a hand-written brief (#3730).
- **The wrapper's four single-agent seams become plan-aware.**
  - **The lane occupant** is whichever Claude session is editing in the lane: a Claude step, the fallback worker,
    or the converge editor. Each is adopted with `lane-pool adopt` for its turn and released after.
    Scratch-clone executors never touch the lane, so the lane guard's foreign-occupant check (#2997) stays on
    for every in-lane edit.
  - A red gate becomes a `rework` step, planned by the supervisor, instead of resuming one session.
  - The park-mode choice reads a report the plan runner assembles from its steps.
  - **When `maxRounds` runs out,** the lane keeps every accepted step. The remaining work goes to one Claude
    worker on that partly built lane, which is today's single-worker path, with its own time budget.
    - This is not a fork, because the two alternatives are broken. Dropping the lane throws away accepted,
      paid-for work, which is today's `blocked-mid-build` placeholder. Opening a PR for a half-built card
      invites the early-resolve bug #3820 fixed.
- **Rework keeps the step's derived task type.** `self-fix` stays unproduced (#3801 Fork 2).
- **Settings, checked into one file next to `we:scripts/lib/dispatch-size-policy.json`:**
  - `planBuild: off | shadow | on`, default **`shadow`**. In shadow mode the planner writes a plan, the routes are
    recorded, and the single worker builds as today, so plans can be judged before any step runs. `on` takes a
    ratified settings change.
  - `planMinSize` (Fork 6).
  - `maxParallel` (default 2).
  - `maxRounds` (default 3).
  - A time budget for the planned steps (default 60 minutes), and a separate one for the fallback worker (default
    60 minutes, today's single-agent limit).
  - Fork 4's exploration cap and candidate table.
  - These are values of settings, changed by a ratified settings change. The only behaviour choice among them,
    `planBuild`, starts at `shadow`, because `on` changes what every build does. That mirrors rule 6: lighter
    checking and wider scope need an explicit act.
- **The PR is still one per card.** After the plan, the gate, converge and PR-open steps run on the assembled lane.

## Fork 1 — Who runs the plan

*Fork-existence:* (b) is excluded, not merely dispreferred. A model would pick which models do the work, the
routed-versus-executed record would lose its meaning, and it would escape the mechanical routing path that
`#delegation-trial-record-graduation` binds. #3383 tracker item 6 measured that "you may delegate" advice produced
0 delegations in about 12 workers. #3717's acceptance test is supporting context only. It was written for one
dispatch, and every planner branch puts some model judgment (the plan itself) upstream of routing.

- **(a) The build wrapper runs the plan — recommended.** `deliverItem` asks the story-stage supervisor for a plan
  and validates it with `planFromSupervisorOutput`. It then routes each ready step through `decideDispatchRoute`,
  runs it, collects the result, and asks for a verdict where Fork 5 requires one. The orchestration is code. The
  planner and the supervisor only write JSON that is checked against a schema.
- **(b) The planner agent orchestrates** by spawning its own subagents. Rejected (above).
- **(c) A conveyor-level split into several lane jobs with their own PRs.** That is child-card delivery, and it
  belongs to #3575 Fork 5, not to this card.

Occurrences: LLMCompiler's task-fetching unit, Magentic-One's orchestrator loop, and the cloud agents Codex, Jules
and the Copilot coding agent, which run the loop in the harness, not in the model.

```js
// Fork 1 (a) — the wrapper's plan loop (built pieces cited; NEW pieces marked)
const sup = routeDispatch(profile, { stage: 'story', kind: 'build', scorecards });                   // built, :447
const { ok, plan } = planFromSupervisorOutput(await invokeSupervisor(sup, { phase: 'plan', story }), { supervisor: sup }); // NEW invoke; built :53-62
if (!ok) return singleWorkerFallback(lane);                                                            // today's path
for (const batch of readyBatches(plan, settings.maxParallel)) {                                        // NEW: dependsOn walk
  const results = await Promise.all(batch.map((t) => runStep(t, routeStep(t))));                        // Fork 2 / Fork 3
  await applyInOrder(lane, results);                                                                    // Fork 2
}
```

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied. The attack was that FOUND called the agent turn "the single place
a plan plugs in", when four seams are tied to the one agent, and that #3717's test doesn't separate the branches.
The four seams are now listed and handled, and the exclusion now rests on the mechanical-routing statute. Round 2
added two things: an occupant rule (adopt each in-lane Claude session for its turn) and a separate time budget
for the fallback worker. Both are applied. **Screen:** clear.

## Fork 2 — How parallel agent steps are isolated and joined back

*Fork-existence:* (c) is excluded. Parallel agents in the lane's own working tree share the git index, the verify
marker and untracked files. A step's file list is the planner's claim, not a guarantee. Running steps one at a
time is not a rival design: it is (a) with `maxParallel: 1`.

- **(a) Delegated steps run in their executor's own scratch clone, Claude steps run in the lane, and each diff is
  applied only after its verdict — recommended.**
  1. **A delegated step** (Gemini or Codex) runs in a fresh scratch clone of the lane's committed tip, outside
     `.lanes/`. That is `--repo-root=<lane>`, already the default for `gemini-direct-task` and
     `codex-direct-task`. The executor hands back a diff and never commits.
  2. **A Claude step** runs in the lane itself, one at a time, through the existing `CLAUDE_RESTRICTED_PROVIDER`
     (`we:scripts/operations/deliver-item-wrapper.mjs:724-739`). It is adopted as the lane occupant for its turn.
     No executor runs a Claude session in a scratch clone and returns a diff today. Building one is a later child,
     and it must first probe the untrusted-checkout stall that #3748 found.
  3. So parallelism starts **between** delegated steps, and alongside one Claude step. It grows once the Claude
     scratch-clone executor exists.
  4. **Verdict before commit.** The wrapper applies a delegated diff with `git apply --3way` to a temporary index
     (`GIT_INDEX_FILE`) on the lane's current tip. Where Fork 5 asks for one, the supervisor gives its verdict on
     that applied result. The wrapper commits only after `accept`. A `rework` or `reject` leaves the lane
     untouched, so there is nothing to revert.
  5. An apply conflict, a file outside the step's declared list, or a binary change sends the step back as
     `rework`. The executors' diff capture gains `--binary` so binary changes can be applied at all.
  6. Before the next batch is cloned, the wrapper commits everything accepted so far, because the executors clone
     the lane's committed tip.
  - This avoids everything a worktree inside the lane would hit:
    - the lane guard;
    - the global deny on `git worktree add`;
    - a nested checkout polluting the lane's tests;
    - leftovers after a crash.
  - Accepted residual risk: agy can write outside its folder, which the diff check cannot see. That is already the
    named, accepted risk of `gemini-direct-task`.
- **(c) Parallel steps in the lane's working tree.** Rejected (above).

Occurrences: the practitioner rule of one isolated checkout per agent, and the per-task containers in Codex, Jules
and the Copilot coding agent, where conflicts are handled at an explicit merge.

```js
// Fork 2 (a) — run isolated, apply in order (NEW: we:scripts/operations/plan-runner.mjs)
const { diff } = await runGeminiDirectTask({ model, task: brief, repoRoot: lanePath });        // clones the lane's committed tip; never commits
const staged = await gitApply3wayToTempIndex(lanePath, diff);                                  // NEW: git apply --3way on a temp GIT_INDEX_FILE
if (!staged.ok || outside(staged.files, step.profile.filesTouched)) return { verdict: 'rework', findings: [staged.reason] };
const v = await invokeSupervisor(sup, { phase: 'verdict', results: [staged] });               // Fork 5, on the diff as applied
if (v.verdict === 'accept') await commitStaged(lanePath, staged, step);                        // commit only after accept
```

**Skeptic:** REFUTED in the first draft → rewritten. The first draft used worktrees inside the lane and
cherry-picked step commits. But the non-Claude executors never commit, the lane guard would block Claude step
sessions, and `git worktree add` is denied in checkouts. The rewrite uses the executors' own scratch clones and
applies diffs.

Round 2 found three more problems, all applied:
- No Claude scratch-clone executor exists, so Claude steps now run in the lane and that executor is a later child.
- The verdict came after the commit, so the order is now verdict first, then commit.
- Binary changes could not be applied, so diff capture gains `--binary`.

**Screen:** clear.

## Fork 3 — Where a step's task type comes from

*Fork-existence:* a real either/or. The type decides which triple's trust a step borrows, and a step has one type.
Both branches work mechanically. They differ in whose judgment sets the route.

- **(a) Derived from the step's files — recommended.** `taskTypeFor({ kind: 'build', scopePaths: filesTouched })`
  gives `doc-fix` when every path is a doc path, and `build-new-feature` otherwise. The planner declares only
  files, size, `acceptanceTestable` and risk.
  - This is what the statute's trust unit requires. "Trust never carries across triples", and a code step
    labelled `bugfix` or `conflict-resolution` would borrow trust earned on different work.
  - An overrun is handled after the step runs. Files outside the declared list, or changed lines above the
    declared estimate × a setting (default 1.5), make the step `rework`. The overrun is recorded as a
    planner-calibration field on the **supervisor's** plan record, never on the executor's trial.
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
if (overran(applied, step.profile, settings.overrunFactor)) plan.calibration.push({ stepId: step.id, overrun: applied.stats }); // supervisor's record, not the executor's trial
```

**Skeptic:** REFUTED in the first draft → rewritten. The first draft called this a forced invariant and recorded
an overrun as a calibration miss on the executor's triple. Under the router's criteria that permanently excludes
the executor, because a provider that is never routed can never earn a clean trial. The rewrite makes this a real
fork, keeps (a) on the statute's trust-unit rule, and moves the overrun onto the planner's own record. Round 2
said it survives, and noted that the overrun field is inert and `sizeSource` is ignored today. Both are now stated.
**Screen:** clear.

## Fork 4 — How a cheap model earns its first build-step trials

*Fork-existence:* a real either/or about what evidence a planned build produces. Under Fork 3 (a), no non-Claude
triple has a `build-new-feature` trial. `selectProvider` needs at least one verified, clean, **landed** trial
before it will route to a triple (`we:scripts/lib/provider-routing.mjs:257-260`, `:361-373`). So without a
trial path nothing is ever delegated. (c) is coherent. It just leaves delegation where it is today.

- **(b) Exploration — recommended.**
  1. In each planned build, at most `explorationCap` steps (default 1) are sent to the next candidate on a
     checked-in, ordered **candidate table**. The step must be low-risk, `acceptanceTestable`, not statute-tier,
     and inside the task type's proven envelope. Its task type must have no qualifying non-Claude triple yet.
  2. The table starts as Gemini Flash (`antigravity`), then Codex (`codex/gpt-6-astra`). That is the operator's
     "favour Gemini" preference written as the explicit ordered table #3383 tracker item 6's caution (a) asks
     for. The router's `getExplorationHint` picks the highest-rated model from a ratings registry that is empty
     today, so it can't serve.
  3. The step runs in its scratch clone (Fork 2) and gets the supervisor's verdict on the diff as applied
     (Fork 5). It lands in the lane only on `accept`.
  4. Any exploration step parks the PR `review:pending` (Fork 5). #3850's review panel is then the independent
     reviewer.
  5. `makeTrial` takes `verifiedBy` only from an independent PR review
     (`we:scripts/lib/dispatch-contracts.mjs:662-700`), so the row is an ordinary trial:
     - `outcome: 'landed'` is honest;
     - `verifiedBy` comes from the panel;
     - `informative` is reachable when the panel's finding is fixed.
  6. Exploration steps count toward `maxParallel`.
  - This needs no statute change. It is the same path every marker-driven Codex build already takes under #3850.
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

**Skeptic:** REFUTED (a) in round 2 → flipped to (b).
- The attack was that a baseline row can satisfy neither routing fitness (it never lands) nor the supervision bar
  (no independent review, no `informative`). The router cannot read its fields.
- "The cheapest candidate the cascade allows" is not computable, because the cascade returns `claude` when
  nothing is fit.
- Rule 3 makes a baseline an alternative to raising N, not an entry in the streak.
- (b) works under today's code and statute, and its "lands untrusted code" objection overstates the risk: it is
  exactly #3850's ratified path for the marker-driven Codex builds.

**Screen:** clear.

## Fork 5 — How each step is checked before the build moves on

*Fork-existence:* a real merit choice. (b) is not broken. #3850 Fork 1 (a) records the PR review panel as the
supervisor, which clears `supervisionHold`, and a planned build still opens one PR. The difference is **when**
problems are caught.

- **(a) A supervisor verdict on delegated and baseline steps — recommended.**
  - Every step whose executed vendor is not Claude, and every Fork 4 baseline, gets the supervisor's
    `accept`/`rework`/`reject` on the diff as applied. That satisfies rule 7: the orchestrator reads the real diff.
  - Claude-executed steps get no per-step verdict, consistent with #3850 Fork 2 (a).
  - The PR parks `review:pending` if **any** step's executed vendor is not Claude. #3850's panel then reviews the
    whole diff once.
  - Early `rework` saves a whole-PR round trip, and it can trigger replanning, the per-step feedback that
    Magentic-One's progress ledger and Devin's failure analysis argue for.
  - Cost: one supervisor call per delegated step, today on Opus.
- **(b) The PR panel only.** Cheaper, but a bad delegated step is found only after every step has run. It is then
  fixed by a whole-card round trip, with no step-level replanning.

Who fills `verifiedBy`: under Fork 4 (b), the PR panel, because an exploration step parks the PR. Under Fork 4 (a),
once it is unblocked, #3783's harness and the statute amendment say. Under Fork 4 (c), nothing new.

**Why Claude steps get no per-step verdict,** argued on merit: #3850 Fork 2 (a) ruled it for single-worker lanes,
which is supporting context only here.
- A Claude step is the native path that every build takes today.
- Its diff is reviewed as part of the whole PR under the existing escalation rubric.
- A per-step Opus verdict on it would add cost and catch nothing the panel does not already see.

**Skeptic:** REFUTED in the first draft → rewritten. The first draft called (b) broken under enforcement, but
#3850's PR panel already clears the hold. The rewrite makes this a merit fork, binds the verdicts to delegated
steps only, and states the PR-level parking rule. Round 2 asked who fills `verifiedBy` for each Fork 4 branch.
That is now stated above. **Screen:** clear.

## Fork 6 — Which builds get planned

*Fork-existence:* the two branches are two values of one setting, `planMinSize`. What this fork rules is the
default value, and the default is a behaviour choice: it decides whether a small card pays for a planner.

- **(a) `planMinSize` 8, and no `deliveryAgent:` marker — recommended.**
  - Size 8 (about 500 lines, `SIZE_TO_ESTIMATED_LOC`, `we:scripts/lib/dispatch-contracts.mjs:80`) is the first
    size outside every proven envelope. A size-5 card, about 300 lines, still fits `build-new-feature`'s envelope
    as a whole card (the check is inclusive, `we:scripts/lib/provider-routing.mjs:210`), so splitting it gains no
    delegation.
  - #3575's own example of a split that pays is "a size-8 story with 6 independent sub-edits".
  - Smaller cards keep the single worker.
  - Lowering the value is a ratified settings change.
- **(b) Every build (`planMinSize` 1).** This is the operator's original wording, and it would produce the most
  exploration trials. Today it adds an Opus planner call to every small card, against the rule that Opus is for
  hard design work only.

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied.
- The first attack showed this had been presented as a default, not a choice.
- Round 2 showed 5 was ungrounded, and that "lowered as planners earn trust" relied on a mechanism that cannot
  fire.
- The default is now 8, grounded on the envelope and on #3575. Lowering it is a ratified settings change.

**Screen:** clear.

## Fork 7 — What a `deliveryAgent:` marker means under a planner build

*Fork-existence:* a real either/or. #3801's ruling on Fork 5 left this open in so many words: "Carried, not ruled:
what the marker means under a planner build".

- **(a) That vendor builds the whole card as one worker, and no plan runs — recommended.** This keeps the meaning
  24 marked cards on `main` already carry, and keeps their trials on the triple they name. The routing record
  shows `planned: false` with the reason `delivery-agent-marker`.
- **(b) The marker pins the planner.**
- **(c) The marker pins every step's agent.** That would force one vendor across steps the router would split,
  and mix the marker's trials with the step trials.

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied. The attack was that this is a real fork, not a forced invariant.
It is now presented as one, and (a) is kept on its merits. **Screen:** clear.

## Build after the ruling (prototype, graduates through #3443)

Predicted touch-set (#2619):
- `we:scripts/operations/deliver-item-wrapper.mjs`
- `we:scripts/operations/plan-runner.mjs` (new), plus its `-io` module
- `we:scripts/operations/supervisor-invoke.mjs` (new)
- `we:scripts/lib/dispatch-supervisor-contract.mjs`
- `we:scripts/lib/dispatch-contracts.mjs`
- `we:scripts/conveyor/run-quality-record.mjs`
- `we:scripts/lib/plan-policy.json` (new)
- their tests

Children to carve at the ruling, each with its own slice:
1. **Schema and routing inputs** (Fork 3, `sizeSource: 'plan'` honoured by `decideDispatchRoute`, `raiseRisk`).
   Scope: `we:scripts/lib/dispatch-supervisor-contract.mjs`, `we:scripts/lib/dispatch-contracts.mjs`.
2. **The supervisor transport**: plan and verdict rounds through `SUPERVISOR_INVOCATIONS`, verifying the two flags
   marked UNVERIFIED there. Scope: `we:scripts/operations/supervisor-invoke.mjs`.
3. **The plan runner in `shadow` mode**: plan, record routes, then the single worker. Scope:
   `we:scripts/operations/plan-runner.mjs`, `we:scripts/operations/deliver-item-wrapper.mjs`.
4. **Step execution with verdict-before-commit** (Forks 2 and 5), including `--binary` diff capture. Depends
   on 3. Scope: `we:scripts/operations/plan-runner.mjs`, `we:scripts/codex-direct-task.mjs`,
   `we:scripts/gemini-direct-task.mjs`.
5. **Exploration trials** (Fork 4 (b)): the candidate table, the cap, and a routing record with
   `executed ≠ routed`. Scope: `we:scripts/lib/plan-policy.json`, `we:scripts/lib/dispatch-contracts.mjs`,
   `we:scripts/conveyor/run-quality-record.mjs`.
6. **Later:** a Claude scratch-clone executor, after probing the #3748 untrusted-checkout stall.
7. **Later:** the concurrent baseline (Fork 4 (a)), `blockedBy` #3783 plus the rule-1 statute amendment.

## Not in this decision

- Splitting a card into separately landing pieces, and each card's delivery strategy: #3575 Fork 5.
- #3575 Forks 1 to 3: their integration premise is stale, so re-prepare them against Fork 2 here.
- Promoting any triple to `spot-check`: #3784.
- `dispatch-task`'s kind vocabulary: #3730. The single-worker model table: #3857.
- Operation steps: deferred until an in-lane declared operation exists.

## Done when

1. **Executable** — `grep -l '^## Ruling' we:backlog/3922-*.md` lists this card. It fails until the operator has
   reviewed it and a `## Ruling` section names the outcome of each of Forks 1 to 7.
2. The ruling names the children to carve, with their scopes, and files the two "later" children.

### Review jury (provisional — pre-registered #2638)

Care level: `elevated`. This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |