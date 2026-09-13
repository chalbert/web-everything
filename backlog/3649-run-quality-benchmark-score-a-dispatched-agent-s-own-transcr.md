---
bornAs: x37kvib
kind: decision
parent: "3383"
status: resolved
scope: ["we:scripts/conveyor/", "we:skills-src/inspect-agent-health/", "we:scripts/operations/", "we:docs/agent/"]
dateOpened: "2026-09-12"
dateStarted: "2026-09-13"
dateResolved: "2026-09-13"
codifiedIn: "docs/agent/platform-decisions.md#drain-daemon-self-hosting-boundary"
preparedDate: "2026-09-12"
relatedTo: ["3475", "3477", "3422", "3593", "3594", "2436", "2822", "3095"]
relatedReport: reports/2026-09-12-run-quality-benchmark-for-dispatched-agent-runs.md
tags: [conveyor, dispatch, self-improvement, benchmark, introspection]
---

# Run-quality benchmark: score a dispatched agent's own transcript against a versioned rubric, auto-apply the low-risk findings and file the rest

A dispatched agent's transcript is never reviewed for HOW it ran. Liveness is watched (we:skills-src/inspect-agent-health/agent-health.mjs), blocking hiccups are classified (we:scripts/conveyor/hiccup-classify.mjs), the diff is reviewed (we:scripts/operations/review-pr.mjs) - the run path is not - where waffling, redundant commands and an abandoned failing test live. Framed as a BENCHMARK, not a checklist: every run starts at an implicit 100 percent and each criterion is a deduction. Seven forks decide the trigger seam, the scoring shape, rubric versioning, whether 100 percent is expected, the subject-class gate (a live driver is report-only, always), the auto-apply axis, and the v1 posture. Named run-quality auditor, not observer.

## Done when

1. **Executable** — `node we:scripts/backlog.mjs show <this item>` reports `status: resolved` with `codifiedIn:`
   set, and the ruling names, for each of the seven forks below, the option taken and why.
2. **Ruled** — the ruling states explicitly (a) whether a per-run score is ever published as a per-run headline
   or only in aggregate over a declared comparability class, and (b) what refuses an auto-applied fix when the
   reviewed subject is a live driver.
3. **Not built here, by design** — no rubric authored, no scorer written, no trigger wired. The ruling names the
   follow-on build items and their `scope:`; this card builds none of them.

## What this is NOT — five adjacent mechanisms, each read before filing, none of which is this

| Mechanism | Subject | Reads a transcript? | Produces a score? | Acts on findings? |
|---|---|---|---|---|
| `we:skills-src/inspect-agent-health/agent-health.mjs` | one live agent | yes, bounded tail | **no** — `ACTIVE`/`BLOCKED_ON_CHILD`/`BLOCKED_ON_TOOL`/`IDLE_OR_STALLED` (`:342-355`) | no |
| `we:scripts/conveyor/hiccup-classify.mjs` + `we:scripts/conveyor/hiccup-sink.mjs` | a delivery **hiccup** | no — tick state + the agent's final return string | no | yes, gated (`#3422`) |
| `we:scripts/operations/review-pr.mjs`, `we:scripts/operations/review-dispatch.mjs`, the jury | the **diff** | no | a verdict, not a score | yes, via labels |
| `we:scripts/conveyor/learnings-drop.mjs` + `/harvest` | whatever a session chose to self-report | no | no | yes, at harvest |
| `we:scripts/conveyor/driver-watchdog.mjs` (POC branch) | the **driver process** | no — queue sidecar bytes | no | yes, rollback |

**The gap, stated precisely.** Liveness is watched. Blocking is classified. The artifact is reviewed. What is
never examined is the *path the agent took to produce the artifact* — and that path is exactly where waffling,
redundant commands, and a quietly-abandoned failing test live. A run can be `ACTIVE` the whole way, produce zero
hiccups, and land a green PR, having burned an hour re-reading the same file and silently dropped a failing
spec. **Every existing guard passes that run.**

Two proofs that the subject is genuinely unoccupied rather than merely unsearched:

- `we:scripts/operations/review-dispatch.mjs`'s `REVIEW_BRIEF_PLACEHOLDERS` (`:150`) is the **complete**
  vocabulary a review dispatch can be parameterized with: `PR`, `REPO`, `SESSION_SLUG`. No agent id, no session
  handle, no transcript. And `we:scripts/operations/review-pr.mjs`'s own op declaration takes `pr: 'number'` +
  `repo: 'string'` (`:1186-1188`), with its judge shape requiring "one sentence on **the diff as a whole**"
  (`:563`). There is no operation in this repo whose subject is an agent's own run.
- `grep -ril "run-quality"` over the whole tree returns nothing.

### The naming: **run-quality auditor**, producing a **run scorecard** — deliberately not "observer"

"Observer" is already taken three times over, all for the same unrelated thing — polling *dispatch state*:
`createDispatchObservers` (`we:scripts/operations/dispatch-lane-io.mjs:1155`), its registration in
`we:scripts/operations/wake.mjs:411`, and `we:scripts/operations/effect-observer.mjs` (whose `OBSERVATIONS`
vocabulary at `:89` is `running`/`succeeded`/`resolved`/`unresolved`). `#3095` hardened that observer's
completion signal. Reusing the word would make every future "the observer" ambiguous in the one subsystem this
mechanism attaches to. `scorecard` is reused on purpose — `we:scripts/grammar-scorecard.mjs` is the same noun for
the same thing.

## The benchmark framing, and the three mature systems that already solved it

The operator's refinement: each criterion is a **deduction against an implicit 100%**, not a pass/fail box. Full
survey in [the report](we:reports/2026-09-12-run-quality-benchmark-for-dispatched-agent-runs.md). Three findings
shape the forks, and one of them changes the proposal's own claim about itself.

**Known occurrences — the pattern is shipped and mature in three unrelated industries.**

- **Lighthouse.** The 0–100 Performance score is a *weighted average of per-metric scores* — the per-metric
  numbers are the record, the headline is derived. Weights have changed across major versions (v8 rebalanced
  toward CLS and TBT), and the project's own guidance is that a cross-version comparison is meaningless: a score
  can move because the algorithm changed, not because the subject did. History is **never re-normalised**.
- **FOQA** (aviation Flight Operational Quality Assurance). Every flight is scored against parameter thresholds
  by *exceedance detection*. Thresholds sit in a zone *approaching* a limit, so routine flights register
  exceedances as a matter of course — and decisively, **a singular exceedance may not trigger corrective action
  at all**; mitigation is driven by the *aggregate* exceedance rate crossing a predetermined threshold.
- **Chess engine accuracy.** Every move is graded against the engine's best, averaged into a 0–100 accuracy with
  named bands (best / excellent / good / inaccuracy / mistake / blunder). **90–100% is grandmaster-level, and
  grandmasters routinely score below 100.**

**The field already has a name for the mechanism: trajectory evaluation** — scoring the path (tool-call sequence,
inputs/outputs, intermediate reasoning, retries) rather than the final answer. The 2026 agent-eval literature
names the operator's criteria independently: *Redundant Tool Calls*, *Tool Frequency*, *Task Relevance*,
*Execution Efficiency* — and states the case in the same terms: an agent that reaches the right answer through a
wildly inefficient path "still represents a production failure", which final-answer evaluation cannot see.

**The one place the analogy breaks, and it is load-bearing.** Published trajectory evals get their comparability
from a **fixed task set**. Here every run is a different backlog item of a different size, dispatched to a
different model at a different effort. **This is therefore not a benchmark in the SWE-bench / MCP-Bench sense**,
and the design must not silently inherit their comparability. Lighthouse-field-data and FOQA are the right
precedents precisely because they score subjects that are never identical. Fork 2 is where that bites.

## Grounding digest — what already exists that this would reuse

- **The risk dial is already ratified and unit-tested.** `assessMissingOperationConfidence`
  (`we:scripts/conveyor/hiccup-classify.mjs:114`) returns `{selfClears, batched, escalate, reason}`: the
  `DEFAULT_OPERATION_BLACKLIST` (`:94` — `rm -rf`, `git push --force`, `git reset --hard`, `drop table`,
  `sudo `, `curl | sh`, `chmod 777`) is checked **first and independently** → `escalate`; any flagged member of
  `CONFIDENCE_CRITERIA` (`:89` — `securityRisk`, `dataLeakRisk`, `performance`, `blastRadius`,
  `baselineCorrectness`) → `batched`; clean → `selfClears`. That *is* "low-risk auto-applies, higher-risk gets
  filed."
- **The gated-auto-file transport is already built.** `fileHiccup` (`we:scripts/conveyor/hiccup-sink.mjs:88`)
  writes an `approvalPending: true` entry into the *same* pool rather than a parallel store;
  `we:scripts/conveyor/hiccup-approve.mjs` clears it by `<session>#<ts>`; and
  `we:scripts/conveyor/learnings-harvest.mjs:182` is the single line that holds a gated entry out of clustering
  entirely.
- **The pool cannot hold a scorecard.** `we:scripts/conveyor/learnings-drop.mjs`'s `ALLOWED_KEYS` (`:65`) is an
  allow-list enforced by `validateEntry` (`:114`) — an un-allow-listed key is **rejected**, not dropped — and
  `FIELD_CAPS` (`:70`) caps `summary` at 240 chars, `suggestion` at 400. A per-criterion deduction vector fits
  neither. Findings can route through the pool; **the score needs its own store.**
- **That store has a precedent to copy in shape and to NOT copy in one detail.**
  `we:scripts/check-app-conformance.mjs:174` computes `Math.round((conformant / denom) * 100)` and appends one
  row per run to `we:reports/app-conformance-burndown.json`, reading the series back — that append-only
  per-run-row-plus-derived-percentage shape is exactly right. Its `denom ? … : 100` fallback is **not**: the 100
  fires when *nothing was measured*, so it encodes "no information", not "a perfect subject". Copied
  unexamined it would score an unreadable transcript a perfect 100 (Fork 2's first skeptic amendment). Meanwhile
  `we:scripts/operations/step-timings-report.mjs:9-12` states the standing posture for the alternative hanger: a
  distribution or trend over `we:scripts/operations/run-record.mjs`'s rows is "a **separate card**, not a reason
  to grow this one."
- **The transcript is already half-parsed.** `summarizeEntry`
  (`we:skills-src/inspect-agent-health/agent-health.mjs:227`) decomposes one JSONL line into `text` /
  `thinking` / `tool_use{name,input}` / `tool_result{isError}` blocks — precisely hesitation, redundant commands,
  and ignored failures. It is exported (`:383-388`) along with `flattenToolResultText`, `truncate` and
  `resolveTranscript`.
- **One concrete gap, named rather than assumed away.** No dispatch record stores a transcript path. What *is*
  stored is the `handle` (`we:scripts/operations/dispatch-lane-io.mjs:908`, minted at `:878` and passed as
  `--session-id` at `:998`), from which the transcript reconstructs as
  `~/.claude/projects/<project-slug>/<handle>.jsonl` — a **session-level** file. `resolveTranscript` (`:100`)
  probes only `<session>/subagents/agent-<id>.jsonl` (`:130`), so it would **miss** a dispatched lane agent
  today. Whatever is built has to widen that resolution.
- **The rubric has a form precedent.** `LENS_EXPECTATIONS` (`we:scripts/lib/review-core.mjs:1851`) is a frozen
  one-sentence-per-lens map where "the wording IS the commitment"; `LENS_HUNT_BRIEF` (`:1870`) is a concrete "go
  looking for these shapes, in roughly this order of past frequency" list. That is the shape a run-quality
  rubric wants — not a new invention.

---

# Fork 1 — When does the audit run, and on what trigger?

**Why this is a real fork.** The candidate triggers differ in *what is knowable at scoring time*, and a single
rubric cannot be written for two of them at once: the criterion "did it abandon a failing test" is scored
differently when the PR is known to have merged than when the outcome is unknown. Two rubrics reduced onto one
scale produce numbers that are not comparable — which destroys the benchmark property the whole card exists for.
So exactly one trigger can own the canonical score. The excluded branch is "all of them, equally."

- **(a) At the agent's own session end** — the reaper (`we:scripts/conveyor/session-reaper.mjs`) or a
  `SessionEnd` hook, reusing `#3477`'s already-ratified triggers verbatim ← **RECOMMENDED (flipped in prep —
  see the `Skeptic:` line; the original default was (b) and it was refuted on the code)**.
- **(b) At dispatch resolution — the `we:scripts/operations/wake.mjs:105` seam.**
- **(c) Mid-flight, periodically, over a still-running agent.**
- **(d) (a) and (c) together.**

**Why (a).** The transcript is the artifact being scored, and (a) is the only seam that reads it while it
still exists. `we:scripts/operations/wake.mjs:99-101`'s own comment says so in the repo's own words —
the observer "may not be able to answer twice (**a session's transcript is reaped**, a build's log rotates)."
Dispatch resolution can be days after the agent exited, because the observer
(`we:scripts/operations/dispatch-lane-io.mjs:1155`) reports `succeeded` **only when the PR merges** (`:1191`).
Scoring at (b) means routinely reaching for a file that is gone. (a) also fires on runs that never produce a
PR at all — exactly the runs most worth scoring — and needs no new trigger, since `#3477`'s reaper and
`SessionEnd` triggers already reach a dispatched lane agent.

**The outcome is still an input — it is joined, not read at scoring time.** The scorecard is keyed by item and
handle (Fork 2's snippet), so `outcome` is filled in by the aggregator when the dispatch later resolves, and is
`null` until then. That is strictly better than what (b) promised: it costs nothing and it survives a reaped
transcript.

**Why (c) is Rejected on merit, not on cost.** A benchmark scores a *completed* performance. A partial
transcript has not yet had the opportunity to lose or keep points — an agent that has re-read one file three
times at minute 5 may be about to do exactly the right thing at minute 6. Scoring it mid-flight yields either an
incomparable number (a different fraction of each run) or an *intervention*, which is a different mechanism
entirely and is already owned by `#3593`/`#3594`'s live-fleet supervisor. **Composability probe run, and it does
not collapse the fork:** the transcript *scanner* could genuinely be shared as one kernel, but the *score*
cannot. (d) inherits (c)'s defect.

**Skeptic:** **REFUTED → flipped from (b) to (a).** The prep skeptic killed (b) on three verified facts, each
checked against the live tree rather than taken on its word. (1) The claim that the run record hands the scorer
`costUsd`/`durationMs`/`numTurns` "for free" is **false**:
`we:scripts/operations/run-record.mjs:106` calls those fields "THE METERED FIELDS of **one juror spawn, and
NOTHING ELSE**", and `we:scripts/operations/engine.mjs:334` **throws** on any non-`judge` step carrying
telemetry — a dispatch effect is not a judge step, so the engine actively refuses to record them. (2) The
repo's own comment at the proposed seam documents that the transcript may already be reaped there. (3) The
`unresolved`/`stuckPast` fallback was **unimplementable as written**: `stuckPast`
(`we:scripts/operations/wake.mjs:244`) is pure and recomputed every pass — its docblock calls it "a REPORTING
bound, never a retry bound" — so with no fired-once record it would append a duplicate scorecard on every pass
forever. The fork's ruling reversed; the outcome-join above is what survives of (b)'s one real advantage.
**Screen:** clear — the trigger point is observable in *when* a finding appears and in whether a reaped run was
scored at all; and both branches stay distinguishable on merit (can the artifact still be read) with cost
stripped out.

**Operator ruling (2026-09-13): APPROVED as recommended.** Fork 1 (a) — score at the agent's own session end,
on `#3477`'s existing triggers, joining the outcome later. Ratified fork-by-fork, in review across sessions;
the item stays `active` (not `resolved`) pending the remaining six forks.

# Fork 2 — What is the canonical record, and is a single comparable number ever published?

**Supported by default, not forked — the vector→scalar direction.** A scalar cannot be decomposed back into a
vector, so "which is canonical" is settled by construction rather than by a ruling: **the per-criterion deduction
vector is the record and any scalar is derived from it.** Lighthouse is built exactly this way. Recorded here so
it is not re-litigated as a fork.

**Why a real fork remains.** Publishing a cross-run headline number and refusing cross-run comparison cannot
coexist: a published per-run score *is* an invitation to compare runs, and the subjects are not comparable
(different items, sizes, models, effort tiers). One of the two has to go.

- **(a)** A single 0–100 aggregate is **the** headline, compared run to run, agent to agent, day to day.
- **(b)** The deduction vector is the record; a 0–100 scalar is derived and published **only as an aggregate
  over a declared comparability class** (`model × effort × dispatch-kind`), never as a per-run headline ←
  **RECOMMENDED**.
- **(c)** Vector only — no scalar is ever computed.

**Why (b).** It is the only option that delivers the operator's actual goal (is efficiency improving over time?)
without asserting a comparability the data does not have. FOQA is precisely this: every flight scored, action
driven by the **aggregate** exceedance rate, not by one flight's number. And it keeps the per-finding
actionability that (a) loses — a headline of 76 tells you nothing about what to fix.

**Why (a) is Rejected.** Published trajectory-eval scores are comparable because the task set is fixed; ours is
not. A run on a size-1 doc fix and a run on a size-8 refactor scoring 76 and 76 are not equal performances, and a
headline number would be read as if they were. **Why (c) is Rejected:** it forfeits the trend the operator asked
for, and the aggregate is exactly where FOQA shows the signal actually lives.

```js
// we:scripts/conveyor/run-scorecard-store.mjs — one appended row per resolved dispatch
{
  v: 1,
  rubricVersion: '2026-09-12.1',            // Fork 3 — stamped, never re-normalised
  item: '3645',
  handle: 'conveyor-3645-build-a1',
  subjectClass: 'work-agent',               // Fork 5 — 'work-agent' | 'driver'
  model: 'sonnet', effort: 'low',           // the comparability class, with dispatchKind
  dispatchKind: 'build',
  outcome: null,                            // JOINED later when the dispatch resolves — Fork 1
  criteriaEvaluated: 14,                    // 0 ⇒ score MUST be null, never 100 (Skeptic amendment)
  deductions: [                             // THE canonical record
    { criterion: 'redundant-command',       weight: 3,  count: 4, evidence: 'read 3x @ turns 11,14,19' },
    { criterion: 'abandoned-failing-test',  weight: 12, count: 1, evidence: 'vitest red @ turn 22, never rerun' },
  ],
  score: 76,                                // DERIVED: clamp(100 - sum(weight*count), 0, 100)
}

// The aggregator — not a per-run headline (Fork 2(b)), and version-fenced (Fork 3(a)):
meanScore({ rubricVersion: '2026-09-12.1', model: 'sonnet', effort: 'low', dispatchKind: 'build' });
// rubricVersion is REQUIRED: there is no query that averages across versions, so a mix cannot be expressed
```

**Skeptic:** **SURVIVES-WITH-AMENDMENT → two amendments folded in, both real defects.** (1) **Never 100 on an
empty read.** The card cited `we:scripts/check-app-conformance.mjs:174` as the "defaults to 100" precedent and
was reading it backwards: `denom ? Math.round(...) : 100` fires the 100 **when nothing was measured**, so it
means *no information*, not *a perfect subject*. Imported as written, an unreadable or empty transcript would
score a perfect 100 — the worst possible failure for a benchmark. Amended: `criteriaEvaluated` is recorded and
`score` is **`null`**, never 100, when it is zero. (2) **The `evidence` strings are raw transcript excerpts**,
and they would land in a new store that bypasses the pre-append secret scrub
`#automated-session-introspection` clause 3 / `#3477` clause 5 ratified *specifically because* an automated
judge paraphrasing a raw transcript reopens a privacy gap a human self-report structurally could not. Amended:
`evidence` passes the same `scrubReasons` gate, denying on a hit rather than redacting — a hard requirement on
the build, not a nicety. The "(b) is (a) with a disclaimer" attack was beaten by the required-`rubricVersion`
query shape; the "a weighted sum is arbitrary" attack survives as a stated limitation, not a flip (Lighthouse's
weights are equally arbitrary and equally useful, and the vector exists so the arbitrary part is never the only
record).
**Screen:** clear — what is published is visible to every consumer of the trend, so it is not an impl detail;
and with both branches free to build, (a) still asserts a comparability the subjects lack, which is a merit
difference, not a cost one.

**Operator ruling (2026-09-13): APPROVED as recommended.** Fork 2 (b) — the deduction vector is the record;
a 0–100 scalar is derived and published only as an aggregate over a declared comparability class (`model ×
effort × dispatch-kind`), never as a per-run headline, and is `null` — never 100 — when `criteriaEvaluated` is
zero. Ratified fork-by-fork, in review across sessions; the item stays `active` (not `resolved`) pending the
remaining five forks.

# Fork 3 — Is the rubric versioned, and what happens when a criterion is added?

**Why this is a real fork — a forced invariant.** Either a historical scorecard is an immutable fact about the
rubric version that produced it, or it is re-derived when the rubric changes. A store cannot be both: a
re-normalised history and a stamped history disagree about what last month's number means, and every trend read
off them disagrees too.

- **(a)** `rubricVersion` stamped on every scorecard; history is **never** re-normalised; the aggregator takes
  a **required** `rubricVersion` so a cross-version mix cannot be expressed, and versions carry a
  `supersedes`/`supersededBy` chain so the prior version stays readable rather than fenced off ←
  **RECOMMENDED**.
- **(b)** One unversioned living rubric; old scores are simply old.
- **(c)** Versioned **and** backfilled — re-score archived transcripts whenever the rubric changes.

**Why (a).** (1) Lighthouse's own guidance, from the largest deployed version of this exact problem: a score can
move because the algorithm changed rather than the subject, so the version must travel with the number. (2) The
stamp is one field written at the moment the score is written, and the alternative is *unrecoverable* — a score
written without its version can never have one attached afterwards. (3) The prevention is structural (no query
expresses a mix) rather than a documented caveat, which is what makes it hold.

**Why (c) is Rejected.** It presumes archived transcripts, which are not durable — they age out, and `#3477`'s
own scoping already treats a transcript as a bounded, chunked read rather than an archive. It costs a full
re-judge of every historical run per rubric edit, making the rubric expensive to edit exactly when it is
youngest and most wrong. And it scores a run against criteria **the agent was never given**, which is not a
measurement of the run. **Why (b) is Rejected:** it is (c)'s drift without (c)'s honesty — the number silently
changes meaning and nothing records when.

**Two citations withdrawn in prep, recorded rather than quietly dropped.** An earlier draft cited `#441`/`#478`
(research refresh-as-new-report) as *authority* and `#2638` (pre-registered review jury) as the reason (c) is
unfair. Neither reaches this case on its own scope: `#441` is `codifiedIn: one-off`, and `#478`'s shipped
mechanism **preserves and renders** the superseded revision in both directions rather than refusing access — it
licenses a supersedes chain, not a hard fence, which is why (a)'s wording above was changed to match it.
`#2638` is a `size: 5` story with no `codifiedIn`, care-gated to elevated/high, about a *human* aligning on one
item's review bar — it does not reach retroactive re-scoring of a time series. Both are now **supporting
context**; the default is re-derived on the three merits above, which stand without them.

**Sub-question, answered rather than left open:** a rubric change is **major** (new criterion, or any weight
change) or **editorial** (wording of an existing criterion's evidence guidance). Only a major change mints a new
`rubricVersion`; an editorial one does not, because it cannot move a score.

**Skeptic:** **SURVIVES-WITH-AMENDMENT** → the stamp itself was found unrefutable ("cheap now, impossible
later"). What the attack did break was the *operative clause* and its two citations: neither `#441`/`#478` nor
`#2638` is authority for a hard cross-version refusal, and `#478` in fact ships the opposite shape. Amendment
folded in above: the fence became a **required `rubricVersion` on the query plus a supersedes chain**, matching
`#478`'s real mechanism, and both citations were downgraded to supporting context with the default re-derived
on its own merits.
**Screen:** clear — a `rubricVersion` on every published scorecard is consumer-visible by construction; and the
merit difference (does a number mean the same thing across time) survives stripping cost entirely.

**Operator ruling (2026-09-13): APPROVED as recommended.** Fork 3 (a) — `rubricVersion` stamped on every
scorecard; history is never re-normalised; the aggregator takes a required `rubricVersion` so a cross-version
mix cannot be expressed; versions carry a `supersedes`/`supersededBy` chain. Ratified fork-by-fork, in review
across sessions; the item stays `active` (not `resolved`) pending the remaining four forks.

# Fork 4 — Is 100% expected, and what makes a deduction actionable?

**Why this is a real fork.** The router needs **exactly one** predicate for "actionable". Two predicates would
disagree on the same deduction, and a finding would be simultaneously auto-applied and not.

- **(a)** 100% is the target; **every** deduction is actionable.
- **(b)** A **par band** is declared (a good run is expected to lose points). A *single* deduction is actionable
  only if its criterion is in a named **always-actionable** class; everything else accrues, and action is driven
  by the **aggregate** rate for that criterion crossing a declared threshold ← **RECOMMENDED**.
- **(c)** No expectation stated; a human reads the scorecards and decides.

**Why (b).** FOQA is the mature answer to exactly this question, and it answers it the opposite way from (a):
thresholds sit in a zone *approaching* a limit so that routine operations register exceedances as a matter of
course, and **a singular exceedance may not trigger corrective action at all** — mitigation follows the
aggregate rate. Chess makes the same point tangibly: 90–100% accuracy is grandmaster play, and grandmasters
routinely score below 100. A system that treated every inaccuracy as actionable would generate a fix request per
run forever.

**The always-actionable class, named now rather than left to build time** — each is a single-instance defect
with a named source, not a matter of degree:

| Always-actionable criterion | Source |
|---|---|
| a blacklisted operation was run | `DEFAULT_OPERATION_BLACKLIST`, `we:scripts/conveyor/hiccup-classify.mjs:94` |
| a false monitor-wait claim (prose claim, no `Monitor` tool_use) | `#3594` pattern (a) |
| a `Monitor` wait-loop whose body has no `sleep` | `#3594` pattern (b) |
| the turn ended on a passive wait for a backgrounded shell command | the pinned rule in `we:CLAUDE.md` |
| a failing test was left failing, weakened, or gamed to pass | `LENS_EXPECTATIONS[CORRECTNESS]`, `we:scripts/lib/review-core.mjs:1852` — an already pre-registered bar |
| a raw command stood in for an existing declared operation | `#automated-session-introspection` / `#3029`; `#3477`'s own mandated scan |

**Everything else accrues**: hesitation/waffling before acting, redundant or repeated reads, command churn,
over-long exploration before the first edit, a concluded external limitation accepted without checking
(doctrine rule 8), hand-dispatching what the conveyor already covers (doctrine rule 12).

**Why (a) is Rejected.** It is the failure mode the operator named directly, and FOQA/chess both show it
produces an unusable signal. **Why (c) is Rejected:** it reintroduces exactly the human-reads-every-transcript
bottleneck that `#3593` documents as not scaling and depending on someone noticing by chance.

**Skeptic:** **SURVIVES — the only clean survivor of the eight forks attacked.** Two attacks. The first landed
on provenance, not merit: two rows of the always-actionable table were traced to the wrong sources (the failing
test was attributed to doctrine rule 11, which is about symptom-relief-vs-root-cause and says nothing about
tests; the raw-command row to doctrine rule 2, which is about bespoke prompts). Both are now re-cited above to
their real, stronger sources — a correction that strengthens the fork rather than moving it. The second attack
was that a "par band" is a number nobody can justify before there is data, so shipping one is a guess dressed as
a threshold. Amendment folded in: **v1 declares no numeric par band.** The always-actionable class is absolute and ships; the accrual half ships as *recording
only*, and no aggregate threshold ships un-grounded in an observed distribution — which is how FOQA sets
thresholds too. The fork's ruling is the *shape* (single-instance class vs accrual), not a number.

**Who sets the threshold, and when — answered here rather than left as residue.** Not this decision, and not at
build time either. The rule is: **a threshold may only be proposed once one full `rubricVersion` has a complete
run population behind it** (Fork 3 makes "complete population for a version" a well-defined set, which is the
second reason that fork is load-bearing). Proposing it is then an ordinary finding through Fork 5's own routing —
it is a change to the rubric, so it is `batched`, never `selfClears`. No separate ceremony, no un-owned `N`.
**Screen:** clear — actionability is observable as "did a card appear for this run"; and (a) vs (b) differ on
whether a signal is usable at all, which is merit, not ordering.

**Operator ruling (2026-09-13): APPROVED as recommended.** Fork 4 (b) — a named always-actionable criteria
list is absolute and ships in v1; everything else accrues (recording only, no numeric par band in v1); a
threshold may only be proposed once one full `rubricVersion` has a complete run population behind it, routed
as an ordinary (batched) finding, never a separate ceremony. Ratified fork-by-fork, in review across sessions;
the item stays `active` (not `resolved`) pending the remaining three forks.

# Fork 5 — Does the SUBJECT CLASS gate auto-apply, before risk is even consulted?

The reviewed subject is not always a bounded, one-off work agent. A conveyor runner or driver is itself a
transcript-producing process — one that holds a queue, dispatches other work, and is *still running* while its
own transcript is being read. **Operator ruling, 2026-09-12, folded in during prep:** when the reviewed subject
is a conveyor/driver instance, the auditor is **report-only — no auto-fix, ever**, regardless of how low-risk a
finding looks. It emits findings and a score and hands them to whoever operates that driver (a human, or the
driver's own supervising process) to decide.

**Why this is a real fork, and it is the forced-invariant kind — a ratify, not a weigh.** The excluded branch is
*provably broken, not merely riskier*: auto-applying a fix to or around a **live** driver on an external
judge's say-so is a second, less careful path to precisely the danger the existing
`we:scripts/conveyor/driver-watchdog.mjs` + `we:scripts/conveyor/validate-and-promote.mjs` design was built to
prevent. That design is deliberately conservative — last-known-good is **recorded, never inferred**, staleness
needs a long quiet period **and** no in-flight work **and** a live lease before it acts, and healing is a
recorded rollback plus the existing `restart-runner` operation. An auditor that could mutate a running driver
because one deduction "self-cleared" would bypass all of it with none of the refusals. Two incompatible
postures over the same subject cannot coexist: one of them is always wrong.

- **(a)** Risk alone gates auto-apply; the subject class is irrelevant. **Rejected — the broken branch above.**
- **(b)** **A two-stage gate: subject class FIRST, risk SECOND** ← **RECOMMENDED (ratify).**
  - subject is a **bounded one-off work agent** (a `build` / `fix` / `prepare` / `review` / `investigation`
    dispatch that ran and finished) → Fork 6's risk dial applies as written.
  - subject is a **driver-class process** — anything that queues, dispatches, or supervises other work as part
    of its own operation → **report-only, always.** Findings are recorded and filed; nothing is applied.
- **(c)** Report-only for **everything**, driver or not.

**Why not (c), even though it is the safest.** It would collapse the entire self-improvement half of the card
for the ~95% of subjects that are bounded one-off agents, where the hazard this fork guards against simply does
not exist: a finished `build` dispatch has no queue, no in-flight work, and no live process to destabilise. The
operator's own framing draws the line at the subject class precisely so the cheap case stays cheap.

**How the class is decided — stamped at launch, never inferred afterwards.** An earlier draft proposed deriving
the class by inspecting the finished transcript against `LAUNCH_KINDS` and the runner lease. The prep skeptic
showed that is **unbuildable**, and checking the tree confirms it: `LAUNCH_KINDS`
(`we:scripts/operations/dispatch-lane.mjs:181`) is `['build','prepare','prepare-decision','fix','ci-heal']` —
`review` and `investigation` are *absent*, though both are real dispatches; `runnerLeaseStatus`
(`we:skills-src/conveyor/runner-lock.mjs:101`) returns one *live* record with no history, so "held a lease"
is unanswerable after the fact; and `we:scripts/operations/dispatch-provider-registry.mjs` does not exist on
`main` at all (it is POC-branch-only). Under the fail-closed default, every review dispatch and every
investigation would have landed driver-class, collapsing (b) into (c) in practice.

**The fix removes the inference entirely.** The launcher already *knows* what it launched — it mints the handle
before the agent exists (`we:scripts/operations/dispatch-lane-io.mjs:878`). So **`subjectClass` is stamped on
the dispatch record at launch time** and read back from there, never re-derived from the transcript. A
transcript with no dispatch record (a hand-started session, a runner) is **driver-class by default**, which
keeps the fail-closed posture without needing an enumeration that is already known to be incomplete.

**Two consequences worth stating so they are not discovered later.** (1) The scorecard carries `subjectClass`
(see Fork 2's snippet), so a later reader can tell why nothing was applied — and so the aggregator never mixes
driver runs into a work-agent class. (2) This is **narrower than a general "don't act on live systems" rule**;
it deliberately says nothing about a driver acting on *itself* through the existing validate-and-promote path,
which stays exactly as ruled.

**Statute reconciliation — a sibling anchor already governs the neighbouring case, and it must be cited, not
re-derived.** `#2077`, codified as a rider under `#pr-flow-rollout-mechanism` in
`we:docs/agent/platform-decisions.md`, already rules: *"the run's own executing tooling is never modified in the
checkout a live run executes it from — the edit itself is ordinary work that lands like any other change and
takes effect on the **next** run."* Its cited prior art is the uniform CI pattern: GitHub Actions pins the run's
workflow definition at run start, Jenkins pins shared-library versions per run, and merge bots run from a
deployment outside the tree they land. **How the two compose, stated so ratification never inherits an
unreconciled conflict:** they key on *different tests* and neither subsumes the other. `#2077` keys on the
edit's **touch-set** (does it hit `RUN_TOOLING`); this keys on the **subject class** that produced the
transcript. Each catches what the other misses — an auditor fix entirely outside `RUN_TOOLING` (say, rewriting
the delivery brief the driver is about to hand its next dispatch) passes `#2077` and is still exactly the hazard
this fork names; conversely a work-agent-class fix that *does* touch `RUN_TOOLING` passes this fork and is still
caught by `#2077`. **So an auto-applied fix must clear both.**

**The second statute neighbour, found by the prep skeptic and decisive for how this is worded.**
`#drain-daemon-self-hosting-boundary` (`we:docs/agent/platform-decisions.md`, `#2501`, ratified 2026-07-27)
governs the nearest turf — automated change to a live daemon's own source — and its clause 3 ruled **against** a
blanket posture: such a change is "**NOT** special-cased to always-human review" and "**NOT** promoted to the
policy tier", going instead through "the standard size/complexity-scaled review committee… exactly like any
other change", with **one** retained invariant: *"the review must be **INDEPENDENT** — the self-updating daemon
and its authoring agent may **never self-approve their own daemon-code change**."*

**Read carelessly this refutes Fork 5; read correctly it is the same rule.** Fork 5's report-only does **not**
mean human-only and does **not** promote anything to a policy tier — it means the finding goes through the
*normal graduated committee like any other change* (filed, reviewed, landed) instead of being applied by the
auditor directly. An auditor auto-applying its own finding about a driver *is* the self-approval hole
`#2501` closed, reached by a non-PR path: the judge would be both author and approver of a change to the thing
it just judged. **So Fork 5 is an entailment of `#2501`'s independence invariant, not a stricter rival
rule** — and the card must say so, because a future reader who finds `#2501` first would otherwise read them as
conflicting.

**Fork 5 sub-fork — does this ruling earn its own statute anchor, or `codifiedIn: one-off`?**

- **(i)** `codifiedIn: one-off` — a narrow call about this one mechanism.
- **(ii)** **A rider under `#drain-daemon-self-hosting-boundary`**, extending its independence invariant from
  the PR path to the automated-judge path ← **RECOMMENDED** (re-sited during prep; an earlier draft proposed a
  free-standing anchor beside `#2077`, before `#2501` was found to be the closer neighbour).

Why (ii): the rule generalizes past this card by construction — *an automated judge never approves its own
finding against the subject it judged; it reports and hands off* — and a rider keeps it visibly a *restatement*
of an existing invariant rather than a second, competing one. The rest of this card genuinely is `one-off`;
**this fork is the only part that earns statute**, and the ruling should say so rather than stamping the whole
card.

**Skeptic:** **SURVIVES-WITH-AMENDMENT → two amendments, both structural; the verdict returned was REFUTED and
is recorded as partially sustained.** The skeptic's two kills were (i) a statute collision with
`#drain-daemon-self-hosting-boundary` and (ii) that the classifier could not be built as described, so (b)
degrades to (c) in practice. **(ii) was sustained in full** — verified against the tree: `LAUNCH_KINDS` really
does omit `review`/`investigation`, the lease really has no history, and the registry really is POC-branch-only.
The classifier was rebuilt to stamp-at-launch, which removes the inference rather than patching it, and the
degradation argument falls with it. **(i) was sustained as a reconciliation, not as a refutation**: `#2501`
rejects a blanket *human-review* posture, which Fork 5 does not propose; its retained **independence**
invariant is what Fork 5 restates on a non-PR path, so the two compose — now written into the fork above, and
the codification re-sited from a free-standing anchor to a rider under `#2501`. The ruling itself stands as the
operator set it. The remaining attack — "make auto-apply a config knob, it's support-both" — fails the standing
test: a knob whose wrong setting is the broken branch is a forced invariant with a footgun attached, not a
config dimension.
**Screen:** clear — whether a fix was applied is directly observable in the tree, so this is not an impl
detail; and with both branches free to build and instantly maintained, (a) still permits an unreviewed mutation
against a live queue-holding process, which is a correctness difference, not a cost or ordering one.

**Operator ruling (2026-09-13): APPROVED as recommended.** Fork 5 (b) + (ii) — a two-stage gate, subject class
FIRST and risk SECOND: a driver/conveyor-class subject is report-only, always, regardless of risk, with
`subjectClass` stamped at dispatch launch time and never inferred from the transcript afterward; codifies as
a rider under `#drain-daemon-self-hosting-boundary` (`#2501`). Ratified fork-by-fork, in review across
sessions; the item stays `active` (not `resolved`) pending the remaining two forks.

# Fork 6 — Within the work-agent class, what AXIS decides "low-risk enough to auto-apply"?

**Why this is a real fork — a forced invariant, so a ratify rather than a weigh.** `#3422`'s ratified axis is
*did the tick get blocked* — deliberately narrow and computed directly off tick state. Apply it here and a
run-quality finding on a **successful** run is non-blocking by definition, which `#3422` rules goes "file the
card only, **no fix proposed**, straight through with no gate." That is the exact opposite of auto-applying a
fix. So (a) is the *provably broken* branch, named per the fork-existence rule.

This fork runs **only after Fork 5 has classified the subject as a work agent.** A driver-class subject never
reaches it.

- **(a)** `#3422`'s blocking/non-blocking axis — **Rejected: it computes the wrong answer**, not merely a
  worse one.
- **(b)** **A risk assessment of the *proposed fix itself*, with a destructive-operation blacklist checked
  first and independently of any confidence judgment** ← **RECOMMENDED (ratify)**. Blacklist hit → file and
  hold behind the approval gate; any flagged risk criterion (security · data-leak · performance · blast-radius ·
  baseline-correctness) → file a card, no auto-apply; clean → auto-apply.

So the answer to "should this reuse `#3422`'s gated-approval mechanism rather than inventing a second one" is
**yes for the transport, no for the axis** — and the right axis is already ratified immediately next door.

**Supported by default, not forked — which code computes it.** The fresh-context screen flagged an earlier
draft that made "the existing `assessMissingOperationConfidence`" versus "a new run-quality risk config" a fork,
and the flag was correct: both branches can be tuned to auto-apply the identical set of findings, so the
difference is maintenance cost, not merit. Recorded as the default instead: **reuse
`assessMissingOperationConfidence` (`we:scripts/conveyor/hiccup-classify.mjs:114`)**, which already returns
exactly `{selfClears, batched, escalate}` off `DEFAULT_OPERATION_BLACKLIST` (`:94`) plus `CONFIDENCE_CRITERIA`
(`:89`). If the five criteria prove too coarse, widening *them* is the move — already contemplated by `#3422`'s
own "widen to a richer risk config later."

**But "reuse `#3422`'s transport unchanged" was FALSE, and the correction is real build work the ruling must
budget for.** Read directly: `fileHiccup` (`we:scripts/conveyor/hiccup-sink.mjs:88`) calls `summaryFor`, which
**throws** on any kind but `guard-suppression`/`free-form-response`; it **ignores** the caller's `summary` and
**ignores** `blocking`, hardcoding `kind: 'friction'`, `blocking: true`, `approvalPending: true` and a fixed
re-dispatch `suggestion`. Its own header says why — "this file only exists for the NEW blocking path." So the
`batched` → file-a-card / `escalate` → file-and-gate mapping collapses through it: *every* routed finding would
be stamped blocking and held. Its dedup (`isUnresolvedDuplicate`) also keys on **exact summary text**, safe only
because hiccup summaries are deterministic per `(kind, num, by)` — LLM-authored run-quality summaries are not,
so the pool would flood. **The pattern is reusable; the function is not.** What is genuinely reused is the
*shape* — a pool entry carrying `approvalPending`, cleared by `we:scripts/conveyor/hiccup-approve.mjs`, held
out of clustering at `we:scripts/conveyor/learnings-harvest.mjs:182` — and a sibling sink plus a
non-text-keyed dedup is owed work, not a free import.

**And `selfClears` does not mean "no review" — it means "no HUMAN".** `assessMissingOperationConfidence`'s own
docblock (`we:scripts/conveyor/hiccup-classify.mjs:105-108`) says the axis decides "whether a **HUMAN** also has
to look at it", because "every built operation still gets an agent review, **always**." An earlier draft mapped
`selfClears` to *unreviewed* auto-apply, inverting it. Corrected: `selfClears` → the fix is applied **through
the normal review path** without a human gate, never outside review. Relatedly, the auto-apply itself must go
through a declared typed operation, not a command string — `#agent-mutations-through-typed-operations` rejects
`run(script, args)`-style pass-through by name, and the snippet below is written to that shape.

```js
// we:scripts/conveyor/run-quality-route.mjs — the router. The DIAL is reused; the SINK is a sibling, NOT
// hiccup-sink's fileHiccup (which throws on an unknown kind and hardcodes blocking/approvalPending).
import { assessMissingOperationConfidence } from './hiccup-classify.mjs';
import { fileRunQualityFinding } from './run-quality-sink.mjs';   // owed work, not a free import

// Fork 5 runs FIRST, off the launch-time stamp, and no finding's own risk verdict can override it.
const reportOnly = scorecard.subjectClass !== 'work-agent';

for (const d of scorecard.deductions) {
  if (!d.proposedFix) continue;                       // recording-only criteria (Fork 4) never route
  const risk = assessMissingOperationConfidence({
    call: d.proposedFix.command ?? '',                // '' for a non-command fix — flaggedCriteria carries it
    criteria: d.proposedFix.flaggedCriteria,          // subset of CONFIDENCE_CRITERIA; REQUIRED, not optional
  });
  if (risk.selfClears && !reportOnly) {
    // `selfClears` = no HUMAN gate, NOT no review. Applied through a declared typed operation, taking
    // the normal review path (#agent-mutations-through-typed-operations rejects command pass-through).
    applyThroughOperation(d.proposedFix.operation, d.proposedFix.input);
    continue;
  }
  fileRunQualityFinding({                             // else → the same GATE SHAPE #3422 ratified
    summary: d.summary, area: d.criterion, proposedFix: d.proposedFix,
    approvalPending: true, blocking: risk.escalate,   // honoured here, unlike fileHiccup
    dedupKey: `${scorecard.item}:${d.criterion}`,     // NOT summary text — LLM-authored text is not stable
  }, { session: scorecard.handle });
}
```

**Skeptic:** **REFUTED on the reuse claim, SURVIVES on the axis → the fork was narrowed, not flipped.** The
verdict returned was "flip to (c), or rebuild (b) from the ground", and on the transport it is right — verified
by reading `we:scripts/conveyor/hiccup-sink.mjs:88` directly: `fileHiccup` throws on an unknown kind, ignores
the caller's `summary` and `blocking`, hardcodes `approvalPending` and a fixed re-dispatch `suggestion`, and
dedups on exact summary text. "Reuse it unchanged" was false; the sibling sink above is the rebuild, and it is
now costed as owed work rather than assumed free. The skeptic also correctly caught the `selfClears` inversion.
What the attack does **not** touch is this fork's actual question, the **axis** — nothing in it defends
`#3422`'s blocking/non-blocking dial, which remains the provably wrong answer. A second attack holds and is
folded in: the dial was authored to judge *one shell command against a blacklist*, so a doc- or brief-shaped fix
would be vacuously clean — hence `flaggedCriteria` is **required**, keeping `blastRadius`/`baselineCorrectness`
operative for the non-command case.
**Statute-overlap check:** `#3422` carries **no** `codifiedIn` by choice ("shapes a not-yet-built mechanism"),
so nothing collides on the routing axis. The one real collision the skeptic found —
`#agent-mutations-through-typed-operations` versus a bare `applyFix(command)` — is **sustained** and fixed in
the snippet above; that anchor rejects `run(script, args)`-style string pass-through by name.
**Citation-scope check:** `#3422` is authority here only over the *gate shape*, which is its authoring scope;
its *axis* is cited as the thing **rejected**, not as authority; and the claim that its *transport* transfers is
**withdrawn**.
**Screen:** clear — which findings auto-apply is visible in the tree, and the axis keeps a right-vs-wrong merit
difference with effort stripped out. The screen's `impl` flag on the earlier module-choice framing was
**accepted**, and that half was dissolved into the default above rather than left as a fork.

**Operator ruling (2026-09-13): APPROVED as recommended.** Fork 6 (b) — a risk assessment of the *proposed fix
itself* (`assessMissingOperationConfidence`), blacklist checked first and independently of any confidence
judgment; blacklist hit → file and hold behind the approval gate, any flagged risk criterion → file a card
with no auto-apply, clean → auto-apply through a declared typed operation via a sibling sink (not
`fileHiccup`). Ratified fork-by-fork, in review across sessions; the item stays `active` (not `resolved`)
pending the last fork.

# Fork 7 — Does the auto-apply half ship in v1 at all, or is v1 recording-only?

**Promoted from prose by the fresh-context screen, which was right to flag it.** An earlier draft parked this as
a closing "honest counter-argument", where it was the single biggest live choice on the card sitting outside any
fork — and it overrides the recommended answers to Forks 4, 5 and 6 at once.

**Why this is a real fork.** Fork 5 already makes report-only *mandatory* for driver-class subjects. Extending
that to every subject for v1 and shipping the router in v1 cannot both be true, and the choice is not
sequencing: the two ship different products on day one, and the recording-only branch collects the very
distribution the other branch's thresholds would need.

- **(a)** Ship all five pieces in v1 — score, store, gate, and route, with auto-apply live for the work-agent
  class.
- **(b)** **v1 is recording-only for every subject class: score every run, persist every scorecard, publish no
  aggregate and auto-apply nothing. The router is built but disarmed behind a single flag, flipped only once one
  complete `rubricVersion` population exists** ← **RECOMMENDED**.
- **(c)** v1 is the rubric and the scorecard only; the router is not built at all until later.

**Why (b).** Three of the five pieces only pay off at volume — a trend over a handful of runs says nothing, and
Fork 4's accrual thresholds are *by construction* underivable until a population exists. Auto-apply is
simultaneously the riskiest half and the half shipping against the least evidence, which is the worst possible
pairing. (b) buys the evidence at the cost of one flag. It is also what FOQA did historically: collect first,
set thresholds from the observed distribution, then act.

**Why (c) is Rejected, and this is the non-obvious part.** Deferring the router entirely sounds safer than
disarming it, but it is worse: an unbuilt router means the rubric is authored with no consumer, so nothing forces
each criterion to carry a *proposable fix* — and a criterion with no fix is exactly the vague finding this whole
mechanism exists to avoid emitting. Building the router and disarming it keeps the rubric honest. **Why (a) is
Rejected:** it asserts thresholds it cannot yet have.

**What this does NOT weaken.** Fork 5 stays a hard invariant, not a v1 convenience — when the flag is eventually
flipped it flips for the work-agent class only, and a driver-class subject remains report-only permanently.

**Skeptic:** **SURVIVES — and the skeptic reached this fork's default independently, from the opposite
direction.** This fork was promoted out of parked prose *after* the skeptic ran, so it was not attacked under
this heading; but the attack on Fork 5 landed squarely on its content, concluding that the auto-apply half
"degrades to (c) in practice — so rule (c) honestly, which is the card's own counter-argument." That is an
independent arrival at recording-only as the v1 posture, from a reviewer trying to refute rather than to agree.
The one attack that could still be made — "recording-only is just deferral, i.e. prioritization" — is answered
in the fork body: (b) and (c) ship *different* artifacts on day one, and (c)'s unbuilt router is what lets a
criterion ship with no proposable fix.
**Screen:** clear — whether v1 ever mutates anything is the most consumer-visible property on the card; and
(b) vs (c) differ on whether the rubric is forced to carry fixes, which is a merit difference surviving with
cost stripped out. *(This fork exists **because** the fresh-context screen flagged it as the biggest live choice
on the card sitting outside any fork — it is the screen's own finding, promoted.)*

**Operator ruling (2026-09-13): APPROVED as recommended.** Fork 7 (b) — v1 is recording-only for every subject
class: score every run, persist every scorecard, publish no aggregate, auto-apply nothing; the router is built
but disarmed behind a single flag, flipped only once one complete `rubricVersion` population exists.

**All seven forks are now ratified (2026-09-13).** See `## Ruling` below for the consolidated ruling,
`codifiedIn`, and the durable router-arm follow-up.

---

## The watchdog precedent does NOT transfer — recorded as a withdrawn fork, not a ruling

An earlier draft made this `# Fork 6` ("must the auditor obey the watchdog's shared-code-is-shared-failure
rule?"), defaulting to a pinned, `toEqual`-asserted import graph for the reader and scorer. **The fresh-context
screen flagged it `impl` and the prep skeptic refuted it outright. Both were right, and the fork is withdrawn
rather than re-defaulted** — this is the prep pass's most substantive reversal and is recorded in full so a
later session does not re-propose it.

**Why the analogy fails, on the watchdog's own stated reason.**
`we:scripts/conveyor/driver-watchdog.mjs:26-32` (on `lane/mechanical-dispatcher`) explains that its graph is
pinned because it must answer **the very same question the driver answers** — *"is there eligible work?"* — and
would otherwise inherit the same wrong answer, so it answers it "minimally, from the queue sidecar's own
bytes… the dumbness is the feature." A run-quality scorer asks a question the dispatcher **never asks**:
`we:scripts/conveyor/tick-core.mjs`, `we:scripts/readiness/dispatch-plan.mjs` and
`we:scripts/operations/dispatch-lane.mjs` hold no quality predicate at all. So the proposed exclusion list
forbids imports the scorer never wanted — a no-op invariant carrying a real cost, which is the definition of
cargo-culting a rule past its reason.

**What survives, re-layered to where it belongs.** The genuine concern — a scorer must not inherit the
dispatcher's own notion of a good run — is a **rubric-provenance** constraint, not an import-graph one, and it
is already discharged by Fork 3 and by the rubric's sourcing: the criteria come from written doctrine, the
pinned `we:CLAUDE.md` rule and `we:agent-memory-src/`, never from the dispatcher's code. No test, no allow-list,
no ruling owed.

**One live hazard the withdrawal surfaces, kept visible rather than dropped:** `#3594` (`status: open`,
`size: 8`) lists `we:skills-src/inspect-agent-health/agent-health.mjs` in its own `scope:`, so the transcript
parser this design leans on (`summarizeEntry`, `flattenToolResultText`) is under concurrent rewrite. That is a
sequencing fact for the build items, not a fork.

## Ruling, not a fork — the relationship to `#3475`/`#3477` and the `#3593` family

An earlier draft made this `# Fork 8`; the screen flagged it `impl` and the flag holds. Once `(c) subsume` is
removed, what remains is **one reader or two**, which is work-ownership, not merit. Recorded as a scope boundary
instead.

**(c) is removed on live statute, and a bad citation is withdrawn.** `#3475` is `status: resolved`, ratified
2026-09-04, and codified at `we:docs/agent/platform-decisions.md#automated-session-introspection` — a standing
anchor, so "close it and rebuild" is not a move this card gets to make; the honest routes are compose, or file a
reconciliation decision. An earlier draft justified that with **`#1886`, cited as "a ratified call is
immutable". That citation was wrong and is withdrawn**: `#1886` is a `<we-card>` substrate-boundary decision
(`codifiedIn: …#identity-semantic-look-composable`) containing no immutability rule, and — as the prep skeptic
pointed out — its own body is headed "REOPENED", so it argued the opposite of what it was cited for. The
conclusion stands on the live anchor alone.

**A reconciliation this card owes, surfaced by the skeptic and not resolvable by assertion.** `#3475` Fork 3
ratified the *destination*: the existing pool and schema, "rather than forking a second pool", together with the
reinstated scrub — chosen **specifically because** an automated judge reading a raw transcript reopens a privacy
gap. Fork 2 here introduces a second store for the same judge pass's output. By this card's own standard that is
exactly the reconciliation it denies to (c). Two things make it a reconciliation rather than a contradiction,
and the ruling must state both: (1) the pool *structurally cannot* hold a scorecard — `ALLOWED_KEYS` rejects
unknown keys and `FIELD_CAPS` caps `summary` at 240 chars — so this is a capability gap, not a preference; and
(2) the scorecard store inherits the same scrub, denying on a hit (Fork 2's second amendment), so the privacy
reason behind `#3475` Fork 3 is honoured rather than escaped. **The ruling should name this as an explicit,
narrow amendment to `#automated-session-introspection` clause 3** — findings keep the pool, scores get a second
destination under the same scrub — rather than letting it land as undeclared drift.

**The ruling: this EXTENDS `#3475`/`#3477`, and `#3477` stays the single transcript reader.** Two readers over
one artifact is exactly what `#3422` Fork (c) rejected by name ("a second judgment pipeline risks the two
disagreeing over time"). `#3477` already builds: a transcript judge pass,
three triggers, a bounded/chunked read of a transcript observed up to 58 MB, a `learnings-drop`-shaped emission,
an `origin: auto-introspection` field, and a pre-append secret scrub. **That is the reader.** A dispatched lane
agent is a top-level `claude --session-id` process, not an Agent-tool subagent, so of those three triggers the
**reaper and `SessionEnd` reach it and `SubagentStop` does not** — a correction worth carrying, not a blocker.

What is genuinely new here, and is the entire honest scope of this card:

| Half | Owner |
|---|---|
| transcript reader, trigger plumbing, scrub, pool emission | **`#3477`** — reuse, do not rebuild |
| the **rubric** (criteria + weights + evidence guidance) | **new, this card** |
| the **scorecard store** and its versioned trend | **new, this card** — the pool's `ALLOWED_KEYS`/`FIELD_CAPS` cannot hold it |
| the **subject-class gate** and the **risk router** | **new, this card** — `#3475` routes everything to the pool and waits for `/harvest` |
| widening transcript resolution to a session-level dispatched agent | **a `scope:` addition to `#3477`** |

**So, said plainly: this is not "just a criteria-expansion of `#3475`", but it is closer to one than the original
framing assumed.** `#3475`'s rubric is a place a criterion *could* be added — and the always-actionable
missing-operation scan already is one. What a criteria-expansion cannot give you is a score, a rubric version, a
trend, a subject-class gate, or an auto-apply path, because `#3475` Fork 3 ratified a destination (the pool)
whose schema structurally excludes all five.

**The other three, each checked:**

- **`#3593`/`#3594`/`#3592`/`#3617` — separate, and should stay separate.** Different subject (the **live**
  fleet, not a completed run), different method (deliberately **syntactic** — a regex for a false monitor claim,
  a static check for a sleepless `Monitor` loop), different output (report-only). `#3593`'s own text partitions
  the problem into a syntactically-checkable half and a judgment half; run-quality scoring sits wholly in the
  judgment half. **One real seam:** `#3594`'s two patterns are named in Fork 4's always-actionable class, so this
  card should *consume* its detectors rather than re-implement them once it ships.
- **`#2436` — separate, already shipped, and narrower.** It is the only thing in the repo that scans a
  transcript for efficiency, but at a **human** session close, over exactly two criteria, emitting a bounded
  prose table with no score and no routing. It is evidence the criteria are real; it is not this.
- **`#2822` — parent principle, not a competitor.** Its thesis is that autonomous steps must self-improve
  without waiting for a human `/close`. A run-quality benchmark is a concrete instance of that principle. This
  card does **not** subsume it, and `#2822`'s blameless-post-mortem framing ("why did the creator get this
  wrong?") is a live constraint on the rubric's wording.

**The counter-argument this ruling had to beat**, raised by the prep skeptic: if `#3477` owns the reader, close
this card and file small stories against `#3477` instead. It does not land, because the surviving forks each
name a genuinely excluded branch (Forks 2, 3, 5, 6 and 7), and folding them into `#3477`'s build would be
exactly the "decide it at build time" the prepared-fork rule exists to prevent. It did land hard enough to
change the card's *claim*: the "genuinely new mechanism" framing was overstated, and the scope table above
replaces it.

---

## Ruling (ratified 2026-09-13)

All seven forks ratified by the operator (Nicolas Gilbert), fork-by-fork across sessions, each as
recommended — see the `Operator ruling` line closing each `## Fork N` section above; consolidated
statement below. **`codifiedIn: we:docs/agent/platform-decisions.md#drain-daemon-self-hosting-boundary`** —
per Fork 5's own sub-fork, only Fork 5's independence-invariant restatement earns statute; the rest of this
card is `one-off`. The rider is written into that anchor.

**Durable follow-up — arming the router.** Fork 7 ships the router built but disarmed for v1. The trigger to
flip it ("one complete `rubricVersion` population exists") is not left in chat: it is filed as its own
tracked card, `xsptg6b` ("Arm the run-quality router once v1's rubricVersion has a complete run population"),
parked `maturityGated` with a named `adoptionSignal` trigger and `blockedBy: ["3649"]`. It is JIT-numbered at
land per this repo's convention (bornAs `xsptg6b`).

## Recommendation, in one place

**Fork 1 (a)** score at the agent's own session end, on `#3477`'s existing triggers, joining the outcome later ·
**Fork 2 (b)** the deduction vector is the record, the scalar publishes only in aggregate over a declared class,
`null` when nothing was measured · **Fork 3 (a)** stamp `rubricVersion`, never re-normalise, supersedes chain ·
**Fork 4 (b)** a named always-actionable class plus accrual, no numeric par band in v1 · **Fork 5 (b) + (ii)**
subject class gates first off a launch-time stamp — a driver-class subject is report-only, always — and that one
rule codifies as a rider under `#drain-daemon-self-hosting-boundary` · **Fork 6 (b)** the axis is a risk
assessment of the proposed fix with the blacklist checked first, never `#3422`'s blocking axis · **Fork 7 (b)**
v1 is recording-only, with the router built and disarmed behind one flag.

Concretely, the mechanism becomes five pieces, only four of which are new:

1. **The reader** — `#3477`'s judge pass, widened to resolve a session-level dispatched-agent transcript. Not
   built here. **Sequencing hazard:** `#3594` (`open`, `size: 8`) has
   `we:skills-src/inspect-agent-health/agent-health.mjs` in its own `scope:`, so the parser this leans on is
   under concurrent rewrite.
2. **The rubric** — a frozen, versioned criteria map in the `LENS_EXPECTATIONS`/`LENS_HUNT_BRIEF` form, seeded
   from what this repo already wrote down: the 12 rules of
   `we:skills-src/mechanical-delivery-doctrine/SKILL.md`, the pinned passive-wait rule in `we:CLAUDE.md`,
   `#3594`'s two syntactic patterns, and 267 notes in `we:agent-memory-src/`.
3. **The scorecard store** — `we:scripts/check-app-conformance.mjs`'s burndown *shape* (an append-only per-run
   row plus a derived percentage), but **not** its 100-when-nothing-measured default, which means *no
   information* and would score an unreadable transcript perfect. Version-stamped, class-fenced, and passing the
   same `scrubReasons` gate the pool does.
4. **The subject-class gate** — `subjectClass` stamped on the dispatch record at launch, read back, never
   inferred from the transcript; no dispatch record ⇒ driver-class.
5. **The router** — `assessMissingOperationConfidence` for the dial, a **sibling sink** for the transport
   (`fileHiccup` cannot be reused: it throws on an unknown kind and hardcodes `blocking`/`approvalPending`), and
   the existing approve/harvest gate. Auto-apply runs through a declared typed operation and still takes the
   normal review path. Unreachable for a driver-class subject, and disarmed entirely in v1.

**What prep changed, stated plainly rather than buried.** This card arrived at prep claiming a genuinely new
mechanism with eight forks and reuse that was "free". The skeptic and the fresh-context screen between them
**flipped one fork** (Fork 1, on verified code: the run record is juror-only and `we:scripts/operations/engine.mjs:334`
throws otherwise; the transcript may already be reaped at the proposed seam), **withdrew one fork entirely**
(the watchdog import-graph rule does not transfer — the dispatcher holds no quality predicate to inherit),
**dissolved two more** to a default and a scope boundary, **promoted one** out of parked prose (the v1 posture),
**withdrew three citations** (`#1886` wrong item; `#441`/`#478` and `#2638` over-scoped), **retracted the "reuse
the transport unchanged" claim** outright, and **surfaced two live statute neighbours** (`#2077` and
`#drain-daemon-self-hosting-boundary`) plus one owed amendment to `#automated-session-introspection`. The
benchmark framing and the operator's driver-class ruling both survived intact.

## Relationships

- **Parent `#3383`**, matching `#3422`, `#3639` and `#3648` — the dispatcher machinery this scores.
- **`#3475` (resolved) / `#3477` (open)** — extended, not subsumed. `#3477` stays the single transcript reader
  and gains one `scope:` item (session-level transcript resolution).
- **`#3422` (resolved)** — its **gate shape** is reused (an `approvalPending` pool entry, the approve verb, the
  harvest hold); its blocking/non-blocking *axis* is the wrong dial and is rejected in Fork 6; and the claim
  that its *transport function* transfers is **withdrawn** — `fileHiccup` is blocking-only by construction.
- **`#3593`/`#3594`/`#3592`/`#3617`** — separate: live fleet, syntactic, report-only. `#3594`'s detectors are
  consumed by Fork 4's always-actionable class once they ship, and `#3594` also owns a rewrite of the transcript
  parser this design reads through — a sequencing dependency, not a conflict.
- **`#2436` (resolved)** — shipped precedent for transcript efficiency scanning at a human close; narrower.
- **`#2822` (open epic)** — the principle this instantiates; not subsumed.
- **`#3095` (resolved)** — hardened the *other* "observer", which is why this concept is named differently.
- **`#2077` (resolved, `#pr-flow-rollout-mechanism` rider)** — the touch-set test; composes with Fork 5's
  subject-class test, neither subsuming the other. Its CI prior art (pin the run's definition at run start) is
  the external grounding for Fork 5.
- **`#2501` (resolved, `#drain-daemon-self-hosting-boundary`)** — the closest statute neighbour. Fork 5 is an
  entailment of its **independence** invariant on a non-PR path, and codifies as a rider under it.
- **`#3029` / `#agent-mutations-through-typed-operations`** — governs the auto-apply call shape; a command-string
  `applyFix` was rejected against it during prep.
- **Citations withdrawn in prep, recorded so they are not re-added:** `#1886` (cited as "a ratified call is
  immutable"; it is a `<we-card>` substrate decision with no such rule, and is itself headed "REOPENED"), and
  `#441`/`#478` + `#2638`, both downgraded from authority to supporting context on Fork 3.
- Checked with `node we:scripts/capability-search.mjs` immediately before filing: verdict PARTIAL, nearest hits
  `#2822`, `#3629`, `#3193`, `#3280`, `#3580` and `we:scripts/operations/review-pr.mjs` — each read, none this.

### Review jury (provisional — pre-registered #2638)

Care level: `elevated`. This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |

**Predicted touch-set (#2619), which is also each buildable child's `scope:` slice** — the rubric child takes
`we:scripts/conveyor/run-quality-rubric.mjs`; the scorer child `we:scripts/conveyor/run-quality-scorer.mjs`; the
store child `we:scripts/conveyor/run-scorecard-store.mjs`; the router child
`we:scripts/conveyor/run-quality-route.mjs` + `we:scripts/conveyor/run-quality-sink.mjs`; the subject-class stamp
`we:scripts/operations/dispatch-lane-io.mjs`; the reader widening rides `#3477`'s own scope. Deliberately sliced
so no two children share a prefix (#2609) — the decision item itself carries no build `scope:`.
