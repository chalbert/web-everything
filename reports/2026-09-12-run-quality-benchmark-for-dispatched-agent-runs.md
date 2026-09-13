# Run-quality benchmarking of a dispatched agent's own transcript — prior-art survey

**Date**: 2026-09-12
**Point**: Nothing in this repo scores HOW a dispatched agent ran, only whether it is alive, whether it blocked,
and whether its diff is good; the field calls the missing pass *trajectory evaluation*, and the three mature
scoring systems worth copying (Lighthouse, FOQA, chess accuracy) all agree on three things this repo's design
must therefore settle explicitly: store the per-criterion deductions rather than only the scalar, stamp a rubric
version and never re-normalise, and never treat "not 100%" as "actionable".
**Research page**: `/research/run-quality-benchmark-dispatched-agent-runs/`
**Decision item**: the `kind: decision` card filed under `#3383` the same day.

---

## Question

The operator's framing, in their own words: a review pass over a dispatched agent's transcript, qualifying the
run against a checklist of efficiency/quality criteria — hesitation/waffling before acting, inefficient or
redundant commands, bad code produced, test failures that got ignored or tailed off rather than addressed — with
low-risk findings auto-applied and higher-risk findings filed as backlog items. Refined the same day into a
**benchmark** framing: every run starts at an implicit 100%, and the pass's job is to identify what prevented
*this specific* execution from scoring it. Each criterion is a **deduction**, not a pass/fail box.

The question this survey answers: does anything already do this, and what do mature deduction-scoring systems
say about the shape?

## In-repo survey — five adjacent mechanisms, none of which is this

| Mechanism | Subject | Reads a transcript? | Produces a score? | Acts on findings? |
|---|---|---|---|---|
| `we:skills-src/inspect-agent-health/agent-health.mjs` | one live agent | yes, bounded tail | **no** — `ACTIVE`/`BLOCKED_ON_CHILD`/`BLOCKED_ON_TOOL`/`IDLE_OR_STALLED` | no |
| `we:scripts/conveyor/hiccup-classify.mjs` + `we:scripts/conveyor/hiccup-sink.mjs` + `we:scripts/conveyor/hiccup-approve.mjs` | a delivery **hiccup** | no — tick state | no | yes, gated (`#3422`) |
| `we:scripts/operations/review-pr.mjs`, `we:scripts/operations/review-dispatch.mjs`, the jury | the **diff** | no | verdict, not a score | yes, via labels |
| `we:scripts/conveyor/learnings-drop.mjs` + `/harvest` | whatever a session chose to report | no | no | yes, at harvest |
| `we:scripts/conveyor/driver-watchdog.mjs` (POC branch) | the **driver process** | no — queue sidecar bytes | no | yes, rollback |

**The gap, stated precisely.** Liveness is watched. Blocking is classified. The artifact is reviewed. What is
never examined is the *path the agent took to produce the artifact* — and that path is exactly where waffling,
redundant commands, and a quietly-abandoned failing test live. A run can be `ACTIVE` the whole way, produce zero
hiccups, and land a green PR, while having burned an hour re-reading the same file and silently dropping a
failing spec. Every existing guard passes that run.

### The three near-misses, and why each is not this

- **`#3475` / `#3477` — automated transcript introspection at session close/reap.** Ratified 2026-09-04 and
  codified at `we:docs/agent/platform-decisions.md#automated-session-introspection`. This is the **closest**
  prior art by a wide margin, and it is genuinely overlapping infrastructure: it already rules a detached judge
  pass over a real transcript, on every terminal session, at three triggers — the reaper, `SessionEnd`, and
  **`SubagentStop`** — emitting into `#2614`'s pool with `origin: auto-introspection`. A dispatched delivery
  agent *is* a subagent, so `#3477`'s `SubagentStop` trigger already covers the trigger half of this proposal.
  What `#3475` does **not** contain: any scoring, any rubric version, any comparability across runs, any
  efficiency criterion (its one mandated check is the raw-command/missing-operation scan), and any auto-apply
  path — every finding routes to the pool and waits for `/harvest`.
- **`#3592` / `#3593` / `#3594` / `#3617` — the instruction-slip scanner and supervisor.** Reads transcripts,
  but for **doctrine compliance**, report-only, and deliberately *syntactic*: a false "I've set up a monitor"
  claim with no real `Monitor` tool_use, and a `Monitor` wait-loop whose body has no `sleep`. `#3593`'s own text
  splits the problem into a syntactically-checkable half and a judgment half; run-quality scoring is entirely in
  the judgment half and is not what `#3594` builds. Its target is also the *live fleet*, not a completed run.
- **`#2436` — the closing-session efficiency-introspection step.** Shipped, and the only thing in the repo that
  scans a transcript for *efficiency*. But it is scoped to a **human session close**, to exactly two criteria
  (steps that should have been delegated; ad-hoc command sequences that should be scripted), emits a bounded
  prose table, and has no score and no routing.
- **`#2822` — conveyor-native self-improvement.** The epic-level *principle* that autonomous steps must
  self-improve without waiting for a human `/close`. A run-quality benchmark is a concrete instance of that
  principle, not a competitor to it.

### The naming collision, checked before choosing

"Observer" is already taken in this repo, twice over: `createDispatchObservers` in
`we:scripts/operations/dispatch-lane-io.mjs`, registered by `we:scripts/operations/wake.mjs`, whose completion
signal `#3095` hardened. `we:scripts/operations/effect-observer.mjs` is a third. All three poll *dispatch
state*. Reusing the word for a transcript-scoring pass would make every future "the observer" ambiguous.
`grep -ril "run-quality"` over the whole tree returns nothing, so **run-quality auditor** (producing a **run
scorecard**) is free. `scorecard` has one live precedent, `we:scripts/grammar-scorecard.mjs` — a deliberate
reuse, since that is exactly the same noun for exactly the same thing.

## External prior art — the field already names this, and three mature systems agree on the shape

### It has a name: trajectory evaluation

The 2026 agent-evaluation literature calls scoring the *path* (tool-call sequence, inputs/outputs, intermediate
reasoning, retries) rather than the final answer **trajectory evaluation**, and names the exact criteria the
operator listed independently: *Redundant Tool Calls* (unnecessary calls as a percentage of total), *Tool
Frequency* (calls exceeding a per-task threshold), *Task Relevance* (LLM-judged per-call relevance), and
*Execution Efficiency* (how concisely the task was completed). The framing is also stated in the same terms the
operator used: an agent that reaches the correct final answer through a wildly inefficient path "still
represents a production failure," and trajectory evaluation exists because final-answer evaluation cannot see
it. That is a direct external corroboration that reviewing the diff cannot substitute for reviewing the run.

**But the standard form differs from this proposal in one load-bearing way.** Published trajectory evals run
against a **fixed task set** — that is what makes their scores comparable. Here every run is a different backlog
item of a different size. So this is *not* a benchmark in the MCP-Bench / SWE-bench sense, and the design must
not assume it inherits their comparability. The systems below are the right precedents precisely because they
score **field data**, where no two subjects are identical.

### Lighthouse — the versioned-rubric precedent

Lighthouse's Performance score is a **weighted average of per-metric scores**: the per-metric numbers are the
record, the 0–100 headline is derived from them. The weights have changed repeatedly across major versions
(v8 rebalanced toward CLS and TBT and away from FCP/SI/TTI), and the project's own guidance is that comparing a
score across versions is meaningless — a score can move because the algorithm changed, not because the subject
did, so the version must be cited whenever scores are compared over time. Notably, Lighthouse **does not
re-normalise history**: old scores stay as they were, stamped with the version that produced them.

This maps onto two of the operator's three sub-questions directly. Per-criterion deductions are the canonical
record and the scalar is derived (not the other way round — a scalar cannot be decomposed back into a vector).
And a rubric change means a new rubric version, not a rewrite of past scores.

### FOQA — the "100% is not the expectation" precedent

Aviation's Flight Operational Quality Assurance programs score **every** flight against parameter thresholds via
*exceedance detection*. Two properties matter here. First, the thresholds are deliberately set at a *zone
approaching* a limit rather than at the limit itself, so routine flights register exceedances as a matter of
course. Second, and decisively: **a singular exceedance may not trigger corrective action at all** — mitigation
is driven by the *aggregate* exceedance rate crossing a predetermined acceptable threshold. FOQA is the mature
answer to the operator's third sub-question: a scoring system over real operations that treats a perfect score
as neither expected nor the trigger for action.

### Chess engine accuracy — the deduction model made tangible

Post-game analysis grades every move against the engine's best and converts the average loss into a 0–100
accuracy figure, with named bands (best / excellent / good / inaccuracy / mistake / blunder). The tangible fact
worth carrying into the card: **90–100% is grandmaster-level, and grandmasters routinely score below 100.** A
strong player's game is full of small inaccuracies. A system that flagged every one of them as actionable would
be unusable, which is exactly the failure mode the operator flagged when asking whether 100% is realistic.

## Findings that change the design, not just decorate it

1. **The reader and the trigger are largely already ratified; the scoring and the routing are what is new.**
   `#3477` builds a judge pass that reads a real session transcript at three triggers. A dispatched lane agent
   is a **top-level `claude --session-id` process**, not an Agent-tool subagent of the driver
   (`we:scripts/operations/dispatch-lane-io.mjs:878` mints the id and passes `--session-id` at `:998`), so of
   `#3477`'s three triggers the **reaper** and **`SessionEnd`** cover it and `SubagentStop` does not. Building a
   second transcript reader would still be a duplicate. The honest scope of this decision is a **rubric + a
   score store + a risk router layered onto `#3475`'s mechanism**, not a new mechanism.
   - **One concrete gap to name, not assume away.** No dispatch record stores a transcript path. What is stored
     is the `handle` (`we:scripts/operations/dispatch-lane-io.mjs:908`), from which the transcript reconstructs
     as `~/.claude/projects/<project-slug>/<handle>.jsonl` — a **session-level** file.
     `we:skills-src/inspect-agent-health/agent-health.mjs`'s `resolveTranscript` (`:100`) probes only
     `<session>/subagents/agent-<id>.jsonl` (`:130`), so it would **miss** a dispatched lane agent today.
2. **The vector is canonical, the scalar is derived — this is not a real either/or.** Lighthouse settles it by
   construction. The genuine fork left is whether the derived scalar is *published and compared*, given that
   runs are not comparable subjects.
3. **Cross-run comparability is the weakest claim in the proposal and must be scoped, not assumed.** Different
   items, sizes, and models. FOQA's answer — compare *distributions in aggregate*, not individual subjects — is
   the only defensible version of "track whether efficiency improves over time."
4. **`#3422`'s ratified gate does not compute the right answer for this, and reusing it verbatim would be
   wrong — but a second, better-fitting dial is already ratified next to it.** `#3422`'s axis is *did the tick
   get blocked* — observable directly off tick state, deliberately narrow. A run-quality finding on a
   **successful** run is non-blocking by that definition, and `#3422` rules non-blocking findings go "file the
   card only, no fix proposed, straight through with no gate." That is the opposite of auto-applying a fix.
   **The dial that does fit is `assessMissingOperationConfidence`
   (`we:scripts/conveyor/hiccup-classify.mjs:114`)**: it returns `{selfClears, batched, escalate}` from a
   blacklist check (`DEFAULT_OPERATION_BLACKLIST`, `:94`) plus five confidence criteria (`CONFIDENCE_CRITERIA`,
   `:89` — `securityRisk`, `dataLeakRisk`, `performance`, `blastRadius`, `baselineCorrectness`). That *is*
   "low-risk self-clears / higher-risk gets filed", already ratified, already unit-tested. The transport is
   equally reusable: `fileHiccup` (`we:scripts/conveyor/hiccup-sink.mjs:88`) writes an `approvalPending: true`
   entry into the same pool, `we:scripts/conveyor/hiccup-approve.mjs` clears it, and
   `we:scripts/conveyor/learnings-harvest.mjs:182` is the single line that actually holds a gated entry out of
   harvesting.
5. **The learnings pool physically cannot hold a scorecard, and that is a design constraint, not a detail.**
   `we:scripts/conveyor/learnings-drop.mjs`'s `ALLOWED_KEYS` (`:65`) is an allow-list enforced by `validateEntry`
   (`:114`) — it is the privacy boundary, and an un-allow-listed key is **rejected**, not dropped. `FIELD_CAPS`
   (`:70`) caps `summary` at 240 chars and `suggestion` at 400. A per-criterion deduction vector fits neither.
   So the findings can route through the pool; **the score cannot live there** and needs its own store.
6. **The score store has an exact in-repo precedent — copy it rather than invent one.**
   `we:scripts/check-app-conformance.mjs:174` computes `Math.round((conformant / denom) * 100)` and
   **defaults to 100 when nothing was measured** — structurally the same "starts at 100%" premise — then
   `--burndown` appends one row per run (`{date, score, fails, gaps, candidates}`) to
   `we:reports/app-conformance-burndown.json` and reads the series back into the report. That is a derived
   percentage plus an append-only per-run trend, already in this repo. The alternative hanger,
   `we:scripts/operations/run-record.mjs`, is per-run and already persisted but its telemetry allow-list
   (`:109-116`) forbids a drive-by field, and `we:scripts/operations/step-timings-report.mjs:9-12` states the
   standing posture explicitly: a distribution or trend on top of those rows is "a **separate card**, not a
   reason to grow this one."
7. **The self-hosting constraint is a written, test-asserted rule here, not a vibe.**
   `we:scripts/conveyor/driver-watchdog.mjs`'s header states it: "IT MUST NOT SHARE THE DRIVER'S OWN DECISION
   LOGIC… Shared code is shared failure," and its test suite asserts the import graph so the rule is a fact about
   the file rather than a promise in a comment. Whether the same constraint binds a run-quality auditor turns on
   whether the auditor is diagnosing the thing it depends on — which it partly is, since a dispatched run's
   quality is partly a property of the dispatcher. The technique is a house pattern, not a one-off:
   `we:scripts/operations/engine.mjs:8`, `we:scripts/operations/dispatch-lane.mjs:39`, and
   `we:scripts/review-set-label.mjs:106` all assert their own import graphs the same way.
8. **"At dispatch completion" is ambiguous in this repo, and the two readings differ in what is knowable.** The
   dispatch **observer** (`createDispatchObservers`, `we:scripts/operations/dispatch-lane-io.mjs:1155`) only
   reports `succeeded` when the **PR merges** (`:1191`) — its own docblock (`:1106-1112`) says liveness alone can
   never say `succeeded`, because "the session is gone" collapses *finished cleanly* and *died*. So the agent's
   transcript is complete long before the dispatch resolves. Scoring at the agent's own session end means
   scoring without knowing the outcome; scoring at dispatch resolution means the outcome is an available input.
   `we:scripts/operations/wake.mjs:105` is the single place in the repo that knows a dispatch just terminated
   **with the run record in hand**.
9. **The criteria list does not need inventing.** It can be *derived* from what this repo has already written
   down: the 12 rules of `we:skills-src/mechanical-delivery-doctrine/SKILL.md` (rule 2 bespoke prompt, rule 8 a
   concluded external limitation, rule 11 symptom relief mistaken for a fix, rule 12 hand-dispatch where the
   conveyor already covers the kind), the pinned never-end-a-turn-on-a-passive-wait rule in `we:CLAUDE.md`,
   `#3594`'s two syntactic patterns, `#3477`'s mandated missing-operation scan, and 267 notes in
   `we:agent-memory-src/`. A hand-authored list would be both smaller and unanchored. The *form* also has a
   precedent: `LENS_EXPECTATIONS` (`we:scripts/lib/review-core.mjs:1851`) is a frozen one-sentence-per-lens map
   where "the wording IS the commitment", and `LENS_HUNT_BRIEF` (`:1870`) is a concrete "go looking for these
   shapes, in roughly this order of past frequency" list. That is exactly the shape a run-quality rubric wants.
   And `we:skills-src/inspect-agent-health/agent-health.mjs`'s `summarizeEntry` (`:227`) already decomposes one
   JSONL line into `text` / `thinking` / `tool_use{name,input}` / `tool_result{isError}` blocks — which is
   precisely hesitation, redundant commands, and ignored failures, already parsed.

## Files created

| File | Action |
|---|---|
| `we:reports/2026-09-12-run-quality-benchmark-for-dispatched-agent-runs.md` | created (this report) |
| `we:src/_data/researchTopics.json` | entry added |
| `we:src/_includes/research-descriptions/run-quality-benchmark-dispatched-agent-runs.njk` | created |
| the `kind: decision` card under `#3383` | filed via `we:scripts/operations/file-item.mjs` |

## Sources

- [Lighthouse performance scoring — Chrome for Developers](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring)
- [Lighthouse v8 performance FAQ](https://github.com/GoogleChrome/lighthouse/blob/main/docs/v8-perf-faq.md)
- [FAA AC 120-82 — Flight Operational Quality Assurance](https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_120-82.pdf)
- [GAO RCED-98-10 — Aviation Safety: Efforts to Implement Flight Operational Quality Assurance](https://www.gao.gov/assets/rced-98-10.pdf)
- [LLM Agent Evaluation Metrics in 2026: Tool Calling, Task Completion, Reasoning, and Trace-Based Evals](https://www.confident-ai.com/blog/llm-agent-evaluation-complete-guide)
- [MCP-Bench: Benchmarking Tool-Using LLM Agents with Complex Real-World Tasks](https://arxiv.org/pdf/2508.20453)
- [Centipawn Loss vs. Accuracy: What These Chess Metrics Actually Mean](https://mychessplan.com/centipawn-loss-vs-accuracy-chess-metrics-explained/)
