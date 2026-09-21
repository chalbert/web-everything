# Grounding the delegation-graduation model — what the code already decides, and the five calls left open

**Date:** 2026-09-20 · **For:** decision [#3690](/backlog/3690-track-and-consider-graduating-session-initiated-codex-delega/)
(`/prepare` pass) · **Downstream:** [#3717](/backlog/3717-choose-the-dispatch-provider-mechanically-from-fixed-criteri/),
which wires `we:scripts/lib/provider-routing.mjs` into the dispatch path and asks the operator to ratify
#3690 first.

Everything below marked **verified** was run against `origin/main` at `e7206136d` on 2026-09-20. Nothing
here is recalled.

---

## 1. What is already built, and what it already decides

`we:scripts/lib/provider-routing.mjs` (779 lines, pure, no filesystem or `process` reads) implements the
graduation model #3690's `## Progressive backdown plan` proposes — as running code, with **zero callers**
(#3717's own survey; re-confirmed here).

Two functions:

| Function | Answers | Returns |
|---|---|---|
| `selectProvider(task, context)` | *which provider runs the work* | `gemini` · `codex` · `both` · `claude` (+ `claudeTier`, `alternateBackend`, `auditTrail`, `explorationHint`) |
| `selectSupervisionLevel(provider, model, taskType, scorecards, thresholds)` | *how much checking the result gets* | `full` · `spot-check` (+ `auditTrail`) |

It is tempting to read these as two independent dials — routing versus graduation — and the operator's
2026-09-19 acceptance test ("no model judgment anywhere between the dispatch kind and the chosen provider")
names only the first, while #3690's body is about the second. **That reading is wrong, and checking it is the
single most load-bearing finding in this report.**

`isCleanRecord` (`we:scripts/lib/provider-routing.mjs:246`) is read by `evaluateProviderFitness` at `:339` and
`:347` — **one** clean verified trial plus a clean most-recent row makes a provider *fit to be handed the
work*. `isInformativeRecord` (`:252`) is read **inside `selectProvider`** at `:506` and `:512`, to decide the
`both` dual-dispatch branch. It is also read by `selectSupervisionLevel` at `:725`.

So the two functions share one store and both of this decision's predicates. Accumulating clean rows already
buys something other than lighter checking: it buys **being selected to do the work at all**, at **N = 1**,
with no operator act. Any ruling that changes either predicate changes `selectProvider`'s output too.

The graduation rule, as coded (`selectSupervisionLevel`, lines 665–779):

1. **Unit of trust** — the exact `{provider, model, taskType}` triple; the filter is a literal three-field
   equality (`r.provider === provider && r.model === model && r.taskType === taskType`).
2. **Trailing clean streak** — walk records newest-first by `scoredAt`; count consecutive `outcome === 'landed'`
   rows; `verifiedBy: 'other'` rows are skipped entirely (neither advance nor break); the first non-`landed`
   verified row stops the walk. Threshold `minCleanStreak` defaults to **5**.
3. **Informative-trial requirement** — `hasInformativeTrial` is true iff some row EVER recorded for the
   triple satisfies `isInformativeRecord` (lines 250–257): `verifiedBy ∈ {claude-subagent, independent-claude}`
   **AND** `outcome ∈ {rejected, reworked}` **AND** `findings` non-empty.
4. **Calibration-miss hard veto** — if the most recent *verified* row is not `landed`, the result is `full`
   regardless of anything else.
5. `spot-check` iff streak ≥ 5 **and** (informative not required **or** one exists).

`isCleanRecord` is fail-closed: anything other than `outcome === 'landed'` is unclean, including a missing
field.

## 2. The live data, and what the model says about it today

`we:scripts/conveyor/run-scorecards.json` holds **26 records**, every one `dispatchKind: 'session-delegation'`
— no record yet comes from a mechanical dispatch kind. Range `2026-09-15T01:00Z` → `2026-09-19T11:58Z`.

Distribution (**verified**, computed from the file):

- outcome — `landed` 22 · `reworked` 3 · `rejected` 1
- `verifiedBy` — `independent-claude` 17 · `claude-subagent` 8 · `other` 1
- taskType — `other` 10 · `bugfix` 7 · `conflict-resolution` 6 · `doc-fix` 2 · `self-fix` 1

Running `selectSupervisionLevel` over every triple present in the store (**verified**, 2026-09-20):

| Triple | Level today | Why |
|---|---|---|
| `codex · gpt-6-astra · other` | **`spot-check`** | streak 5, informative trial exists |
| `antigravity · gemini-3.8-flash-low · conflict-resolution` | `full` | streak **5**, but **no** informative trial |
| `codex · gpt-6-astra · bugfix` | `full` | streak 3 |
| `codex · gpt-6-astra · doc-fix` | `full` | streak 2 |
| `codex · gpt-6-astra · conflict-resolution` | `full` | streak 1 |
| `codex · gpt-6-astra · self-fix` | `full` | streak 1 |
| `antigravity · gemini-3.8 · other` | `full` | streak 1 |
| `claude-native · claude-sonnet-5 · other` | `full` | streak 1 |
| `antigravity · gemini-3.1-pro · other` | `full` | streak 0 (`verifiedBy: other`) |
| `antigravity · claude-sonnet-4-6 · other` | `full` | **calibration veto fired** (most recent verified row `rejected`) |

**One triple has already graduated**, and it is `codex · gpt-6-astra · other` — where `other` is the
catch-all #3717 describes as the taskType that "cannot be derived" from any dispatch kind (10 of the 26
rows). The model is not hypothetical; it is live and it has already moved a dial.

## 3. The finding that drives Fork 2 — the card's prose and the code disagree

#3690's `## Progressive backdown plan` defines an informative trial as one that "surfaced a real finding
from independent review (`findings` non-null on some past row) that was then fixed and landed clean."

The code requires `outcome ∈ {rejected, reworked}`. A `landed` row carrying `findings` text does **not**
count. These are different rules, and the difference decides whether a triple graduates.

**Verified counts** over the 26 rows:

- `landed` **with** `findings` text — **14**
- `rejected`/`reworked` with `findings` text — **4**
- `landed` with no `findings` — 8

Under the card's prose rule, those 14 `landed`-with-findings rows would each satisfy the informative
requirement. At least two of them record the *opposite* of a finding, verbatim:

> `codex · gpt-6-astra · bugfix`, PR #2299 — "Independent review accepted **with no blocking findings**; merged to main…"
> `codex · gpt-6-astra · doc-fix`, PR #2300 — "Independent review accepted **with no blocking findings**; documentation-only change…"

So the prose rule lets a triple clear the informative bar on rows that explicitly record that nothing was
found. The prose is wrong; the code is right.

The code is not free of error either, in the other direction. `codex · gpt-6-astra · bugfix`, PR #2301, is
recorded `outcome: landed` with findings "Round 1 review requested changes (blast-radius concern); fix was
re-armed and re…" — a genuinely informative trial that the outcome-based rule misses, because the row was
labelled `landed` rather than `reworked`. That is a **data-entry** divergence, not a model flaw: the enum
`logDelegationTrial` already validates (`we:scripts/conveyor/log-delegation-trial.mjs:13`) contains
`reworked` precisely for this case.

## 4. What the delegation wrappers actually enforce

All **verified** by reading the files on `origin/main`:

- **`we:scripts/codex-direct-task.mjs` never commits and never pushes.** Its header states it as "THE ONE
  HARD CONSTRAINT"; `captureDiff` runs only `git add --intent-to-add` (zero content) so new files show in
  the diff. The prompt (line ~299) also tells the agent not to commit, push, or open a PR.
- **That is an instruction, not a boundary.** Codex runs with a real shell under `-s workspace-write` and
  *can* commit anyway. `captureDiff` handles it: it diffs against the recorded start SHA and reports
  `report.diff.commits`, and the CLI prints "⚠ codex made N commit(s) despite being told not to".
- **The wrapper exits 0 on a timeout, on a gate FAIL, and on a Codex commit.** `main()` sets
  `process.exitCode` only on a missing `--task` (2) or a thrown error (1). `report.timedOut`,
  `report.gate.pass` and `report.diff.commits` are printed and returned but never affect the exit code. A
  caller that checks the exit status alone learns nothing.
- **`we:scripts/gemini-direct-task.mjs` has the same no-commit/no-push constraint and no real sandbox.** Its
  own header: "NO REAL WRITE/READ CONFINEMENT EXISTS. `--add-dir` is bookkeeping only, not a sandbox.
  `--sandbox` confines the shell only; agy's own in-process native file tools BYPASS it… A run with
  `--sandbox` is NOT isolated." The fresh scratch clone is the only real mitigation.
- **The write-capable Codex port is not on `main`.** `we:scripts/operations/codex-delivery-provider.mjs`
  exists only on `lane/mechanical-dispatcher`, and its header records live evidence that its `:workspace`
  permission profile has **no network** (`git ls-remote origin` → "Could not resolve hostname github.com";
  `curl` to api.github.com → exit 6). So even that port cannot push.

- **And the transport works *against* draft-only.** `setupScratchClone`
  (`we:scripts/codex-direct-task.mjs:558-563`) deliberately rewrites the scratch clone's `origin` from the
  local `repoRoot` path to the **real remote**, commented "so a human who likes the diff can push straight
  from the scratch clone if they choose to". Codex runs there under `-s workspace-write` with a real shell,
  and the entire draft-only constraint is one English sentence in `buildCodexPrompt` (`:292-301`). `--dir`
  also lets a caller point a run at any existing checkout. *(Not tested: whether ambient credentials would
  let such a push authenticate.)*

**Net:** on `main` today a delegated agent's *expected* output is a diff in a scratch clone — but that is a
convention the prompt asks for, not a property the transport holds. The clone is push-capable by design.
Filed as `x9avg7g`.

## 5. The statute already on the books, and where it reaches

Three ratified anchors govern neighbouring turf. Their exact scope matters, because #3690 will set
`codifiedIn`.

**`we:docs/agent/platform-decisions.md#model-probation-graduation-criteria`** (#3654, ratified 2026-09-13).
Four clauses: (1) minimum trial count **plus** at least one informative trial, never count alone —
a pure count is "provably gameable by selection bias"; (2) a confirmed calibration miss is an
**independent veto**, never diluted into a blended score; (3) per-role, the bar **scales with the role's
eventual authority**; (4) one uniform floor per `{provider, model}` identity — no identity buys an easier
bar on reputation. It fixes **no numeric threshold**, by design.

It also carries, from PR #2182 which it extends, the clause that bites hardest here:

> promotion is always an explicit human decision grounded in accumulated data, **never automatic, never
> inherited by a model upgrade**

**Scope check.** That clause governs `we:scripts/lib/model-probation.mjs` — a `{provider, model}` identity's
progression `unvalidated → probation → validated`, i.e. whether the identity may hold **blocking/gating
authority** in review. `selectSupervisionLevel` governs something else: how much checking a *draft* gets
before a Claude session decides what to do with it. Whether those two are the same object is exactly Fork 1,
and the answer to Fork 1 decides whether Fork 3 may be mechanical at all.

**`we:docs/agent/platform-decisions.md#calibration-veto-clearing`** (#3673, ratified 2026-09-14). A
triggered veto clears only through (1) a documented **root-cause finding** naming which of
`deriveFindingDisposition`'s sub-answers diverged, then (2) a minimum count **plus** a similarity-matched
trial; (3) decay never substitutes; (4) human override only as a narrow factual reclassification.

**Scope check.** Its clause 1 is written against `we:scripts/lib/jury-core.mjs`'s reviewer-disposition
sub-judgments — a *reviewer calibration* miss (the live PR #2107 veto on Codex's `advisory-review` role).
`selectSupervisionLevel`'s veto is a different object: a *delivery* trial that was rejected or reworked. The
anchor's own text says "or the equivalent diagnostic for a future non-jury-core review mechanism" — review
mechanism, not delivery. So it is supporting context here, not authority. But the rule #3690 would codify
performs the same job by a *different* test — the router restores `spot-check` on the next five clean
trials with no root-cause requirement at all — and that is a live reconciliation, raised as the Fork 2
sub-fork below.

**`we:backlog/3581-…`** (ratified 2026-09-08, `codifiedIn: one-off`). Codex pilots on independent
review/fix-dispatch **first**; full delivery-agent builds come later (pacing tightened to "soon after" the
reviewer seat lands). This is a ratified *sequence*, set by the operator — not something a trial streak
may overtake.

**`we:docs/agent/backlog-workflow.md#model-routing`.** Row "Inline (2)" — **the call** (the ruling; accepting
or rejecting what a sub-agent returns) never leaves the orchestrating loop, *including opening the artifact
it rules on*: "A verdict formed on someone else's summary is their call wearing yours." Row "Inline (5)" —
the loop **runs the gate and reads its output**; neither a sub-agent's word nor a green check substitutes.

**`we:docs/agent/backlog-workflow.md#codex-model-routing`** (#3635, ratified 2026-09-11, resolved — not
open). The Codex model is pinned (`gpt-6-astra`) and the Haiku/Sonnet/Opus rungs select *effort*, not model.
This is why the trust unit's `model` field is stable rather than drifting under every call.

### 5b. Three further anchors, found by the skeptic pass and each verified here

**`we:docs/agent/platform-decisions.md#every-pr-gets-a-look-advisory-floor`** (#3313, ratified 2026-08-26).
"A PR that trips no escalation reason still gets an independent look — and the economizing axis is **depth**,
never **coverage**… the capacity floor is never zero… The residue that reaches no reviewer is not a safe
class, it is an *unmeasured* one." It extends `#build-lane-self-review-non-zero-floor` (*care scales depth,
never existence*) from Layer 1 to Layer 2, and specifies the floor's own shape: one tool-free juror, one
round, the diff and the item card, a capped finding count, non-blocking; plus two non-optional obligations —
a finding **files a follow-up item**, and the floor's cost and yield are **measured and reported**.

**Why it matters:** #3690's 2026-09-15 backdown plan proposed dropping the separate independent pass entirely
at `spot-check`. That is economizing on *coverage*, with a trust score as the sampling key, over exactly the
population whose reliability the score is estimating. The anchor forecloses it. Fork 5's default moves depth
and holds coverage instead.

**`we:docs/agent/platform-decisions.md#agent-mutations-through-typed-operations`** (ratified 2026-09-04).
Reads stay free and sandboxed; mutations route only through a strictly-typed, fail-closed operation catalog.
Its own text: "**Sandboxing is not a substitute** for either fork. A sandbox bounds *damage*; the operation
catalog bounds authority." This is the anchor that already owns *what a delegated agent may do*, which is why
Fork 1 routes authority there rather than to a transport property.

**`we:docs/agent/platform-decisions.md#agent-convergence-independent-validation`** (#2398), reached through
`#model-probation-graduation-criteria`'s own lineage paragraph, which says the two compose: "staged auto-fix
autonomy is a sibling axis **keyed by repo, not by provider/model trust**." #3690 keys staged autonomy by
`{provider, model, taskType}`. Fork 3 reconciles the two as orthogonal axes that compose — the repo axis says
*which repos permit staged autonomy at all* and dominates; the triple axis says *how much checking a draft
gets inside a repo that permits it*.

**And the routing collision.** `#model-routing` row *Inline (3)* ratifies that "what to spawn, with what
brief, in what order… produces the brief and **the tier verdict**, so it is orchestration, not delegated
work", and that "the routing verdict is emitted at claim". `#effort-routing` (#3106) adds "Route on the SHAPE
of the work, **not a lookup table**" and "never on a field alone". `selectProvider` routes on `taskType` — a
field — plus fixed LOC and file-count ceilings (`PROVEN_TASK_ENVELOPES`, `we:scripts/lib/provider-routing.mjs:163`).
**Scope check:** that table's column heading is "Why it can't leave the loop" and Inline (3) is about an
orchestrating loop choosing a subagent and writing its brief, so it does not reach a mechanical dispatcher
with no loop, no claim and no brief. It *does* reach an interactive session — and the router's own header
claims exactly that reach ("across both interactive Claude Code sessions… and autonomous conveyor/runner
dispatch machinery"). Fork 4 rules on the boundary.

## 6. Prior art

Surveyed 2026-09-20. Four of the six findings below changed a fork's shape; two confirmed one.

### 6.1 N = 5 clean trials is not a statistical bar — the exact number is 45%

**Computed here, not quoted.** For zero failures in `N` independent trials, the one-sided 95%
Clopper–Pearson upper bound on the true failure rate is `p = 1 − 0.05^(1/N)`:

| N clean trials | 95% upper bound on failure rate | To rule out… | needs N |
|---|---|---|---|
| **5** | **45.07 %** | 20 % failure | 14 |
| 10 | 25.89 % | 10 % failure | 29 |
| 14 | 19.26 % | 5 % failure | 59 |

And the other direction: an agent that truly fails **1 run in 5** still produces five clean runs
**32.8 %** of the time; at a 10 % failure rate, **59.0 %** of the time.

The familiar "rule of three" (`3/N`) does **not** apply here — it comes from approximating `ln(1−p) ≈ −p`,
which holds only for small `p`; Wikipedia's own statement is that it is a good approximation when `n > 30`.
At N = 5 it gives 60 % against an exact 45.07 %; both are useless.
(Formula: <https://en.wikipedia.org/wiki/Rule_of_three_(statistics)>; attribution Hanley &
Lippman-Hand 1983.)

Worse, trials are not independent draws from one population: five `conflict-resolution` trials of the same
shape are effectively N ≈ 1–2 of evidence about a different task shape.

**How real progressive-delivery systems decide "enough evidence" instead:** Spinnaker's Kayenta does not
count clean runs at all — it runs a **Mann–Whitney nonparametric test per metric against a concurrent
baseline** (<https://spinnaker.io/docs/guides/user/canary/judge/>), wrapped by Argo Rollouts as an
`AnalysisTemplate` per promotion step. Google SRE's multiwindow multi-burn-rate alerting
(<https://sre.google/workbook/alerting-on-slos/>) frames the question as a **continuous error budget**
optimised on four named properties — precision, recall, detection time, **reset time** — with a short and
a long window that must *both* cross. Wald's SPRT (<https://docs.statsig.com/experiments/advanced-setup/sprt>)
is the principled early-stopping version of "count clean runs", and it too will not stop at five.

**What this means for #3690:** N = 5 is a smoke test, not evidence. It is defensible only if what it
unlocks is correspondingly small — which is exactly Fork 1's question.

### 6.2 The informative-trial requirement already has a standard name: **positive control**

A positive control is a sample known to produce a positive result; it exists to confirm the assay is
*capable of detecting* and to assess its **sensitivity**, and a run whose positive control does not fire is
**invalid, not passing** (<https://www.rockland.com/resources/positive-and-negative-controls/>). That is
precisely #3654 clause 1's argument, stated in the vocabulary of a field that has used it for a century.
The same idea carries four other established names, all for the same failure mode:

- **Mutation testing / "vacuous pass" / "assertion-free test"** — inject a fault, check the suite actually
  reddens; a surviving mutant proves the suite cannot tell correct from broken.
- **IEC 61508 "dangerous undetected (DU) failure"** and proof-test coverage — a low-demand safety system may
  sit dormant for years; only an offline proof test reveals a DU failure, and the standard explicitly
  assumes 100 % proof-test coverage is unachievable.
- **Latent condition** (Reason's Swiss-cheese model; aviation and nuclear) — the OECD/NEA CSNI survey of
  undetected safety-system failures found some latent since initial start-up
  (<https://www.osti.gov/etdeweb/biblio/22703991>). "Never triggered" and "works" are different states, and
  redundancy actively hides the difference.
- **Chaos-engineering game days** — the stated purpose includes validating that monitoring and alerting
  actually fire.

**What this means for #3690:** adopt the term. "This triple has no positive control" says in three words
what the card currently spends a paragraph on, and it makes the rule's *reason* portable.

### 6.3 Put the hard floor in the transport, not in the trust score

**GitHub Copilot coding agent** (<https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent>)
is structurally pinned at one authority level regardless of any track record: it pushes only to a
`copilot/*` branch or the existing PR branch, never to the default branch; it cannot merge; its PRs require
the repository's own checks plus a human reviewer; and Actions triggered by its PRs need write-access
approval to run at all. There is no score that changes any of this.

**OpenAI Codex CLI** (<https://developers.openai.com/codex/agent-approvals-security>) separates the two
dials explicitly: `approval_policy ∈ {untrusted, on-request, never}` **×**
`sandbox_mode ∈ {read-only, workspace-write, danger-full-access}`. Supervision frequency and blast radius
are orthogonal knobs, not one ladder. **Claude Code's own permission modes**
(<https://platform.claude.com/docs/en/agent-sdk/permissions>) are the same shape: `plan` → default →
`acceptEdits` → `bypassPermissions`, plus a per-tool `allowedTools` allowlist.

**What this means for #3690:** the industry pattern is to keep authority out of the earned score entirely.
But this repo does **not** already have that property — §4 shows the scratch clone is push-capable and the
draft-only rule is prompt text. So the right home for authority here is not the transport at all: this repo
already ratified one, at
`we:docs/agent/platform-decisions.md#agent-mutations-through-typed-operations`, whose own text says "a sandbox
bounds *damage*; the operation catalog bounds authority". Fork 1 routes authority there and files the
transport gap separately.

### 6.4 Graduated autonomy exists as a named scheme — and its evidence window is 10× ours

**AWS, "Closing the AI agent trust gap with graduated autonomy"**
(<https://aws.amazon.com/blogs/architecture/closing-the-ai-agent-trust-gap-with-graduated-autonomy/>) is the
closest published match to what #3690 proposes. Four tiers scored 0–100 — T1 Probation (read/list only),
T2 Supervised (writes, human approves high-risk), T3 Trusted, T4 Autonomous (post-hoc audit only).
The mechanics worth borrowing:

- **Promotion requires the score held above the threshold across a rolling 50-action window**, and entry
  requires **5 points above the tier floor** — an explicit hysteresis gap, so a triple cannot oscillate
  across the boundary.
- **Demotion is immediate** at the floor. The asymmetry is deliberate.
- **"Trust is non-transitive"** — a delegated action's effective tier is the **minimum across the whole
  delegation chain**.

By contrast, the academic framing (Knight First Amendment Institute, "Levels of Autonomy for AI Agents",
<https://knightcolumbia.org/content/levels-of-autonomy-for-ai-agents-1>) defines five levels by the
*human's* role — Operator, Collaborator, Consultant, Approver, Observer — and explicitly does **not** model
earning progression by track record, proposing third-party "autonomy certificates" instead. Neither Devin
nor Cursor publishes a numbered ladder.

### 6.5 Everyone splits promotion from demotion — and almost nobody hard-resets permanently

| System | Up | Down | Back |
|---|---|---|---|
| AWS graduated autonomy | rolling 50-action window + 5-pt hysteresis gap | immediate at floor | window re-clears |
| Tor consensus flags (<https://spec.torproject.org/dir-spec/assigning-flags-vote.html>) | decayed continuous statistics (`guard-wfu`, `stable-mtbf`) crossing a threshold | score falls | score recovers |
| Debian maintainer ladder (<https://wiki.debian.org/DebianMaintainer>) | ≥ 6 months + a named sponsor who reviews each upload | — | — |
| Stack Overflow suspension | — | time-boxed 1–365 days, scaled to severity | reputation recalculated at the end |
| Chrome CA distrust (<https://www.censys.com/blog/google-entrust-internet/>) | — | on a **pattern** of repeated compliance failures, not one miss; SCT-not-after cutoff grandfathers existing certs | — |
| CT log removal | — | **binary, on a single failed audit** | — |

The Beta Reputation System (Jøsang & Ismail; <https://arxiv.org/pdf/1710.10061>) documents why a pure
decayed score is the weak choice *for this threat model*: its forgetting factor fails against an actor that
behaves well and then abruptly switches — which is exactly an agent that is fine on five easy tasks and
wrong on a hard one. That argues for keeping the hard demotion trigger #3654 clause 2 already ratified.

One more orthogonal lever appears repeatedly and is absent from #3690: a **cooldown**. Renovate's
`minimumReleaseAge` (<https://docs.renovatebot.com/key-concepts/minimum-release-age/>) quarantines each
individual *version* by wall-clock age regardless of the publisher's reputation, and GitHub environment
protection rules (<https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments>)
make a **wait timer of 1–43,200 minutes** a first-class protection rule alongside required reviewers.

### 6.6 The `{provider, model, taskType}` trust unit has no single industry name — but each axis does

- **`{provider, model}` — solid, conventional precedent.** npm provenance attestations bind to **package
  name + version + tarball digest** (<https://docs.npmjs.com/generating-provenance-statements/>), and
  trusted publishing binds to a **specific CI workflow**, not a human author. Google Binary Authorization
  attests **image digests** (<https://docs.cloud.google.com/binary-authorization/docs/attestations>).
  Package ecosystems abandoned author-scoped trust years ago. SLSA Build levels
  (<https://slsa.dev/spec/v1.1/levels>) are worth noting for a different reason: its rungs are defined by
  **what class of attack each rules out**, never by how many clean builds happened.
- **`taskType` — the established name is "operational design domain" (ODD).**
  (<https://en.wikipedia.org/wiki/Operational_design_domain>) An autonomous vehicle's safety case is scoped
  to the conditions it was designed for, and the ODD definition is what "constrains the scope of safety
  cases and testing efforts". Dependabot auto-merge policies are the software version of the same idea:
  auto-merge is scoped to semver patch/minor, majors stay manual — graduation by the change's **declared
  risk class**, not by the producer's reputation.
- **The full triple has no standard name.** "Task-scoped trust" appears in vendor security glossaries with
  no standards body behind it. The eval literature acknowledges the gap rather than closing it — *Evaluation
  Cards* (<https://arxiv.org/html/2606.09809v1>) reports that "versioning is ad hoc or entirely absent,
  causing transparency to degrade over time."

**What this means for #3690:** the trust unit is defensible and should not be claimed as standard. If a
single borrowed word is wanted for the `taskType` axis, **operational design domain** is the established
term with the right meaning.

## 7. What this report does not settle

Nothing here rules. The five open calls — what the trial record governs, the evidence bar, who may move a
level, how far mechanical routing reaches, and what verification stays with the orchestrator — their options
and their recommended defaults are authored on
[#3690](/backlog/3690-track-and-consider-graduating-session-initiated-codex-delega/) itself, in the
prepared-fork shape, for the operator to ratify or override.
