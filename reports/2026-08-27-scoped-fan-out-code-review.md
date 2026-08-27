# Scoped fan-out code review — prior art, and what this repo's own data says

**Date**: 2026-08-27
**Point**: Preparation research for [#3326](/backlog/3326/) — how real systems parallelise review across a large
change, and what this repo's 120 merged PRs, 92-case review corpus and juror telemetry say about doing it here.
**Research page**: `/research/scoped-fan-out-code-review/`

---

## Question

#3320 ruled that diff size adds reviewers and never refuses a PR, and named **scoped fan-out** as what replaces
a refuse threshold: every reviewer gets the whole diff and full repository access, each accountable for a
disjoint named subset, plus a seam reviewer scoped to the boundaries and an omission reviewer scoped to the
whole diff. #3326 is the build. Preparation had to settle five things the card left open — how shards are cut,
what the seam reviewer actually receives, what reduction does with an inter-shard contradiction, what it costs,
and whether it composes with #3335 / #3319 / #3344 — and to survey what has already been tried.

## Recommendation

**Build the derivation; ship breadth off; measure before switching it on.**

1. Cut shards by **risk-weighted churn over the path-sorted changed-file list**, not by directory prefix.
   Directory cutting was measured and it degenerates on this repo's largest PRs.
2. Give the seam reviewer a **seam manifest** — module-scope declarations introduced by the diff, traced to
   their references **both by identifier and by literal value**, inside a hit cap, with the predicate and the
   uncovered classes stated on the manifest itself.
3. Treat an inter-shard **co-citation** as a candidate finding adjudicated by the seam seat, not as a
   contradiction the script has decided; escalate to `needs-human` only when the seam seat cannot adjudicate.
4. `maxShards` ships at **1** — the fan-out is inert — until an A/B against the review corpus shows scoped
   seats beating an equal number of unscoped ones. That comparison is the one acceptance criterion on #3326
   that can fail if the premise is wrong.
5. Seating a variable-N panel inside a declared operation is a genuine fork and is carved to its own decision
   item, *"Seating a variable-N scoped panel — fan out inside one judge step's caller, or widen the judge
   request"*, filed under the review-efficacy watch (#3318).

## Key findings — this repo's data

Every figure below was measured on 2026-08-27 against `origin/main` at `6b03a7bd`, in lane-12.

### 1 — PR size distribution (120 merged PRs, #1522–#1643, a six-day window)

`gh pr list --repo chalbert/web-everything --state merged --limit 120 --json number,additions,deletions,changedFiles`

| metric | min | p25 | median | p75 | p90 | max |
|---|---|---|---|---|---|---|
| changed files | 1 | 2 | **4** | 7 | 17 | **131** |
| changed lines | 6 | 135 | **317** | 785 | 1381 | **7445** |

25 of 120 (21%) changed ≥10 files; 5 (4%) changed ≥25. The repo's own 92-case review corpus is smaller still:
median 3 files, max 19, and **zero** cases at ≥25 files — no PR as large as #1571 has ever been reviewed by
the recorded pipeline.

**Consequence:** a shard dial keyed on file count is inert on ~75% of PRs by construction. The design's cost is
concentrated entirely in a 4% tail.

### 2 — Directory-prefix sharding degenerates on exactly the PRs that need sharding

For the 15 largest merged PRs, counting distinct one- and two-segment path prefixes:

- **10 of 15** put ≥47% of their files under a single two-segment prefix; **5** put ≥75%.
- **#1570 is 100% `backlog/`** — a directory cut yields exactly one shard on a 26-file PR, i.e. no fan-out.
- **#1571** puts 79% under `we:scripts/review-corpus/`; a directory cut gives
  `104 / 8 / 7 / 6 / 1 / 1 / 1 / 1 / 1 / 1`.
- `backlog/` is flat, so a deeper cut does not help.
- Only 4 of 15 (the `we:skills-src/` sweeps) shard evenly, with a largest prefix of 3 files.

### 3 — Churn-balanced contiguous partition fixes the balance, and the numbers say what it costs

Linear partition of the path-sorted file list minimising the maximum shard churn (binary search on capacity),
at `targetShardFiles: 12`, `maxShards: 6`:

| PR | files | churn | k | files per shard | largest shard's churn share | cuts inside one 2-seg dir |
|---|---|---|---|---|---|---|
| #1571 | 131 | 7445 | 6 | 17, 12, 24, 40, 31, 7 | **17%** (79% by directory) | 5 of 5 |
| #1572 | 40 | 4115 | 4 | 9, 22, 6, 3 | 27% | 1 of 3 |
| #1587 | 34 | 1976 | 3 | 12, 9, 13 | 36% | 0 of 2 |
| #1570 | 26 | 1360 | 3 | 3, 6, 17 | 35% (one shard by directory) | 0 of 2 |
| #1609 | 13 | 1272 | 2 | 7, 6 | 65% | 1 of 1 |

Two costs, both measured:

- **Balance has an atomic floor.** #1609's largest single file is 40% of its whole churn (511 of 1272 lines),
  so no two-way cut can beat 40%; contiguity pushed it to 65%.
- **Directory cohesion is not preserved on the big PRs.** On #1571 all five cut points fall inside a
  two-segment directory. A coupled caller/callee pair will land in different shards. That is the price paid
  for deferring dependency-graph cutting, and it is what the seam seat exists to absorb.

### 4 — Raw churn is the wrong weight

On #1571, **97 of 131 files (74%) and 3308 of 7445 changed lines (44%)** are generated corpus fixtures under
`we:scripts/review-corpus/`. A raw-churn cut spends roughly 2.6 of its 6 seats holding machine-generated JSON
to account. #3320 named this and left it unruled: *"Risk-weighted size — 400 lines of generated fixtures is not
400 lines of policy logic — is a live refinement of the care dial, not ruled here."* Sharding is where it bites
hardest, so #3326 weights by `churn × riskWeight(file)`, composed from the existing per-file classifiers in
`we:scripts/lib/review-escalation.mjs` plus a **listed** down-weight set for generated material.

### 5 — Identifier-only grep misses the majority of a frozen string enum's consumers

The seam manifest's first draft traced references by identifier alone. Measured, restricted to the code
prefixes:

| declaration | files reached by identifier | files reached by its literal value | identifier-only recall |
|---|---|---|---|
| `CLAIM_ACCURACY` | 4 | 18 (`claim-accuracy`) | **22%** |
| `NEEDS_HUMAN` | 16 | 28 (`needs-human`) | 57% |
| `PREVENTION_OUTSTANDING` | 10 | 21 (`prevention-outstanding`) | 48% |

`MANDATE_LENSES` and `VERDICTS` are frozen string enums and most consumers dispatch on the **value**. The
manifest therefore traces both.

Reference-set sizes, same restriction: `derivePanelVerdict` 15 files · `panelRigorForCareLevel` 23 ·
`normalizeFinding` 6 · `VERDICTS` 40 · `advance` **89** · `run` **645** (unrestricted, `run` matches 2360
tracked files and 11 493 lines). A hit cap is mandatory, and the code-path restriction is load-bearing: an
unrestricted grep for `derivePanelVerdict` returns 40 files of which 22 are prose; restricted, it returns 15,
all `.mjs`.

### 6 — Cost, and where it stops being linear

The diff is embedded in **each** juror's stdin — `renderJudgeInput(read)` → `judgeSpawn`'s single
`child.stdin.end(input)` per child — with no shared cache on that path. N seats is N copies.

Per-juror cost, from ~20 hand-recorded figures across `backlog/` (the 92-case corpus records no cost,
duration or token fields at all): **$0.02 – $1.35**, median of the well-instrumented runs **≈ $0.66**, wall
12.6 s – 312 s. Seats per round, with `seats = max(jurorsPerLens, k)` on mandatory lenses and seam + omission
added once when `k > 1`:

| PR class | files | k | seats/round today (care `high`) | with fan-out | Δ |
|---|---|---|---|---|---|
| median | 4 | 1 | 10 | 10 | ×1.0 |
| p90 / #1609 | 17 / 13 | 2 | 10 | 12 | ×1.2 |
| #1572 | 40 | 4 | 10 | 16 | ×1.6 |
| #1571 | 131 | 6 | 10 | 20 | ×2.0 |

At three rounds and $0.66 a juror: today's declared care-`high` panel is ≈$19.80 (cross-checking #3318's
independent ≈$21); #1571 under fan-out is ≈$39.60. Today's *actual* amortised spend is $0.43/PR.

Three limits on that number, all structural:

- It extrapolates from jurors that judged ~5 k-token diffs. #1571's diff is ~125 k tokens and is unmeasured.
- 20 seats × 125 k tokens × 3 rounds is ~**7.5 M input tokens of diff copies alone**. At median size the
  copies are a minority (one instrumented juror loaded 70 688 context tokens against a ~5 k-token diff), so
  the linear term only bites at the tail — where it dominates.
- `assertPanelBudget` sums declared per-seat budgets **before the first spawn** and throws, and the aggregate
  ceiling is required rather than defaulted. At `DEFAULT_BUDGET_USD = 1.5` a 20-seat roster declares $30, so
  a caller ceiling below that kills the panel outright. Fan-out fails **closed** at exactly the PRs it exists
  for unless `maxTotalBudgetUsd` is dialled with `k`.

Scheduling cost is separate: a tool-bearing juror needs a lane clone that is not the driver's own
(`assertLaneCwd`), and the mandate permits mutating that tree, so seats cannot safely share one. Twenty seats
against a 41-lane pool is half the pool for one review; at concurrency 4 and 167–312 s a juror, one round is
~20–25 minutes of wall clock.

### 7 — The measurement that argues against the whole design

`node we:scripts/review-corpus/stability.mjs --json` (drop the `we:` prefix when actually running it), re-run
on `main`:

```
pairs: 5, pooledFindings: 7, verdictFlipRate: 0.2
defect-level: intersection 0, union 7, microChurn 1.0
locus-level:  intersection 1, union 6, microChurn 0.833
```

Two runs of the **same** reviewer against the **same head sha** share **zero** findings at defect level. If
that holds, the gain from `k` seats is fully explained by resampling, and the scope assignment explains no
residual — `panelRigorForCareLevel` already ships resampling as `jurorsPerLens`, and dialling that on size is
a one-line table change.

Stated at its real strength: n = 5 pairs, 7 pooled findings, one pair with both rounds empty, and the sample
is biased toward unstable rounds. It is weak evidence. It is also the only measurement that exists, and it
points against the design. This is why #3326 ships `maxShards: 1` and carries an A/B as its first acceptance
criterion.

### 8 — The grounding on the card was partly retracted, and this survey found it

#3326's justification for the omission seat read *"on PR #1569 two rounds of the claim-accuracy lens found nine
wrong figures and missed both defects that bounced it."* The parent card #3318's own review log formally
retracts that sentence: one of the two pre-split rounds ran `claim-accuracy` (not two), the recorded finding
count is four (not nine), and the `claim-accuracy` round **did** carry one of the two defects —
`we:scripts/lib/__tests__/review-core.test.mjs:710`, *"two rounds earlier"* than the post-split note. #3318's
lesson from the episode is that the finding was under-**rated**, not un-**found**, because the juror had not
executed the mutation in a live clone.

The omission seat is therefore restated as **structurally** justified: sharding creates the gap. Under one
whole-diff juror absence is somebody's to notice; under `k` scoped jurors it belongs to no shard.

## Key findings — prior art

Full survey with sources on the `/research/` page. The five that changed the design:

1. **The exact intervention has a controlled positive result and the placebo was ruled out — but the strongest
   replication is null.** Porter, Votta & Basili (IEEE TSE 21(6), 1995): 16 three-person teams, whole
   specification to every reviewer, a disjoint fault class each — one of the three being *"Missing or Ambiguous
   Functionalities"*. Detection rate **+~35%, p < .01**; scenario reviewers no worse off-scope; each group best
   at *its own* faults and no better than other scenario reviewers elsewhere, so *"the content of the Scenario
   was primarily responsible."* Against it: Lanubile & Visaggio (>100 subjects) found no support, and other
   replications find no difference between perspectives in rate or coverage.

2. **Splitting the INPUT is the intervention with a controlled null.** di Biase et al. (PeerJ CS 2019, 28
   developers): change decomposition gave fewer wrongly-reported issues and more context-seeking, but
   *"impacts neither understanding the change rationale nor the number of found defects."* Do not cite the
   decomposition literature as evidence that fan-out raises recall.

3. **No production ownership system records who approved which file.** GitHub CODEOWNERS, Google Critique,
   Gerrit `code-owners`, Phabricator Owners and Chromium all partition the *requirement* by path and keep the
   *approval* whole-change. Gerrit is explicit — *"It is not possible to approve individual files only"* —
   and gives the reason any per-file scheme inherits: the owned set can change after the approval. Google and
   Chromium independently landed on stating the partition in a comment. Two transferable details: Gerrit shows
   a **red question mark on a file no reviewer owns**, and Chromium's Rubber Stamper never supplies both the
   code review and the ownership approval, by design.

4. **The territory half has a measured LLM-specific mechanism, and one shipped system already does this
   design.** Sovrano, Bauer & Bacchelli: models are *"lost in the end"* of long inputs, and naive chunking
   bought **>+37% average recall** across models and CWE types — at a precision cost. Qwen Code's `/review`
   fans out on territory × dimension with a **coverage receipt** (*"a chunk with no receipt is re-reviewed
   before the run proceeds"*) and records the failure to design against: *"chunk agents held every one of these
   defects inside their assigned territory and reported none. What they lacked was not the lines but the
   question."* Internal anecdotes, not a controlled study.

5. **Do not vote, do not debate, and do not report a plain union.** Majority voting beats every multi-agent
   debate configuration at matched compute; conformity averages **47.2%** with **57–77%** of flips
   correct→wrong and the *stronger* agent caving; and the minority holds the correct answer in roughly **1 in
   4** disagreements because shared pretraining correlates errors. Meanwhile Ribeiro et al. showed three
   analyzers at 0.57 / 0.16 / 0.08 precision union to **0.39** — toward the pool *mean* — while a learned
   filter lifted it to **0.68** retaining **95.8%** of real flaws. Union-then-rank-then-filter.

Also folded in, as better grounding than the card's own anecdote for the seam and omission seats: **Wagner et
al.** — bug-finding tools and testing found *no identical defect at all*; *"all defects found by bug finding
tools were also found by the review"*, whose 17 extra defect types were every one of them **cross-location**
(an unclosed connection missed *"because this was done in different functions"*). Coverage-share, not recall;
three developers including the author, unprepared, one project.

**One citation struck.** An earlier draft of this survey carried a *"<10% pairwise overlap between analyzers"*
figure attributed to Ribeiro et al. **That figure is not in the paper** — it came from a search-engine
synthesis and was passed through unchecked. Recorded here rather than silently deleted, because it is the exact
failure class the parent programme keeps finding.

## Files Created/Modified

| File | Action |
|---|---|
| `we:backlog/3326-scoped-fan-out-review-disjoint-accountability-over-a-shared.md` | prepared — scope, settled design, cost, skeptic + screen verdicts, six executable criteria |
| a new `we:backlog/` decision item, *"Seating a variable-N scoped panel"* (child of #3318) | created — the carved seating fork |
| `we:src/_data/researchTopics/scoped-fan-out-code-review.json` | created |
| `we:src/_includes/research-descriptions/scoped-fan-out-code-review.njk` | created |
| `we:reports/2026-08-27-scoped-fan-out-code-review.md` | created (this file) |
