---
bornAs: xwzihdg
kind: decision
status: resolved
dateOpened: "2026-09-14"
dateResolved: "2026-09-21"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#delegation-trial-record-graduation"
preparedDate: "2026-09-20"
preparedAgainstSha: "df3a05856013a8ce4de58f53a865e1823c173bfc"
relatedTo: ["3654", "3673", "3635", "3581", "3717", "3696", "3443", "3369"]
relatedReport: reports/2026-09-20-delegation-graduation-model-grounding.md
tags: [codex, delegation, model-routing, graduation, scorecard]
---

# Track and consider graduating session-initiated Codex delegation as a trusted capability

Tonight (2026-09-14), for the first time, an interactive orchestrating Claude Code session delegated real work directly to Codex via we:scripts/codex-direct-task.mjs, using a Codex-drafts/Claude-subagent-verifies-and-lands pattern -- because the orchestrating session's own standing rule (ask a subagent, never shell out itself) blocks it from running Codex directly. First live trial: PR 2223 (pid-forwarding fix), in progress. Idea: treat this like a real subagent type earning trust rather than an ad hoc one-off -- track trials, then consider graduating it to a named, trusted capability. See body for the two-part idea and #3654 as precedent.

> **Update (2026-09-15):** the tracking mechanism is now built and today's real trials are backfilled — see
> `## Implementation notes` and `## Progressive backdown plan (filed 2026-09-15 — see the correction below)`.
>
> **Prepared 2026-09-20.** Five forks, each with a bold default, grounded in
> [a research topic](/research/delegation-graduation-and-supervision-tiers/) and
> [a session report](/reports/2026-09-20-delegation-graduation-model-grounding.md).
>
> **Ratified 2026-09-21 by the operator, as prepared** — every fork's bold default. See
> `## Ratified (all five forks, as prepared) — 2026-09-21` below; the rule is codified at
> [#delegation-trial-record-graduation](../docs/agent/platform-decisions.md#delegation-trial-record-graduation).

## Why this is on the critical path

[#3717](/backlog/3717-choose-the-dispatch-provider-mechanically-from-fixed-criteri/) wires
we:scripts/lib/provider-routing.mjs into the dispatch path. That router already implements this card's
progressive-backdown model, so wiring it turns an unratified model into a dispatch gate — which is why
#3717's own body asks the operator to ratify this card first.

## Settled before the forks — the operator's standing statements

Cited, not re-asked. **The decider should confirm these in their own words at ratification.**

1. **"No model judgment anywhere between the dispatch kind and the chosen provider"** — the acceptance test
   recorded on #3717, 2026-09-19, alongside "ideally routing would be mechanical from fixed criteria" and
   that delegation is "mechanically forced, not advice in a brief". Fork 4 asks what this settles; Fork 3
   asks what it implies for the graduation dial.
2. **Antigravity is the top capacity lever** (2026-09-15,
   [#3696](/backlog/3696-make-antigravity-gemini-claude-via-antigravity-the-default-s/)) — the default
   provider recommendation, not an opt-in fallback.
3. **"Delegate some work to Codex as soon as feasible"** (2026-09-12,
   `we:agent-memory-src/delegate-work-to-codex-when-feasible.md`) — a standing forward-looking preference,
   where "feasible" means wired and proven, not theoretically possible.
4. **Capability parity is the default across providers**
   (`we:agent-memory-src/agent-capability-parity-principle.md`) — close an asymmetry that was never
   validated, preferring scoped containment over blanket access.

## What is true today, as of 2026-09-20 — facts, not forks

**Verified** against `origin/main` at `e7206136d`. Full working in
[the report](/reports/2026-09-20-delegation-graduation-model-grounding.md).

- **The router is built, pure, and has zero callers.** we:scripts/lib/provider-routing.mjs is 779 lines with
  no filesystem or `process` reads. It exposes two functions: `selectProvider` picks *which provider runs the
  work*, and `selectSupervisionLevel` picks *how much checking the result gets* (`full` / `spot-check`).
- **Those two functions are NOT independent — they share this card's own predicates.** `isCleanRecord`
  (we:scripts/lib/provider-routing.mjs:246) is read by `evaluateProviderFitness` at `:339` and `:347`, where
  **one** clean verified trial plus a clean most-recent row makes a provider fit to be handed the work; and
  `isInformativeRecord` (`:252`) is read **inside `selectProvider`** at `:506` and `:512` to decide the `both`
  dual-dispatch branch. So the trial record already buys more than lighter checking — it buys *being selected
  at all*, at **N = 1**, with no operator act. Fork 1 rules on what follows.
- **The model has already moved a dial.** Running `selectSupervisionLevel` over the 26
  `dispatchKind: 'session-delegation'` records in we:scripts/conveyor/run-scorecards.json, one triple —
  `{codex, gpt-6-astra, other}` — is at **`spot-check`** today. `{antigravity, gemini-3.8-flash-low,
  conflict-resolution}` has a clean streak of **5** and stays `full`, because no informative trial exists for
  it. The other eight triples sit at `full` on streak 0–3, and `{antigravity, claude-sonnet-4-6, other}` has
  a fired calibration veto.
- **The one graduated triple has the least-specified task type.** `other` is the catch-all; 10 of the 26
  rows carry it, and #3717's analysis names it as the one `taskType` that cannot be derived from any dispatch
  kind.
- **This card's own prose and the shipped code define "informative trial" differently.** The
  `## Progressive backdown plan` below says `findings` non-null on any past row. The code
  (`isInformativeRecord`, we:scripts/lib/provider-routing.mjs:250-257) requires
  `outcome ∈ {rejected, reworked}` **and** non-empty `findings`. **Verified counts:** 14 of the 26 rows are
  `landed` *with* findings text, and at least two of those record verbatim that review found nothing
  ("Independent review accepted with no blocking findings", PR 2299 and PR 2300). Fork 2 rules on this.
- **"Draft-only" is an instruction, not a boundary — and the transport works against it.** Both wrappers
  declare never committing or pushing as their one hard constraint and hand back a `git diff`. Neither
  *enforces* it: each agent holds a real shell, and `captureDiff` detects an unbidden commit rather than
  preventing it. Worse, we:scripts/codex-direct-task.mjs's `setupScratchClone` (`:558-563`) deliberately
  rewrites the scratch clone's `origin` from the local path to the **real remote**, commented "so a human who
  likes the diff can push straight from the scratch clone if they choose to"; Codex runs there under
  `-s workspace-write` and the whole constraint is one English sentence in `buildCodexPrompt` (`:292-301`).
  `--dir` also lets a caller point a run at any existing checkout. *(Whether ambient credentials would let
  such a push authenticate was **not tested**.)* The write-capable port
  we:scripts/operations/codex-delivery-provider.mjs exists only on `lane/mechanical-dispatcher`, and its own
  header records live evidence that its `:workspace` profile has no network, so that one cannot push.
- **Two honest limits.** we:scripts/codex-direct-task.mjs **exits 0** on a timeout, on a gate FAIL, and when
  Codex commits despite instruction — `main()` sets a non-zero exit code only for a missing task argument
  (`:919`) or a thrown error. And we:scripts/gemini-direct-task.mjs's own header states there is no real
  confinement: "`--add-dir` is bookkeeping only, not a sandbox. `--sandbox` confines the shell only; agy's own
  in-process native file tools BYPASS it."
- **N = 5 is not a statistical bar.** For zero failures in N trials the one-sided 95% Clopper–Pearson upper
  bound on the failure rate is `1 − 0.05^(1/N)`: **45.07% at N = 5**. An agent that truly fails 1 run in 5
  still produces five clean runs 32.8% of the time. Ruling out a 20% failure rate takes N = 14; a 10% rate takes 29.
  (The rule-of-three `3/N` shorthand gives 60% and does not apply below n ≈ 30.) **Computed, not quoted.**
- **The informative-trial requirement has a standard name — *positive control*.** A run whose positive
  control does not fire is *invalid, not passing*. The same idea is mutation testing's "vacuous pass", IEC
  61508's "dangerous undetected failure", and Reason's "latent condition".

**Known occurrences** — the pattern in shipped systems, surveyed 2026-09-20:
GitHub's Copilot coding agent (authority pinned in the transport: `copilot/*` branches only, cannot merge,
whatever its record) · AWS's published graduated-autonomy scheme (four tiers, rolling 50-action window, 5-point
hysteresis gap up, immediate demotion down, "trust is non-transitive") · Renovate `minimumReleaseAge` and
GitHub environment wait timers (cooldown as a lever orthogonal to reputation) · Tor consensus flags and the
Beta Reputation System (decayed scores, and why they fail against an actor that switches) · Chrome's CA
program (distrust on a *pattern*, not one miss) · npm provenance and Google Binary Authorization (trust scoped
to the artifact version, never the author) · Dependabot auto-merge (graduation by the change's declared risk
class) · operational design domain (the established name for scoping a safety case to a task category).

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| Fork 1 — what does the trial record govern | **One record, two consumers: the ruling binds every read of the store**, and authority is owned by the typed-operation catalog, never by a streak or a transport | Rule only the supervision dial and leave `selectProvider`'s use of the same predicates unruled | Med-high |
| Fork 2 — the evidence bar | **Ratify the shape only** (streak + positive control + hard veto, unit = the triple); N stays a config default for an ordinary batched finding to propose | Fix a literal N in this ruling | High |
| Fork 2 sub-fork A — what makes a trial informative | **A separate recorded field**, distinct from `outcome` and from `findings` | Outcome-based (`rejected`/`reworked`), as coded today | Med-high |
| Fork 2 sub-fork B — what a miss costs, and how it clears | **Root-cause precondition plus an explicit hysteresis gap** — the post-miss bar is strictly higher than the cold-start bar | Bare re-accumulation, as coded | Med |
| Fork 3 — who may move a level | **Mechanical demotion, operator-gated promotion** — demote on the data, promote only by an explicit ratified act | Compute both directions with no operator act | Med-high |
| Fork 4 — how far does mechanical routing reach | **The mechanical dispatch path only** — the interactive loop's inline routing verdict is untouched, and the router's header claim over interactive sessions is corrected | Mechanical everywhere, amending two ratified anchors | Med |
| Fork 5 — the verification floor at spot-check | **Shallower, never absent** — graduation moves the independent pass's depth, never its coverage | Drop the independent pass entirely at spot-check | High |

**Fork 2, Fork 3 and Fork 5 all rest on Fork 1.** If Fork 1 is not (a), each of them is ruling over a
narrower object than the one the data actually drives — see each fork's own note.

## Supported by default — not forks

Each of these has exactly one coherent branch, so no ratifiable alternative exists. They are recorded so the
ruling is complete, not so they are chosen.

- **Unit of trust is `{provider, model, taskType}`, and it is non-transitive.** Already ratified as shape by
  [#model-probation-graduation-criteria](../docs/agent/platform-decisions.md#model-probation-graduation-criteria)
  clause 4 ("no identity buys an easier bar on reputation") and by #3654's own Fork 4 principle that identity
  never inherits trust. The `taskType` axis is this context's stand-in for #3654 clause 3's role axis, which
  does not exist here. Industry agrees on both halves: package ecosystems scope trust to the artifact version
  rather than the author, and "operational design domain" is the established name for scoping a safety case to
  a task category. AWS states the non-transitivity rule directly.
- **One uniform floor for every triple.** Ratified verbatim by the same anchor's clause 4. A project may
  configure a *stricter* bar; nothing configures a looser one.
- **The calibration miss is an independent veto, never blended into a score.** Ratified by that anchor's
  clause 2. The router implements it as a hard veto on the most recent verified trial. The Beta Reputation
  System's documented failure mode — a forgetting factor that fails against an actor who behaves well and then
  switches — is the reason not to soften it into a rolling average.
- **Trials are recorded in we:scripts/conveyor/run-scorecards.json through
  we:scripts/conveyor/log-delegation-trial.mjs.** This card's own `## Implementation notes` already settled it
  as an implementation detail on 2026-09-15, and it shipped. Nothing reopens it.
- **The Codex model stays pinned per rung.** Ratified by
  [#codex-model-routing](../docs/agent/backlog-workflow.md#codex-model-routing) (#3635): every invocation
  names its model, and the Haiku/Sonnet/Opus rungs select *effort*, not model. This is what keeps the trust
  unit's `model` field stable instead of drifting under every call.

## Fork 1 — What does the trial record govern: one read of the store, or every read?

**Fork-existence.** One data set is read by two functions through the **same two predicates**. Either one
ruling governs both reads, or two rulings govern one predicate — and two rulings over one predicate is how a
contradiction gets written into the tree. The **excluded branch** is (b): ruling only the supervision dial
leaves `selectProvider`'s use of `isCleanRecord`/`isInformativeRecord` governed by nothing, while a change
this card makes to either predicate silently changes which provider gets the work.

**Crux, with refs — the two dials are NOT separate.** `isCleanRecord`
(we:scripts/lib/provider-routing.mjs:246) is called by `evaluateProviderFitness` at `:339` and `:347`, where
**one** clean verified trial plus a clean most-recent row makes a provider *fit to be handed the work*.
`isInformativeRecord` (`:252`) is called **inside `selectProvider`** at `:506` and `:512` to decide the `both`
dual-dispatch branch. So accumulating clean rows already buys something other than lighter checking: it buys
*being selected at all*, at **N = 1**, with no operator act. Any ruling on the predicates reaches both.

**And the transport does not pin authority.** we:scripts/codex-direct-task.mjs's `setupScratchClone`
(`:558-563`) deliberately rewrites the scratch clone's `origin` from the local path to the **real remote**,
with the comment "so a human who likes the diff can push straight from the scratch clone if they choose to".
Codex runs there with `-s workspace-write` and a real shell, and the whole draft-only constraint is one
English sentence in `buildCodexPrompt` (`:292-301`). `--dir` also lets a caller point the run at any existing
checkout. Whether ambient credentials would let such a push actually authenticate was **not tested**; the
point stands regardless — the constraint is an instruction, not a boundary.

- **(a) One record, two consumers; the ruling binds every read — recommended.** The unit of trust, the
  positive-control requirement and the hard veto apply wherever this store is read, so `selectProvider`'s
  N = 1 fitness test is **inside** what this card rules, not beside it. Separately and independently:
  **authority — what a delegated agent may DO — is owned by the typed-operation catalog**, per
  [#agent-mutations-through-typed-operations](../docs/agent/platform-decisions.md#agent-mutations-through-typed-operations),
  whose own text says "a sandbox bounds *damage*; the operation catalog bounds authority". Neither a transport
  nor a trial streak grants it.
  - It is the only branch under which a change to `isInformativeRecord` is a governed change. Fork 2 sub-fork
    A changes that predicate; under (b) that change would alter `selectProvider`'s dual-dispatch behaviour
    with no ruling covering it.
  - It routes authority to the anchor that already owns it, rather than to a property of one script. The
    transport finding above is then a **defect to fix**, not a foundation to build on — **filed as its own
    item, `3782`, scoped to `we:scripts/codex-direct-task.mjs`**, rather than ruled here.
  - **Against it:** it widens what ratifying this card settles, from one function to a shared data contract.
    That width is the point — the data is already shared.
- **(b) Rule only the supervision dial.** Rejected as the excluded branch: it leaves the N = 1 fitness test
  and the dual-dispatch branch reading predicates this card defines but does not govern.
- **(c) One combined authority ladder** — `draft-only` → `commit-in-lane` → `open-PR` → `land`, each rung
  earned by N clean trials. Rejected on statute: it makes a streak an authority grant, which collides both
  with `#agent-mutations-through-typed-operations` (authority comes from the catalog) and with
  [#model-probation-graduation-criteria](../docs/agent/platform-decisions.md#model-probation-graduation-criteria)'s
  "promotion is always an explicit human decision grounded in accumulated data, never automatic".

**Default: (a).** The ruling binds the store, not one function. Authority is the catalog's, not a streak's.

**Code shape.** Under (a) the ruling attaches to the predicates, which both consumers already import:

```js
// we:scripts/lib/provider-routing.mjs — ONE data contract, two consumers. Both are ruled by this card.
function isCleanRecord(record) { /* :246 */ }        // read by evaluateProviderFitness :339,:347  (N=1 fitness)
function isInformativeRecord(record) { /* :252 */ }  // read by selectProvider :506,:512           (dual dispatch)
//                                                   // and by selectSupervisionLevel :725         (graduation)

// What the ruling does NOT come from — neither of these is an authority grant:
//   the wrapper's prompt text ("do not run git push")      — an instruction (codex-direct-task.mjs:292-301)
//   the wrapper's scratch clone                             — it points origin AT the real remote (:558-563)
// Authority comes from the typed-operation catalog: #agent-mutations-through-typed-operations.
```

**Skeptic:** REFUTED → default rewritten. The attack landed on both legs of the original default. First, the
claim that "the two dials are already separate" is **false in the shipped module** — `isCleanRecord` and
`isInformativeRecord` are read inside `selectProvider` at `:339`, `:347`, `:506`, `:512`, so a clean streak
already buys selection at N = 1. Second, "the transport pins authority at draft-only" is **false as a property
of the transport** — `setupScratchClone` (`:558-563`) rewrites `origin` to the real remote on purpose, and the
only draft-only constraint is prompt text. Classification was also re-routed: the skeptic derived
`#agent-mutations-through-typed-operations` independently and found it already rules that authority comes from
the fail-closed catalog and that "sandboxing is not a substitute" — exactly the substitution the old default
made. The fork was rebuilt around the real either/or (one ruling over the shared predicates, or two), the
authority clause now cites the anchor that owns it, and the transport gap is filed as its own item rather than
leaned on. A residual collision the skeptic found is reconciled in Fork 3.

**Screen:** clear — fresh-context two-confusion screen, both questions clear on the original framing, and the
rewrite strengthens both. Not an implementation detail: it rules which reads of a shared store a ruling binds,
which every dispatcher observes through the provider it is handed. Not prioritization: with both branches free
to build and instantly maintained, (b) still leaves a predicate this card defines governing an ungoverned
consumer.

## Fork 2 — What is the evidence bar, and what makes a trial count?

**Fork-existence.** The bar is set by exactly one kind of rule — a shape, or a literal number. The **excluded
branch** is fixing a number here, because two ratified anchors forbid this venue for it: both
[#model-probation-graduation-criteria](../docs/agent/platform-decisions.md#model-probation-graduation-criteria)
and [#calibration-veto-clearing](../docs/agent/platform-decisions.md#calibration-veto-clearing) state that
**no concrete numeric threshold is fixed by any of their clauses** and that each "names what a follow-on
ordinary (batched) finding must propose once real trial-count data exists — **never a separate ceremony**".
A decision ceremony picking N *is* the separate ceremony they foreclose.

**Crux, with refs.** `DEFAULT_BACKDOWN_THRESHOLDS` (we:scripts/lib/provider-routing.mjs:140) is
`{minCleanStreak: 5, requireInformativeTrial: true}`, and `selectSupervisionLevel` takes a caller-supplied
`backdownThresholds` override (`:666-672`). The number is already configuration with a platform default; what
a ruling can add is the rule that default must satisfy.

**The arithmetic the follow-on finding must reckon with, computed not quoted.** For zero failures in N
independent trials, the one-sided 95% Clopper–Pearson upper bound on the true failure rate is
`1 − 0.05^(1/N)`:

| N clean trials | 95% upper bound on failure rate | To rule out… | takes N |
|---|---|---|---|
| **5** | **45.07 %** | 20 % failure | 14 |
| 10 | 25.89 % | 10 % failure | 29 |
| 14 | 19.26 % | 5 % failure | 59 |

An agent that truly fails 1 run in 5 still produces five clean runs **32.8 %** of the time. And the trials are
not independent draws: five `conflict-resolution` runs of the same shape carry effectively N ≈ 1–2 of evidence
about a different shape. Reaching N = 14 is **not** out of range on the observed rate — `{codex, gpt-6-astra,
bugfix}` accumulated 7 rows in 3.98 days (1.76/day), so N = 14 is roughly 8 days away, not months.

Real progressive-delivery systems do not count clean runs at all — Kayenta compares a canary against a
**concurrent baseline** with a Mann–Whitney test per metric, and Google SRE frames the question as an error
budget with named precision, recall, detection-time and reset-time properties.

- **(a) Ratify the shape only; leave N to an ordinary batched finding — recommended.** What is ratified
  here: the unit of trust is the triple; graduation requires a **trailing clean streak** *and* a **positive
  control** *and* a clean most-recent verified trial; a confirmed miss is a hard veto. What is **not**
  ratified here: the value of `minCleanStreak`, which stays a `backdownThresholds` config default for a
  follow-on batched finding to propose against real data — exactly as both cited anchors instruct.
  - It is the venue those anchors name, so it writes no rule they forbid.
  - It keeps the decision durable: the shape outlives any N, and the follow-on finding gets the arithmetic
    above plus Fork 5's amended floor as its inputs.
  - **Against it:** it leaves a live number (5) running under a default nobody has explicitly blessed. That
    is the state both anchors deliberately chose for their own thresholds, and the follow-on finding is the
    named remedy.
- **(b) Fix a literal N in this ruling** (5, or 14). Rejected on the anchors above: a decision ceremony is
  the one venue they exclude. Either value remains reachable as a *setting*.
- **(c) A cooldown instead of a streak** — quarantine each triple by wall-clock age, as Renovate's
  `minimumReleaseAge` quarantines each version and GitHub's environment wait timers gate each deployment.
  Rejected on merit: elapsed time with no clean-run requirement is exactly the temporal dilution
  `#calibration-veto-clearing` clause 3 forecloses. Recorded as an orthogonal lever this card does not add.

**Default: (a).**

**The target evidence shape, ratified as direction.** A **concurrent-baseline comparison** — the same task run
through Claude and through the delegated provider, judged on the difference — is the evidence shape this model
should reach, and it is what a follow-on finding should prefer over raising N. It needs a harness that does
not exist, so it is **filed as its own item — `3783`, scoped to `we:scripts/conveyor/`** — rather than
ruled here. Two hand-produced comparative rows already sit in the store (`claude-native/claude-sonnet-5`
against `antigravity/claude-sonnet-4-6` on the same PR 2223 diff, both `scoredAt` 2026-09-15T14:35), which is
the shape that item mechanizes.

### Fork 2 sub-fork A — what makes a trial informative (the positive control)

**Fork-existence.** A row either is the positive control or it is not, and exactly one field decides. The
**excluded branch** is deriving it from `outcome`, because `outcome` is already load-bearing in the *opposite*
direction — `isCleanRecord` wants `landed`, `isInformativeRecord` wants `rejected`/`reworked` — so one field
cannot carry both meanings without making the gate unsatisfiable for a clean performer.

- **(a) A separate recorded field — recommended.** Add an explicit `informative` field to
  we:scripts/conveyor/log-delegation-trial.mjs's validated row shape, with a stated meaning: *independent
  review found a real problem on this trial that was then fixed*. `isInformativeRecord` reads that field.
  `outcome` keeps its single meaning (did this trial land), and `findings` stays free-text prose.
  - It is the only option that resolves the live false negative **without collateral damage**.
    `{codex, gpt-6-astra, bugfix}` PR 2301 (`2026-09-19T00:27:04`) is recorded `landed` with findings
    "Round 1 review requested changes (blast-radius concern); fix was re-armed…" — genuinely informative.
    It is also the **most recent** verified row for that triple, so relabelling it `reworked` would fire the
    calibration-miss hard veto (`:705`) on the repo's largest triple, and under sub-fork B would then demand
    a root-cause note before any trial counts. A separate field marks it informative and leaves the veto
    alone — because the trial did, in fact, land.
  - It unsticks a triple that is currently stuck by construction. `{antigravity, gemini-3.8-flash-low,
    conflict-resolution}` has a clean streak of 5 and stays at `full` **permanently** under (b), because its
    only route to a positive control is to log a failure — which the gate would then punish. Verified by
    running the function.
  - **Against it:** the field is still written by the delegating session, so it is self-certified. That
    residue is real and is stated below rather than papered over; it is strictly smaller than (b)'s, because
    a declared field with one meaning is auditable where an inference from prose is not.
- **(b) Outcome-based, as coded today** (`outcome ∈ {rejected, reworked}` plus findings). Rejected on the
  construction flaw above: it makes the two predicates read one field in opposition, so a triple can graduate
  only by first recording a failure, and honest relabelling of a caught-and-fixed trial fires the veto. It is
  also no less self-certifiable than the alternatives — `outcome`, `verifiedBy` and `findings` are all plain
  CLI flags checked only for enum membership and a secret scrub
  (we:scripts/conveyor/log-delegation-trial.mjs:12-16, :28-34) — while adding an incentive gradient against
  honest logging.
- **(c) Findings-based**, as this card's 2026-09-15 prose says (`findings` non-empty on any past row).
  **Rejected on the live data:** 14 of the 26 rows are `landed` with findings text, and PR 2299's and
  PR 2300's rows read "Independent review accepted **with no blocking findings**". A rule that clears the
  positive-control bar on a row recording that nothing was found is not a positive control at all.

**Default: (a).**

**The residue, stated plainly.** Under (a) the positive control is still asserted by the same session that
ran the trial. The durable fix is for the **independent reviewer** to write that field rather than the
delegating session — which needs a reviewer-side write path that does not exist today, and is named here as
the follow-on rather than ruled.

**Code shape.**

```js
// we:scripts/conveyor/log-delegation-trial.mjs — (a) adds ONE validated field with ONE meaning
const enums = {
  taskType:   TASK_TYPES,
  outcome:    ['landed', 'rejected', 'reworked'],   // unchanged: did this trial land
  verifiedBy: ['claude-subagent', 'independent-claude', 'other'],
  informative: [true, false],                       // NEW: independent review found a real problem, since fixed
};

// we:scripts/lib/provider-routing.mjs — the predicate stops overloading `outcome`
function isInformativeRecord(record) {
  const isVerified = record.verifiedBy === 'claude-subagent' || record.verifiedBy === 'independent-claude';
  return isVerified && record.informative === true;   // no longer reads `outcome` — it means the opposite here
}
// PR 2301 then records: { outcome: 'landed', informative: true } — the veto never fires, the control counts.
```

### Fork 2 sub-fork B — after a miss, what does re-graduation require?

**Fork-existence.** A demoted triple is restored by exactly one rule. The **excluded branch** is bare
re-accumulation, because it clears a veto by a *weaker* test than the statute already applies to the
neighbouring veto, with no stated reason for the difference.

**Statute-overlap, reconciled here rather than at ratification.**
[#calibration-veto-clearing](../docs/agent/platform-decisions.md#calibration-veto-clearing) (#3673, ratified)
requires, before any post-miss trial counts: (1) a documented **root-cause finding**; (2) a minimum count
**plus** a similarity-matched trial; (3) decay never substitutes; (4) human override only as a narrow factual
reclassification. `selectSupervisionLevel` implements none of these — it restores `spot-check` on the next
five clean trials. **Citation-scope check:** that anchor's clause 1 is written against
we:scripts/lib/jury-core.mjs's `deriveFindingDisposition` sub-answers, i.e. a *reviewer-calibration* miss, and
its own text extends only to "the equivalent diagnostic for a future non-jury-core **review** mechanism". A
delegation-trial rework is a *delivery* miss, so the anchor is **supporting context here, not authority** —
but the rule this card would codify does the same job by a different test, which is a live collision to settle
now.

- **(a) Root-cause precondition plus an explicit hysteresis gap — recommended.** Two clauses. **(i)** After
  a miss, post-miss trials count toward restoration only once a **root-cause note is on record in its own
  field** — not free text in the next row's `findings`, which the same session writes and which is already
  load-bearing elsewhere. **(ii)** The post-miss bar is **strictly higher** than the cold-start bar
  (`minCleanStreak + k`, with `k` left to the same follow-on finding that sets `minCleanStreak`, per Fork 2
  (a)).
  - Clause (ii) is the hysteresis every comparable system has and this model lacks. AWS pairs immediate
    demotion with an explicit 5-point gap above the tier floor precisely to stop a subject flickering across
    the boundary; without it, one honestly-logged miss demotes and the next clean run of trials promotes,
    repeatedly.
  - Clause (i) supplies the similarity-matched-trial requirement's intent without importing an out-of-scope
    rule: the root-cause note is what makes the next trials *about* that failure rather than beside it. The
    codified rule states that it composes with `#calibration-veto-clearing` on the same principle and differs
    only in the object (a delivery trial, not a reviewer disposition).
  - **Against it:** it adds a written step and a second number to a loop that is otherwise a pure function.
    Both are recorded inputs the function reads, so it stays pure.
- **(b) Bare re-accumulation, as coded.** The same streak restores `spot-check`, no diagnosis required.
  Rejected: it is the "trial volume alone is gameable without ever diagnosing why the miss happened"
  objection that anchor already ratified, re-appearing under a different name — and with no hysteresis it
  flaps.
- **(c) A time-boxed suspension** — demote for a fixed window, then re-evaluate, as Stack Overflow suspends
  for 1–365 days and AWS re-clears on a rolling window. Rejected as the primary rule: elapsed time alone is
  the temporal dilution clause 3 forecloses. Composable with (a) if flapping is still observed once (ii) is
  in place.

**Default: (a).**

**Skeptic:** REFUTED (main fork and sub-fork A) / SURVIVES-WITH-AMENDMENT (sub-fork B) → all three rewritten.
(0) *Classification, run first and decisive on the main fork:* the skeptic re-routed it correctly — picking N
is a **config dimension** already governed by a platform default (`DEFAULT_BACKDOWN_THRESHOLDS` at `:140`,
overridable at `:666-672`), and, more sharply, both `#model-probation-graduation-criteria` and
`#calibration-veto-clearing` state in their own text that no numeric threshold is fixed and that N belongs to
"a follow-on ordinary (batched) finding… never a separate ceremony". The fork was rewritten to ratify the
shape and explicitly defer N to that venue. (1) *Merit:* two supports of the prior default were factually
wrong and are gone — "at N = 14 no triple would qualify for months" is off by roughly 10× (7 rows in 3.98 days
for `{codex, gpt-6-astra, bugfix}` puts N = 14 about 8 days out, computed), and "the single thing dropped is
one extra independent-review pass" collided with a ratified floor (see Fork 5). On sub-fork A the attack was
structural and decisive: `outcome` is read in opposite directions by the two predicates, so the old default's
logging rule would have fired the hard veto on the repo's largest triple (PR 2301 is that triple's most
recent verified row), and a clean performer — `{antigravity, gemini-3.8-flash-low, conflict-resolution}`,
verified stuck — could reach a positive control only by logging a failure. The default flipped to a separate
recorded field. (2) *Statute overlap:* found and reconciled — the sub-fork B section names
`#calibration-veto-clearing` and states how the two compose. (3) *Citation-scope:* the existing downgrade of
`#calibration-veto-clearing` from authority to supporting context was independently confirmed correct.

**Screen:** flagged(prio) → fixed, then superseded by the rewrite. The screen found options rejected on data
rate, spend and a missing harness — reachability, not merit. Both are gone: the reachability claim was
factually wrong and is deleted, and the concurrent-baseline option was moved out of the fork into a ratified
direction plus its own filed item (`3783`). Q1 clear on the main fork and both sub-forks: the shape, the
predicate and the re-graduation rule each bind every triple and are observable to any dispatcher.

## Fork 3 — Who may move a level: the operator, or the data?

**Fork-existence.** A level changes by exactly one authority. The **excluded branch** is computing promotion
with no operator act, because
[#model-probation-graduation-criteria](../docs/agent/platform-decisions.md#model-probation-graduation-criteria)
carries, from the probation mechanism it extends, "promotion is always an explicit human decision grounded in
accumulated data, **never automatic, never inherited**" — and under Fork 1 (a) the object it governs and the
object this card rules are the same shared record.

**Crux, with refs.** `selectSupervisionLevel` is a pure function: given the same records it returns the same
level, with no state, no approval table and no human seat. Promotion happens the instant a fifth clean row is
appended — no act occurs. The same is true of `selectProvider`'s N = 1 fitness test.

**Why the acceptance test does not settle this.** The operator's 2026-09-19 criterion is "**no model
judgment** anywhere between the dispatch kind and the chosen provider". An operator ratification is *human*
judgment, not model judgment, and it happens **before** any dispatch. A dispatch path that reads a ratified
list plus computes demotions contains no model judgment at any point, so it satisfies the criterion literally.
The earlier reading of that criterion as forbidding *any* human seat was too wide.

**The second collision, inside an anchor this card already leans on.**
`#model-probation-graduation-criteria`'s own lineage paragraph states it composes with
[#agent-convergence-independent-validation](../docs/agent/platform-decisions.md#agent-convergence-independent-validation)
(#2398): "staged auto-fix autonomy is a sibling axis **keyed by repo, not by provider/model trust**". This
card's model keys staged autonomy by `{provider, model, taskType}`. **Reconciled:** the two axes are
orthogonal and compose multiplicatively rather than competing — #2398's repo axis says *which repos permit
staged autonomy at all*, and this card's triple axis says *how much checking a delegated draft gets inside a
repo that permits it*. The codified rule must say this in as many words, and must state that a repo-level
`none` is never overridden by any triple's level.

- **(a) Mechanical demotion, operator-gated promotion — recommended.** Demotion is computed from the data
  and takes effect immediately. Promotion to a lighter level requires an **explicit ratified act** naming the
  triples being promoted — ratified in batches against accumulated data, never per dispatch and never
  per trial.
  - It is what the statute requires, without straining a scope carve-out: promotion is a human decision
    grounded in accumulated data, exactly as worded.
  - It is what essentially every comparable system does. AWS demotes immediately at the floor and promotes
    only across a rolling window; Debian requires ≥ 6 months plus a named human sponsor who reviews each
    upload; Stack Overflow suspends at once and re-evaluates later. A permanent hard reset with automatic
    re-promotion appears nowhere in the survey.
  - It is fail-safe in the direction that matters: a triple sits at `full` until someone ratifies it, and
    the batched act is bounded work on a list that grows slowly (10 triples in the first five days).
  - **Against it:** the operator becomes a periodic gate, and an un-ratified but well-performing triple pays
    for a review pass it has arguably earned. The batched shape is the mitigation; the residual cost is real
    and is the trade this option takes deliberately.
- **(b) Compute both directions, no operator act** — the shipped behaviour. Rejected as the excluded branch
  on the statute clause above. Its earlier defence — that the clause governs a different object because the
  supervision dial grants no authority — does not hold under Fork 1: the same predicates already drive
  `selectProvider`'s choice of who touches the repo, at N = 1.
- **(c) Operator ratification per triple on every level change, in both directions.** Rejected on merit: it
  puts a human seat in front of a *demotion*, which is the one direction that must never wait. Demotion is
  fail-safe and computing it is strictly better than gating it.

**Default: (a).**

**Code shape.** Under (a) the call site computes the floor and reads a ratified list for anything lighter:

```js
// we:scripts/operations/dispatch-lane.mjs — the promotion path under Fork 3 (a)
const records = loadScorecards();                     // IO at the edge; the router stays pure
const computed = selectSupervisionLevel(provider, model, taskType, records);   // may DEMOTE freely

// Promotion below `full` needs a recorded operator act naming this triple. No act → `full`.
const level = computed.level === 'spot-check' && isRatifiedForSpotCheck({ provider, model, taskType })
  ? 'spot-check'
  : 'full';
recordRoutingDecision({ provider, model, taskType, computed: computed.level, level, auditTrail: computed.auditTrail });
// Still zero MODEL judgment on this path: a pure function plus a ratified list lookup.
```

**Skeptic:** REFUTED → default flipped. The attack broke the scope carve-out the old default rested on: it
claimed `#model-probation-graduation-criteria`'s "never automatic" clause governs a different object because
the supervision dial grants no authority, and that premise is false in the shipped code (`isCleanRecord` and
`isInformativeRecord` already drive `selectProvider` at `:339`, `:347`, `:506`, `:512`, deciding at N = 1 which
identity is handed the work). The skeptic also surfaced a collision the card never cited, sitting inside an
anchor it does cite — `#model-probation-graduation-criteria`'s lineage says staged auto-fix autonomy is "keyed
by repo, not by provider/model trust" (`#agent-convergence-independent-validation`, #2398) — now reconciled in
the crux above as two orthogonal axes that compose, with the repo axis dominant. Re-deriving from there flipped
the default to mechanical demotion with operator-gated promotion, which also matches the prior art the survey
found and which the earlier reading of the acceptance test had wrongly excluded: that test forbids **model**
judgment, and a human ratification is not model judgment.

**Screen:** clear — both questions clear, and the rewrite does not disturb either. Not an implementation
detail: it rules the authority that moves a level, which is governance rather than code shape. Not
prioritization: computed-versus-ratified is a genuine merit split, and the objection to per-triple gating is
that demotion must never wait, not that gating costs effort.

## Fork 4 — How far does mechanical routing reach?

**Fork-existence.** Provider routing is decided by exactly one method in any given path. The **excluded
branch** is treating mechanical routing as binding everywhere while leaving the ratified inline-routing rule
standing, because the two give different answers on the same question and a downstream build cannot act on
both.

**Crux, with refs — the operator's statement and a ratified anchor point opposite ways.** The 2026-09-19
acceptance test, recorded on #3717, is "no model judgment anywhere between the dispatch kind and the chosen
provider", with "ideally routing would be mechanical from fixed criteria". But
[#model-routing](../docs/agent/backlog-workflow.md#model-routing) row *Inline (3)* ratifies the opposite for
the orchestrating loop: "Choosing and briefing — what to spawn, with what brief, in what order… That read is
what produces the brief and **the tier verdict**, so it is orchestration, not delegated work", and "the
routing verdict is emitted at claim". [#effort-routing](../docs/agent/backlog-workflow.md#effort-routing)
(#3106) adds "Route on the SHAPE of the work, **not a lookup table**" and closes "this stays a convention, not
a lookup table… never on a field alone". `selectProvider` routes on `taskType` — a field — plus fixed LOC and
file-count ceilings (`PROVEN_TASK_ENVELOPES`, we:scripts/lib/provider-routing.mjs:163). That is a lookup
table.

**Citation-scope check.** `#model-routing`'s rows are written for **an orchestrating Opus loop's own spawns**
— the table's column heading is "Why it can't leave the loop", and Inline (3) is about choosing a subagent and
writing its brief. A mechanical dispatcher choosing a provider for a queued item is a different actor with no
loop, no claim and no brief-writing step. So the anchor does **not** reach the mechanical dispatch path. It
*does* reach an interactive session — and we:scripts/lib/provider-routing.mjs's own header claims exactly that
reach, offering itself "across both interactive Claude Code sessions (as a pre-dispatch check before picking a
subagent) and autonomous conveyor/runner dispatch machinery". That claim is where the collision lives.

- **(a) Mechanical routing binds the mechanical dispatch path only — recommended.** #3717 wires
  `selectProvider` into `dispatch-lane`, `review-dispatch`, `reconcile-fix-dispatch` and `dispatch-task`, and
  the computed decision is binding there. An **interactive** orchestrating loop keeps its inline routing
  verdict under `#model-routing` Inline (3) and `#effort-routing`; the router may inform that verdict but does
  not replace it. The router's header claim over interactive sessions is corrected to say so.
  - It satisfies the acceptance test where the test was actually made: that statement is recorded on #3717,
    whose subject is the dispatch path, and its criterion names "the dispatch kind", which only a mechanical
    dispatch has.
  - It amends **no** ratified anchor — the narrowest reading that leaves both rules standing and true.
  - The correction it does require is one paragraph of a module header, not a rule change.
  - **Against it:** it leaves two routing methods in the tree, which will read as inconsistent to someone
    who meets the router before the anchors. The codified rule naming the split by actor is the remedy.
- **(b) Mechanical routing binds everywhere**, amending `#model-routing` Inline (3) and `#effort-routing`'s
  "never on a field alone" to carve out provider selection. Rejected as the default *here*: amending two
  ratified anchors on the strength of a statement recorded on a third card is the unrecoverable
  resolve-time collision this card exists to avoid. It remains the right option if the operator confirms the
  wider intent — in which case the amendment is its own item, ruled on those anchors' own cards.

**Default: (a).** The operator should confirm the reach in their own words, since (b) is a live reading of the
same statement and the difference is which anchors change.

**No code example** — this fork rules on which actor a method binds. Its only code surface is a corrected
header paragraph.

**Skeptic:** REFUTED → fork re-framed. The original framing asked whether the 2026-09-19 statement ratifies
mechanical routing, and the skeptic showed that question was mis-posed twice over. First, its (a) rested on
"the two functions are separately testable, separately callable", which is false — they share the store and
both predicates. Second, and decisively, the record does not simply *fail* to settle mechanical routing: a
ratified anchor settles it the **other way** for the orchestrating loop (`#model-routing` Inline (3), "the
tier verdict… is orchestration"; `#effort-routing`, "never on a field alone"), against a router that routes on
`taskType` plus `PROVEN_TASK_ENVELOPES` (`:163`). The fork was rebuilt around the real either/or — how far the
mechanical method reaches — and a citation-scope pass found the honest boundary: the anchor is written for a
loop's own spawns and does not reach a mechanical dispatcher, but the router's header claims interactive reach
and that claim is the collision. The default is now the narrowest reading that amends no anchor, with (b)
named as the live alternative if the operator confirms wider intent.

**Screen:** flagged(prio) → fixed, then superseded by the rewrite. The screen found the old (a) partly chosen
for being the "smallest ratification" and the old (c) admitting it produced the same ruling as (a) — ceremony,
not merit. Both are gone: the surviving (a)/(b) split turns on which anchors would have to change, which is a
merit difference, and the ceremony option no longer exists. Q1 clear: the fork rules which actor a routing
method binds, which every dispatcher and every interactive session observes.

## Fork 5 — What is the verification floor, and what never leaves the orchestrator?

**Fork-existence.** At `spot-check` there is exactly one verification floor. The **excluded branch** is
dropping the independent pass to zero, because
[#every-pr-gets-a-look-advisory-floor](../docs/agent/platform-decisions.md#every-pr-gets-a-look-advisory-floor)
(#3313, ratified 2026-08-26) already rules that "the economizing axis is **depth**, never **coverage**", that
"the capacity floor is never zero", and that "the residue that reaches no reviewer is not a safe class, it is
an **unmeasured** one". A trust score that removes the reviewer entirely is a sampler with the score as its
sampling key — over exactly the population whose reliability the score is estimating.

**Crux, with refs — two layers, and they have different rules.** Layer 1 is the orchestrator's own read:
[#model-routing](../docs/agent/backlog-workflow.md#model-routing) row *Inline (2)* keeps **the call** on the
loop *including opening the artifact it rules on* ("a verdict formed on someone else's summary is their call
wearing yours"), and row *Inline (5)* requires the loop to **run the gate and read its output**, with neither
a sub-agent's word nor a green check substituting. That row's own scope paragraph extends it past the main
session to "a build agent [running] its own gate in its own lane clone", so it reaches a delegated build.
Layer 2 is the **separate independent pass**, and that is what #3313 governs.

And the exit code is not a verdict: we:scripts/codex-direct-task.mjs's `main()` sets a non-zero code only for
a missing task argument (`:919`) or a thrown error — **it exits 0 on a timeout, on a gate FAIL, and when Codex
commits despite instruction**. `report.timedOut`, `report.gate.pass` and `report.diff.commits` are all
returned and printed, and all are invisible to an exit-status check.

- **(a) Shallower, never absent — recommended.** Layer 1 never moves at any level: the orchestrator reads
  the real diff and rules on it, and runs the close-out gate itself and reads its output. Layer 2 keeps
  **full coverage** and moves only in **depth**: at `full`, a full independent review before landing; at
  `spot-check`, #3313's own floor shape — one tool-free juror, one round, the diff and the item card, a capped
  finding count, non-blocking, and a finding files a follow-up item.
  - It is what #3313 ratified, applied to this population rather than exempting it.
  - It keeps the measurement the model depends on. A graduated triple whose trials stop being reviewed stops
    generating evidence, so the streak that promoted it becomes the last thing anyone ever learned about it.
  - The reviewer's provider is **unconstrained** by this rule — any provider may fill the seat.
  - **Against it:** graduation now buys less than the earlier framing claimed — a shallower pass rather than
    no pass. That is the honest size of it, and it is why Fork 2 (a) declines to ratify a number for what it
    costs.
- **(b) Drop the independent pass entirely at spot-check** — the card's own 2026-09-15 proposal and the
  earlier recommended default. Rejected as the excluded branch on #3313, and independently on the exit-code
  evidence: a run that timed out mid-task and a gate that failed look identical to a caller reading only the
  wrapper's status.
- **(c) Require the reviewer at `full` to run under a *different provider* than the builder.** Rejected as a
  *requirement*, on merit: a floor that cannot be met when the second provider is down, rate-limited, or has
  no seat for the needed lens is not a floor.

**Default: (a), stated provider-neutrally.**

**Cross-provider independence is the preferred seat, recorded as direction.** A reviewer running under a
different provider's own auth cannot forge `CLAUDE_CODE_SESSION_ID` — the same-harness signal #3581 (resolved
2026-09-08) already names as forgeable by "an agent with shell access on the same machine", and which it calls
a genuine structural upside rather than a migration cost. Epic #3369's own goal 1 ("a second provider
answering the SAME judge contract, seated as an additional panelist/lens") already owns building it.
Preferring it costs this card nothing; requiring it would break the floor.

**Two obligations ride along from #3313**, and neither is optional: a finding from the floor pass **files a
follow-up item**, and the floor's own cost and yield are **measured and reported** to the owning program.

**Code shape.** What the orchestrator must read, at both levels:

```js
// After any delegated run, at EVERY supervision level. The exit code is not a verdict.
const report = await codexDirectTask({ task, dir, taskType });
if (report.timedOut)                      throw new Error('delegated run timed out — no verdict');
if (report.gate.ran && !report.gate.pass) throw new Error('gate FAILED — exit code was still 0');
if (report.diff.commits.length)           warn('agent committed despite instruction — review the commit boundary');

readDiffAndRule(report.diff.diff);   // Layer 1, model-routing Inline (2): never on someone else's summary
runCloseOutGateAndReadOutput();      // Layer 1, model-routing Inline (5): never a green check in its place

// Layer 2 — coverage is CONSTANT, depth moves. Never `if (level === 'full')`.
await independentPass(report.diff.diff, level === 'full' ? FULL_REVIEW : ADVISORY_FLOOR);
```

**Skeptic:** SURVIVES-WITH-AMENDMENT, amendment mandatory and applied. The exit-code evidence was
independently re-verified and kept (`main()` sets a non-zero code only at `:919` and on a throw; timeout, gate
FAIL and an unbidden commit all exit 0). The break was a statute this card never cited:
`#every-pr-gets-a-look-advisory-floor` (#3313) rules that the independent Layer-2 look has a non-zero floor
and that economizing happens on **depth, never coverage** — so the old default, which dropped the pass to zero
for graduated triples, was the sampler shape that anchor rejects, with the trust score as the sampling key.
The default now moves depth and holds coverage, taking #3313's own floor spec (one tool-free juror, one round,
capped findings, non-blocking, a finding files a follow-up) as the `spot-check` shape, and carrying its two
obligations. The skeptic also corrected a citation aim: `#model-routing`'s rows **do** reach a delegated build
(row 5's own scope paragraph says so) but govern Layer 1, not the Layer-2 pass this fork moves — the crux now
names both layers separately. Fork 2 was amended in step, since this shrinks what graduation buys.

**Screen:** flagged(prio) → fixed, then reinforced by the rewrite. The screen found (c) called "genuinely
attractive" and rejected only as "a different question" — venue, not merit. (c) is now rejected on merit as a
*requirement* (a floor that cannot always be met is not a floor), the default is stated provider-neutrally,
and cross-provider independence is recorded as the preferred seat with epic #3369 goal 1 named as its owner.
Q1 clear: the fork rules what never leaves the orchestrator and what coverage the second layer keeps, both
observable in whether an independent look happens at all.

### Review jury (provisional — pre-registered #2638)

Care level: `high`. This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |

**Predicted touch-set (#2619)** for the work this decision authorizes, coarse and prefix-shaped —
`we:scripts/lib/provider-routing.mjs` · `we:scripts/conveyor/` · `we:scripts/operations/` ·
`we:docs/agent/platform-decisions.md`. Each buildable child carved off a fork at resolve time takes **its own
slice**, never the whole set: a Fork 2 child takes `we:scripts/lib/provider-routing.mjs` +
`we:scripts/conveyor/`; a Fork 3 child takes `we:scripts/operations/`; the codification takes
`we:docs/agent/platform-decisions.md`.

## The idea (as filed, 2026-09-14)

1. **Start small and deliberately track outcomes.** Reuse this repo's existing scorecard/graduation-data
   pattern -- we:scripts/conveyor/run-scorecards.json, already used for the mechanical dispatcher's own
   model-probation graduation criteria (#3654) -- to record each session-initiated Codex delegation trial:
   the task given, what Codex produced, what the verifying Claude subagent's scrutiny found (good/bad, and
   specifics), and whether it landed.
2. **Once enough trials accumulate with a clean track record, consider graduating the pattern** --
   formally recognizing session-level delegation to Codex (and eventually other models) as a trusted, named
   capability alongside Claude subagents, rather than an improvised one-off each time. This follows the same
   spirit as #3654's graduation-criteria work (bar scales with role authority, an informative-trial
   requirement, a calibration-miss veto) but applied to a different context: an interactive orchestrator
   delegating ad hoc work, not the autonomous mechanical dispatcher.

The three open questions this filing left for a `/prepare` pass are all prepared above. "What counts as
*enough* trials" and "what the graduation bar should be for this context" are **Fork 2** and its two
sub-forks. "Does tracking reuse `we:run-scorecards.json` or need its own file" was settled as an
implementation detail on 2026-09-15 and shipped — it is in *Supported by default*, not a fork. The prepare
pass also surfaced two calls the filing did not anticipate: what the trial record governs once it is read by
two consumers (**Fork 1**), and how far mechanical routing reaches (**Fork 4**).

## Implementation notes (2026-09-15)

The third open question above ("does tracking reuse `we:run-scorecards.json` directly, or need its own file?")
is now resolved as an implementation detail, not a governance decision (does not require a full decision
ceremony): **reuse `we:scripts/conveyor/run-scorecards.json`'s existing pattern/shape directly — same file
name, same JSON envelope, same validated-row convention — rather than inventing a new file.** Reasoning: less
new surface, and it is the direct precedent this card's own body already cites (`#3654`).

**A real complication changed how this landed, worth recording.** `we:scripts/conveyor/run-scorecard-store.mjs`
and `we:scripts/conveyor/run-scorecards.json` exist today only on `lane/mechanical-dispatcher`
(epic #3383), not yet on `main`. The first attempt at this card based its lane on
`origin/lane/mechanical-dispatcher` so the write would hit the literal same file the mechanical dispatcher
already uses. That lane's PR (opened, tests green, `we:scripts/check-standards.mjs` clean) then hit a genuine
tooling gap at the independent-review step: `we:scripts/operations/review-pr.mjs` always diffs a PR against
`origin/main` regardless of the PR's declared `--base`, so a `lane/mechanical-dispatcher`-based PR read as
~270 changed files (the whole divergent lane) instead of this card's real 5-file diff — caught live by a
genuinely independent `claude -p` review pass (see `we:docs/agent/delivery-loop.md`'s panel-fanout recipe),
which correctly refused to run a panel against the wrong file set rather than rubber-stamping. Fixing that
scoping bug in `we:scripts/lib/review-core.mjs` was judged out of scope here — it is shared, heavily-used
machinery (#2678 flags it as a throughput lock point already referenced by dozens of queued items) and this
card's actual job is data durability + a backdown plan, not a review-pipeline fix.

**So the accepted tradeoff is duplication, not a shared write.** `we:scripts/conveyor/run-scorecard-store.mjs`
and its test are copied (unmodified) onto `main` here, alongside a fresh, empty
`we:scripts/conveyor/run-scorecards.json` (`{"version": 1, "records": []}` — main never had the mechanical
dispatcher's own 18 probation-era rows, and this card does not invent them). This is real, acknowledged
new surface — the opposite of the "less new surface" reasoning above — accepted only because the
alternative (a non-`main`-based PR) turned out to break the review tooling live. When `lane/mechanical-
dispatcher` eventually graduates to `main` (tracked separately, `#3443`), whoever lands that graduation will
need to reconcile two `we:run-scorecard-store.mjs` histories and two `we:run-scorecards.json` record sets —
a known, one-time merge cost, flagged here so it isn't a surprise.

The mechanism: `we:scripts/conveyor/log-delegation-trial.mjs` (`logDelegationTrial`) — a thin wrapper over the
existing `we:run-scorecard-store.mjs#appendScorecard`, stamping `subjectClass: "work-agent"`,
`dispatchKind: "session-delegation"` on every row, plus this context's own required fields:
`taskDescription`, `taskType` (`bugfix` / `conflict-resolution` / `doc-fix` / `self-fix` / `other`),
`outcome` (`landed` / `rejected` / `reworked`), `verifiedBy` (`claude-subagent` / `independent-claude` /
`other`), and optional `findings` / `item` / `pr` / `retroactive`. No changes were needed to
`we:run-scorecard-store.mjs` itself — its validator already accepts arbitrary extra row properties, and
`subjectClass: "work-agent"` / an arbitrary non-empty `dispatchKind` string were already within its existing
contract.

Tonight's real trials (2026-09-14) were backfilled via `we:scripts/conveyor/backfill-2026-09-14-delegation-trials.mjs`
(kept in the repo as the durable record of how the data got there — see that file for the literal 9
records). Counts at that time: **Codex 8 trials** (5 clean, landed — a pid-forwarding fix `PR 2223`, a real
conflict resolution `PR 2212`, a self-fix of its own ENOBUFS failure, a NUL-byte fix `#3428`, a doc fix
`#3539` — plus 3 rounds of hardening `we:codex-direct-task.mjs`/`we:gemini-direct-task.mjs`, of which the first
two rounds each had a real finding from independent review, including a filename-quoting bug, fixed before
landing, and the third round was clean); **Gemini 1 trial** (building `we:gemini-direct-task.mjs` itself,
verified only by a live smoke test rather than a Claude-subagent review — see that record's own `findings`
note on why it carries lighter evidentiary weight, and why `we:gemini-direct-task.mjs`'s own lack of a pinned
default model means even the trial's `model` label is a best-effort record, not a confirmed identity, unlike
Codex's pinned `gpt-6-astra`). Gemini's much smaller trial count is expected and accurately reflected, not
padded. Total store records at that point: **9** (this file's own first population on `main`).

## Progressive backdown plan (filed 2026-09-15 — see the correction below)

> **Correction (2026-09-20).** Two statements below are superseded by the prepared forks above and are kept
> only as filing history. (1) The informative-trial definition below says a `findings` value on a past row;
> the shipped code requires `outcome ∈ {rejected, reworked}` **and** findings, and **Fork 2 sub-fork A**
> rules on the difference — the code is right and this prose is wrong. (2) The per-triple standing table that
> stood here is superseded and has been removed: as of 2026-09-20 one triple, `{codex, gpt-6-astra, other}`,
> is at `spot-check`, and the live standing for all ten triples is in the *What is true today* section above.
> (3) The final bullet's "SKIP the separate independent-review-for-landing pass" is superseded by **Fork 5**:
> the independent pass gets *shallower* at `spot-check`, never absent, because
> [#every-pr-gets-a-look-advisory-floor](../docs/agent/platform-decisions.md#every-pr-gets-a-look-advisory-floor)
> ratifies that the economizing axis is depth, never coverage.

**Full verification (the standing baseline — what every 2026-09-14 trial actually got):** a
Claude subagent reads the real diff before it lands, real tests run and must pass, `check:standards` runs
clean, and a SEPARATE independent-review-for-landing pass (a second Claude subagent, or a fresh `claude -p`
process, per this repo's own escalation pattern) reviews the finished diff before it is allowed to land. This
is mandatory for every trial of a `{model, taskType}` pair that has not yet cleared the bar below, and for
every pair the first time it is ever seen.

**Downgrade bar**, mirroring `#3654`'s already-ratified shape (bar scales with authority / an informative-
trial requirement / a calibration-miss independent veto), applied here with `taskType` standing in for
`#3654`'s "role" as the risk-scaling axis (this context has no role axis; task type is the closest real
proxy for how much damage an unsupervised miss could do):

- **Unit of trust: `{provider, model, taskType}`, never broader.** A clean streak in `{codex, bugfix}` does
  not let `{codex, conflict-resolution}` skip its own accumulation, and a clean streak under one model never
  transfers to a different model from the same provider (mirrors `#3654` Fork 4's "identity never inherits
  trust" principle).
- **N = 5 consecutive clean trials** for that exact `{provider, model, taskType}` triple, counting only
  trials where `verifiedBy` is `"claude-subagent"` or `"independent-claude"` — a trial verified `"other"`
  (e.g. a smoke test, like the one 2026-09-14 Gemini trial) carries lighter evidentiary weight and does not
  count toward, or break, a streak either way.
- **Informative-trial requirement (mirrors `#3654` Fork 1b):** the triple's streak additionally requires
  that at least one trial EVER recorded for that triple (not necessarily inside the current streak) was
  genuinely informative — i.e. surfaced a real finding from independent review that was then fixed and landed
  clean. A triple with only ever-trivial, ever-clean trials does not qualify at N=5; it needs a real,
  once-caught-then-fixed data point on record first. *(Superseded in detail by Fork 2 sub-fork A — see the
  correction above.)*
- **Calibration-miss independent veto (mirrors `#3654` Fork 2b):** ANY confirmed finding from independent
  review on any future trial for a `{provider, model, taskType}` triple immediately resets that triple's
  streak counter to 0 and pulls it back to full verification — a hard reset, not a decayed average, and
  independent of how long the prior streak was.
- **Uniform floor per triple, never loosened by provider reputation (mirrors `#3654` Fork 4a):** Codex and
  Gemini are held to the identical N and identical rules for the same task type; Gemini's smaller trial count
  reflects that it has simply not yet accumulated trials, not that it is held to a stricter or looser bar.
- **What downgrading actually changes:** once a triple clears the bar, its future trials get a LIGHTER Claude
  spot-check — verify the acceptance criteria are met and tests pass — and SKIP the separate independent-
  review-for-landing pass (the single subagent diff read at landing time stays; only the extra independent
  pass is dropped). Escalate back to full verification immediately on any finding, per the veto above.

Whoever next reviews a `we:log-delegation-trial.mjs` call site should compute a triple's live streak straight
from `we:scripts/conveyor/run-scorecards.json` (filter `dispatchKind: "session-delegation"`, group by
`{provider, model, taskType}`, walk records in `scoredAt` order) — no separate rollup file is built by this
card. Since 2026-09-19 that computation is also available directly as `selectSupervisionLevel` in
`we:scripts/lib/provider-routing.mjs`.

## Ratified (all five forks, as prepared) — 2026-09-21

**Ratified 2026-09-21 by the operator (Nicolas Gilbert), as prepared.** The operator's words, typed in the
orchestrating session: "I ratify 3690". That takes the bold default of every fork and sub-fork below, with no
amendment. Codified at
[#delegation-trial-record-graduation](../docs/agent/platform-decisions.md#delegation-trial-record-graduation).

- **Fork 1 — (a) one record, two consumers.** Binds: "The ruling binds the store, not one function.
  Authority is the catalog's, not a streak's."
- **Fork 2 — (a) ratify the shape only.** Binds: "graduation requires a **trailing clean streak** *and* a
  **positive control** *and* a clean most-recent verified trial; a confirmed miss is a hard veto", with "the
  value of `minCleanStreak`, which stays a `backdownThresholds` config default for a follow-on batched finding
  to propose against real data".
- **Fork 2 sub-fork A — (a) a separate recorded field.** Binds: "Add an explicit `informative` field …
  *independent review found a real problem on this trial that was then fixed*. `isInformativeRecord` reads
  that field."
- **Fork 2 sub-fork B — (a) root-cause precondition plus an explicit hysteresis gap.** Binds: "post-miss
  trials count toward restoration only once a **root-cause note is on record in its own field**", and "The
  post-miss bar is **strictly higher** than the cold-start bar (`minCleanStreak + k`…)".
- **Fork 3 — (a) mechanical demotion, operator-gated promotion.** Binds: "Demotion is computed from the data
  and takes effect immediately. Promotion to a lighter level requires an **explicit ratified act** naming the
  triples being promoted."
- **Fork 4 — (a) mechanical routing binds the mechanical dispatch path only.** Binds: "An **interactive**
  orchestrating loop keeps its inline routing verdict under `#model-routing` Inline (3) and
  `#effort-routing`; the router may inform that verdict but does not replace it."
- **Fork 5 — (a) shallower, never absent, stated provider-neutrally.** Binds: "Layer 2 keeps **full
  coverage** and moves only in **depth**: at `full`, a full independent review before landing; at
  `spot-check`, #3313's own floor shape."

**What this ratification does NOT do.**

- It does **not** turn supervision enforcement on. `WE_DISPATCH_SUPERVISION_ENFORCE` stays off; the routing
  build [#3717](/backlog/3717-choose-the-dispatch-provider-mechanically-from-fixed-criteri/) keeps the gate
  behind that switch. Turning it on is filed as its own design-first story,
  [3784](/backlog/3784-turn-dispatch-supervision-enforcement-on-now-that-3690-is-rat/).
- It does **not** change any threshold value. `DEFAULT_BACKDOWN_THRESHOLDS` in
  we:scripts/lib/provider-routing.mjs is untouched; N and `k` stay for an ordinary batched finding.
- It builds none of the code the forks imply (the `informative` field, the root-cause field and post-miss
  bar, the ratified promotion list, the corrected router header). Those are open questions on 3784's
  design section. The two items the prepare pass already filed are unchanged: `3782` (the scratch clone's
  real-remote `origin`) and `3783` (the concurrent-baseline harness).

## Done when

1. **Executable** — `node we:scripts/conveyor/log-delegation-trial.mjs --help` exits 0 (failed before this
   landed: the file did not exist), and reading `we:scripts/conveyor/run-scorecards.json` shows at
   least 9 rows with `dispatchKind: "session-delegation"` (failed before: zero such rows existed).
   **Met 2026-09-15**; the store now holds 26 such rows.
2. **Not a ratified decision** — this card's `status` stays `open`; only the tracking mechanism, the
   backfilled trial data, and the progressive backdown plan are delivered here (see `## Implementation
   notes` and `## Progressive backdown plan` above). The graduation call itself is untouched.
3. **Prepared, not ruled (2026-09-20).** Five forks are authored to the prepared-fork shape with bold
   defaults, a research topic is published, and `preparedDate` is set — so readiness tags this
   `✓ ready to ratify`. The call remains the operator's.
4. **Ratified (2026-09-21).** The operator ratified every fork as prepared; the ruling is recorded above,
   codified at `we:docs/agent/platform-decisions.md#delegation-trial-record-graduation` (`codifiedIn`), and
   the card is resolved through the `resolve` operation. Item 2 above is superseded by this.
