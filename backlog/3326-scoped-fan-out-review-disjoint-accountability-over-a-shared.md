---
bornAs: xytw33u
kind: story
size: 8
parent: "3318"
status: open
dateOpened: "2026-08-26"
blockedBy: ["3158", "3335"]
relatedTo: ["3319", "3320", "3344", "3362"]
scope:
  - we:scripts/lib/review-shards.mjs
  - we:scripts/lib/__tests__/review-shards.test.mjs
  - we:scripts/lib/jury-core.mjs
  - we:scripts/lib/review-policy.contract.json
  - we:scripts/review-core-cli.mjs
tags: [review, jury, program, delivery]
---

# Scoped fan-out review — disjoint accountability over a shared full-diff context

A large diff earns more reviewers, never fewer lines (#3320). Every juror gets the whole diff and full repo
context; each is accountable for a disjoint named subset, plus a seam juror scoped to shard boundaries and an
omission juror scoped to the whole diff. Reduction surfaces an inter-shard co-citation as signal, not noise to
dedup.

## Why

`we:scripts/lib/jury-core.mjs` scales review **rigor** — `panelRigorForCareLevel` dials `rounds`, `lenses`,
`jurorsPerLens` — but every juror still reads the entire diff at one altitude and answers for the entire diff.
So the panel gets *deeper* on a large change and never gets *wider*. Size is the one care signal the rigor dial
cannot answer, which is what made a refuse threshold look necessary in #3320. It isn't: the missing lever is
breadth, not a ceiling.

### Grounding for "context never is": a defect that was invisible in the diff

PR #1609 would have **wedged the entire drain**, and a diff-only reviewer would have passed it.

The change flipped a verification default to required. The defect was that the drain calls `pr-land` with no
verify flag, lands WE from the **primary** checkout (`DRAIN_REPOS.we.path = null`), and a lane's
`.git/.lane-verify` marker can never appear there because lanes are separate clones. Every queued couple would
have failed `unverified`, and `reopenStrandedItem` would have sent each item back to open.

Those are **three facts in three files, none of which the changed lines mention.** Nothing in the diff is
wrong; the diff is only wrong *in combination with* code it does not touch. The reviewer that found it went and
read `we:scripts/lane-drain.mjs`, then grepped the whole repo to establish that the opt-out the change relied on
had **zero callers** — the escape existed in a docblock and nowhere else.

This is the concrete argument for the tool-bearing seat and for full repository context, made from an observed
defect rather than from theory. A juror restricted to the diff cannot reach any of the three facts. It also
bounds the fan-out design: **narrowing a juror's `scope` must never narrow what it can read**, or this class of
finding becomes unreachable by construction — which is the failure the shape below exists to avoid.

**State what this grounds, and what it does not** (prep skeptic, 2026-08-27). It grounds **full context** and a
**tool-bearing** seat. It is **not** evidence for fan-out: one reviewer reading widely found it, and #3362
records that the guard built on top of that finding then took **five rounds, each finding a caller the previous
sweep had missed**. If anything, #1609 argues for *resampling* — which is the attack this card has to answer,
not dodge (see *Skeptic*).

## The shape

**Scope is disjoint; context never is.** Each juror receives the whole diff and full repository access, and a
`scope` naming the subset it answers for. The attention ceiling being dodged is rigor-per-reviewer, not tokens
— a 900-line diff is small against the context window. Truncating a juror's diff to its shard would
reintroduce exactly the blindness the fan-out exists to remove.

Three seat kinds:

1. **Scoped jurors** — one per shard, accountable for a named subset of changed files/hunks.
2. **A seam juror** — its scope *is* the boundaries: symbols and signatures crossing shard cuts. Reads edges,
   not bodies. Catches "signature changed here, call site not updated there", the classic loss of disjoint
   slicing.
3. **An omission juror** — whole diff, low rigor, one question: what isn't here? Absence has no shard by
   construction.

**Reduction surfaces co-citations.** Two shards asserting incompatible things about the same behaviour is a
seam signal in its own right. Naive dedup discards it.

> **Retracted 2026-08-27 — this card's grounding for the omission seat was a claim its own parent card
> formally retracts.** It read: *"Grounding: on PR #1569 two rounds of the claim-accuracy lens found nine wrong
> figures and missed both defects that bounced it — a test that could not fail under any mutation, and the main
> new feature having no test at all."* Every quantity in that sentence is wrong, per the review log on
> [#3318](/backlog/3318/): **one** of the two pre-split rounds ran `claim-accuracy` (the 13:15 round ran
> `correctness`), the recorded finding count across both rounds is **four**, not nine, and it did **not** miss
> both defects — the 14:12 `claim-accuracy` round carried `we:scripts/lib/__tests__/review-core.test.mjs:710`,
> the same mutation-proof test defect as the post-split `:707` note, *"two rounds earlier"*. #3318's own lesson
> from that episode points away from adding a seat: *"What belongs in every reviewer brief this programme
> writes is the mutation probe, not a ranking of lenses"* — the finding was under-**rated**, not un-**found**,
> because the juror had not executed it in a live clone.
>
> **The omission seat's justification is therefore structural, not evidential, and is restated at that
> strength:** sharding *creates* a gap that does not exist today. Under one whole-diff juror, absence is
> somebody's to notice; under `k` scoped jurors, absence belongs to no shard by construction. The seat exists
> to stop the fan-out from opening a hole, not because absence findings are currently being missed — the
> record shows the unscoped panel finding them (the 13:15 `correctness` round's *"zero test coverage; no test
> file exists at all"* on the corpus miner).
>
> **Better grounding exists, and the prior-art survey found it.** Wagner et al. compared bug-finding tools,
> testing and review on the same code: tools and tests found **no identical defect at all**, and *"all defects
> found by bug finding tools were also found by the review"* — the review additionally found 17 defect types
> the tools never produced. Every one of those extra catches was **cross-location**: an unclosed database
> connection missed *"because this was done in different functions"*, and 8 redundant `if`-clauses to the tools'
> 1 because *"the redundancy of the others could only be found out by investigating the logics of the program."*
> That is measured evidence for a defect class a per-site reviewer structurally cannot reach — the argument for
> both the seam and the omission seat. *Caveats, stated: the denominator is the union of all three techniques,
> so it is coverage-share and not recall; the review used three developers including the code's own author,
> unprepared, on one project.*
>
> *(The same retracted sentence appears in the ratified
> [#3320](/backlog/3320/); that item is resolved and is not edited here.)*

---

## Prepared 2026-08-27 — the settled design

Prior art: [/research/scoped-fan-out-code-review/](/research/scoped-fan-out-code-review/). Grounding for every
number below is `we:reports/2026-08-27-scoped-fan-out-code-review.md`.

### 1 — How are shards cut

**The cut is a property, not an algorithm ruling.** What the build owes is a partition of the net changed-file
set that is **disjoint**, **complete**, **stable** (same input ⇒ same output) and **balanced by risk-weighted
churn**, over files in **path order** so a directory's files stay contiguous for free. How the partition is
computed is an implementation detail defended by the tests in *Done when*, not a design call. (Screen flag,
fixed: the first draft dressed greedy rebalancing and a threshold constant as a ruling.)

**Directory-prefix cutting was measured and rejected on this repo's own data.** Over the 15 largest merged PRs
of the last 120 (#1522–#1643), **10 put ≥47% of their files under a single two-segment prefix** and five put
≥75%. PR #1570 is **100%** `backlog/` — a directory cut yields exactly one shard, i.e. no fan-out at all on a
26-file PR. PR #1571 (131 files) puts **79%** under `scripts/review-corpus`, so a directory cut gives
`104 / 8 / 7 / 6 / 1 / 1 / 1 / 1 / 1 / 1`. `backlog/` is flat, so a deeper cut does not help.

**Balancing on churn instead, over the path-sorted list, at `targetShardFiles: 12` / `maxShards: 6`** —
simulated against the real file+churn lists from the GitHub API, 2026-08-27:

| PR | files | churn | k | files per shard | largest shard's churn share | cuts falling inside one 2-seg directory |
|---|---|---|---|---|---|---|
| #1571 | 131 | 7445 | 6 | 17, 12, 24, 40, 31, 7 | **17%** (was 79% by directory) | 5 of 5 |
| #1572 | 40 | 4115 | 4 | 9, 22, 6, 3 | 27% | 1 of 3 |
| #1587 | 34 | 1976 | 3 | 12, 9, 13 | 36% | 0 of 2 |
| #1570 | 26 | 1360 | 3 | 3, 6, 17 | 35% (was one shard by directory) | 0 of 2 |
| #1609 | 13 | 1272 | 2 | 7, 6 | 65% | 1 of 1 |

**RAW churn is the wrong weight, and this is the amendment the prep skeptic forced.** On #1571, **97 of 131
files (74%) and 3308 of 7445 changed lines (44%)** are generated corpus fixtures under `scripts/review-corpus`.
A raw-churn cut therefore spends roughly **2.6 of its 6 seats** holding machine-generated JSON to account,
while the files that carry the logic get cut across the remaining shards. #3320 named this exact gap and
declined to rule it: *"Risk-weighted size — 400 lines of generated fixtures is not 400 lines of policy logic —
is a live refinement of the care dial, not ruled here."* This card cannot leave it unruled, because sharding
is where it bites hardest.

So the weight is **`churn × riskWeight(file)`**, where `riskWeight` is composed from the per-file classifiers
that already exist in `we:scripts/lib/review-escalation.mjs` (statute, declarative leash, blast-radius
surfaces) plus one **listed** down-weight set for generated material. Per #3362 the set is stated as a
predicate with its members, never as "all generated files": the initial members are paths under
`scripts/review-corpus/cases/`, any path segment `__tests__/fixtures/`, and `*.snap`. A file matching none of
the classifiers weighs 1.

**The named failure modes, all measured.**

- **Files are atomic, so balance has a floor.** #1609's largest single file is **40% of its whole churn**
  (511 of 1272 lines), so no two-way cut of it can do better than 40%; the contiguous cut got 65%. On PRs
  with few files and skewed churn the shards are lopsided, and the only fix would be splitting a file across
  seats, which breaks the "answer for a named subset of files" contract.
- **Directory cohesion is a freebie, never a guarantee.** On #1571 **all five** cut points fall inside one
  two-segment directory; on #1587 and #1570, none do. So a coupled caller/callee pair *will* land in
  different shards on the largest PRs. That loss is deliberate and is what the seam seat and the shared full
  context exist to absorb — and it is the price of setting dependency-graph cutting **off** here (below), which
  is a cost call in this setting, not a judgement that nobody should want it.
- **The down-weight list is a predicate, not a guarantee.** It cannot recognise generated material it has not
  been told about, and a new fixture directory weighs 1 until someone lists it.

**Why not risk-class cutting** (shard *by* class rather than weighting by it): it is a genuinely different
axis — it groups by what a mistake would *cost* rather than by what is *coupled* — and it degenerates on the
same PRs (#1570 is 26 files of one class). Recorded as a live alternative, not a rejected one.

### 2 — What the seam juror actually receives

*"Symbols and signatures crossing shard cuts"* is intent, not an input. The input is a **seam manifest**,
computed with grep and no symbol-level analysis:

- **Candidates** — **module-scope** declarations whose declaring line is inside the diff, matched by a named,
  listed set of patterns (`export function|const|class` and their unexported module-scope equivalents).
  Function-local declarations are excluded: the prep skeptic pointed at `const r`
  (`we:scripts/lib/jury-core.mjs:1218`) and `const m` (`we:scripts/lib/judge-spawn.mjs:325`), which carry
  thousands of word-boundary hits and no seam meaning.
- **References — traced by identifier AND by value.** A word-boundary `git grep -w` on the identifier, plus,
  when the declaration is a **string-literal constant**, a second grep on its literal value. This is the
  skeptic's sharpest correction and it is measured on this tree, restricted to `scripts/**` + `src/**`:
  `CLAIM_ACCURACY` reaches **4** files by identifier and **18** by its value `claim-accuracy` (22%);
  `NEEDS_HUMAN` 16 vs 28 (57%); `PREVENTION_OUTSTANDING` 10 vs 21 (48%). `MANDATE_LENSES` and `VERDICTS` are
  frozen string enums that most consumers dispatch on **by value**, so identifier-only tracing misses the
  majority of every one of them.
- **Rows** — `(identifier, defining file, defining shard, referencing file, referencing shard | outside-diff,
  reference-is-in-the-diff?, matched-by: identifier | value)`.

The rows that matter are the two the diff cannot show: a reference **outside the diff** (the changed signature
whose untouched call site is somewhere else) and **no matched reference** — the shape of the PR #1609 finding.

**A no-reference row says "no reference matched this predicate", never "no callers".** This is #3362's rule
applied at the sharpest place it applies, and the prep skeptic is right that this repo has already watched the
opposite fail: on PR #1609, round 4's harvest was *"213 candidates, genuinely complete as a candidate set"*
while the predicate matched a path spelled without the repo prefix this repo's own convention uses — a
mutation-proven false negative, four rounds running. A row that reads "zero callers" would be that defect
rebuilt as a feature.

**The hit cap.** Word-boundary counts on this tree, restricted to `scripts/**` + `src/**`: `derivePanelVerdict`
15 files · `panelRigorForCareLevel` 23 · `normalizeFinding` 6 · `VERDICTS` 40 · `advance` **89** · `run`
**645** (unrestricted, `run` hits 2360 tracked files and 11 493 lines). A candidate whose reference set exceeds
the cap is recorded as `too-common-to-trace` with its count, never expanded.

**On prose noise, the skeptic's figure and the corrected one.** The attack measured `derivePanelVerdict` at 40
files of which 22 (55%) are `.md`/`.json` — that is an **unrestricted** grep. Restricted to `scripts/**` +
`src/**` as specified here, `derivePanelVerdict` hits **15 files, all `.mjs`, 0 documentation**. The path
restriction is load-bearing and is why it is written into the predicate rather than left to the implementation.

**What the manifest scans, and what it does not** (#3362). It scans the tracked set under the code prefixes; it
matches the listed module-scope declaration patterns and a word-boundary identifier or literal-value reference.
It does **not** resolve re-exports, computed property dispatch (`table[name]`), dynamic `import()`, references
from untracked paths, references inside JSON/YAML that do not match the literal, or identifiers whose spelling
is an ordinary English word below the hit cap's discrimination. The manifest carries `candidateCount`, the
literal `predicate`, and a `notCovered` list, and every consumer renders them.

### 3 — What reduction does with a co-citation

**A candidate finding in its own right, adjudicated by the seam seat — an escalation only if it survives.**

- **What the script decides is narrow, and it is not "contradiction".** Two seats on the same lens whose
  findings **co-cite** the same `file` (or the same seam-manifest identifier) with opposing typed
  `impactIfUnfixed` produce a synthetic finding, `category: 'seam/co-citation'`, citing both. It is named a
  *co-citation*, not a contradiction, deliberately: whether two claims genuinely contradict is a semantic read
  that stays with a juror. `derivePanelVerdict`'s own note says why — the `conflict` flag is *"a semantic read
  of the findings text — judgment, not a thing this pure function can detect from verdict labels alone (#51:
  the derivation stays mechanical, the judgment stays with the caller/subagents reading the actual findings)"*.
  The first draft called the script's output a contradiction, which is exactly the smuggling that note
  forbids. (Skeptic amendment.)
- **Adjudication, not a re-vote.** The candidate becomes the **seam seat's** mandate: it has tools and a lane,
  so it goes and reads the cited file and says which claim is right. It is *not* resolved by re-running the two
  seats and seeing whether they still disagree — with run-to-run defect-level finding churn measured at
  **1.0** (below), a re-vote is a coin flip. The round it consumes is drawn from the care band's `roundCap` in
  `we:scripts/lib/review-policy.contract.json` and clamped by `NEGOTIATION_ROUND_CAP`, never invented outside
  the budget table. (Screen caveat, folded in.)
- **Escalation.** Only a co-citation the seam seat **cannot** adjudicate sets the existing
  `derivePanelVerdict({ conflict: true })`, which already returns `needs-human`.

**On the charge that this softens a ratified deadlock** — recorded because a reviewer will raise it again. The
skeptic argued that `mandate-conflict` is `family: deadlock`, `clearance: human`, *"no further convergence"*,
so routing a contradiction back for a round contradicts the contract. It does not, and the distinction is
worth pinning: the contract governs what happens **once `conflict` is set**, and `derivePanelVerdict` honours
that unchanged — `conflict` short-circuits before every other check. What is at issue here is **when the
caller sets it**, which the contract deliberately leaves to the caller (*"so the caller passes it in
explicitly"*). Nothing in this design lets a set `conflict` re-enter the loop.

**Not covered:** a contradiction expressed only in prose about unnamed behaviour, where neither finding cites a
file or a manifest identifier. The detector cannot see it and the design does not claim to.

### 4 — Cost, against real PRs

**Seats per round.** For a mandatory lens, `seats = max(jurorsPerLens, k)` where `k` is the shard count — so
breadth *substitutes for* extra jurors-per-lens rather than multiplying them, and `k = 1` is byte-identical to
today's panel. Advisory lenses keep `jurorsPerLens`. The seam and omission seats are added **once**, only when
`k > 1`.

Measured inputs: 120 merged PRs #1522–#1643 — median **4** changed files / **317** changed lines / ~20.5 KB
diff; p90 17 files / ~114 KB; max #1571 at 131 files / 498 KB. Per-juror cost, from the ~20 hand-recorded
figures in `backlog/`: **$0.02 – $1.35**, median of the well-instrumented runs **≈ $0.66**, wall 12.6 s – 312 s.

| PR class | files | k | seats/round today (care `high`) | with fan-out | Δ |
|---|---|---|---|---|---|
| median | 4 | 1 | 10 | 10 | **×1.0 — no change** |
| p90 / #1609 | 17 / 13 | 2 | 10 | 12 | ×1.2 |
| #1572 | 40 | 4 | 10 | 16 | ×1.6 |
| #1571 | 131 | 6 (cap) | 10 | 20 | ×2.0 |

At three rounds and $0.66 a juror: today's declared care-`high` panel is 30 juror-runs ≈ **$19.80** (which
cross-checks #3318's independently-derived ≈$21); #1571 under fan-out is 60 runs ≈ **$39.60**. Today's *actual*
amortised spend is $0.43/PR for one juror, one lens, one round — the thing being replaced.

**Four honest limits on that estimate.**

- **It extrapolates from small diffs.** Every recorded per-juror figure comes from a juror judging a diff far
  smaller than #1571's. The 125 k-token tail is unmeasured, and $0.66 understates it.
- **The diff-copy term is linear and uncached, and dominates at the tail.** The diff is embedded in each
  juror's stdin (`renderJudgeInput` → `judge-spawn`'s one `stdin.end(input)` per child); there is no shared
  cache on that path. Twenty seats × 125 k tokens × 3 rounds is **~7.5 M input tokens of diff copies alone**
  for #1571. Against that, the one instrumented juror loaded 70 688 context tokens against a ~5 k-token diff,
  so *at median size* the copies are a small minority and tool reads dominate. **Trigger:** if a run's
  diff-copy tokens exceed its tool-read tokens, `maxShards` is being dialled off file count when it should be
  dialled off diff bytes, and a prompt-cache seam on the juror stdin path earns its own item.
- **The panel refuses rather than degrades when the bill grows.** `assertPanelBudget`
  (`we:scripts/lib/judge-panel.mjs`) sums the declared per-seat budgets **before the first spawn** and throws —
  *"Nothing was spawned"* — and the ceiling is required, never defaulted. At `DEFAULT_BUDGET_USD = 1.5` a
  20-seat roster declares $30, so any caller ceiling below that kills the whole panel. The build must dial
  `maxTotalBudgetUsd` with `k` in the same place it dials `k`, or fan-out fails closed at exactly the PRs it
  exists for. (Skeptic finding, verified.)
- **Lane pressure is the scheduling cost.** A tool-bearing juror needs a lane clone that is not the driver's
  own (`assertLaneCwd`), and the mandate tells jurors they may check out and mutate that tree, so seats
  cannot safely share one. Twenty seats against a pool of **41** lanes is half the pool for one review. The
  build runs seats at bounded concurrency in waves; at 167–312 s a juror and concurrency 4, one round of a
  20-seat panel is ~20–25 minutes of wall clock.

### 5 — Does it compose with what landed

- **#3335 (derive the shape from the touch-set before the run starts) — composes, and is a hard dependency.**
  Its rule is *"derive, never re-taxonomize"*: the shape comes from `scoreEscalation` + `panelRigorForCareLevel`
  through one entry point on `we:scripts/review-core-cli.mjs`. The shard plan is another derivation from the
  same touch-set, so it **extends that one entry point** — a second files→shape command would be exactly the
  second taxonomy #3335 forbids. Hence `blockedBy: 3335`.
- **#3344 (a selection seating no mandatory lens must refuse) — composes, and strengthens its open question.**
  Scoped seats differ by *scope*, never by lens, so the mandatory floor is unaffected. #3344's own card asks
  whether its condition should read *"no mandatory lens seated across all judge steps"* rather than *"the
  `--lens` input is advisory"*; with `k` scoped seats plus a seam and an omission seat, the across-all-seats
  reading is the only one that stays correct. Land #3344 first, in that form.
- **#3319 (two declared judge steps) — this is where the design meets a structural wall, and it is carved
  out.** `STEP_KINDS` is closed at four by ratified statute (#3031), the step list is fixed at **registration**
  before any PR is read, and `advance`'s `judge` case refuses a request that is not one
  `{ mandate, input, shape }`. So a **variable** number of scoped seats cannot be declared as steps, and
  #3319's own residual already records why. That is a real fork — fan out inside the *caller* of one declared
  judge step, or widen the judge request contract to carry seats — and it is filed as **#x79c033**, not decided
  here. #3326 delivers the derivation, the manifest and the reduction; #x79c033 decides how they get seated.
- **#3158 (tool-free panel jurors) — a hard dependency, and it is larger than it looks.** The design's central
  invariant is full repository access, and `judgePanel` forwards no `allowedTools`, so every panel seat is
  `--tools ''` today; #3318 records the consequence in one line — *"Wiring it as-is replaces one tool-bearing
  juror with three blind ones."* The mandate is also `contextIsolation: 'diff-only'` by default
  (`we:scripts/lib/review-core.mjs`), whose text is *"Work from the diff text alone — do NOT `git checkout`"*.
  Both must flip for a scoped seat, or the fan-out rebuilds the #1609 blindness deliberately. Hence
  `blockedBy: 3158`.

### 6 — What stops the added volume from costing precision

*A sixth question the prior-art survey forced onto the list, because the card's reduction section answered only
half of it.* Saying "an inter-shard contradiction is signal, not noise to dedup" is right and incomplete: `k`
seats plus a seam and an omission seat produce **more findings**, and `buildPanelFindings` **flat-concatenates**
every seat's list. That is a naive union, and the measured cost of a naive union is on record.

Ribeiro et al. ran three static analyzers over NIST Juliet: Frama-C precision **0.57**, Clang Analyzer 0.16,
Cppcheck 0.08 — and the **plain union of all three: 0.39**. Unioning two weak reporters onto a strong one pulled
precision toward the pool **mean**, not toward the best member. Their fix is the transferable part: a learned
filter over the pooled warnings lifted precision **0.39 → 0.68** while retaining **95.8%** of real flaws
(false alarms 3942 → 1158). **The rule is union-then-rank-then-filter, never union-and-report.**

**This repo already has the filter, already built and deliberately switched off.** `admitFindingsByEvidence`
(#3312, `we:scripts/lib/jury-core.mjs`) ranks every finding by what a machine could actually check —
`assertion` < `resolved-citation` < `repro` < `quoted-citation` — and demotes below a caller-set floor.
`EVIDENCE_FLOOR` ships at `assertion`, where it demotes nothing, and its own docblock says why raising it is a
deliberate act: on PR #1569 the `claim-accuracy` juror found a real test defect two rounds before anyone else
and rated it `PLAUSIBLE`/`cosmetic` because it had not run the mutation — under a default-on assertion floor
that correct, early finding would have been demoted.

**So the answer is not "raise the floor because Ribeiro says unions lose precision".** Ribeiro measured static
analyzers, not these jurors, and the docblock is explicit that the floor rises *"on MEASURED per-category
precision (front A of #3318), not on the intuition that prose is weak."* Instead:

- **Criterion 1's A/B reports precision per arm**, so the scoped arm's precision is a measured number rather
  than an assumption — that measurement is the only admissible basis for raising the floor.
- **Nothing needs raising yet.** `maxShards` ships at 1, so the panel adds no volume until the number exists.
- **When breadth is switched on, the floor moves in the same change**, from the same table, or the fan-out
  ships the pool-mean effect knowingly.

### What the prior art settles, and what it leaves open

Full survey at [/research/scoped-fan-out-code-review/](/research/scoped-fan-out-code-review/). Four findings
change this card.

- **The exact intervention has a controlled positive result, and the placebo was ruled out.** Porter, Votta &
  Basili (IEEE TSE 1995) gave 16 three-person teams the **whole** specification and gave each reviewer a
  **disjoint fault class** — one of the three was *"Missing or Ambiguous Functionalities"*, i.e. an omission
  seat. Detection rate rose **~35% (p < .01)**, scenario reviewers were **no worse** on faults outside their
  scope, and — the part that bears on the resampling attack — each group was best at *its own* faults and **no
  better than other scenario reviewers** at faults no scenario targeted, so *"the content of the Scenario was
  primarily responsible"*, not the act of having more readers. The scenarios covered only **about half** the
  checklist's faults and still won.
- **The strongest replication is null, so this stays contested.** Lanubile & Visaggio, >100 subjects: *"the
  experimental results do not support previous findings that PBR improves defect detection effectiveness."*
  Other replications find no significant difference between perspectives in detection rate or coverage. Porter
  is one 48-student study on requirements documents.
- **There is an LLM-specific size effect, measured — and it lands on the COST side, not the support side.**
  Sovrano, Bauer & Bacchelli: models are *"lost in the end"* of large inputs, and naive chunking bought
  **>+37% average recall** across models and CWE types, at a precision cost. Independently, review-comment F1
  collapses ~15× past a ~50-line diff. **Read the direction carefully:** that gain came from *reducing what
  was read*, which is exactly the trade this design refuses. It is therefore evidence that the shared-context
  invariant **costs recall**, not evidence for the territory split — see §7, where an earlier draft of this
  preparation had it the wrong way round and it is struck.
- **The design already exists in a shipped tool, and its recorded failure is the one to design against.** Qwen
  Code's `/review` fans out to whole-diff dimension agents under a size gate and to territory × dimension above
  it, and its rationale is accountability rather than tokens: *"one agent per chunk means every line of the
  diff has exactly one accountable reviewer."* Two things to take: (a) a **coverage receipt** — *"a chunk with
  no receipt is re-reviewed before the run proceeds — so 'no blockers' can never be reported over code that
  nobody read"*, which no production ownership system (GitHub, Google, Gerrit, Phabricator, Chromium) provides;
  and (b) its recorded failure — on one PR *"chunk agents held every one of these defects inside their assigned
  territory and reported none. What they lacked was not the lines but the question."* **Territory alone
  silently fails.** Scoped seats therefore carry a named lens, and the whole-diff lens seats stay seated
  alongside them — which is what `seats = max(jurorsPerLens, k)` on mandatory lenses, advisory lenses unchanged,
  already does. *These are internal single-PR anecdotes, not a controlled study; they are design rationale, not
  proof.*

**Two things the survey says NOT to do**, recorded so they are not re-proposed: majority voting over seats (the
minority holds the correct answer in roughly **1 in 4** disagreements, because shared pretraining correlates
juror errors and breaks the independence a vote assumes — and this repo already forbids it,
`AGGREGATION.DIVERSITY_SELECTION`), and any debate round between seats before they commit (measured conformity
averages **47.2%**, **57–77%** of conformity flips are correct→wrong, and the *stronger* reviewer is the one
that caves). Seats commit in silence; disagreement routes, it does not resolve.

### 7 — What this card is allowed to claim

**The mechanism claimed, and the scope it acts on.** Every argument for this design has to name whether it acts
on the scope a juror **reads** or the scope a juror **owns**, because this design shrinks the second and leaves
the first at full size. Sorted honestly:

| argument | acts on | transfers here? |
|---|---|---|
| Named accountability defeats diffusion of responsibility — Meta's `BystanderRecRnd` assigns one **named individual** instead of a team: **−11.6% time-in-review, no quality-guardrail regression** | **owned** | **Yes — this is the claim** |
| Porter's scenario result: each group best at *its own* fault class, no better elsewhere, so the **lens content** carried the gain, with every reviewer reading the whole artifact | **owned** | **Yes** |
| Agent panels collapse under diffusion — one model went 100% unaided to 23% with two unnamed peers | **owned** | Yes, as motivation (the study injects static consensus and does **not** test whether naming an owner mitigates it) |
| Fewer spurious findings — di Biase's FP 0.42 → 0.07, Ribeiro's union precision 0.57 → 0.39 recovered to 0.68 by filtering | reporting | **Yes — the secondary claim** |
| *"Reviewers do worse on large changes"* — Baum et al., n = 50: effectiveness **59% small vs 35% large**, and **76% vs 36%** on a delocalized defect, McNemar p = 0.002–0.0117 surviving Bonferroni-Holm, with fatigue and position ruled out | **read** | **No — struck** |
| *"Chunking buys recall"* — Sovrano et al.'s **>+37%** from naive chunking | **read** | **No — struck, and it argues the other way** |

**So the size literature is dropped as support, and this card says so rather than leaving it standing
unearned.** Baum's effect is measured on what a reviewer *reads*; this design keeps read scope whole by
invariant, so nothing entitles it to that result. The same correction applies to a citation this preparation
itself made two drafts ago: Sovrano's +37% came from **reducing what was read**, which is precisely the trade
#3326 refuses for the PR #1609 reason. It is therefore not evidence *for* the territory half — it is
**measured evidence that the invariant costs recall**, and it belongs on the cost side of the ledger. The
ruling that a large diff earns more reviewers stands on #3320's own contract-derived reasoning, not on the
attention literature; #3320 says as much when it refuses to apply a human attention ceiling to an agent panel.

**Nothing measures the owned-vs-read separation, anywhere, so this card owes the measurement.** That is why
criterion 1 runs **three** arms rather than two, which is the only way the two mechanisms come apart.

**The success metric is FEWER SPURIOUS FINDINGS, not more defects found.** The only controlled experiment on
decomposing a code change and reviewing it (di Biase, Bruntink, van Deursen & Bacchelli, PeerJ CS 5:e193, n = 28,
between-subjects, one tangled PR vs two untangled, ~100 LOC over 7 files, 3 seeded defects) measured:

| outcome | tangled | untangled | p |
|---|---|---|---|
| defects found (mean) | 1.42 | 1.21 | **0.6 — not significant** |
| **false positives (mean)** | **0.42** | **0.07** | **0.03**, Cliff's δ = 0.36 |
| review time (median s) | 831 | 759 | 0.66 — n.s. |
| rationale understanding | — | — | no difference |

The authors say so themselves: *"we were surprised that our experiment was not able to highlight differences in
terms of reviewers' effectiveness… reviewers are still able to conduct their work properly, even when presented
with tangled changes."* Their recommendation rests on **false-positive reduction at no cost**, not on recall.
It lines up exactly with §6's union result (three analyzers at 0.57 / 0.16 / 0.08 precision union to 0.39) and
with the local churn measurement: **more reviewers do not reliably find more, and pooling them naively costs
precision.** So this card's value has to come from *accountability* and from *ranking and filtering the union* —
never from volume. Criterion 1 is written that way: **precision is the primary outcome, recall the secondary.**

**No accuracy target for the cut, and that is a consequence of the invariant, not a dodge.** The decomposition
literature optimises "did we cut where the author cut" (0.13 → 0.83 across ClusterChanges, Herzig, Flexeme,
SmartCommit, UTango), and its ground truth is **synthetic almost everywhere** — recombined commits, merged
consecutive commits, cherry-pick chains, and successors reusing a predecessor's corpus. **Because every juror
reads the whole diff, a mis-cut mis-routes accountability, not context**, so none of those metrics bound the
risk this design actually carries: *a finding nobody owns*. Importing an accuracy target would measure the
wrong thing. What is measured instead is coverage (every file owned, receipted) and precision.

**Completeness is by construction here, which is stronger than the prior art manages — and the residue moves
elsewhere.** ClusterChanges leaves **34% of changed methods** in "trivial" single-region partitions, with a
tail of **326** of them in one change; SmartCommit sweeps all leftover singletons into one trivial group by
construction. A contiguous partition of the path-sorted changed-file list has no unattached residue at all: the
union of shards *is* the changed set, and criterion 5(b)'s receipt enforces that nothing goes unreported. But
the residue does not vanish, it relocates — **the seam manifest can fail to attach a candidate** (over the hit
cap, or with no matched reference). Those rows are **assigned to the seam seat by name**, never dropped, for
the same reason: unowned residue is the failure the omission seat exists to prevent, arriving through a
different door.

**Primacy is a measured lever; re-sequencing the whole diff is not.** Fregnan et al. (FSE 2022, Distinguished
Paper; 219 476 PRs plus a controlled experiment, n = 106) found participants had **64% lower odds of identifying
a defect when its file was shown last rather than first**, and a follow-up (FSE 2024, n = 29) leading with
predicted hot-spots instead of alphabetical order got **+23% review comments**. But dependency-optimal
re-sequencing of the change is a **null** result — Baum et al. report p = 0.2587 / 0.1084 / 0.0537,
*"no statistical confirmation."* So only the primacy half is built: **a seat's scope list LEADS with its
highest-`riskWeight` file** and the remainder keeps path order. The cut itself stays path-ordered, because
contiguity is what keeps a directory's files together. No claim is made about sorting the whole diff.

**And the honest baseline: there isn't one.** No reviewer recommender in the literature — RevFinder, cHRev,
TIE, WhoDo, WhoReview, Meta's RevRecV2 — assigns *disjoint subsets*; every one ranks candidates for the change
as a whole. The idea's only prior appearance is an unimplemented suggestion from **8 of 20** ClusterChanges
study participants, who asked to *"allow different reviewers with different purposes to focus on what they
want."* This design is ahead of the evidence in both directions: nothing validates it, and nothing warns
against it either.

### The scope clause must ship with its counter-sentence

Every panel mandate already says *"Judge ONLY your own lens — do not comment on concerns outside it"*
(`we:scripts/lib/review-core.mjs`). Stacking a bare *"you answer for files A–F"* on top of that gives a juror
two orthogonal "only"s, and the #1609 defect lived in three files that would be in **no** seat's scope. This
repo has already met the problem and written the antidote: the `aim` parameter — the closest existing analogue
to a scope sentence — ships with *"never let it narrow you: anything else your lens finds is still yours to
report."* The scope clause carries the same counter-sentence, and *Done when* defends it with a mutation.
(Skeptic amendment.)

### What this design covers, and what it does not

Covers: a disjoint, complete, stable, risk-weighted-churn-balanced partition of the net changed-file set; a
seam manifest over module-scope declaration candidates with identifier-and-value reference tracing inside a hit
cap; and detection of co-citations that name a file or a manifest identifier.

Does **not** cover: coupling that crosses a shard cut without a grep-visible identifier or literal;
re-exports, computed dispatch and dynamic imports (listed in the manifest's `notCovered`); balance on a PR
whose largest single file exceeds the ideal shard capacity; generated material the down-weight list has not
been told about; contradictions expressed only in prose; and — the open one — **any claim that a scoped panel
finds a defect an equally-equipped unscoped panel of the same size would not.**

## Skeptic

**Verdict as returned: `REFUTED`.** Recorded verbatim rather than softened, because the strongest half of it
is not answered by an amendment.

**Six findings were verified and folded in above:** the retracted #1569 grounding (the omission seat is now
justified structurally, and the retraction is written into the card); raw churn as the wrong shard weight (44%
of #1571's churn is generated fixtures — now risk-weighted); identifier-only seam tracing (`CLAIM_ACCURACY`
reaches 4 files by name and 18 by value — now traced both ways, module-scope candidates only); the
"contradiction" label smuggling judgment into a script (renamed to a co-citation *candidate*, adjudicated by
the seam seat); the missing counter-sentence on the scope clause; and `assertPanelBudget` refusing rather than
degrading a large roster.

**Two attacks were checked and do not stand as made.** The prose-noise figure (55% of `derivePanelVerdict`
hits being docs) is an unrestricted grep; under this card's stated code-path predicate it is 0 of 15. And the
deadlock-softening charge misreads the seam: the contract governs what happens once `conflict` is set, not
when a caller sets it.

**The attack that stands, and what this card does about it.** `node we:scripts/review-corpus/stability.mjs
--json` (drop the `we:` prefix when actually running it), re-run on `main` 2026-08-27: over 5 pairs of recorded
juror rounds against the **same head sha**, defect-level `intersection: 0`, `union: 7`, `microChurn: 1.0` — two
runs of the same reviewer on identical input share **zero** findings, and `verdictFlipRate` is 0.2. If that
holds, any gain from `k` seats is fully explained by **resampling**, and the scope assignment is a free
variable explaining no residual — `panelRigorForCareLevel` already ships resampling as `jurorsPerLens`, and
dialling *that* on size is a one-line table change. *(Stated at its real strength: n = 5 pairs, 7 pooled
findings, one pair with both rounds empty, and the sample is biased toward unstable rounds. It is weak
evidence. It is also the only **local** measurement that exists, and it points against the design.)*

**The prior art bears directly on this attack, and it half-answers it while changing what the card may claim.**
*For* the design, on **owned** scope — the only axis this design moves: Porter, Votta & Basili ruled the
resampling hypothesis out in their own experiment (each group best at *its own* fault class and no better than
other scenario reviewers elsewhere, so the gain tracked the *content* of the lens, not the number of readers),
and Meta's `BystanderRecRnd` shows naming **one individual** rather than a team is worth **−11.6%
time-in-review with no quality-guardrail regression** in production. That is a real mechanism the scope
sentence plausibly carries, and it is not resampling.

*Against* it: the strongest replication of Porter is **null**; the one controlled experiment on decomposing a
code change (di Biase et al., n = 28) found **no effect on defects found**; and — the correction that matters
most — the size literature the design leaned on (Baum et al.: 59% vs 35% effectiveness, 76% vs 36% on a
delocalized defect) measures **read** scope, which this design deliberately does not shrink. **That argument is
struck from the card** (§7). What is left is a claim about accountability and about *fewer spurious findings*,
not about finding more.

None of it is measured on *this* panel, on *this* corpus, and **nothing anywhere separates owned scope from
read scope**. So the prior art moves the question from "is this plausible" to "is it true here, and through
which mechanism" — which is exactly what criterion 1's three arms exist to answer.

Every criterion in the first draft of *Done when* was a **shape** assertion — partitions are disjoint, seats
carry the full diff, a seam seat exists — and not one of them can fail if scoping does nothing. So:

1. *Done when* now carries a **discriminating** criterion (#1 below): scoped-`k` versus unscoped-`k` on the
   same diffs, scored against the corpus, reported with its interval.
2. **`maxShards` ships at `1`** — breadth **off** — and is raised only on that number. This is the rollout
   shape the repo already uses for an unproven seam (`landMode: "shadow"` in
   `we:scripts/lib/review-policy.contract.json`). Until then this card delivers the derivation, the manifest
   and the reduction, and changes no live review.

The ruling that a large diff earns more reviewers is #3320's and is not re-opened here. What the skeptic
established is that *scoped* reviewers are not yet shown to beat *more* reviewers, and the card's job is to
measure that rather than assume it.

## Screen

Fresh-context two-confusion screen, 2026-08-27, over four claims. **Overall: 2 flagged.**

- **The shard cut — `flagged(impl)` and `flagged(prio)`, both fixed.** (impl) The first draft bundled a design
  ruling with packing-algorithm internals, and never named which side of the layer line the cutter sits on;
  the cut is diff-shaped, so it belongs with `we:scripts/lib/review-core.mjs`, never inside the
  subject-agnostic `we:scripts/lib/jury-core.mjs`. Fixed: the cut is now stated as a **property**, and the
  scope lists a separate diff-aware module. (prio) Directory-versus-dependency-graph is a **cost** deferral,
  not a merit win — made free, the dependency cut is strictly better because it keeps a caller and its callee
  in one shard. Fixed: recorded as a deliberate cheap-proxy tradeoff with its price measured, not as a win.
- **Breadth as a dial separate from depth — clear, `merit`.** Care and size are independent inputs (a one-file
  statute edit is high-care and narrow; a 200-file mechanical rename is low-care and wide), and
  `panelRigorForCareLevel` is shared by `/jury`, `/review` and `/converge`, so buying breadth by raising its
  `rounds` would change three consumers' budgets for something only the large-PR path needs. **Caveat folded
  in:** the size signal must reach the engine as an already-computed magnitude, never as a changed-file count
  the engine reads for itself, or the subject-agnostic core learns it is judging a PR.
- **Seam and omission are scopes, not new lenses — clear, `merit`.** A lens is the question asked; a seat's
  scope is the material shown. Minting a lens would also force a mandatory-or-advisory ruling and, if
  mandatory, enter the unanimity set that can stop a land.
- **Co-citation routing — clear, `merit`.** Most inter-seat disagreements are one juror being wrong; a
  re-round resolves those with no human attention, and the fail-safe is unchanged. **Caveat folded in:** the
  extra round comes from the contract's per-band `roundCap` under `NEGOTIATION_ROUND_CAP`, not from a literal.

## Dependency-graph cutting — a lever set OFF here, not an option removed

**Re-examined 2026-08-27, and the earlier exclusion does not survive.** The card said graph cutting was
*"deliberately out of scope"* on two grounds welded together, and they are different kinds of reason:

1. *"needs symbol-level analysis"* — **cost.** Cost is a setting value and may not remove an option from the
   design space. **Struck as a reason to exclude.**
2. *"shared context removes most of its value"* — **merit**, and the only kind that could exclude it. **Tested,
   and it does not hold.**

Why (2) fails. Shared context removes the **reachability** half of graph cutting's value: with every juror
reading the whole diff and the whole repo, no juror is *blind* to a callee that landed in another shard. It
does **not** remove the **accountability** half. Under a graph cut a caller/callee pair has exactly one
accountable owner; under the path-order cut shipped here it has two owners and needs a seam seat to hold the
edge between them. The fresh-context screen reached the same conclusion independently — made free, the
dependency cut is strictly better on the axis that matters. And the measurement in §1 shows the price being
paid rather than avoided: on #1571 **all five** cut points fall inside a two-segment directory, so coupling is
being severed on exactly the PRs the fan-out exists for. Perry & Evangelist put **68.6%** of a real error
population in the interface class, which is the class a severed edge hides.

**So graph cutting is a lever this project sets OFF, on cost, in this setting — not a discarded idea.** The
mechanism is published and validated, so a consumer that wants it is not starting from nothing: ClusterChanges
(Barnett, Bird, Brunet & Lahiri, ICSE 2015) projects two relations over diff-regions — `defUsesInDiffs` (a
definition in one region used in another) and `useUsesInDiffs` (two regions using a definition that is itself
unchanged, i.e. "changed all the callers, not the callee") — and on **1000** Microsoft Office changesets found
**~42%** carried more than one non-trivial partition. *Read its evidence honestly: it and every successor
(SmartCommit, Flexeme, UTango) is scored against a ground-truth partition, so none of them measured whether a
reviewer then finds more defects.*

**The design consequence:** the shard cutter takes its weight and its edge source as **inputs**, so a
consumer supplying a dependency graph gets a graph cut without re-architecting the panel. This repo supplies
the path-order/risk-weight source and no edge source. *(Classification of this lever as platform-invariant vs
consumer-setting is the sibling lever-catalogue item's call, not this card's — this card owns the fan-out
design and defers on the taxonomy.)*

## Deliberately out of scope

**Seating the panel inside a declared operation** — #x79c033.

**Raising `maxShards` above 1 in the live panel** — gated on criterion 1's number, not on this card landing.

## Done when

1. **Executable — the THREE-ARM measurement, and the one criterion that can fail if the premise is wrong.** A
   named harness runs, over the corpus cases with ≥10 changed files, three arms at the same `k` on the same
   diffs:
   **(A) unscoped** — `k` seats, each reads the whole diff, each answers for the whole diff;
   **(B) scoped** — `k` seats, each reads the whole diff, each answers for one shard (this design);
   **(C) truncated** — `k` seats, each reads *and* answers for only its shard.
   A vs B isolates **owned** scope; B vs C isolates **read** scope. Nothing in the literature separates the two,
   which is why the card owes the measurement rather than inheriting a result. It reports, per arm, with
   intervals and the n: **precision (primary)**, pooled findings and pairwise intersection, and the
   novel-finding rate `|F \ P| / |F|` (secondary). Precision leads because §6's pool-mean effect and di Biase's
   false-positive result are the two things the design is actually claimed to buy, and because raising
   `EVIDENCE_FLOOR` is admissible only on a measured number. It reuses
   `we:scripts/review-corpus/stability.mjs`'s comparison, so all three arms are scored the way this repo
   already scores run-to-run churn. The criterion is that the numbers **exist and are recorded on this card** —
   not that they favour scoping. A null result is a valid outcome and keeps `maxShards` at 1.
2. **Executable — the partition holds over real inputs.**
   `npx vitest run review-shards -t "#3326" | grep -qE "Tests +[0-9]+ passed"` — the `grep` is load-bearing,
   because a `-t` filter selecting zero tests exits 0 (the #3319 vacuity). Named tests assert, over the real
   file+churn lists of PRs #1571, #1572, #1570 and #1609 carried as fixtures: shards are **disjoint**,
   **complete**, **stable**, `k = 1` for a median-sized input, and — the risk-weight half — that #1571's
   generated-fixture files occupy **fewer** shard-weight units than their raw churn share. Plus a property test
   over ≥200 generated file lists asserting the four properties and `k ≤ maxShards`.
3. **Executable — a scoped seat's mandate carries the whole diff AND its counter-sentence, both mutation-proven.**
   A named test builds every seat of a 3-shard plan and asserts each seat's ground-truth changed-file list equals
   the **full** net set while its `scope` is only its shard. Then two mutations: delete the line passing the full
   set, and separately delete the *"never let it narrow you"* counter-sentence — a named test must redden for
   each. A test that stays green with either removed is itself a finding.
4. **Executable, real mechanism (#3264) — the seam manifest runs against a real repository.** A named test
   builds a real git repo (`withRealRepo`), declares a string-literal constant in shard A, references it **by
   value only** from a file in **no** shard, and asserts the manifest lists that row as `outside-diff` with
   `matched-by: value`. A second fixture with no matched reference asserts the row renders as *"no reference
   matched this predicate"* and never as "no callers". The test must fail against a double whose git calls
   return `''`.
5. **Executable, adversarial fixtures (#3354) — reduction routes a co-citation, and refuses an unaccounted-for
   shard.** *(a)* Two structurally-valid findings from different seats co-citing one file with opposing
   `impactIfUnfixed` produce exactly one `seam/co-citation` finding; a near-miss pair (same file, non-opposing)
   produces none; an unadjudicated co-citation sets `conflict: true` and `derivePanelVerdict` returns
   `needs-human`. Removing the named guard line reddens the first case. *(b)* The **coverage receipt**: each
   scoped seat returns a `covered` receipt naming its shard, and a reduction over a `k = 3` plan where one seat
   returns **no receipt** refuses to emit a panel verdict and names the unreceipted shard — so *"no blockers"*
   can never be reported over files nothing accounted for. A plan whose every seat reports reduces normally.
6. **Observable — the manifest states its scan, never its coverage (#3362), and breadth ships off.**
   `candidateCount`, `predicate` and `notCovered` are non-empty; a candidate over the hit cap renders as
   `too-common-to-trace` with its count; and `maxShards` is `1` in
   `we:scripts/lib/review-policy.contract.json`. `npm run check:standards` — 0 errors.

## References

- Ruled by #3320 — `#size-adds-reviewers-never-refuses` in `we:docs/agent/platform-decisions.md`.
- Composes `#blast-radius-advisory-care-not-a-gate` (#2563) and
  `#build-lane-self-review-non-zero-floor` (care scales depth; this extends the same shape to breadth).
- Touches `we:scripts/lib/jury-core.mjs` (`panelRigorForCareLevel` and the juror-prompt assembler).
- #3317 (cumulative escalation basis) is independent but complementary — it makes the size measurement honest
  under stacked lanes, which is what dials shard count.
- Prior art: [/research/scoped-fan-out-code-review/](/research/scoped-fan-out-code-review/) ·
  `we:reports/2026-08-27-scoped-fan-out-code-review.md`.
