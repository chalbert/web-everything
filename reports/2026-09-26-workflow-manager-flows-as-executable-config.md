# Workflow manager: flows as executable configuration — prep report (x3vjug7)

_2026-09-26, prep for decision card x3vjug7 (epic #4075). Research topic:
`/research/conveyor-workflow-manager/`._

## The question

The operator's target, verbatim (2026-09-26): *"The idea would be to migrate all flow like code to it"* and
*"Eventually I wonder if having a workflow manager where flow are pure configuration which would allow for graphs
to be generated, inspected, etc would not be a good idea"*. So the target is not in question: every daemon, pass
and dispatch lifecycle should execute from a declared flow, with only step logic (classifiers, gates, effects)
left as code the flow calls. The prep answers **how**: which engine, where the config↔code line sits, where the
engine runs, and how to migrate without breaking delivery.

## Evidence from the tree

### What already exists

- **Flows as data (xr05jjl, PR #2744).** Nine flow files under `we:scripts/conveyor/flows/` (5,209 lines), each
  a state machine with owner / wait / retries / escalation per state and assumes / provides / removes facts per
  step, every fact cited to `file:line`. `we:scripts/conveyor/flows/flow-model.mjs` loads them (`loadFlows`,
  line 39), computes must-provided facts along every path (`guaranteedFacts`, line 86) and checks 8 rules
  (`checkFlow`, line 145). `we:scripts/conveyor/flows/check.mjs --ci` gates CI on unacknowledged findings.
  Nothing executes from these files; the README says the code is the truth.
- **The operations engine (#3031/#3032).** `we:scripts/operations/engine.mjs` is a pure step function:
  `startRun` (line 135), `advance` (line 376), no `node:` imports (asserted by its test), four closed step kinds
  (`compute`, `judge`, `confirm`, `effect`), every non-compute step a suspend with a resume, declared reads
  enforced by projection, fail-closed on a declaration that changed under a live run. Run records live in
  `we:scripts/operations/run-store.mjs` (atomic write, dir from env). Effects are keyed by run + step so replay
  is safe (`we:scripts/operations/effect-executor.mjs`). This is already a workflow engine — for **linear**
  operations (a cursor over an ordered step list). It has no graph, no timers, no retry caps, no owners.
- **The #4120 job model (ratified 2026-09-25, `#daemon-jobs`).** Slow actions run as detached jobs with a
  run-store record, a `host:pid:procStart` handle, dead-handle relaunch from the last applied step, capped
  attempts, visible failure. Review already runs this way: `we:scripts/operations/review-job.mjs` replaced the
  wrapper session with a deterministic arc (388 wrapper sessions, ~27 active hours), keeps the old path behind
  `WE_REVIEW_DISPATCH_MODE` (line 102), and bounds itself with a loop timeout.
- **The review lifecycle today** spans `we:skills-src/conveyor/review-daemon.mjs` (tick loop, 120 s,
  `runDaemonLoop` line 122), `we:scripts/conveyor/reconcile-core.mjs` `planReconcile` (lines 781–1320, a pure
  planner re-deriving the plan from PR labels + live sessions/jobs each tick), `we:scripts/operations/review-job.mjs`
  and the `review-pr` declared operation (`we:scripts/operations/review-pr.mjs`, steps `read` 2041 … `reduce`
  2211). `we:scripts/conveyor/flows/review.flow.json` describes it as 13 states, 20 transitions, 10 steps.

### Today's incidents (plan status log, 2026-09-26)

| Incident | Class | Where it hit | In the flow model |
|---|---|---|---|
| #2701 moved dispatched sessions' cwd to a scratch folder → fixers lost edit permission on their lane, sat 36 min on a prompt nobody answers | cwd → permission (knock-on) | fix, build dispatch, ci-heal | `unprovided-assumption permission:edit:<lane>` (xrv69j6) |
| #2731 off-lock smoke ran the candidate in a stripped env (wrong lane-pool root, no git on PATH, gh timeout) → every rebuild rejected, daemons refused all work as stale | env (knock-on) | daemon-rebuild | `removes` cwd / lane-pool root, then `assumes` them (regression fixture) |
| Review + fix daemons smoked the SAME candidate folder; first to finish deleted it (git ENOENT); `overlay add` held the writer lock 8+ min | lock / shared state | daemon-rebuild | `unbounded-wait`, `failure-no-exit mutate-overlay-list` (x56qzx8) |
| App-auth check read "no repo list" as "no access" → daemons acted as the operator | auth (wrong answer inside one check) | all | **not caught** — a wrong result inside one step, not a flow gap |
| Stacked PR retargeted onto main never got CI; accepted PR sat forever | missing provision | ci-heal, drain | `no-owner base-retargeted`, `unprovided-assumption ci:required checks ran on head` (xi4od2p) |
| Accepted + red CI → "nothing owed" → no fixer | no owner | fix | routing gap (fixed by #2743) |
| Broken Claude login burned 34 sessions overnight | auth | all dispatch | `unbounded-wait claude-auth-paused` (xwo3j0l) |

The replay fixtures in `we:scripts/conveyor/flows/test-fixtures/regressions.mjs` show the static checker would
have flagged 6 of 7 of these at review time. The 7th (App auth) is a wrong answer inside one check — a unit-test
problem, not a flow problem. **Lesson for the engine:** static checking catches "who owns this / what bounds
this / what provides this"; it cannot catch a step that returns the wrong value. An engine adds a second net the
checker cannot: **runtime fact probes** — before a step runs, the facts it `assumes` are probed, so a lost
permission or a stripped env fails as a named state (`assumption-failed:permission:edit:<lane>`) instead of a
36-minute silent stall.

### The 57 gaps (the checker on #2744)

57 findings, all acknowledged against 9 cards: 21 `unbounded-wait`, 13 `uncapped-retry`, 11 `silent-failure`,
5 `no-owner`, 5 `unprovided-assumption`, 2 `failure-no-exit`. Every one is something an
engine would have to **decide** to run the flow — a wait without a timeout has no `onTimeout` to go to, a retry
without a cap never terminates. In describe-only mode they are warnings; in an engine they are load-time
refusals (or explicit, carded acknowledgements of an intentional human wait). That is the concrete sense in which
*the checker becomes the engine's validator*.

## Prior art

| System | Model | Config or code? | Durability | Runs where | Fit here |
|---|---|---|---|---|---|
| **Temporal** | Durable execution, deterministic replay of workflow code | Code (workflows are TS/Go functions; the graph is implicit) | Event history in a DB | A server cluster (dev: one binary + SQLite) | Solves timers/retries/history; but a server is a new critical path on one Mac, and workflows-as-code misses "pure configuration" — we would still need our own DSL on top |
| **Restate** | Durable execution via a journal, handlers in code | Code | Journal in the Restate server | Single-binary server | Same shape as Temporal, lighter server; same two objections |
| **Inngest** | Event-driven step functions | Code (`step.run`, `step.sleep`) | SQLite by default, Postgres optional; bundled in-memory Redis | Single-binary server (`inngest start`) | Lightest server option; still code-first + a process to keep alive |
| **DBOS Transact** | Durable workflows as a **library** in-process | Code (decorated functions) | Postgres; SQLite support added 2026 | In the app process | Closest to "no server"; still code-first, and adds a DB our file-based run store already covers |
| **AWS Step Functions (ASL)** | JSON state machine: Task / Choice / Wait / Parallel / Map, `Retry` with `MaxAttempts`, `Catch`, `TimeoutSeconds` | **Config** | Managed | AWS only | Best prior art for the *format*: retries, caps, timeouts and catch targets are first-class config — exactly the fields our checker demands. Choice rules are a small expression language (JSONPath comparisons) |
| **CNCF Serverless Workflow (DSL 1.0, 2025)** | Declarative YAML/JSON workflows | **Config**, jq expressions | Runtime-defined | SonataFlow, Synapse … | Vendor-neutral spec, but its expressions are full jq — logic leaks into config |
| **W3C SCXML (2015 Recommendation)** | Statecharts: states, transitions, guards, `<invoke>`, delayed `<send>`, `<final>` | **Config** (XML) | None (engine concern) | Any interpreter | The standard vocabulary; guards by name or expression; timeouts as delayed events |
| **XState v5** | Statecharts in JS, named guards/actions via `setup()`, persisted snapshots | Config object + named implementations | Snapshot only; delayed events are in-memory timers | In-process library | Its "named guard, implementation elsewhere" split is the right boundary; its in-memory timers do not survive our per-tick daemon restarts |
| **GitHub Actions** | YAML jobs + `${{ }}` expressions | Config that grew an expression language | Managed | GitHub | Cautionary: the expression language became where logic hides |
| **Argo Workflows / BPMN (Camunda)** | DAG CRDs / BPMN XML | Config | K8s / engine DB | Cluster / server | Heavy; BPMN proves visual inspection of config at scale |

**WE's own standards.** WE already standardizes this shape: the Workflow Protocol (`project:webworkflows`,
`we:src/_data/protocols/workflow.json`, #634) is an SCXML-style, data-defined orchestration graph behind a
swappable `CustomWorkflowEngine`, with retry and wait-for-event listed as Tier-2/3 operators; `project:webprocess`'s
Self-Driven Project Artefact Contract names the WE backlog as one dogfooded recipe of a self-driven SDLC. FUI
ships a dependency-free `NativeWorkflowEngine` for it (`frontierui:blocks/workflow-engine/`), but its guards are
functions, it has no timers, retries, owners or durability, and it is UI-side. So the protocol is the right
**vocabulary** to align with, not a runtime to run the conveyor on, and its authoring scope (UX step-intents)
does not govern delivery tooling — it is supporting context, not authority.

### What the survey and the red-team changed in the card

1. **Added the host fork (now Fork 4).** Every server engine forces one central process; the card never asked
   whether that is acceptable. Per-daemon failure domains are what today's incidents argue for.
2. **Sharpened the boundary fork (now Fork 3).** Step Functions and GitHub Actions show both ends: first-class
   retry/timeout/catch config is what makes a flow checkable; an expression language is where logic escapes.
   XState's named-guard split, plus a **closed enum outcome per guard**, gives an outcome check for free. The
   skeptic added ordered first-match evaluation, a limit on `otherwise`, and composite classifiers in place of
   chains of boolean guards.
3. **Dissolved the filed "migration safety" fork into ratify lines.** The fallback switch and the per-kind
   adoption switch are operator rulings (2026-09-26 11:47, PR #2739; the #4120 prep). Shadow-then-cut-over
   coexists with the fallback. The skeptic added that flows writing `main` fail closed (#daemon-jobs).
4. **Surfaced two hidden forks.**
   - **Where flow state lives (Fork 2).** The draft stored state and attempt counts in the instance record.
     `we:scripts/conveyor/reconcile-core.mjs` (757–759) re-derives state every tick on purpose: "a cap that a
     restart can reset is not a cap".
   - **What runs the rebuild flow (Fork 5).** The draft's "last-known-good engine" rule does not match
     #resident-daemon-reload-lifecycle. After adoption the candidate is the running engine.
5. **Tightened the admission rule.** All 57 findings are acknowledged today, so "refuse unacknowledged findings"
   would admit every flow unchanged. Executable flows may not waive unbounded waits, uncapped retries or unowned
   states.

## Recommendation (summary; the card holds the forks)

- **Fork 1 (a), med-high:** no always-running server on the critical path. An in-repo engine over the
  declared-operations engine and #4120 jobs, with restart-safe inspectable records and graphs drawn from the
  files that execute. The pure `advanceFlow` interpreter is the slice's build detail.
- **Fork 2 (a), high:** state derived each tick from live observations. The record keeps only deadlines, job
  handles and a transition log; retry counts come from their durable sources.
- **Fork 3 (a), high:** classifier guards with closed outcomes, ordered first match, `otherwise` only to
  escalation or failure, no expressions.
- **Fork 4 (a), med:** a library in the daemon that owns each state; hand-offs through live state.
- **Fork 5 (a), med:** the daemon-rebuild flow stays code-driven, its file in permanent shadow.

## First executable slice — review

Review goes first: smallest blast radius (it labels and comments, never writes `main`), already a #4120 job,
already built on a declared operation, and every state has a known host. Acceptance criteria and the six new
checker rules are in the card.

## Residual risk

We become the maintainers of a small workflow engine. Durability, relaunch and handles are the ratified #4120
job model, and Fork 2 keeps state where it already lives, so the new code is a transition function plus a
loader. One interpreter bug can still reach every migrated flow. That is why hosting is per daemon, every flow
has its own fallback, the drain migrates last and fails closed, and the rebuild flow is never driven by the
engine.

The first slice's real risk is classifier design. Turning `planReconcile`'s ordered decision list into closed
enums is where it can go wrong, and the shadow diff measures that before anything acts. If, after review and fix
are migrated, the interpreter has grown its own timer or replay subsystem beyond ~1.5k lines, revisit Fork 1 (b)
with that evidence.

## Sources

- Inngest self-hosting: <https://www.inngest.com/docs/self-hosting>
- DBOS Transact: <https://www.dbos.dev/dbos-transact>, <https://www.dbos.dev/blog/dbos-new-features-march-2026>
- Temporal, Restate, AWS Step Functions ASL, CNCF Serverless Workflow, W3C SCXML, XState v5: public docs (known
  prior art; no claims beyond their documented models).
