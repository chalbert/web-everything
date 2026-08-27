---
bornAs: x2iwy8f
kind: decision
parent: "3318"
status: open
dateOpened: "2026-08-26"
preparedDate: "2026-08-27"
blockedBy: ["xg7hrd5"]
relatedReport: reports/2026-08-26-advisory-lens-blocking-set-corpus-replay.md
tags: []
---

# Should every advisory lens block above the impact bar, or only claim-accuracy

#3314 ruled that what blocks is impact, not the lens — but scoped the blocking set to `claim-accuracy`
alone rather than take the general form. The general form is the obvious next question: if
`impactIfUnfixed >= broken` is the right reason to block a land, why does a `broken` finding from
`simplicity` or `standards-conformance` ride the accept?

> ## Do not rule this yet — `blockedBy` #xg7hrd5 (added 2026-08-27)
>
> **This item is prepared but its load-bearing ground is about to change.** Fork 1's recommended default
> (a) rests, by its own text, on one discriminating ground — a lens joins the blocking set only if its
> *"impact levels are checkable against an artifact rather than asserted"* — and calls `simplicity`'s
> exclusion *"permanent unless the criterion itself is overturned"*.
>
> [`#xg7hrd5`](/backlog/xg7hrd5-calibrate-the-finding-consequence-scale-one-axis-or-two-asse/) prepares
> exactly that criterion. Its Fork 2 moves the level from a juror's assertion to a derivation over three
> factual answers, and its Fork 4 builds the anchor set those answers are checked against. Both are
> **lens-independent**: a `simplicity` juror answers them exactly as a `correctness` juror does. So the
> criterion stops discriminating between lenses, and this item's *"permanent"* half loses its ground.
>
> Two things sharpen this rather than soften it. **(1)** Measured in that item's lane, the artifact does not
> exist for **any** lens — the corpus holds 42 impact labels and zero anchors — so read strictly the
> criterion currently admits `claim-accuracy` on no more evidence than it excludes `simplicity` on.
> **(2)** That item's Fork 2 predicts a `simplicity` finding will usually derive to `cosmetic`, which would
> make generalising safe **for a reason this card never argued** — the rubric, not the roster, holding low
> consequence below the bar. A decider ratifying this card today would not see that case.
>
> **What survives untouched, and is why this is `blockedBy` rather than dissolved:** generalising still
> takes the merge path from 2-of-4 to 4-of-4 blocking lenses, and the advisory lenses never dissented in
> 6 of 6 observed subjects. Grounds 1 and 2 stand. **The question is live; only its third ground is not.**
>
> Per #1886 a ratified call is immutable, so ratifying this first would leave no honest repair but a new
> reconciliation item. Re-derive Fork 1's default with the criterion **retired as a discriminator** once
> #xg7hrd5 is ruled, and take the anchor-agreement number as an input Done-when 3 did not previously have.

## Digest

**One real fork, one concern that dissolved.**

**Fork 1** (the fork) — keep the blocking set explicit and one-member, or generalize it to every advisory
lens. **Recommended: keep it narrow, codify the admission rule, and file the measurement that can open it.**

**The card's second question — does the general form collapse `MANDATORY_LENSES` into the bar? — dissolved
as contract-derived**, not as a fork. #3314's anchor already answers it in its first sentence, and the code
confirms: mandatory means *blocks at any impact* (`deriveVerdict` has no impact test), which is a different
power from *blocks above the bar*, so no finding rate makes one the other. See *Derived, not ratified* below.

The empirical work is in
[`we:reports/2026-08-26-advisory-lens-blocking-set-corpus-replay.md`](../reports/2026-08-26-advisory-lens-blocking-set-corpus-replay.md).
Its headline is that **the card's point 1 is unanswerable from any artifact this repo holds** — where the
advisory lenses ran, `impactIfUnfixed` did not yet exist; where the field exists, the lenses never ran — plus
an inversion: the lens #3314 gave a blocking sub-class to is **not seated on the land path**, while the two
this fork is about **are**.

## The replay — what it covers, what it excludes, what it found

Full method, per-lens tables and limits in the linked report. The load-bearing figures, re-derived
2026-08-26 by direct enumeration and **not** carried forward from any sibling card:

**Candidate set:** the 92 JSON case files in `we:scripts/review-corpus/cases/` (excluding the corpus index),
59 distinct PRs, #1456–#1567. **Excluded:** the **62** recorded verdicts the miner could not parse
(`skipped.unstructuredVerdicts`) — so this is **92 of 154** recorded verdicts, a 40% exclusion of unknown
composition — and, for the lens tally only, the **5** cases carrying no lens row (denominator 87, not 92).

| what was asked | what the corpus holds |
| --- | --- |
| `simplicity` findings clearing `broken` | **0 — because 0 runs seated the lens** |
| `standards-conformance` findings clearing `broken` | **0 — same reason** |
| lens rows recorded | 86 `correctness`, 1 `security`, **0 advisory**, all `singleLens` |
| operator `changes` verdicts | 37 of 92 |
| correctness juror accepted **and** operator bounced | 27 |

**The card's point 1 cannot be answered from the corpus as written.** `review-pr` seats one caller-chosen
lens plus a pinned `security` seat, so a lens that is never seated cannot produce a recorded finding.

**The second population, and why it does not rescue the question.** The corpus is not the only durable
record, and the claim *"no recorded review ever seated an advisory lens"* would be **false repo-wide**. The
drain's parked-PR loop really does fan out four lenses, and its **jury ledgers** at `we:.conveyor/jury/`
hold six real runs (84 events, 2026-08-02 → 2026-08-05; **gitignored, so machine-local and not replayable
from a checkout**). Re-derived directly:

| lens | findings | verdicts across the 6 subjects |
| --- | --- | --- |
| `correctness` | 4 | 4 accept · 2 changes |
| `security` | 5 | 4 accept · 2 changes |
| **`simplicity`** | **10** | 4 accept · 2 changes |
| **`standards-conformance`** | **7** | 4 accept · 2 changes |

Three results, and they do not all favour the same branch:

1. **The card's premise about volume is refuted.** `simplicity` is not a lens that "rarely produces
   findings" — it produced **more than either mandatory lens**. No argument here may rest on it being quiet.
2. **But the advisory lenses never dissented.** In **6 of 6** subjects all four lenses returned the *same*
   verdict. There is **no observed case** where an advisory lens wanted changes and the mandatory pair did
   not — so on this evidence the general form would have changed **zero** outcomes.
3. **`impactIfUnfixed` is absent on all 26 findings** — the field postdates these runs. The population cannot
   be stratified by impact, and it must not be retrofitted: #3339's scan is **fail-closed on undeclared**, so
   applied literally to this population all 17 advisory findings would block, which measures a missing field
   and nothing else.

**So the honest state of the evidence is that the question is not merely unanswered but currently
unanswerable**: where the advisory lenses ran the field did not exist, and where the field exists the lenses
never ran. Done-when 3 makes closing that a filed obligation rather than a wish.

**The proxy, and its ceiling.** The 42 recorded findings carry a free-text `category` — 18 distinct values,
only 15 of 42 inside the five-lens vocabulary — so `category` is a topic label, not a lens attribution.
Hand-attributing all 42 to the lens whose charter owns them (one reader, this session; predicate and
candidate set in the report):

| lens | findings | at/above `broken` |
| --- | --- | --- |
| `correctness` | 17 | 7 |
| `claim-accuracy` | 21 | 3 |
| `security` | 2 | 1 |
| `simplicity` | **1** | **0** |
| `standards-conformance` | **1** | **0** |

**This proxy under-counts `simplicity` by construction** and the default does not lean on it as proof: the
42 findings came from jurors seated at `correctness`/`security`, so they record what a correctness juror
*incidentally* noticed about duplication — not what a briefed simplicity juror would file. The honest claim
is "**no observed instance**", not "cheap".

**The inversion the replay forced.** The blast radius does not depend on that rate at all:

- The drain's parked-PR loop (`LENSES`, `we:scripts/workflows/review-parked-prs.mjs:153`) seats four lenses —
  `correctness`, `security`, **`simplicity`, `standards-conformance`** — and `:141` states *"ADVISORY
  (surfaced, never blocking): simplicity, standards-conformance"*. The general form takes that path's
  blocking seats from **2 of 4 to 4 of 4**, immediately, on the path that lands PRs.
- `claim-accuracy` is **deliberately not seated** there (`:145-152`), and `derivePanelVerdict`'s
  outstanding-finding scan is unbuilt (#3339, open). **So #3314's rule reaches nothing today, and the
  general form would reach the land path at exactly the two seats where #3314's ruling has none.**
- Counted in *seats*: the parked-PR loop clamps at 2 jurors per lens (`JURORS_PER_LENS_CEILING`,
  `we:scripts/workflows/review-parked-prs.mjs:161`) over its own four-lens literal, so at the top band it
  goes from **4 of 8 blocking seats to 8 of 8**. The five-lens, ten-seat roster the care contract declares
  (`we:scripts/lib/review-policy.contract.json`, `high`) is **not** the land path — it is the roster
  `/converge` and `/jury` resolve, both advisory end-to-end — so its 4-of-10 → 10-of-10 sizes those surfaces,
  not a land.
- **Count the two powers separately, or the figure overstates its own case.** The four seats a promotion adds
  are not equivalent to the four that already block: a mandatory seat blocks on **any** outstanding blocker
  finding, a promoted advisory seat only at or above the bar. On the corpus's measured distribution (11
  `broken` of 42) the added seats would fire at roughly **a quarter** of a mandatory seat's rate. The honest
  statement is *"the number of seats that can stop a land doubles, and the added ones fire at about a
  quarter the rate"* — not "blocking doubles".

---

## Fork 1 — does the blocking set generalize to every advisory lens?

**Fork-existence justification.** A genuine either/or: *may a `simplicity` juror's `broken` finding stop a
land?* has one answer for this repo's review policy, and the two branches **cannot coexist** because the
same finding cannot both stop and not stop the same land.

**The composability probe, run properly — it half-succeeds, and the residue is what is ratifiable.** The
"support both" shape is not the strawman *"let the reviewee configure it"*; it is **human-gated per-surface
config**, which this repo already does for the neighbouring knob: `derivePanelVerdict` takes
`mandatoryLenses` as a parameter (`we:scripts/lib/jury-core.mjs:1074`), `we:scripts/review-core-cli.mjs:186`
passes a caller-supplied value straight through, `we:scripts/workflows/review-parked-prs.mjs:154` declares
its *own* `MANDATORY_LENSES` literal, and `we:scripts/lib/review-policy.contract.json` carries per-care-band
rosters as data whose edits fire `gate-self` → `review:human`. So the **mechanism** is already a dimension,
and a `blockingAdvisoryLenses` contract entry would be its natural home.

**What survives the probe is the platform default, and that is a real ratification, not a formality.**
Per-*surface* variation in *seating* is legitimate and already ruled (#3313 separates looking from
blocking). Per-surface variation in *blocking power* is not the same thing: it would let one gate stop a PR
that another gate clears on the identical finding, which is incoherence rather than configurability. The
question this fork rules is therefore **the one platform default every surface inherits unless a human-gated
contract edit says otherwise** — and Q6's most-permissive rule picks that default whether the axis is read
as a fork or as a dimension, so the *answer* is stable under the re-route. (The dial that is unambiguously
config here is the *level*, `PREVENTION_IMPACT_BAR`, already parameterised as `bar` at
`we:scripts/lib/jury-core.mjs:692` and `:1074`. Nothing below rules the level.)

**Crux with refs.** `ADVISORY_LENSES` (`we:scripts/lib/jury-core.mjs:862`) is
`[simplicity, standards-conformance, claim-accuracy]`. #3339's `BLOCKING_ADVISORY_LENSES` is specified as a
frozen one-member set and is not yet built. The scan it gates must read impact alone — outstanding **and**
`impactStrictness(impactIfUnfixed) >= impactStrictness(bar)`, fail-closed on undeclared — never
`blocksAcceptance` (`:692`), which short-circuits on `hasUncapturedPrevention` (`:647`).

### Options

- **(a) Keep the blocking set explicit and narrow; admit a lens only on evidence about that lens.**
  `BLOCKING_ADVISORY_LENSES = ['claim-accuracy']` stays a literal membership list, and the *rule* for
  adding to it is codified: a lens joins when its own findings show an above-bar population **and** its
  impact levels are checkable against an artifact rather than asserted. Cost: `simplicity` and
  `standards-conformance` keep riding the accept on genuine `broken` findings until someone measures them.
- **(b) Generalize — every advisory lens blocks above the bar.** Drop the set; test impact alone on any
  advisory-lens finding. Cost: doubles the blocking seats on the live land path (above) on zero measured
  evidence for either newly-blocking lens, and hands a self-declared blocking power to the one lens whose
  findings have no artifact to peg an impact level to.
- **(c) Generalize by property, not membership — admit `standards-conformance`, exclude `simplicity`.**
  The blocking set becomes "lenses whose findings are checkable against an artifact". Coherent, and it names
  the right criterion — but it promotes `standards-conformance` on the *same zero evidence* as (b), just
  less of it. *Rejected as a branch, adopted as the criterion*: (a) takes (c)'s test and applies it as an
  admission rule rather than as a second promotion.

### **Recommended default: (a) — keep it narrow, and codify the admission rule.**

Three grounds, in ascending order of weight — **the last one is the only one that discriminates, and it is
the one the default rests on**:

1. **The measured population shows no outcome the general form would have changed.** Across the six real
   four-lens runs, all four lenses returned the same verdict in **6 of 6** subjects: the advisory lenses
   never once dissented from the mandatory pair. (b) buys nothing observable and adds four unilateral stops.
2. **The burden of proof is on the branch that adds blocking**, and (b) would bind first and hardest on the
   two lenses whose above-bar rate is *unmeasurable*, not merely unmeasured. This is a burden argument, not
   an evidence-of-absence one: it does not claim the rate is low, only that nobody may assume it.
3. **The incentive objection is answerable, but it is not neutral between lenses** (its own section below).
   It leaves `simplicity` inadmissible on a **criterion** — not on a stall, and not on a count.

**And the volume premise the card offered for (a) is refuted, so the default does not use it.** The card
supposed `simplicity` might "rarely produce above-bar findings". It produced **10 findings across 6
subjects, more than either mandatory lens**. Anyone reaching for (a) because the lens is quiet is reaching
for a fact that is not true.

**The two excluded lenses are excluded for different reasons, and the anchor must say so** — otherwise one
deferral reads as one principle:

- **`simplicity` fails on the criterion.** Its findings have no artifact to check an impact level against,
  so it stays out **however large a future above-bar population turns out to be**. This half of the ruling
  is permanent unless the criterion itself is overturned.
- **`standards-conformance` fails only on the evidence.** It plausibly passes the checkable test — a
  conformance finding names a convention or a ratified rule the diff violates, and that is verifiable — but
  its above-bar rate is unmeasurable today. This half is *"not yet"*, **and a "not yet" is only honest if
  something is obliged to end it** — which is why Done-when 3 files the measurement unconditionally rather
  than "if wanted". #3313 ruled in this same cluster that a circular "not yet" is not a ruling; this default
  must not reproduce the shape it refused.

**Rejected — (b):** its whole appeal is symmetry, and symmetry is an argument about the *shape* of the rule,
not about what the rule would do. The wiring survey and the ledger data show what it would do: four more
unilateral stops on the land path, and zero changed outcomes in the only observed population.
**Rejected — (c):** right criterion, wrong instrument. A promotion is a claim that a lens's findings *reach*
the bar, and no artifact can yet support that claim for `standards-conformance` — so (c) would ratify on the
same absent evidence as (b), just less of it. (a) adopts (c)'s criterion and waits for the measurement (c)
skips.

### The code shape

**(a), the default** — the set stays a ruled literal, and the *admission* rule is what the anchor writes:

```js
// we:scripts/lib/jury-core.mjs — #3339 builds this; #3338 rules its membership.
/** Advisory lenses whose OUTSTANDING above-bar findings block the panel verdict. Membership is RULED
 *  per lens (#3338), never derived from `ADVISORY_LENSES`: a lens joins on evidence of an above-bar
 *  population of its OWN, and only if its impact levels are checkable against an artifact. */
export const BLOCKING_ADVISORY_LENSES = Object.freeze([MANDATE_LENSES.CLAIM_ACCURACY]);
```

**(b), the alternative** — one line, and the reason it is a large change wearing a small diff:

```js
export const BLOCKING_ADVISORY_LENSES = ADVISORY_LENSES; // every advisory lens blocks above the bar
```

The scan `#3339` gates is identical under both; only the membership test moves.

`Skeptic:` **SURVIVES-WITH-AMENDMENT — the value `['claim-accuracy']` was not refuted; three of its
supports were, and all three were replaced.** A throwaway agent prompted only to refute, carrying all four
axes.

1. **Classification (the strongest hit — landed).** It argued the fork is a **config dimension**: leading
   with Q6 concedes dimension-hood, the `### The code shape` block prints two values of one symbol, and the
   *"a review gate the reviewee configures is not a gate"* rebuttal is a **strawman** — the real alternative
   is human-gated per-surface config, which this repo already runs for `mandatoryLenses`
   (`we:scripts/review-core-cli.mjs:186`, `we:scripts/workflows/review-parked-prs.mjs:154`,
   `we:scripts/lib/review-policy.contract.json`). **Accepted in substance.** The fork-existence paragraph was
   rewritten to run the composability probe against those surfaces rather than assert its failure, to concede
   the mechanism is a dimension, and to state that what is ratifiable is the **platform default every surface
   inherits** — noting the answer is stable under the re-route, since Q6 picks the same value either way. Q6
   was demoted out of the grounds list.
2. **Merit — "absence of evidence used both ways" (landed).** The draft called the proxy unreliable and then
   rejected (c) *because* `standards-conformance` had one recorded finding. Rewritten: the grounds are now a
   burden argument and a measured no-dissent result, and (c) is rejected because the claim it would ratify is
   **unsupportable**, not because a count is low.
3. **Merit — "criterion (i) is unreachable, so (a) is a stall in mechanism" (landed hardest).** It traced the
   miner's `Net basis:` key to `we:scripts/operations/review-pr.mjs`, the one surface that never seats an
   advisory lens, and showed Done-when 3 said *"if a measurement pass is wanted"*. **Done-when 3 was made
   unconditional.** The independently-found jury ledgers narrow the gap it identified — the parked-PR loop
   *does* record advisory findings — but confirm its point: those records carry no `impactIfUnfixed`.
4. **Statute-overlap (landed).** It found the table quoted #3313 past the clause that bites (its Lineage:
   *"the ruling took **neither** branch, on the finding that 'not yet' was **circular**"*) and omitted two
   `lens`-matching anchors — `#build-lane-self-review-non-zero-floor` clause 4 (*"Depth above the floor is a
   config dimension, not a fork"*) and `#converge-editor-enabled-at-low-only`. All three rows were added and
   the table's stated predicate corrected.
5. **Citation-scope — attacked, held.** It confirmed #3314's *"Scope held deliberately narrow"* clause
   genuinely authorizes this case (it names `#3338` by number), that #2563 is correctly downgraded, and that
   the #2310 "no anchor" finding reproduces exactly.
6. **One attack it tried and lost:** *"a blocking verdict costs only an extra editor round, so the cost is
   nil."* It withdrew this itself — at `elevated` and above the parked loop is review-only
   (`#converge-editor-enabled-at-low-only`), so an advisory `changes` converts an auto-land into an operator
   hand-off, which is the currency the loop is trying to spend less of.

`Screen:` **clear** — fresh-context agent; two wording fixes applied (the `simplicity`-vs-
`standards-conformance` grounds split, and one stray effort-word). See *Two-confusion screen*.

---

## Derived, not ratified — the impact bar does not govern mandatory lenses

**This was drafted as `## Fork 2` and dissolved.** Both the skeptic and the fresh-context screen reached the
same disposition independently: it is **contract-derived**, so no branch remains to weigh. That is the same
disposition [`#size-adds-reviewers-never-refuses`](/backlog/3320/) took in this cluster on the same day —
*"convened as a fork … and dissolves as contract-derived: `#2563` clause 1 had already ruled the class."*
It is recorded here as a clarifying clause the eventual anchor should carry, **not** as a decision to make.

**The derivation, in two steps.**

1. **The statute already says it.** `#claim-accuracy-advisory-blocks-on-impact` opens: *"Leaves
   [`#2310`](/backlog/2310/)'s mandatory/advisory split **intact** — `claim-accuracy` stays **out** of
   `MANDATORY_LENSES` — and refines what an advisory lens may **nonetheless** do."* The bar was authored as
   a refinement of the *advisory* path. Nothing in #3314 reaches the mandatory veto.
2. **The code confirms it.** `deriveVerdict` (`we:scripts/lib/jury-core.mjs:616`) returns `changes` on any
   outstanding blocker finding **with no impact test at all**, and `derivePanelVerdict` (`:1074`) propagates
   any mandatory `changes` straight through. The bar appears only in the prevention scan (`blocksAcceptance`,
   `:692`).

**So the card's worry is unfounded, and this is why.** *Blocks at any impact* and *blocks above the bar* are
**different powers**, not the same power at two strengths. `MANDATORY_LENSES` therefore does not degrade into
*"lenses whose findings are usually above the bar"* under any branch of Fork 1 — no finding rate turns one
power into the other. The only thing that would collapse it is applying the bar uniformly, and nothing
proposes that.

**Priced, so the exclusion is visible.** Were the bar applied uniformly, it would strand the whole `degraded`
band — 19 of 42 corpus findings, gloss *"someone hits friction or a worse result, and recovers unaided"* —
plus 12 `cosmetic`, i.e. 31 of 42 findings stop blocking. On the object a uniform bar actually governs (the
**machine reduction**, `lensRows[].verdict`): 7 of 92 cases carry a lens row at `changes`, 6 of those carry
findings, and in **1 of those 7** every finding is below the bar. So a uniform bar would have flipped **1 of
7** reduced verdicts.

> **Retracted — this section's original figure priced the wrong object.** It read *"Of the 37 cases the
> operator recorded `changes` on, 21 carried at least one recorded finding — and in **13 of those 21**, every
> finding was below `broken`. A uniform bar would have removed the findings-based grounds for 13 of 21
> measured bounces."* **All three raw counts reproduce (37 / 21 / 13), and the inference does not.**
> `Decision:` in a mined case is the **operator's own free answer**, recorded through `findings.confirm`
> (`we:scripts/operations/review-pr.mjs:700`) — not the machine reduction a bar change would alter. The
> corpus proves the two are decoupled: in **27 of 92** cases every lens row said `accept` and the operator
> recorded `changes` anyway, and **16 of the 37** bounces carry no recorded finding at all. Re-derived on
> `lensRows[].verdict`, the figure is **1 of 7** — roughly a thirteenth of the overstated one, and by itself
> *"evidence of one"*, the standard this item invokes against Fork 1 (b). The clause does not rest on it: the
> derivation above is textual and structural, and the 1-of-7 is reported because a pricing that shrinks by an
> order of magnitude on correction has to be shown shrinking.

`Skeptic:` **REFUTED as a fork → restated as a derivation.** Attacked on all four axes. Classification: it
showed the answer is read straight off #3314's first sentence plus `deriveVerdict:616`, so this is the #3320
contract-derived shape, not a ratifiable pick — **accepted, and the section was demoted out of `## Fork N`.**
Merit: it caught that the 13-of-21 figure priced operator decisions rather than the reduction — **accepted
and retracted above.** The merit conclusion itself held: its attack *"if impact is the right axis, exempting
mandatory lenses is special pleading"* fails on #3314's own scope, and its fallback (apply the bar uniformly
but drop it to `degraded`) makes `cosmetic` the only non-blocking level, which renames the status quo rather
than changing it.
`Screen:` **clear, and it reached the same dissolution unprompted** — *"If that is true, it is a
ratification, not a fork, and the two-option framing overstates the contest."* Not an impl detail (the ruled
thing is the observable verdict reduction); the merit difference is measured, not costed. Fix applied: the
section no longer poses a choice.

---

## The incentive objection — answered, not filed

The card's point 3, and the strongest argument for the status quo: *a juror that can block by declaring
`broken` has an incentive to declare `broken`; the mandatory/advisory split is discretion-proof in a way an
impact self-declaration is not.* Three parts, and the third is the one that decides anything.

**1. The split is not discretion-proof. It allocates discretion; it does not remove it.** A mandatory juror
blocks by self-declaring `changes`, at any impact, with **no typed field involved at all**
(`deriveVerdict:616`). That discretion is measurably imperfect in both directions: in **27 of 92** cases the
correctness juror accepted and the operator bounced anyway. Whatever an impact self-declaration is, it is a
*narrower* discretion than four of the four blocking seats already exercise — a promoted advisory juror must
clear a typed bar; a mandatory one need not.

**2. So the objection is not "self-declaration is unsound" — it is "how many independent seats may
unilaterally stop a land".** Under diversity-selection (`AGGREGATION.DIVERSITY_SELECTION`, strictest wins,
never a vote), every added blocking seat is another unilateral stop. That is a real cost and it is the one
the wiring survey sizes: 2 of 4 → 4 of 4 blocking lenses on the parked-PR loop (4 of 8 seats to 8 of 8). It
is an argument about **magnitude**, and it does not discriminate between the one-member set and the general
form except by counting — and the magnitude is smaller than the seat count suggests, since a promoted seat
fires at roughly a quarter of a mandatory seat's rate.

**3. The part that does discriminate — and this is the answer.** The bar filters honestly only where the
impact level is **pegged to an observable**. For `claim-accuracy` it is: a citation either resolves or it
does not, and whether a Done-when criterion depends on it is checkable, so `broken`-versus-`cosmetic` is an
argument a juror can *lose*. For `simplicity` the finding **is** the judgment — there is no artifact the
level can be checked against — and `IMPACT_GLOSS`'s `broken` gloss reads *"real work is lost,
**duplicated**, or **silently skipped**"* (`we:scripts/lib/jury-core.mjs:206`), phrasing that a simplicity
finding can reach by wording alone.

**The ten real `simplicity` findings in the ledgers show the elasticity directly, in one lens's own
population.** At one end, plainly `cosmetic`: *"Three overlapping guards in `checkRunTimestamp` do the work
of one."* At the other, wording that reads straight onto the `broken` gloss with no artifact to check it
against: *"one marker comment **silently exempts** the two source lines below it"*
(`we:scripts/lib/utc-day-slice-scan.mjs:64`), and *"a run that ENDED late can outrank the newer run that
only STARTED late"* (`we:scripts/merge-ai-prs.mjs:339`). **Both readings are available on the same evidence,
and nothing outside the juror's own sentence decides between them.** A juror that gains a blocking power by
choosing the higher word is being asked to price its own leverage — which is exactly the incentive the card
names, made concrete rather than hypothetical.

**This cuts against (a) too, and the item does not hide it.** Those same findings show `simplicity` *does*
produce work that plausibly belongs above the bar; the objection is not that its findings never matter, but
that its **level** is unfalsifiable. That is a narrower and more defensible claim, and it is the one the
default rests on.

**Verdict: the objection does not kill the general form, and it does not survive as a defence of the status
quo either.** It cannot kill (b) on its own, because it applies with equal force to #3314, which is already
ratified — an argument that would retroactively unmake a ratified decision is proving too much. What it does
is **kill the uniform version of (b)** and supply the admission criterion the default adopts: *a lens is
admissible to the blocking set only where its findings' impact level is checkable against an artifact rather
than asserted.* `claim-accuracy` passes. `standards-conformance` plausibly passes but has no measured
population. `simplicity` fails on the criterion itself, and would fail it even with a large above-bar
population — which is why (a) is not merely "wait for data" for that lens.

**#3314 anticipated exactly this test** and it is quoted here because the default rests on it: *"A sub-class
defined by a typed field is the whole point — the objection to a sometimes-blocking advisory lens
('mandatory with extra steps') holds only where the sub-class is reviewer discretion, so any future rule of
this shape must name a typed field or take plain advisory instead."* Naming the typed field is necessary and
not sufficient: the field must also be **checkable**, or naming it is discretion wearing a type — the same
phrase #3339 already uses about the `claim-accuracy` lens brief.

---

## What remains of #2310's split under the general form

The card's point 2, answered on the code rather than from the card.

**`MANDATORY_LENSES` survives as a concept under every branch of Fork 1, and the card's worry — that
mandatory would degrade to "lenses whose findings are usually above the bar" — is unfounded.** Mandatory
means *blocks at any impact*; blocking-advisory means *blocks only above the bar*. Those are different
powers, so the mechanisms are not redundant, and no finding rate makes one the other. `MANDATORY_LENSES`
would collapse only if the bar were applied **uniformly** — and that is not a branch anything proposes, it
is the possibility *Derived, not ratified* excludes above.

**What the general form would genuinely contradict is one sentence of #2310, and it is not a statute.**
#2310 is `kind: story`, resolved 2026-07-09, `graduatedTo` code — **grep of
`we:docs/agent/platform-decisions.md` for "2310" returns three hits, all incoming references from other
anchors; #2310 has no anchor of its own.** The sentence at issue is from its resolve note: *"Advisory
findings are always surfaced, never blocking on their own."* So:

- **Stated plainly, as a cost of the branch and not a footnote:** Fork 1 (b) **overrides that sentence for
  all three advisory lenses**. It is a real reversal of a resolved story's rationale, and the honest size of
  it is *a resolved story's rationale sentence*, not a ratified statute anchor — the move #3320 refused for
  size was a reversal of a **platform-decisions** rule.
- **And #3314 already overrode that sentence once**, for one lens, while its anchor says it *"Leaves #2310's
  mandatory/advisory split intact"*. Both are true: the *membership* is intact (`claim-accuracy` stays out
  of `MANDATORY_LENSES`); the *"never blocking"* half is not. Fork 1 (b) extends an override that has
  already begun, which weakens the "unconvened reversal" objection without removing it.

**Three live cards this touches, checked against their code rather than the card text:**

- **#3339 (open, unbuilt) — directly affected, and it is executable.** Its Done-when 1 pins *"the same
  `broken` finding from `simplicity`… still `accept`"*. Fork 1 (b) **inverts that test case**, so (b) cannot
  be ratified without amending an open card's executable criterion — a one-criterion amendment, but one that
  must be named rather than discovered at build time.
- **#3344 (`decideLensFloor` / `assertMandatoryLensSeated`, `we:scripts/operations/review-pr.mjs:253` and
  `:282`) — its mechanism survives, its stated reason does not.** The refusal message reads *"An advisory
  lens INFORMS; only a mandatory one can block, so the verdict this run rendered could never have been
  anything but a pass."* Under Fork 1 (b) that sentence is **false** — an advisory-only run could block
  above the bar. The guard stays defensible (a run with no any-impact seat still has a weaker floor) but
  would need rewriting — and it would lose its subject entirely under a uniform bar, which is a further
  reason that possibility is excluded above. Under the recommended default, both card and message are
  untouched.
- **#3319 (pinned `judgeSecurity` seat) — unaffected.** It seats a mandatory lens by construction; nothing
  in this item changes whether that seat exists or what it may do.

---

## Supported by default (not decisions)

- **Surfacing every advisory finding, at every impact.** Not a fork under any branch — the notice-wide /
  verdict-narrow split (`hasUncapturedPrevention` vs `blocksAcceptance`,
  `we:scripts/lib/jury-core.mjs:647` and `:692`) already fixes the direction: *no reporting surface may
  narrow by the bar*. Both branches of both forks keep that.
- **`bar` as a caller-supplied dial.** `PREVENTION_IMPACT_BAR` is already a parameter on `deriveVerdict`,
  `derivePanelVerdict` and `blocksAcceptance`. Nothing here rules the *level*; both forks rule *whose
  findings the level is applied to*.
- **Fan-out width.** Which lenses are *seated* is a separate axis from which may *block*, and #3313 already
  ruled that direction (*"Looking and blocking are separate decisions"*). Nothing in this item widens or
  narrows a roster.

## Statute-overlap check

**The rule this decision would codify** (draft anchor text, for
`we:docs/agent/platform-decisions.md#blocking-set-admits-a-lens-on-its-own-evidence`):

> **A lens enters the blocking set on evidence about that lens, never by generalization from another lens's
> ruling — and the impact bar narrows an advisory seat's power without ever touching a mandatory one.**
> `BLOCKING_ADVISORY_LENSES` is a ruled membership list, not a derivation from `ADVISORY_LENSES`. A lens is
> admissible only where (i) its own recorded findings show an above-bar population, and (ii) its
> `impactIfUnfixed` level is **checkable against an artifact** rather than asserted — a typed field is
> necessary and not sufficient, because an unfalsifiable level is discretion wearing a type. **The two tests
> exclude on different grounds and a ruling must say which it is using**: a lens failing (ii) is excluded
> permanently unless the criterion is overturned; a lens failing only (i) is excluded *pending measurement*
> and owes a stated trigger. Mandatory lenses keep the any-impact veto: *blocks at any impact* and *blocks
> above the bar* are different powers, and the bar is a narrowing of the second, never a narrowing of the
> first.

**Grep of `we:docs/agent/platform-decisions.md` for same-subject anchors** — predicate: the literal terms
`2310`, `lens`, `advisory`, `impact`, `block`, read over every anchor they hit rather than over the ones
expected. **Seven rows below; three of them (`#build-lane-self-review-non-zero-floor` clause 4,
`#converge-editor-enabled-at-low-only`, and #3313's Lineage clause) were added after the skeptic showed the
first pass had missed two `lens` hits and had quoted #3313 past the clause that bites.** Each is quoted **in
full for the clause the rule lives in**, not summarised — the failure mode this table exists to avoid is a
"no collision" reached by quoting around the sentence that collides.

| anchor | the clause, quoted | collision? |
| --- | --- | --- |
| `#claim-accuracy-advisory-blocks-on-impact` (#3314) | *"**Scope held deliberately narrow.** The blocking set is an explicit one-member set, not `ADVISORY_LENSES`. Whether the bar should govern every advisory lens — which would leave little of #2310's split standing — is `#3338`, and generalizing it as a side effect of a single lens's promotion would reverse a ratified decision without convening it, the move [`#size-adds-reviewers-never-refuses`](#size-adds-reviewers-never-refuses) refused for size."* | **No — it delegates.** #3314 names #3338 as the item that decides this exact question. The recommended default *affirms* its scope clause and adds the admission rule it left unstated. Fork 1 (b) would **amend** this clause, and that amendment is a cost of (b), named in its option text. |
| `#claim-accuracy-advisory-blocks-on-impact` (#3314), second clause | *"**A sub-class defined by a typed field is the whole point** — the objection to a sometimes-blocking advisory lens ('mandatory with extra steps') holds only where the sub-class is reviewer discretion, so any future rule of this shape must name a typed field or take plain advisory instead."* | **No — the draft rule is its next term.** This clause makes naming a typed field *necessary*; the draft adds that it is not *sufficient* unless the field is checkable. That is a refinement of the same test, in the same direction, not a competing test. Cite together. |
| `#blast-radius-advisory-care-not-a-gate` (#2563) clause 1 | *"**Scored signals are advisory, not a gate.** Blast-radius, size, dismissed-findings, cross-repo, and 1-in-N sampling **annotate a care-level** that raises the convergence loop's scrutiny; they do **not** block the land on a review verdict. Gating a computed *risk score* is a documented anti-pattern (advisory dominates: CODEOWNERS/SonarQube gate *ownership*, not scores); the review still happens (via the loop), just not a human park. A repo may *tighten* a scored signal to a gate as config — where **`gate` means route-to-a-human, never hard-block-with-no-reviewer**."* | **No — different subject, and #3314 already litigated the boundary.** Its subject is *scored signals*; a lens's mandate is not one. #3314's own retraction states this in terms: *"**#2563 clause 1 does not forbid it.** Its subject is *scored signals* … A lens's mandate is not a scored signal, so this ruling **extends** the principle to a new object rather than deriving from a clause that already covered it."* Quoted here **with** that retraction because reading the clause without it is how a prior prep reached a false "no collision". The final sentence still binds either fork: a blocking advisory finding returns `changes` into the bounded loop and escalates to `review:human` at the round cap — it routes to a human, never a hard block with no reviewer. |
| `#size-adds-reviewers-never-refuses` (#3320) | *"**What size means instead.** Size is a care-level signal that dials review *capacity* — how many reviewers, how many rounds, how much rigor — never review *permission*."* | **No — and it is the nearest precedent, cited for three things.** (i) Its **disposition**: convened as a fork, dissolved as contract-derived — the same move *Derived, not ratified* makes above. (ii) Its **method**: a proxy stops measuring anything outside its domain. (iii) Its refusal to reverse a ratified rule as a side effect of a differently-scoped call — which is why Fork 1 (b)'s override of #2310's rationale is stated as a cost rather than a footnote. Capacity-vs-permission is orthogonal: this item rules permission and leaves every roster alone. |
| `#every-pr-gets-a-look-advisory-floor` (#3313), body clause | *"**Looking and blocking are separate decisions, and fusing them is what made the earlier sampler unaffordable.** … So the floor pass records its verdict and bears on nothing: no `review:*` label, no `REVIEW_HOLD_LABELS` member, no path from a finding to a merge condition."* | **No — same principle, one layer down, and the default composes with it.** #3313 separates looking from blocking for the *floor pass*; this item separates *seating* a lens from *empowering* it, on the panel. Fork 1 (b) does not violate it — the floor pass is a different surface — but it does fuse seating with blocking on the panel, which is the shape #3313 argues against. |
| `#every-pr-gets-a-look-advisory-floor` (#3313), **Lineage clause — the one that bites** | *"Convened as a go/no-go on restoring the #2631 sampler; the ruling took **neither** branch, on the finding that 'not yet' was **circular** (#3313 waiting on #3315, which needs the verdicts only coverage produces)."* Body, same anchor: *"…yields a trickle of recorded verdicts where full coverage yields the whole population — **starving the very measurement a sampler is usually justified by**."* | **Not a collision, but a live constraint on the default's *shape* — and the first pass of this table missed it by quoting only the body clause above.** Same operator, same day, same parent watch (#3318), refusing exactly the shape a "not yet, pending measurement" ruling takes when nothing produces the measurement. Seating and blocking are separable, so `simplicity`/`standards-conformance` can be *recorded* without being *empowered* — which is precisely why **Done-when 3 is unconditional**. Ratifying (a) with a conditional trigger would reproduce the circularity #3313 refused. |
| `#build-lane-self-review-non-zero-floor` (#2828) clause 4 | *"**Depth above the floor is a config dimension, not a fork.** How many extra adversarial rounds/lenses a build earns as care rises is tunable; default = a light floor at `none`/`low`, deepening at `elevated`/`high` (reuses the shape of the [#2567] care model, not its table). A conservative repo raises the floor or the per-band depth."* | **No collision, but it is the classification argument Fork 1 had to answer — and a `lens` grep hits this line, so the first pass claiming that predicate should have found it.** Its turf is Layer-1 self-review **capacity** (how many rounds/lenses a build *earns*), not review **permission** (whether a seated lens may stop a land), so it does not literally bind. It does establish that lens-set tunability is a config dimension in this repo — which is why Fork 1's fork-existence paragraph now concedes the mechanism is a dimension and ratifies only the platform default. |
| `#converge-editor-enabled-at-low-only` (#2908) | *"**Exhaustively, what reaches the operator:** a review-only band whose panel wants changes; loop **deadlock** (rounds spent, panel still at `changes`); loop **breakage**…"* and *"`elevated`, `high`, `none` and any band that cannot be resolved are **review-only**: the panel still runs and its findings still reach the operator, but the author's branch is left untouched."* | **No collision — it supplies the unit the cost argument should be denominated in, and another `lens`-adjacent anchor the first pass missed.** It is why the attack *"a blocking advisory verdict costs only an extra editor round"* fails: at `elevated`+ the editor is off, so an advisory `changes` converts an auto-land into an **operator hand-off**. That is the real currency of Fork 1 (b)'s cost, and it composes with #2563's *"`gate` means route-to-a-human"* rather than conflicting with either. |
| **#2310** | **No anchor exists.** Grep for `2310` returns three hits (`:2855`, `:3725`, `:3783`), all incoming references from other anchors. #2310 is `kind: story`, resolved 2026-07-09. The sentence at issue lives in its resolve note: *"Advisory findings are always surfaced, never blocking on their own."* | **No statute collision is possible.** Recorded because "the general form reverses a ratified decision" is the objection this item must weigh, and its true size matters: the reversal is of a resolved story's rationale, not of a platform-decisions rule — and #3314 already overrode the same sentence for one lens. See *What remains of #2310's split*. |

**Citation-scope check.** Every anchor is cited as *supporting context* except one: #3314's "Scope held
deliberately narrow" clause is cited as **authority**, and its scope genuinely reaches this case because it
names `#3338` by number as the deciding item. Downgrades, each checked against the cited anchor's own
authoring scope:

- **#2563 clause 1 → supporting context**, per #3314's own retraction. Quoted for its
  `gate`-means-route-to-a-human sentence, which reaches any branch here; **not** as authority over a lens's
  mandate, which its subject (scored signals) does not cover.
- **#3320 → method and precedent only.** It governs diff size; no part of the default derives from it.
- **#2828 clause 4 → context only.** Its turf is Layer-1 self-review *capacity*, not review *permission*.
  It is cited to concede a point against this item's first framing, never to authorize the default.
- **#2908 → context only.** Cited for what an advisory `changes` actually costs at `elevated`+, not as
  authority over which lens may produce one.
- **#3313 → constraint on shape, not authority.** Its ruling is about a floor pass's coverage; it is cited
  because its *reasoning* about circular "not yet" bears on how this default's trigger must be written.

The skeptic attacked all five downgrades and confirmed each; it found no citation used as authority beyond
its scope.

## Two-confusion screen

A fresh-context agent that had not seen this authoring answered both questions on both forks, and was told
to ignore the placeholder verdict lines. **Both forks: clear.** Three wording fixes it named were applied
before the stamp.

- **Fork 1 — clear.** (1) Not an implementation detail: `BLOCKING_ADVISORY_LENSES` membership is a policy
  value in WE's own review machinery, no WE↔FUI boundary is in play, and the consumer-visible outcome is
  whether a PR lands. (2) A merit difference survives the free-and-instant test: (b) grants blocking power
  to a lens whose `impactIfUnfixed` level cannot be checked against any artifact, which is a
  correctness-of-the-gate and precedent-consistency argument, not a cost one.
- **The mandatory-bar concern (then drafted as Fork 2) — clear**, and the screen went further than asked.
  (1) Not an impl detail; what it governs is the observable verdict reduction. (2) The merit difference is
  measured, not costed — the whole `degraded` band stops blocking under a uniform bar. **Unprompted, it
  raised the dissolution the skeptic then confirmed:** *"If that is true, it is a ratification, not a fork,
  and the two-option framing overstates the contest."* The section is now *Derived, not ratified*.

**The three fixes it produced, all applied:**

1. *"Only the `simplicity` half is permanently principled; for `standards-conformance`, (a) reduces to 'not
   yet, pending a measured population' — the anchor should say plainly that the two lenses are excluded for
   different reasons, or the ruling reads as one deferral wearing a principle."* → added as an explicit
   two-grounds paragraph under Fork 1's default, and written into the draft anchor. **This is also the fix
   the skeptic and #3313's Lineage clause converged on from two other directions**, which is why Done-when 3
   became unconditional.
2. *"'**Cheap**, but it must be named' is effort-talk sizing a consequence of (b); effort has no standing
   anywhere else in the fork."* → restated as "a one-criterion amendment".
3. *"If Fork 2 is a forced invariant, it is a ratification, not a contest."* → the section was demoted out
   of `## Fork N` entirely and restated as a derivation, with the alternative kept only as priced exclusion.

It found **no** cost/effort/timing wording load-bearing for either recommendation, and quoted the fork's own
line — *"one line, and the reason it is a large change wearing a small diff"* — as the case that uses size
against the branch rather than for it.

## Context

- Parent: the Review-efficacy watch [#3318](/backlog/3318/).
- Precedent this item does **not** re-open: [#3314](/backlog/3314/) (`claim-accuracy` advisory on merit),
  [#2310](/backlog/2310/) (the mandatory/advisory split), [#3319](/backlog/3319/) (the pinned security seat).
- Implementation this item gates: [#3339](/backlog/3339/) builds the blocking scan whose membership this
  rules; [#3344](/backlog/3344/) owns the floor refusal whose message Fork 1 (b) would falsify.
- Evidence: [`we:reports/2026-08-26-advisory-lens-blocking-set-corpus-replay.md`](../reports/2026-08-26-advisory-lens-blocking-set-corpus-replay.md).

## Why it was not folded into #3314

Scope. #3314 was convened as one lens's promotion, and answering it did not require ruling the general case —
an explicit one-member set is strictly weaker and reversible. Generalizing would have overridden a resolved
decision (#2310) as a side effect of an unrelated call, which is the move #3320 refused for size.

**STILL OPEN after PR #1642 (merged 2026-08-27).** That PR was a **prepare** run, not a
delivery: it set `preparedDate`, published
`we:reports/2026-08-26-advisory-lens-blocking-set-corpus-replay.md` and authored the fork — and says so in its
own body (*"Prep only — the decision is not ruled. The item stays `status: open`."*). It touched no code and no
statute. All three criteria below remain unaddressed: the item is not `status: resolved` and carries no
`codifiedIn`; no anchor states the `MANDATORY_LENSES` any-impact veto; and the child that criterion 3 requires
be filed **unconditionally** — making advisory-lens findings minable with a declared `impactIfUnfixed`, scope
`we:scripts/workflows/review-parked-prs.mjs` + `we:scripts/review-corpus/mine-review-corpus.mjs` — does not
exist (the only #3318 child touching the miner is #3363, which records reviewer identity, a different job).
**What remains: ratify the fork, land the anchor, and carve that child.**

## Done when

1. **Executable** — `npm run check:standards` passes with this item `status: resolved` and `codifiedIn`
   naming the anchor the ruling lands in.
2. The ruling states, in the anchor, that `MANDATORY_LENSES` keeps the any-impact veto (*Derived, not
   ratified*), so a future reader does not re-derive it from `deriveVerdict`'s missing impact test.
3. **The measurement that can open the admission rule is FILED, unconditionally — not offered.** A "not yet"
   whose trigger nothing is obliged to produce is the circularity #3313 refused in this same cluster, and
   today the trigger is not merely unmet but **unreachable**: the miner keys on the `Net basis:` line
   (`we:scripts/review-corpus/mine-review-corpus.mjs`) that only `we:scripts/operations/review-pr.mjs` emits,
   and that surface never seats an advisory lens; the surface that does
   (`we:scripts/workflows/review-parked-prs.mjs`) writes only the gitignored `we:.conveyor/jury/` ledger,
   whose findings predate `impactIfUnfixed`. So resolving this item **must** carve a child under #3318 that
   makes advisory-lens findings minable **with a declared `impactIfUnfixed`** — either by having the
   parked-PR loop emit a minable verdict, or by teaching the miner to read the ledger and requiring the field
   on new entries. Predicted scope for that child: `we:scripts/workflows/review-parked-prs.mjs`,
   `we:scripts/review-corpus/mine-review-corpus.mjs`. Without it, the recommended default is a deferral
   wearing a rule, and should not be ratified as written.

### Review jury (provisional — pre-registered #2638)

Care level: `high`. This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

Predicted touch-set for the work this ruling authorizes (#2619): `we:scripts/lib/jury-core.mjs` (the
membership list + the #3339 scan it gates), `we:scripts/workflows/review-parked-prs.mjs` (the parked-PR
loop's advisory-never-blocks comment at `:141`), `we:docs/agent/platform-decisions.md` (the anchor). `high`
because the ruling codifies a statute anchor and governs the gate that clears the repo's own PRs.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| correctness#2 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| security#2 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| simplicity#2 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| standards-conformance#2 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |
| claim-accuracy#2 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |
