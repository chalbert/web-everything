---
bornAs: xg7hrd5
kind: decision
parent: "3318"
status: open
dateOpened: "2026-08-27"
preparedDate: "2026-08-27"
relatedReport: reports/2026-08-27-calibrated-finding-severity-and-disposition.md
relatedTo: ["3310", "3314", "3338", "3339", "3363", "3315", "2942", "2950"]
tags: [review, jury, calibration, severity, impact]
---

# Calibrate the finding consequence scale — one axis or two, asserted or derived, and what anchors it

A calibrated severity-and-disposition model for review findings: whether severity exists as a second axis alongside impactIfUnfixed, whether the level is asserted by the juror or derived in code from typed sub-answers, where reach and likelihood belong, and what artifact a juror's labels are checked against.

## Digest

**Five forks, two dissolved concerns, one edge set on a neighbouring decision.**

**Fork 1** — does `severity` exist as a second typed axis? **Recommended: no — one axis, and delete the four
dangling `severity` references, which name a field *a jury finding* has never had.** (Scoped deliberately: a
required `severity` field does exist in the unrelated Web Reporting model at
`we:scripts/lib/buildReport.mjs:42`, so the deletion is by filename, never directory-wide.)

**Fork 2** — is `impactIfUnfixed` asserted by the juror or derived in code? **Recommended: derived, from
three factual answers read off `IMPACT_GLOSS`'s own ladder — but SHADOW-FIRST. The derivation is computed
and recorded; the declared level keeps governing until the Fork 4 measurement says the derivation is
faithful. The flip is its own later decision.**

**Fork 3** — do reach and likelihood become typed criteria, and on which axis? **Recommended: typed, but
DISPLAY/AUDIT-ONLY — carried on the finding and read by no reducer, the shape `citationScope` and
`evidenceKind` already ship.**

**Fork 4** — whose labels are the answer key for the anchor set? **Recommended: an authored key whose
authority is `IMPACT_GLOSS` and whose level is computed, never typed — with key-free juror-vs-juror spread
reported alongside.**

**Fork 5** — does `unrecoverable` stay, given it has never once fired in 42 recorded labels? **Recommended:
yes — dropping it makes *"irreversible only"* inexpressible, because `EVIDENCE_EXEMPT_IMPACT_BAR` cannot
point at a rung that does not exist, so (b) forcibly widens the evidence floor's exemption.** (The
*"Fork 2 revives it"* argument is a **contested prediction**, not a ground — both later passes attacked it —
and it carries a measured re-open trigger.)

**Dissolved (not forks):**
- *Should the agreement number gate anything?* Not this item's to rule — [`#3315`](/backlog/3315/) already
  owns the per-category effective-FP contract with its probation and auto-disable thresholds, and a second
  reviewer-quality gate authored here would duplicate a live contract by a different test.
- *Should an anchor set exist at all?* Entailed, not chosen — the two-confusion screen refuted it as a fork
  (`prio`) and it is recorded as *Supported by default* item 7. Forks 4 and 5 rule the parts of it that are
  genuinely open.

**Edge set:** [`#3338`](/backlog/3338/) is now `blockedBy` this item. It does **not** dissolve; its
load-bearing ground does. See *Does this dissolve #3338?* for the full argument.

Prior art in [`/research/review-finding-severity-classification/`](/research/review-finding-severity-classification/);
session grounding in
[`we:reports/2026-08-27-calibrated-finding-severity-and-disposition.md`](../reports/2026-08-27-calibrated-finding-severity-and-disposition.md).

## What already exists — verified in this lane, not taken on report

Every claim below was read out of the tree on 2026-08-27, in lane-6 at `6b03a7bd`.

| Thing | Where | State |
|---|---|---|
| `DISPOSITIONS` = `blocker` · `carve-out` · `nit` | `we:scripts/lib/jury-core.mjs:284` | shipped (#2950) |
| `deriveFindingDisposition({introduced, worseThanBase, parallelizable})` | `we:scripts/lib/jury-core.mjs:318` | shipped; exactly one of eight combinations is a blocker; fail-closed on an incomplete answer set |
| `IMPACT_LEVELS` = `cosmetic` · `degraded` · `broken` · `unrecoverable` | `we:scripts/lib/jury-core.mjs:197` | shipped (#2942) |
| `IMPACT_GLOSS` — the definitions, once, as data | `we:scripts/lib/jury-core.mjs:210` | shipped; rendered into the mandate, never re-typed |
| `IMPACT_STRICTNESS`, `impactStrictness`, `PREVENTION_IMPACT_BAR` (= `broken`) | `we:scripts/lib/jury-core.mjs:225`, `:249`, `:264` | shipped; totality asserted at module load |
| `blocksAcceptance`, `earnsRound`, `deriveVerdict`, `derivePanelVerdict` | `we:scripts/lib/jury-core.mjs:971`, `:335`, `:895`, `:1353` | shipped |
| A `severity` field **on a jury finding** | nowhere on the jury spine | **does not exist** — see the scope note directly below; `severity` *does* exist elsewhere in `we:scripts/lib/` |
| `deriveFindingImpact` (or any impact routing) | nowhere | **does not exist** — the level is written by the model and validated by enum membership only (`we:scripts/lib/jury-core.mjs:397`) |
| A scored anchor / worked-example set for any level | nowhere | **does not exist** — but two *ratified* worked examples do, in the statute (`#claim-accuracy-advisory-blocks-on-impact`); see Fork 4 |

> **Scope, stated precisely, because the unscoped version of this claim is false.** A required `severity`
> field is alive in this very directory: `we:scripts/lib/buildReport.mjs:40` declares
> `finding({ id, severity, title, … })` with `need(severity, …)` at `:42`, and
> `we:scripts/lib/conformanceReport.mjs:44` emits `severity: c.severity === 'GAP' ? 'warn' : 'error'`;
> `we:scripts/lib/visual-comparator.mjs:59` types one too. Those belong to the **Web Reporting report model**
> (#431 — the `check:standards` / `check:readiness` / app-conformance reporters), a different subsystem that
> never touches `normalizeFinding`. **Everything this item says about `severity` is scoped to the jury
> spine**, and Fork 1's deletion is scoped **by filename** to `we:scripts/lib/jury-core.mjs` and
> `we:scripts/lib/review-render.mjs` — never to `we:scripts/lib/` as a directory.
>
> *Corrected after the skeptic pass*, which found the table asserting `severity` existed "nowhere" while a
> required field of that name sits four files away, and found a directory-wide deletion scope that would
> have swept it.

**The four dangling `severity` references, quoted.** `severity` appears on the review path four times and
resolves to nothing:

1. `we:scripts/lib/jury-core.mjs:184` — *"what it COSTS to ship this finding, as distinct from `severity`
   (how bad the defect looks to the lens that found it)"* — backticked, so it reads as a field name.
2. `we:scripts/lib/jury-core.mjs:632` — *"nothing here reads `verdict`, `severity` or `impactIfUnfixed` to
   place a rung"* — lists a non-existent field alongside two real ones.
3. `we:scripts/lib/jury-core.mjs:2028` — the mandate text: *"required, for EVERY finding you report — at
   every severity, nits included"* — prose, and harmless in itself, but it is the word arriving in the
   juror's own prompt with no definition behind it.
4. `we:scripts/lib/review-render.mjs:120` — *"each finding showing severity/category, `file:line` when
   present, and its summary"* — **this one is false about its own function.** `renderFinding`
   (`we:scripts/lib/review-render.mjs:106`) appends the `category` and an `_[impact if unfixed: …]_` marker;
   it renders no severity, because there is none to render.

That last one is the concrete cost of leaving the word standing: a docblock describing a render that does
not happen. It is the same failure class the `#claim-accuracy-advisory-blocks-on-impact` anchor had to
retract — *"There is no `impact` field on a finding"* — and that retraction's correction sweep ran across
the statute, three cards and a source comment.

### The measured label population — 42 findings, re-derived here

`we:scripts/review-corpus/cases/` holds 92 replayable cases. Counting every finding's mined `impact` value:

```
findings total: 42     keys seen: category, impact, line, path, summary, verdict     with severity: 0
by level:   broken 11 · degraded 19 · cosmetic 12 · unrecoverable 0
at or above PREVENTION_IMPACT_BAR: 11 of 42 (26.2%)
by lens row: correctness {broken 6, degraded 18, cosmetic 12} · security {degraded 1} · (no lens row) {broken 5}
```

Three facts this fixes in place, none previously written down:

1. **A level population exists.** 42 labelled findings, mined from the rendered
   `_[impact if unfixed: <level>]_` marker (`we:scripts/review-corpus/mine-review-corpus.mjs:272`). This
   corrects a natural misreading of `#3338`'s replay, which reports that *where the advisory lenses ran,
   `impactIfUnfixed` did not yet exist* — true of the **advisory** lenses; the `correctness` lens, which is
   86 of 87 recorded lens rows, has been labelling levels all along.
2. **`unrecoverable` has never once been used** — 0 of 42. Three of four levels carry the whole population,
   and the top level is decorative in practice. (Prior art calls this distribution clustering; CVSS's
   score distribution has the same complaint filed against it from the other end of the scale.)
3. **One defect class spans three levels.** Filtering the 42 to findings about missing or insufficient test
   coverage gives six, all `CONFIRMED`:

   | PR·round | category | level | summary (truncated) |
   |---|---|---|---|
   | 1485 r1 | `test-coverage` | `cosmetic` | a one-line call-site addition has no integration test |
   | 1500 r2 | `coverage` | `cosmetic` | two outcomes with `ok:true` are mapped to `refused` |
   | 1504 r1 | `coverage` | `degraded` | the same NaN comparator pattern is unfixed in three other files |
   | 1509 r1 | `test-coverage` | `degraded` | a documented priority order is asserted nowhere |
   | 1561 r2 | `coverage` | `degraded` | a documented safety guard is exercised by no test |
   | 1516 r1 | `coverage` | **`broken`** | gate-forwarding is verified only at one layer, not at the step |

   These are not identical findings and some of the spread is real. But **nothing in the record says which
   part is real**, and one of the six crosses the blocking bar while five do not. That is the calibration
   gap stated at exactly the strength the data supports — no stronger.

   `#3318`'s own review log records a sharper instance which is **not** in the corpus and was **not**
   re-derived here — quoted from that card: a `coverage` finding on 2026-08-26 (*"has zero test coverage; no
   test file exists … at all"*, `CONFIRMED`) rated **`degraded`**, and a `test-coverage` finding later the
   same day on the same PR (the headline addition had *"zero test coverage anywhere in the repo"*,
   `CONFIRMED`) rated **`broken`**. Same PR, same defect class, hours apart, either side of the bar. Treat
   it as a lead, not as evidence: it rests on that card's transcription of two verdict comments.

### The reproducibility result, re-derived

Run in this lane on 2026-08-27:

```
$ node we:scripts/review-corpus/stability.mjs --missed-on-unchanged-input --replay-cases=all
pairs 5   pooled findings 7   pairs where both runs found nothing 1
  defect  churn 100.0% pooled   80.0% per-pair mean   (0/7 findings agreed)  <- headline
  verdict flips: 1/5 pairs = 20.0%
```

**0 of 7 findings recurred across 5 recorded same-head-sha repeat pairs, and one pair's verdict flipped
`accept → changes` on a byte-identical diff.** The script's own caveats are load-bearing and are not
softened here: n=5, a **convenience sample** (a round repeats because a human re-ran it, which correlates
with rounds going badly), and the corpus records **no model id, prompt revision, roster or care setting per
round**, so "identical input" means identical head sha and juror nondeterminism cannot be separated from
version drift. That separation is [`#3363`](/backlog/3363/), already filed.

**What this does and does not license.** It does **not** license *"the levels are miscalibrated"* — you
cannot measure label agreement on findings that do not recur. What it establishes is narrower, and is the
premise this decision actually needs: **the review has no demonstrated test-retest floor, so no property of
a juror's output may be assumed stable without being measured, and `broken` is a property of a juror's
output.**

**And the level is load-bearing *today* — but state which predicate makes it so, because the obvious answer
is wrong.** It is **not** `#3314`: that anchor says on its own face that its blocking half is **inert**
until `#3339` ships (*"this rule's blocking half is inert and the lens behaves as plain advisory"*), and
`#3338` separately records that `claim-accuracy` is not seated on the land path at all. What reads the level
on every verdict today is **`blocksAcceptance` (#2942)** — and `#3314` will add a second reader the moment
`#3339` lands. So an unmeasured level is already deciding lands, through a predicate the first draft of this
paragraph misnamed.

> *Corrected after the skeptic pass.* This paragraph read *"`#3314` has already made `impactIfUnfixed >=
> broken` blocking for one lens… **this is a repair to a rule in force, not an enabler for a possible future
> one**."* The priority conclusion survives; the citation behind it did not. Full quote of the anchor's
> inertness paragraph in the statute-overlap check.

**Two quantities, and the trap of conflating them.** *Churn* is about which findings are raised; *agreement*
is about what a level means given a finding. They are independent. Fork 4's held-out half measures the
second **without** contamination from the first, because re-labelling a fixed finding set runs no hunt.

**And this is what routes around the blocker `#3338` called fatal.** `#3338`'s replay concludes its point 1
is *"unanswerable from any artifact this repo holds"* — correct, and it stays correct, because a
**retrospective** above-bar rate per lens cannot be recovered: the corpus records no juror identity per
round (`#3363`), and no finding in it was ever labelled twice. But **agreement needs no history.** Hand
several jurors the same fixed finding and see whether they agree on its level; that is obtainable today,
from fixtures, at a fraction of a review's cost. The *unanswerable* verdict applies to the retrospective
rate alone, and Fork 4 is the prospective instrument nobody had when `#3338` was prepared.

## Prior art — what the five classic models actually do

Full survey, with URLs, verbatim quotes and an explicit could-not-verify list, in
[`/research/review-finding-severity-classification/`](/research/review-finding-severity-classification/).
Load-bearing findings only, here:

**1 — IEEE 1044-2009 keeps `Severity` and `Priority` as separate normative fields, and *removed* mandatory
level values.** `Severity` is *"the highest failure impact that the defect could (or did) cause"*; `Priority`
is *"ranking for processing … relative to other reported defects"*. Its `Disposition` is a **closure
outcome** (Corrected / Not found / Referred / Duplicate), never a blocking decision — and the *"disposition
process of whether or not to remove the defect"* is explicitly **out of scope**. Critically, the 2009
revision lists among its changes: *"**Not specifying a mandatory set of values for anomaly attributes**"* and
*"**Not specifying a classification process**"*, and demotes its five one-line severity glosses to
**informative** examples. **That is the exact state `IMPACT_GLOSS` is in today** — one line per level, with
the calibration burden pushed onto the adopter, which 1044 makes explicit by requiring the adopter to define
*"how disagreement or conflict regarding classification decisions are to be resolved."*

**2 — ODC has no severity field, by name and on purpose.** IBM's ODC 5.2 spec lists *"additional **non-ODC
attributes** (e.g. phase-found, **severity**, open date, component…)"* — severity sits in a list beside
`open date`. Chillarege's own attribute diagram files Severity under *Tracking (not ODC)*. The 1992 paper
explains the placement: ODC's contribution is the **cause** attributes; severity was one of the pre-existing
**effect** measures (*"usually measured on a scale of 1–4"*), and where CUPRIMD got promoted into `Impact`,
severity never did. **Survey caveat, recorded honestly: no source states a *reason* for the exclusion** — it
is asserted, never argued, so this is a precedent, not an argument. ODC's opener/closer split (Activity ·
Trigger · Impact at open; Target · Type · Qualifier · Age · Source at close) is the enforcement mechanism
for independence: different people, different moments, so cause and catalyst cannot collapse into one field.
And its stated reason for small closed sets is directly on point: *"**If the number of classes is small,
there is a greater chance that the human mind can accurately resolve between them.**"*

> **The counter-datum this item must not hide:** the one ODC attribute defined by judgment — `Impact`, 13
> values — measured **κ ≈ 0.26–0.33** in the wild (two datasets, five annotators each). On the same 962
> defects, the five raters assigned the `Maintenance` category **2, 140, 184, 36 and 62** times. `Impact` is
> ODC's closest analogue to `impactIfUnfixed`, and it is the attribute that failed.

**3 — CVSS is the anchoring exemplar and the cautionary tale, and both halves matter.** Its v4.0 `User
Interaction` upgrade is a textbook anchoring move — v3.1's bare binary became three values, each with an
observable predicate and enumerated worked examples. Yet measured inter-rater reliability on the *anchored*
metrics is poor: 196 practitioners (mean 6.5 years' experience) scored `Attack Vector` at Finn's **0.33** and
**0.21**, `User Interaction` on stored XSS at **0.0206** (*"almost no agreement"*), `Scope` at **0.035–0.080**;
**68% of returning participants gave different ratings to the same vulnerabilities nine months later**, and
*"85% of evaluators find CVSS inconsistent"* while 80% still find it useful. **The lesson taken here:
anchoring to an observable fact produces reproducibility only when *which* fact is uncontested.** Also
corrected in the survey: the *"CVSS measures severity, not risk"* line is **not** in the specification — it
is in the v3.1 User Guide §2.1 and the FAQ.

**4 — SSVC is the working blueprint for a derived disposition, and its reliability pilot is the single most
decision-relevant number in the survey.** SSVC's thesis: *"**decisions about vulnerabilities—rather than
their severity—are a more useful approach**"*; outputs are **actions** (Defer / Scheduled / Out-of-Cycle /
Immediate) from a transparent lookup table, with *"**no (unjustified) shifts to quantitative
calculations**"*. Its `Technical Impact` decision point is anchored by a **three-yes/no-question rubric** —
the same shape as `deriveFindingImpact`. Its six-analyst pilot, Fleiss' κ:

| decision point | κ | anchored to |
|---|---|---|
| `Exploitation` | **0.807** | public PoC databases |
| `Technical Impact` | **0.679** | a three-question rubric |
| `Exposure` | 0.480 | a Shodan scan |
| `Mission Impact` | 0.146 | organizational judgment |
| `Safety Impact` | 0.122 | organizational judgment |
| *supplier outcome (derived)* | *0.226* | — |
| *deployer outcome (derived)* | *0.295* | — |

**Two things follow, and they point in opposite directions.** The anchoring gradient is real and measurable:
inputs tied to an external artifact agree; inputs resting on judgment do not. **But the derived outcomes
score *worse* than their best inputs** — composing imperfectly-agreed inputs through a tree compounds
disagreement rather than cancelling it. That is why Fork 2's default is **shadow-first**: a derivation's
faithfulness is an empirical question, and this is the prior art that says so.

**5 — Fagan's split is binary and functional, and nobody ever measured whether two inspectors agreed.**
The 1986 definition: *"A **MAJOR** defect is one that **would cause a malfunction or unexpected result if
left uncorrected**… **MINOR** defects… will not cause malfunction, but are more of the nature of poor
workmanship."* That is `breaksSomething`, almost word for word, and Fagan's reason for the binary is
commensurability with testing: *"Major defects are of the same type as defects found by testing."* Two
cautions. Severity is assigned **unilaterally by the moderator in real time**, so *"no agreement statistic
is collectible"* — Fagan makes no consistency claim anywhere in either paper. And where others measured,
the picture is poor: 8 classifiers over 30 real faults averaged **κ = 0.16** while reporting median
confidence **4 of 5**; and in a live commercial study *"24% of the issues are False Positives, 55% involve
Soft Maintenance, and 21% are True Defects."*

**6 — Google Tricorder removed severity ratings, and the reason is not the one usually cited.** ICSE 2015
§III-E: *"**we got rid of all priority or severity ratings for analysis results**"* — and the argument is
**not** that severity is inaccurate. It is that a severity/filter axis lets consumers **silence a broken
analyzer instead of reporting it**: *"Instead of having developers filter out analyzer results, we started
getting bug reports about broken analyzers."* Its replacement for severity is the **effective false positive
rate** — *"if developers did not take positive action after seeing the issue"*, explicitly including *"if an
analysis reports an actual fault, but the developer did not understand the fault and therefore took no
action"* — with probation at 10% and possible disable at 25%. **That is `#3315`'s contract, and this item
routes to it rather than re-authoring it.** Survey caveat: the anti-severity sentence exists in **exactly
one paper**, ICSE 2015 — not in the CACM 2018 article and not in the SWE book.

**7 — On anchoring itself, the evidence is weaker than the folklore.** Behaviourally-anchored rating scales
have been compared against other formats repeatedly, and *"BARS and other formats appear to differ
relatively little (if at all)"*. The recent test that separates the variables found **rubric structure did
nothing** while **descriptor specificity** moved ICC ~.49 → ~.64 for experienced raters and ~0 for
inexperienced ones. What replicates is **frame-of-reference training** — raters shown reference cases, *told
the correct answer with the reasoning*, and given feedback on practice ratings — not exemplars shipped as
static reference text. And a well-run RCT of the full training package moved ICC 0.40 → 0.43 against a
control's 0.43 → 0.53 (**p = 0.19**), while rater **confidence** rose significantly. **The same signature
appears in the Fagan literature** (κ̄ 0.16 with 4-of-5 confidence): *anchoring raises confidence whether or
not it raises agreement.* **Consequence for Fork 4:** the teaching half is the weak half, the held-out
measurement is the load-bearing half, and this item must not claim the anchors will improve agreement — only
that they make it measurable.

### What the survey changed

Prior art is supposed to reshape the forks, and here it did:

- **Fork 1's default is reinforced by three of five sources** (ODC excludes severity by name; Tricorder
  removed it and says why; SSVC replaces it with decisions) — and the Tricorder *reason* is new to this item
  and is now one of its grounds.
- **Fork 2's default was amended to shadow-first**, on SSVC's derived-outcome κ.
- **Fork 4's metric was ruled explicitly** rather than left to the build, on the kappa-paradox evidence, and
  its teaching half was demoted relative to its held-out half on the BARS evidence.
- **Fork 5's ground 1 was demoted to a contested prediction**, partly on the survey's "an unused level is
  doing no work" finding.
- **Nothing refuted Fork 3's flipped default**, and SSVC's `Exploitation` result added the reason its
  anchor does not transfer.

## Fork 1 — does `severity` exist as a second typed axis, or does `impactIfUnfixed` absorb it?

**Fork-existence justification.** A real either/or with a broken third branch. `impactIfUnfixed` and a
`severity` field cannot coexist as *"whichever the juror feels like"*: every consumer that ranks a finding —
`blocksAcceptance` (`we:scripts/lib/jury-core.mjs:971`), `derivePanelVerdict` (`:1353`), the `#3339` scan —
must read exactly one graded field, and the one it reads is the one that blocks. The status quo (word named,
field absent) is the **flawed** branch: not a third position but a documentation defect that has already
produced one false docblock (`we:scripts/lib/review-render.mjs:120`) and, in its `impact`/`impactIfUnfixed`
sibling form, one retraction inside a ratified statute anchor.

**Crux with refs.** The classic split — IEEE 1044's *severity* vs *priority*, Fagan's major/minor beside the
inspection's disposition — exists so one argument cannot settle two questions: *how bad is the defect* and
*how urgently must we act*. This repo **already has that split**, but its second axis is not priority: it is
`disposition` (`we:scripts/lib/jury-core.mjs:284`), derived from provenance. So the two questions are
already separated, by two fields, with two different derivations. What is open is whether the *first* axis
needs splitting again.

### Options

- **(a) One axis. `impactIfUnfixed` is the only graded consequence field; delete references 1, 2 and 4 above
  and reword 3.** The rejected reading of "severity" — *how bad the defect looks* — is the reading the
  mandate **already explicitly forbids**: *"Judge the CONSEQUENCE, not how bad the code looks: a defect can
  be ugly and cosmetic, or a two-line omission and unrecoverable"* (`we:scripts/lib/jury-core.mjs:2020`).
  Cost: the genuine severity/impact divergence (a null dereference in unreachable code is a severe defect
  with no ship cost) becomes unexpressible as a *rank* — expressible only in prose.
- **(b) Two axes. Mint a typed `severity` alongside `impactIfUnfixed`.** Cost: a second four-way graded
  scale, answered by every juror on every finding, whose *only* consumer would be reporting — nothing in
  `deriveVerdict`, `blocksAcceptance` or the `#3339` scan would read it, because `#3314` already ratified
  that what blocks is impact. A graded field nothing reads is a field that drifts silently; and the measured
  population above shows the *existing* graded field is already unaudited enough that nobody knows what its
  levels mean.
- **(c) Keep the word as informal prose.** Rejected on its face — this is the state that produced the false
  docblock and the statute retraction.

### **Recommended default: (a) — one axis, and delete the dangling references.**

Four grounds, the last being cost alone:

1. **The second question is already asked, and it is not severity.** IEEE 1044 splits severity from priority
   because a single label was carrying both *magnitude* and *urgency*. This repo's second axis answers
   *"is it this change's problem to fix here"* — provenance, not urgency, and derived in code rather than
   negotiated. That is a **different and stronger** separation than the classic one, and adding severity
   would give three typed axes where two already carry every decision the engine makes.
2. **A field nothing reads is worse than no field.** `#3314`'s ruling closes the door: *"any future rule of
   this shape must name a typed field or take plain advisory instead"* — and the typed field it names is
   `impactIfUnfixed`. A `severity` minted now would have no consumer and no bar, so its only effect would be
   to give a juror a second place to put the argument it lost on the first.
3. **A severity axis is an active harm, not merely a cost — and this is the survey's contribution.** Google
   Tricorder removed severity and priority ratings from its analysis results, and the reason is not that
   severity is inaccurate: *"Instead of having developers filter out analyzer results, we started getting
   bug reports about broken analyzers."* A severity axis is a **filter**, and a filter lets a consumer
   silence a bad producer instead of reporting it — destroying the feedback that says which producer to
   fix. That is directly this constellation's problem: `#3315` is building a per-category
   effective-false-positive meter whose whole input is whether findings get acted on, and a second graded
   axis is the thing that would let a lens be quietly filtered rather than measured.
4. **Cost is real and per-finding, and this ground is last because it is only cost.** Every typed field is
   a question every juror answers on every finding, in every round, on every lens. Fork 2 spends that
   budget on three questions that *replace* an existing unaudited judgment; Fork 1 (b) would spend it on a
   fourth graded scale that replaces nothing.

**Rejected — (b):** the divergence it captures is real but already has a home. A severe defect with no ship
cost is `cosmetic` **and its `prevention` field is still mandatory** — the mandate demands
`rootCause`/`prevention`/`preventionCaptured` *"for EVERY finding you report — at every severity, nits
included"* (`we:scripts/lib/jury-core.mjs:2028`), unconditionally and deliberately not scaled to the bar. So
"this is a bad defect even though it costs nothing to ship" already has a place to go that is not a rank.
**Rejected — (c):** it is the defect, not an option.

### The code shape

**(a), the default** — three deletions and one reword, all in comments:

```js
// we:scripts/lib/jury-core.mjs:184 — BEFORE
 * IMPACT IF UNFIXED (#2942) — what it COSTS to ship this finding, as distinct from `severity` (how bad the defect
 * looks to the lens that found it).

// AFTER — the distinction survives; the phantom field name does not.
 * IMPACT IF UNFIXED (#2942) — what it COSTS to ship this finding. Deliberately NOT how bad the defect
 * looks to the lens that found it: there is no second graded axis and none is planned (#3374 Fork 1).
 * A severe-looking defect that costs nothing to ship is `cosmetic`, and the weight a reviewer wants to put
 * on it goes in the (unconditional) `prevention` field, never in a rank.
```

```js
// we:scripts/lib/review-render.mjs:120 — BEFORE (false about its own function)
 * ... each finding showing severity/category, `file:line` when present, and its summary.
// AFTER
 * ... each finding showing its `category` and `impactIfUnfixed` marker, `file:line` when present, and its summary.
```

**(b), the alternative** — and the reason it is a large change wearing a small diff:

```js
export const SEVERITY_LEVELS = Object.freeze({ TRIVIAL: 'trivial', MINOR: 'minor', MAJOR: 'major', CRITICAL: 'critical' });
// …and then: a SEVERITY_GLOSS, a SEVERITY_STRICTNESS, two more module-load totality assertions, a
// `@severity-total` check:standards rule, a mandate paragraph, a normalizeFinding branch — and no consumer.
```

`Skeptic:` **SURVIVES-WITH-AMENDMENT — the default `(a)` was not refuted; three of its supports were, and all three were replaced.** A throwaway agent prompted only to refute, carrying all four axes. (0) *Classification* — it argued this is settled by precedent, since `#claim-accuracy-advisory-blocks-on-impact` already names `impactIfUnfixed` as the axis, leaving only *"three comment deletions and one reword"*. **Partly accepted:** the fork is narrower than the first draft implied and the anchor is recorded above as coming close to settling it — but the two-confusion screen tested exactly this question independently and returned `clear`, on the ground that at *zero cost* minting a second graded field still loses on merit, which is a fork test the deletions do not carry. Kept as a fork, with the classification concession stated. (1) *Merit* — **landed hard: `we:scripts/lib/buildReport.mjs:40-45` declares a REQUIRED `severity` field on a function named `finding`**, so the grounding table's *"does not exist"* was false and the *"scoped to `we:scripts/lib/`"* deletion scope would have swept it. Both corrected; the scope is now by filename. (2) *Statute overlap* — **landed: `#statute-anchor-states-rule-not-status` (#2854)** forbids point-in-time status in anchor prose, and the drafted rule's flat *"There is no `severity` field"* was both status-shaped and false. Rewritten as the timeless, scoped rule. (3) *Citation-scope* — no over-extension found in this fork. The prior-art survey independently reinforced the default from three directions (ODC, Tricorder, SSVC).

`Screen:` **clear** — fresh-context agent, both questions. Q1: the mint-or-not question is juror- and consumer-observable (a second four-way question on every finding, a second field every reducer could read). Q2: at zero cost (b) still loses on merit, on *"a field nothing reads is a field that drifts silently"* and on consistency with `#3314`. It filed one rider, accepted and acted on: ground 3 is a pure effort argument, so it is stated third and the default does not rest on it.

## Fork 2 — is `impactIfUnfixed` asserted by the juror, or derived in code from typed sub-answers?

**Fork-existence justification.** One field, one writer. A level cannot be both asserted by the model and
computed by the engine — `normalizeFinding` writes `out.impactIfUnfixed` exactly once
(`we:scripts/lib/jury-core.mjs:396`), and whichever branch wins owns that write. Both branches are coherent
(CVSS asserts its metrics and computes its score; ODC asserts every attribute and computes nothing), so this
is a genuine either/or, not a forced invariant.

**Not settled by precedent — and this is the attack to expect.** `#2950` put the *disposition* routing in
code, and its docblock gives the reason: *"the reason the disposition is not something a juror talks itself
into"* (`we:scripts/lib/jury-core.mjs:318`). It is tempting to read that as already settling this. It does
not. `deriveFindingDisposition` routes onto a **three-member unordered set** from three near-facts about a
diff. An **ordered four-level consequence scale** is a different object, and the classic failure of derived
severity is CVSS, whose base score is computed from anchored metrics and is then, by wide documented
consensus, over-trusted as risk. So the precedent supplies a *discipline* worth considering, not a ruling
to apply.

**Crux with refs.** Today the level arrives as free-form model JSON and is validated by enum membership
only:

```js
// we:scripts/lib/jury-core.mjs:396 — the entire quality control on a level today
if (raw.impactIfUnfixed != null && Object.hasOwn(IMPACT_STRICTNESS, String(raw.impactIfUnfixed))) {
  out.impactIfUnfixed = String(raw.impactIfUnfixed);
}
```

Membership is checked. Meaning is not. Compare the sibling fields the same function handles: `disposition`
is **recomputed**, and a self-declared word is honoured only in the stricter direction
(`we:scripts/lib/jury-core.mjs:446`); `citationScope` and `evidenceKind` are **recomputed from ground truth
and whatever arrived is discarded** (`:415`, `:432`), each with an explicit comment naming the
self-certification hole that would otherwise open. `impactIfUnfixed` is the only decision-bearing field on a
finding that a juror still writes for itself — and since `#3314` it is the field that blocks.

### Options

- **(a) Asserted, definitions only (status quo).** Cost: no quality control beyond enum membership on the
  one field that gates the land.
- **(b) Asserted, but anchored.** Keep the juror writing the word; add worked reference examples to the
  mandate so the word is anchored rather than merely defined. Cost: the labels probably improve, but the
  juror still picks a four-way word in one step and the step is unauditable — a reader sees the level, never
  the reasoning that produced it.
- **(c) Derived — three factual answers route to a level, in code.** Add
  `deriveFindingImpact({ breaksSomething, reversible, selfEvident })`, total over `IMPACT_LEVELS`,
  fail-closed on an incomplete answer set, with a self-declared level honoured only when it is **stricter**
  — the exact contract `normalizeFinding` already applies to `disposition`. Cost: three more questions per
  finding; a re-ranking of one recorded defect class (stated below — a real cost); and a derivation is a new
  thing to get wrong.

### **Recommended default: (c) — derive it, but SHADOW-FIRST: the derivation is recorded and does not govern until it is measured.**

> **Amended twice after the skeptic pass and the prior-art survey.** The first draft had the derivation
> govern `impactIfUnfixed` on day one. Two independent findings say that is premature, and neither is a cost
> argument:
>
> 1. **The survey's sharpest datum.** SSVC — the closest working analogue to this design, and the model the
>    rest of this fork leans on — ran a six-analyst reliability pilot. Its *anchored* inputs agreed well
>    (`Exploitation` Fleiss' κ **0.807**, `Technical Impact` **0.679**, the latter anchored by a
>    three-yes/no-question rubric almost identical in shape to `deriveFindingImpact`). But its **derived
>    outcomes scored worse than their best inputs** — supplier κ **0.226**, deployer κ **0.295**. Composing
>    imperfectly-agreed inputs through a tree **compounds** disagreement rather than cancelling it. That is
>    a direct hit on this fork's ground 2, and it means a derivation's faithfulness is an empirical question,
>    not a design one.
> 2. **The skeptic's costs are real and land on the blocking path** — re-ranks 1 and 4 below un-block
>    findings the shipped gate blocks today, and re-rank 4 narrows a rule ratified the day before.
>
> **So the ruling is: build the derivation, carry the three answers, compute and record the derived level —
> and let the *declared* level continue to govern until the Fork 4 measurement says the derivation is
> faithful.** This is not sequencing dressed as a decision: which field governs is a live either/or, and
> shadow-first is the branch that makes the paired `(derived, declared)` record — the only artifact that can
> answer whether the derivation is faithful at all — exist before anything rests on it.
>
> **Precedent, in this repo's own statute:** `#enforce-flip-triple-gated` runs exactly this pattern for the
> review seam — *"the seam runs in shadow: it computes the would-clear decision and logs it, but a human
> still clears every `review:pending` PR"*, with a named readiness predicate arming the flip. **The flip
> here is its own later decision**, on the same shape, and ratifying this fork does not pre-authorise it.
>
> **What arms that later decision, stated so it does not resolve to a number this item elsewhere refuses to
> fix.** Fork 4 rules that **no benchmark band is a pass/fail gate** — the published kappa bands are
> arbitrary conventions their own authors disclaimed. So the flip trigger is **not** a threshold. It is:
> **the operator rules on a fixed report**, and what is ruled *here* is what that report must contain
> before the question may be put — (i) the four statistics Fork 4 specifies, over (ii) the held-out anchors
> with `statute`-keyed and `authored`-keyed results **reported separately**, plus (iii) the
> **derived-vs-declared match rate** from the shadow record, which only shadow mode can produce. A flip
> proposed without all three is refused as unprepared, exactly as an unprepared decision is.
>
> This is deliberately a **human judgment on a specified artifact**, not an automatic arming predicate —
> which is the only shape consistent with Fork 4's no-band ruling and with `#2563`'s rule that a
> computed score does not gate a land.
>
> > *Rewritten after the second two-confusion screen*, which found the first version's trigger — *"at a
> > level the operator accepts"* — resolving to a judgment call Fork 4 explicitly declines to specify, and
> > correctly called it *"the one that decides whether the derivation ever governs."*

**The derivation is not a new scale. It is `IMPACT_GLOSS`'s own ladder with its discriminators made
answerable.** Read the four glosses as data (`we:scripts/lib/jury-core.mjs:210`) and the ladder is already
monotone in exactly two properties — *can it be undone*, and *does it announce itself*:

| gloss, verbatim | the discriminator it turns on |
|---|---|
| `cosmetic`: "nothing breaks; a later reader might be mildly misled" | nothing breaks |
| `degraded`: "someone hits friction or a worse result, and **recovers unaided**" | breaks · reversible · the affected person sees it |
| `broken`: "real work is lost, duplicated, or **silently** skipped — recoverable, but **only by someone noticing**" | breaks · reversible · **not** self-evident |
| `unrecoverable`: "data or work is destroyed with **no way back**" | breaks · **not** reversible |

So the three questions are not invented. They are read off the definitions that already ship:

1. **`breaksSomething`** — does anything actually stop working or produce a wrong result? (No ⇒ `cosmetic`.)

   > **Pinned: commission, not omission — the distinction the first draft used two incompatible ways.** The
   > skeptic pass caught this and it was the sharpest hit in the pass: the draft answered `false` for a
   > coverage gap (*"only reduced future detection"*) and `true` for a wrong `file:line` (*"work is directed
   > at the wrong place"*), while describing both as *"a human later wastes work"*. As stated those
   > contradicted each other, and the contradiction sat on the largest class in the corpus.
   >
   > **The rule, stated once:** a finding **breaks something** when an artifact *asserts something false that
   > someone acts on* — a wrong `file:line`, a wrong acceptance criterion, a mis-parsed line, a guard that
   > silently does not fire. It does **not** break something when an artifact merely *fails to check* —
   > a missing test asserts nothing; nobody reads it and concludes something false. Commission breaks;
   > omission does not. That is why a wrong `file:line` is `broken` (matching `#3314`'s ratified example)
   > and an untested path is `cosmetic`, and the two answers no longer conflict.
   >
   > **The residual cost of this pin, not hidden:** it keys on the *defect*, never on the category slug. See
   > the re-rank paragraphs below, where the first draft's category-keyed phrasing mis-ranked its own
   > exhibit.
2. **`reversible`** — once it has happened, can the effect be undone? (No ⇒ `unrecoverable`.)
3. **`selfEvident`** — does the person affected *see it happen*, so they can act unaided? (Yes ⇒ `degraded`;
   no ⇒ `broken`.) **Self-evident to whom, pinned:** to *the person the failure happens to, at the moment it
   happens* — never to a reviewer reading the diff, who by construction can see everything. A guard that
   throws is self-evident; a guard that silently does not fire is not.

Four grounds:

1. **It closes the last self-certification seam on the verdict path.** `disposition`, `citationScope` and
   `evidenceKind` are all recomputed, each with a comment in `normalizeFinding` naming the hole it closes.
   `impactIfUnfixed` is the one exception, and since `#3314` it is also the one that blocks. Leaving the
   blocking field self-declared while the non-blocking ones are recomputed is the inconsistency; fixing it
   is the change.
2. **Calibration needs a decomposition, not more prose.** Definitions are not anchors. Three yes/no calls
   are more nearly checkable than one four-way word — which is the property `#3314`'s ruling and `#3338`'s
   admission rule both turn on (*"checkable against an artifact rather than asserted"*). Fork 4 anchors
   these three answers; anchoring a single four-way word is materially harder, and prior art on rating
   scales says the gain from anchoring comes from decomposing the judgment, not from adding examples to it.
3. **It is auditable after the fact.** `#2950`'s three booleans are carried onto the finding *"so the
   routing is auditable after the fact (a reader can see WHY a finding was carved out, not just that it
   was)"* (`we:scripts/lib/jury-core.mjs:400`). Today a level arrives with no reasoning attached. After (c),
   a disputed `broken` is a dispute about a named answer rather than about a word.
4. **No threshold moves and no consumer's code changes.** `IMPACT_STRICTNESS`, `PREVENTION_IMPACT_BAR`,
   `blocksAcceptance`, `derivePanelVerdict` and the `#3339` scan are untouched. **But the labels move, in
   both directions** — this ground claims code stability, never outcome stability, and the first draft's
   *"no consumer changes"* wording blurred the two. Re-labelling *is* moving the gate in effect, because the
   bar is only a threshold on labels. Both directions are priced below.

**Re-rank 1, downward: findings whose only cost is reduced future detection.** Under the derivation these
answer `breaksSomething: false` and derive to `cosmetic`, including `#1516 r1`, which a juror labelled
`broken`. The rule the default carries, **keyed on the defect and never on the category slug**: *a finding
whose only cost is that a future defect would go undetected is `cosmetic`.* The alternative reading — *"the
untested path is itself wrong"* — is a **different finding** about that path, which derives its own level on
its own facts.

> **Corrected after the skeptic pass — the first draft keyed this rule on the category and mis-ranked its
> own exhibit.** It read *"a coverage or missing-test finding is `cosmetic`"*, but `#1504 r1` is filed under
> `coverage` and actually reads *"the same NaN-producing `Number(a)-Number(b)` comparator pattern this PR
> fixes still lives, unfixed, in three other files"* — a live defect in three files, which asserts a wrong
> sort order that callers act on, so it answers `breaksSomething: true` and stays `degraded`. Only 4 of the
> 6 coverage-table findings actually re-rank. A rule keyed on a free-text slug would have mis-ranked it, and
> `#3338` records that the corpus's `category` is *"a topic label, not a lens attribution"* — 18 distinct
> values, only 15 of 42 inside the lens vocabulary.

**And the cost of re-rank 1 is larger than "it just reports differently".** The first draft said the weight
*"is carried by the `prevention` field"*. That is true of **reporting** and false of **blocking**, and the
distinction is ruled against it in the statute. `blocksAcceptance` today blocks a finding that is at or above
the bar **and** owes an uncaptured guard (`we:scripts/lib/jury-core.mjs:971-972`) — and a coverage finding's
guard is *"add the test"*, essentially always `preventionCaptured: false`. So dropping that class to
`cosmetic` **un-blocks findings the shipped gate blocks today.** Worse for the escape hatch,
`#claim-accuracy-advisory-blocks-on-impact` has already ruled that the future `#3339` predicate *"reads
impact and nothing else"* and **may not** be built on `blocksAcceptance` — so under `#3339` there is no
prevention backstop at all. Prevention carries the *reader's* attention; it does not carry the *block*. This
is the single largest cost of (c) and it is why the default is amended to shadow-first below.

**Re-rank 2, upward: silent structural defects a juror called cosmetic.** The first draft counted only the
downward direction. `#1552 r1` (`cosmetic`, `structure`) reads *"a missing closing brace leaves one describe
block unclosed, causing two sibling describe blocks to be accidentally nested inside it"* — it breaks
something (hooks apply to the wrong blocks), is reversible, and is **not** self-evident (the file still
passes) ⇒ **`broken`**. That is a new block the derivation creates.

**Re-rank 3, upward, and it is the strongest evidence in this item — four recorded labels that a *ratified
anchor* already says are wrong.** `#claim-accuracy-advisory-blocks-on-impact` rules that *"a wrong acceptance
criterion or a wrong `file:line` a card directs work to is `broken`."* Four corpus findings are exactly that
and were labelled `cosmetic`:

| case | category | juror label | what the ratified anchor says |
|---|---|---|---|
| `1556 r3` | `citation-accuracy` | `cosmetic` | a skill step cites `we:scripts/pr-land.mjs:574` as "the push it does itself"; that line is a different function ⇒ `broken` |
| `1556 r6` | `citation-accuracy` | `cosmetic` | a card's two current-state line cites are each off by one ⇒ `broken` |
| `1560 r2` | `acceptance-criteria-accuracy` | `cosmetic` | Done-when 1 claims a grep "returns nothing today"; the file already has a hit ⇒ `broken` |
| `1560 r6` | `citation-precision` | `cosmetic` | the card mis-attributes the annotation text at the line it cites ⇒ `broken` |

**This is a calibration failure measured against an already-ratified key, not against this item's opinion** —
and it is sharper than the coverage table the grounding section leads with. All four answer
`breaksSomething: true` (a card asserts a false line reference a builder acts on), `reversible: true`,
`selfEvident: false` (the builder finds out downstream) ⇒ `broken`. The derivation moves all four onto the
side the statute already put them. *Found by the skeptic pass, which noted the item had missed its own best
evidence.*

**Re-rank 4, downward, and it cuts against a rule just ratified.** Applying
the three questions by hand to all 42 recorded labels (a judgment call over truncated summaries, so the
*direction* is reportable and a *count* is not — do not cite a number for this) shows a systematic downward
move in one more class: **prose findings that mislead a reader without directing anyone's work derive to
`cosmetic`**, where jurors labelled several of them `degraded`. Two worked examples from the corpus:
`#1559 r1` (*"the closing cross-reference `[[104-…]]` does not resolve to any file in the memory corpus"*)
and `#1562 r1` (*"the card claims two slices 'collide only on the registry line'… but"*) are both recorded
`degraded`; both answer `breaksSomething: false` and derive `cosmetic`.

**Why this is the honest headline rather than a footnote.** That class is `claim-accuracy`'s home
population, and `#3314` has just made `claim-accuracy` block at `>= broken`. So (c) would **narrow the set
of `claim-accuracy` findings that reach the bar** — it makes the ruling `#3314` took, and the scan `#3339`
is filed to build, bite on less. That is not an argument against (c): the narrowing is `#3314`'s **own**
split applied consistently, and the anchor says in terms that a wrong figure nothing depends on is
`cosmetic`. It means the current labels are the drift, not the derivation. But a decider must see it before
ratifying, because it changes the practical reach of a rule ratified the day before, and the alternative —
discovering it when the `#3339` scan ships and blocks nothing — is strictly worse. It also sharpens
`#3338`: if the rubric is what holds prose findings below the bar, the roster is doing less work than
`#3338`'s default assumes.

**Rejected — (a):** it is the status quo whose only quality control is a membership test, on the field that
gates the land. **Rejected — (b):** anchoring without decomposing leaves the level a one-step judgment and
leaves the reasoning unrecorded, so a disagreement about a level stays a disagreement about a word. (b) is
not discarded so much as **contained in** (c) — Fork 4's teaching anchors anchor (c)'s three answers.

### The code shape

**(c), the default** — the routing, and the `normalizeFinding` wiring, in the shape the file already uses:

```js
// we:scripts/lib/jury-core.mjs — alongside deriveFindingDisposition
/**
 * ROUTE three factual answers to an impact level. Pure. TOTAL over `IMPACT_LEVELS` — the ladder is
 * `IMPACT_GLOSS`'s own discriminators, so no level's meaning changes and no bar moves.
 * FAIL-CLOSED on an incomplete answer set: returns `undefined`, which leaves the level UNDECLARED, which
 * `blocksAcceptance` already reads as blocking. A juror cannot un-block a finding by omitting an answer.
 */
export function deriveFindingImpact({ breaksSomething, reversible, selfEvident } = {}) {
  if (typeof breaksSomething !== 'boolean') return undefined;
  if (!breaksSomething) return IMPACT_LEVELS.COSMETIC;
  if (typeof reversible !== 'boolean') return undefined;
  if (!reversible) return IMPACT_LEVELS.UNRECOVERABLE;
  if (typeof selfEvident !== 'boolean') return undefined;
  return selfEvident ? IMPACT_LEVELS.DEGRADED : IMPACT_LEVELS.BROKEN;
}

// …and in normalizeFinding, alongside the EXISTING membership test (`we:scripts/lib/jury-core.mjs:396`),
// which is UNTOUCHED and remains the ONLY writer of `out.impactIfUnfixed` — SHADOW-FIRST means the declared
// level keeps governing until a later, separate decision arms the flip.
for (const k of ['breaksSomething', 'reversible', 'selfEvident']) {
  if (typeof raw[k] === 'boolean') out[k] = raw[k];
}
if (raw.impactIfUnfixed != null && Object.hasOwn(IMPACT_STRICTNESS, String(raw.impactIfUnfixed))) {
  out.impactIfUnfixed = String(raw.impactIfUnfixed);
}
const derived = deriveFindingImpact(out);
const declared = out.impactIfUnfixed;
// SHADOW ONLY — read by no reducer, not consulted by `blocksAcceptance`. Records the paired
// (derived, declared) pair Fork 4's measurement needs, plus what WOULD govern once armed: the STRICTER of
// the two, the same contract `normalizeFinding` already applies to `disposition` — a juror may escalate its
// own finding but never soften the routing, once this is live.
out.impactShadow = {
  derived,
  declared,
  wouldGovern:
    derived && declared
      ? (impactStrictness(declared) > impactStrictness(derived) ? declared : derived)
      : derived ?? declared,
};
// `impactIfUnfixed` itself is exactly what the membership test above wrote — nothing in this block touches
// it. A missing declared level stays UNDECLARED, which `blocksAcceptance` already reads as blocking; the
// derivation opens no new escape hatch and closes none, because it does not govern yet.
```

> **Corrected after the skeptic pass, which found the first draft's snippet let the derivation write
> `out.impactIfUnfixed` directly, governing on day one instead of shadow-first as the ruling above requires.**
> The `wouldGovern` computation itself also read
> `[derivedImpact, declaredImpact].filter(Boolean).sort(…)[0]` — and `filter(Boolean)` drops the `undefined`
> a missing answer produces, so **a juror that wrote `impactIfUnfixed: 'cosmetic'` and answered nothing would
> have had `wouldGovern` resolve to `cosmetic`**, byte-identical to today. It was also not *"the exact
> contract `normalizeFinding` already applies to `disposition`"*, as the draft claimed: that contract
> **discards** a bare non-blocking word (`:450-451` — *"a bare `carve-out`/`nit` with no answers is dropped on
> the floor"*), where "strictest of the two" merely ranks it. The branch above is the faithful analogue, and
> — because it now writes only to the shadow field — it cannot touch `impactIfUnfixed` even if it were wrong.

**(b), the alternative** — the mandate grows worked examples, `normalizeFinding` keeps its membership test,
and nothing about the write changes.

`Skeptic:` **SURVIVES-WITH-AMENDMENT, and the amendment is substantial — the branch (derive) stands; its GOVERNANCE was changed to shadow-first.** The heaviest attack of the pass, six named kills. **Accepted and fixed:** (i) *`breaksSomething` was used two incompatible ways in one card* — the sharpest hit; resolved by pinning commission-vs-omission above. (ii) *The snippet left the self-certification seam open* — verified true (`filter(Boolean)` dropped the `undefined`, so a declared word with no answers won alone) and it was **not** `disposition`'s contract as claimed; rewritten. (iii) *Ground 4's "no consumer changes" was false in effect* — reworded, and the upward re-rank it omitted (`#1552 r1`) added. (iv) *The coverage rule keyed on a category slug and mis-ranked its own exhibit* (`#1504 r1`) — re-keyed to the defect. (v) ***`#3314` was over-extended***: the anchor says its blocking half is **inert** until `#3339` ships, so *"a rule in force"* was wrong — corrected, and the under-quoted paragraph (*"the scan may not be built on `blocksAcceptance`"*) added to the overlap section, where it kills the *"prevention carries the weight"* escape hatch. (vi) *`#deterministic-core-thin-judgment` (#2607) was missing from the overlap section entirely* — added, and it **composes**: it requires script-decidable *routing* to be a script, which is what this fork does, while leaving the judgment with the model. **Not accepted:** the skeptic's claim that `#2950`'s three questions are *"near-script-decidable"* where these are not — `worseThanBase` is plainly a judgment, so the asymmetry it rests on does not hold. **The flip to (b) asserted-but-anchored was declined, but its substance was absorbed:** the prior-art survey supplied the decisive fact the skeptic did not have — SSVC's *derived outcomes* agreed **worse** than their inputs (κ 0.226 / 0.295 vs 0.807 / 0.679) — which says measure before governing rather than do not derive. Shadow-first is that answer, on this repo's own `#enforce-flip-triple-gated` precedent.

`Screen:` **clear** — Q1: changes what a juror is asked, what a finding carries, and who writes the field that gates the land; fully contract-visible. Q2: a genuine merit fork survives zero cost — the screen noted that someone with infinite budget could still prefer (b) on the CVSS over-trust ground this fork raises itself. It flagged as *noted, not flagged* that (c) bundles a second ruling (the coverage rule) under a heading advertising only "asserted or derived"; the bundle is admitted rather than hidden, and is now stated as its own named rule.

## Fork 3 — do reach and likelihood become typed criteria, and on which axis?

**Fork-existence justification.** A criterion sits on exactly one axis or on none, and the three branches
give the same word three different powers. Put "reach" on the impact axis and it changes what a *level*
means; put it on the disposition axis and it changes whether a finding *earns a round*; leave it untyped and
it changes nothing mechanical. Those cannot coexist — one word cannot hold two mechanical powers without the
engine double-counting it.

**Crux with refs.** The three existing direction tests are all about **provenance**: `introduced` (did this
change cause it), `worseThanBase` (is it worse than before), `parallelizable` (can it be fixed elsewhere)
(`we:scripts/lib/jury-core.mjs:318`). None asks about reach, reversibility or likelihood. **Reversibility is
answered by Fork 2** — it becomes `reversible`, an *impact* input, which is where the gloss already put it.
That leaves reach and likelihood.

Both are already demanded — **in prose**. The mandate says: *"State the likelihood in your failure scenario
— a rare path with a catastrophic end and a certain path with a trivial end are different findings, and the
reader needs both halves to rank them"* (`we:scripts/lib/jury-core.mjs:2021`). The design's existing
position is therefore explicit: likelihood is a **second half the reader needs**, deliberately kept beside
the level rather than folded into it.

### Options

- **(a) Neither is typed. Both stay narrative in `failure_scenario`.** Cost: a rarely-hit hazard and a
  merge-path hazard can carry the same level, and no mechanical surface tells them apart.
- **(b) Type them as inputs to the impact derivation.** Cost: it **collapses the two halves the mandate
  requires be kept apart**, and it re-ranks every existing label — a `broken` on a rare path becomes
  something else, so the 42 recorded labels stop being comparable with anything measured after it. This is
  CVSS's documented failure mode: a severity computed with likelihood folded in gets read as risk.
- **(c) Type reach as a fourth input to `deriveFindingDisposition`.** Cost: it changes what disposition
  *is*. The three questions answer *"is it this change's problem to fix here"*; adding reach would let a
  wide-reaching **pre-existing** problem block a change that did not cause it, deleting the carve-out
  `#2950` exists to buy. It also runs at a ratified anchor — see the statute-overlap check.

- **(d) Type both as CARRIED, DISPLAY/AUDIT-ONLY fields that no reducer reads.** They appear on the finding,
  in the notice, in the ledger and in the posted comment; `deriveVerdict`, `blocksAcceptance`,
  `derivePanelVerdict`, `deriveFindingImpact` and the `#3339` scan all ignore them, and `check:standards`
  gates that nothing starts reading them. **Merit cost, not a cost cost:** unlike its two shipped precedents
  these fields have **no ground truth to recompute from**, so each is an **unfalsifiable model self-report**
  — a real objection that keeps (a) a live branch rather than a strictly-dominated one, and the reason the
  no-reader rule below is part of the ruling rather than a note.

  > *Added after the skeptic pass, which found the first draft had refused a branch this repo already
  > ships. The unfalsifiability objection was moved up here from the amendment after the second
  > two-confusion screen, which observed that (d) is otherwise (a) plus two fields — the contained-in shape
  > that made the original Fork 4 a `prio` flag — and that this objection is the thing that saves it.*

### **Recommended default: (d) — typed, but display/audit-only, on the shape this repo already runs twice.**

> **Flipped from (a) by the skeptic pass.** The first draft rejected typing on the grounds that a criterion
> *"sits on exactly one axis or on none"* and that *"one word cannot hold two mechanical powers."* Both are
> true and **neither reaches (d)**, because a display-only field holds *zero* mechanical powers. The draft
> simply failed to enumerate the option — and it is the option that answers the operator's actual request
> instead of declining it.

**The precedent is in the same function, twice, with its rationale written out.** `normalizeFinding` already
carries two fields on exactly these terms:

- `citationScope` (`we:scripts/lib/jury-core.mjs:422`) — *"IT IS DISPLAY/AUDIT DATA, AND NOTHING READS IT TO
  DECIDE A VERDICT. Carrying it here would otherwise be a self-certification seam."*
- `evidenceKind` (`we:scripts/lib/jury-core.mjs:432`) — *"It is DISPLAY/AUDIT data … a juror writing the
  field cannot pin its own finding above a floor."*

Four grounds:

1. **It answers the question rather than declining it.** The operator asked for blast radius, reversibility
   and likelihood. Reversibility is answered by Fork 2 (it becomes `reversible`). (d) types the other two at
   the cost of nothing mechanical, where (a) types neither and leaves both buried in prose.
2. **It makes this fork's own re-open trigger collectable instead of hypothetical.** The first draft
   deferred to *"if jurors systematically split on likelihood"* — but with likelihood untyped that split is
   readable, never measurable. Typed, Fork 4's runner grades it directly. **(a) deferred to evidence that
   (a) made impossible to collect.**
3. **The grounds against (b) and (c) survive intact and still refuse them.** (b) collapses the two halves
   the mandate requires be kept apart (*"the reader needs both halves to rank them"*,
   `we:scripts/lib/jury-core.mjs:2022`) and would invalidate every recorded label — CVSS's documented
   failure mode, where a severity computed with likelihood folded in gets read as risk. (c) would delete the
   `#2950` carve-out — *"real, but not this change's problem to fix here"*
   (`we:scripts/lib/jury-core.mjs:276`) — because reach is not provenance. (d) does neither.
4. **A ratified anchor's principle is satisfied rather than dodged.**
   `#blast-radius-advisory-care-not-a-gate` clause 1 names **blast-radius first** among scored signals that
   *"annotate a care-level … they do not block the land on a review verdict."* A display-only field
   annotates and does not gate, which is that clause's own prescription. **Scope discipline (#1932):** its
   authoring scope is signals about the *change*, so it is **supporting context, not authority**; the
   default rests on grounds 1–3.

**The amendment (d) must carry, because it is weaker than its own precedent.** `citationScope` and
`evidenceKind` are display-only **and recomputed from ground truth** — a juror cannot write them. A
display-only `reach`/`likelihood` has no ground truth to recompute from, so it is a pure model self-report:
**unfalsifiable, and admissible only because nothing reads it.** The rule the default carries: these two are
**reporting and measurement inputs only**, and any future proposal to have a reducer read one **re-opens
this fork** rather than extending it. A `check:standards` rule asserts the no-reader property, exactly as it
would for `citationScope`.

**Prior art, for the level vocabularies rather than the placement.** SSVC's highest-agreement decision point
by a wide margin is `Exploitation` — a likelihood axis, Fleiss' κ **0.807** — because it anchors to public
artifacts (*"a typical public PoC in places such as Metasploit or ExploitDB"*). **That anchor does not
transfer**: nothing external records how often a code path is hit, so a likelihood field here cannot inherit
SSVC's reliability. It is a further reason the field must not gate anything, and a reason to keep its value
set coarse.

**Rejected — (a):** declines the operator's question and makes its own re-open trigger uncollectable.
**Rejected — (b):** collapses two halves the mandate requires kept apart, and invalidates every recorded
label. **Rejected — (c):** changes what disposition is.

### The code shape

**(d), the default** — carried like its two shipped siblings, and read by nothing:

**The two value sets, ruled here rather than left to the build** — three values each, deliberately coarse.
ODC's stated reason applies directly: *"if the number of classes is small, there is a greater chance that
the human mind can accurately resolve between them"*; and since neither field has an external artifact to
anchor to, a fine-grained scale would only manufacture disagreement. Each carries a one-line gloss as data,
under the same `IMPACT_GLOSS` single-sourcing discipline, so the reviewer's mandate renders from the same
map a maintainer reads.

```js
// we:scripts/lib/jury-core.mjs — #3374 Fork 3. Coarse by ruling, glossed as data.
export const REACH_LEVELS = Object.freeze({
  ONE_SITE: 'one-site',       // one call site or one path
  ONE_SURFACE: 'one-surface', // one command, page, or module's consumers
  PERVASIVE: 'pervasive',     // every consumer of the changed contract
});
export const LIKELIHOOD_LEVELS = Object.freeze({
  RARE: 'rare',               // needs an unusual input or state to reach
  OCCASIONAL: 'occasional',   // reachable in normal use, not on the common path
  CERTAIN: 'certain',         // on the path this change's own goal exercises
});

// …and in normalizeFinding.
// DISPLAY/AUDIT DATA. Nothing reads these to decide a verdict — and UNLIKE `citationScope`/`evidenceKind`
// there is no ground truth to recompute them from, so they are model SELF-REPORTS, admissible ONLY
// because no reducer reads them. A check:standards rule asserts no reducer ever starts to.
if (raw.reach != null && Object.hasOwn(REACH_LEVELS, String(raw.reach))) out.reach = String(raw.reach);
if (raw.likelihood != null && Object.hasOwn(LIKELIHOOD_LEVELS, String(raw.likelihood))) {
  out.likelihood = String(raw.likelihood);
}
```

> *Value sets added after the second two-confusion screen*, which found the first version minted two enums
> inside a code snippet and defined neither — *"Fork 5 treats enum membership as fork-worthy and
> contract-visible; Fork 3 leaves two new enums' membership as a [deferral] in a parenthetical."* (The
> screen's own word there is the one the residue gate scans for; it is paraphrased so the fixed item does
> not trip a check on a quotation of the finding it already resolved.)

`Skeptic:` **REFUTED → default flipped from (a) to (d).** The pass found the first draft had refused a branch it never enumerated: **type both as carried, display/audit-only fields no reducer reads**, the exact shape `citationScope` (`we:scripts/lib/jury-core.mjs:422`) and `evidenceKind` (`:432`) already ship, each with a comment naming the self-certification seam that carrying-without-reading avoids. The fork's own exclusivity argument (*"one word cannot hold two mechanical powers"*) does not reach a field holding **zero** powers. It also landed the sharper point that (a)'s deferral trigger — *"if jurors systematically split on likelihood"* — was uncollectable, because an untyped field cannot be graded. Both accepted; the default is now (d), with an amendment the skeptic did not raise: unlike its two precedents, `reach`/`likelihood` have no ground truth to recompute from, so they are self-reports admissible only because nothing reads them. **Grounds 2 and 3 of the old default survived the attack intact** and still refuse (b) and (c) — the skeptic said so explicitly, and separately conceded that `#blast-radius-advisory-care-not-a-gate` clause 1's *subject* and *form* distinctions both hold.

`Screen:` **clear** — Q1: whether a word is typed and whether a reducer reads it is exactly the tool's contract. Q2: grounds 1–3 are merit and survive zero cost. **Re-screened after the skeptic flipped the default to (d)**, since the screened text no longer stood: the flipped default is *more* contract-visible, not less (two new fields on the finding, the notice, the ledger and the posted comment), and the merit difference between (d) and (b)/(c) — what a reducer may read — is untouched by cost. **Second screen, fresh context, on the flipped text: `clear` on both questions** — *"(d) adds two fields a juror must answer… squarely 'what a finding carries / what a juror is asked'"*, and *"which reducer, if any, may read the word is a correctness/lock-in question"*. It filed one caveat, acted on: (a)-vs-(d) is *nearly* the contained-in shape that flagged the original Fork 4, and the only thing saving it — the unfalsifiability objection — was buried in an amendment; it is now stated in (d)'s own option entry. It also found `REACH_LEVELS`/`LIKELIHOOD_LEVELS` minted in the snippet and defined nowhere — both value sets are now ruled above.

## Fork 4 — whose labels are the answer key for the anchor set?

> **Reframed by the two-confusion screen, which flagged the original Fork 4 as `prio`.** It first asked
> *"should there be an anchor set at all"*, over options (a) nothing / (b) teaching anchors only / (c) a
> teaching half plus a held-out half. The screen's refutation is correct and is recorded rather than
> paraphrased: *"a branch **contained in** another branch is not a fork — it is the same branch with less of
> it, and the only reason to pick less is that more costs something."* (c) dominated (a) and (b) on every
> merit ground; only effort separated them. **That question is therefore not a decision** — it is an
> entailment of Fork 2's default plus `#3338`'s ratified criterion, recorded under *Supported by default*
> item 7, and built by the already-carved child. What the screen found genuinely open inside it is below.

**Fork-existence justification.** An anchor's `answers`/`level` either are the scored key or they are not,
and if they are, exactly one thing is the key. An **authored** key and a **consensus** key cannot both be
the key of the same anchor: they disagree precisely in the case that matters — where the jurors agree with
each other and the author thinks they are wrong. That case is not hypothetical here; it is the very first
anchor the code shape below writes, which overturns a recorded juror label by fiat.

**Crux with refs, and the objection this fork exists to answer.** The screen put it sharply: *"an authored
anchor's `level` field installs one author's judgment as ground truth for a scale the item just finished
proving nobody has calibrated."* That objection is real and it is what the options below weigh. Note what
the answer key is *of*, after Fork 2: not a four-way word but the three yes/no answers, plus the level they
route to — so a key is only as authoritative as the derivation and the glosses behind it.

### Options

- **(a) Authored key.** A maintainer authors each anchor's three answers, and the level is *computed* from
  them by `deriveFindingImpact`, never written by hand. Agreement is scored against that key. Cost: it
  installs a maintainer's reading as ground truth, and a wrong anchor teaches and mis-scores in the same
  motion.
- **(b) Consensus key.** The key is whatever N jurors converge on; an anchor's answers are the majority
  answers. Cost: the measurement becomes partly circular — agreement with a key derived from the jurors is
  guaranteed to look better than agreement with an independent one, and a *systematic* error (every juror
  wrong the same way, the failure mode diversity-selection exists to guard against) is invisible by
  construction, because the wrong answer becomes the key.
- **(c) No key — report spread only.** Never install a right answer; publish juror-vs-juror agreement.
  Cost: it detects *disagreement* and can never detect *drift* — a scale on which every juror has moved
  together scores perfectly.

### **Recommended default: (a) — an authored key, with its authority constrained to the glosses, and (c) reported alongside.**

**(c) is not rejected — it is support-both.** Spread and key-agreement can be published together and answer
different questions, so the runner reports both. What is ruled here is only whether a key exists and where
its authority comes from.

Three grounds:

1. **After Fork 2, the key is not an author's taste — it is `IMPACT_GLOSS` applied.** This is the whole
   answer to the screen's objection, and it is why (a) is only defensible *given* Fork 2. An authored anchor
   states three factual answers; the level is then computed. The author's discretion is confined to reading
   a shipped, single-sourced, already-ratified definition against a concrete finding, and the anchor's `why`
   field must quote the gloss clause it turns on. **A hand-written `level` that disagrees with
   `deriveFindingImpact(answers)` is a build error, not an anchor** — the gate refuses it.
2. **(b) cannot see the failure this whole programme is about.** `#3318` records the panel is aggregated by
   diversity-selection *"never by naive majority vote"*, because *"LLMs share failure modes, so a vote
   amplifies the shared-WRONG output that most models happen to agree on"*. A consensus key is that vote,
   applied to the answer key itself. Adopting it here would contradict a ruling this programme's own card
   states.
3. **(c) alone measures the wrong half of the operator's requirement.** *"A medium in review 1 means the
   same as a medium in review 500"* is a claim about a **fixed meaning**, not about jurors resembling each
   other. Only a key that is independent of the jurors can test drift.

**The constraint the default carries, so the objection cannot recur:** an anchor is admissible only if
(i) it is drawn from a **real recorded finding** with its `source` case path, (ii) its `why` **quotes the
`IMPACT_GLOSS` clause** that decides it, and (iii) its `level` is *computed*, never typed. Where an anchor
corrects a recorded juror label — the first one below does — it must say so and give the gloss reason, so
the correction is auditable rather than asserted.

**And the key is SEEDED from the statute, not authored fresh — which is what breaks the circularity.**

> **Amended after the skeptic pass**, which landed two hits here. First, this item's claim that the artifact
> did not exist for *any* lens **overstated**: `#claim-accuracy-advisory-blocks-on-impact` carries **two
> ratified, level-assigned worked examples** — *"a wrong acceptance criterion or a wrong `file:line` a card
> directs work to is `broken`"* and *"a wrong figure no criterion depends on is `cosmetic`"*. That is a tiny
> single-lens anchor set, and it exists. Corrected in the grounding table above. Second, the first draft's
> sample anchor keyed itself to *this item's own ruling* (*"this anchor IS the correction"*), so the runner
> would have measured **compliance with the prompt, not calibration**.
>
> **The fix, which is also cheaper:** the answer key is **seeded with `#3314`'s two ratified examples**,
> which were ratified *before* this derivation existed and therefore cannot have been fitted to it. New
> anchors are authored **only for levels and classes the statute has not already worked an example for**,
> and each is marked with whether its key is `statute` (independent) or `authored` (this item's reading).
> The agreement number is reported **separately for the two**, so a reader can always see how much of it
> rests on an independent key. The four `cosmetic`-labelled findings in Fork 2's re-rank-3 table are
> ready-made held-out items with a statute key and zero authoring cost.

**Rejected — (b):** it makes a shared-failure-mode error invisible by turning it into the key, contradicting
the diversity-selection rule this programme runs on. **Rejected as the *sole* instrument — (c):** it cannot
detect drift; adopted alongside (a) rather than instead of it.

### The code shape

**(a), the default** — anchors as data with the `IMPACT_GLOSS` single-source discipline, the teaching /
held-out split (entailed, not ruled — *Supported by default* item 7), and the computed-level constraint:

```js
// we:scripts/lib/finding-anchors.mjs — the anchor corpus, as DATA. Same discipline as IMPACT_GLOSS: the
// examples a juror grades against and the examples a maintainer reads are the same objects, so they cannot
// drift. TEACHING renders into the mandate; HELD_OUT never does, and check:standards enforces that the two
// id sets are disjoint (an anchor shown to a juror cannot test it).
// NO ANCHOR CARRIES A HAND-WRITTEN LEVEL. The level is deriveFindingImpact(answers); the gate refuses an
// anchor whose stated level disagrees with its answers, so a key can never drift from the derivation.
export const FINDING_ANCHORS = Object.freeze([
  Object.freeze({
    id: 'coverage-gap-on-new-wiring', use: 'teaching',
    source: 'we:scripts/review-corpus/cases/1516-r1.json',
    finding: 'Gate-forwarding is verified only at the verify-io layer; the operation\'s own `run: compute` step is exercised by no test.',
    answers: { breaksSomething: false, reversible: true, selfEvident: true },   // ⇒ cosmetic
    why: 'IMPACT_GLOSS cosmetic: "nothing breaks". Shipping it breaks nothing — the cost is reduced FUTURE detection, carried by the mandatory `prevention` field, not by the impact rank. CORRECTS a recorded label: this finding was rated `broken` at #1516 r1.',
  }),
  Object.freeze({
    id: 'silent-skip-on-parse-failure', use: 'heldOut',
    source: 'we:scripts/review-corpus/cases/1488-r1.json',
    finding: 'Quote state is not carried across physical lines, so an unterminated string that closes on a later line is mis-parsed and the entry is silently skipped.',
    answers: { breaksSomething: true, reversible: true, selfEvident: false },   // ⇒ broken
    why: 'IMPACT_GLOSS broken: "real work is … silently skipped — recoverable, but only by someone noticing".',
  }),
  // COVERAGE RULE: at least one anchor per level in the TEACHING half, and at least one per level in the
  // HELD-OUT half — EXCEPT `unrecoverable`, whose only anchor is synthetic and teaching-only (Fork 5), so
  // it is never scored. Worded to admit that exception, which is unsatisfiable by construction otherwise.
]);
```

```js
// we:scripts/review-corpus/anchor-agreement.mjs — the runner, mirroring the posture of
// we:scripts/review-corpus/stability.mjs: two sections kept apart, a count printed with every rate, and NO
// threshold and NO non-zero exit. Labels ONLY the held-out anchors, so finding-set churn (#3310) cannot
// contaminate the number.
//   $ node we:scripts/review-corpus/anchor-agreement.mjs --jurors=5 --repeats=3
//   ── Section 1 — INTER-JUROR (5 distinct jurors, one pass each) ──
//   anchor                        breaks  reversible  selfEvident  level  n
//   silent-skip-on-parse-failure    5/5       5/5         3/5       3/5   5
//   ── Section 2 — TEST-RETEST (one juror configuration, 3 repeats) ──
//   …same columns, reported separately and never pooled with Section 1.
//   ── Section 3 — SPREAD, NO KEY (juror-vs-juror only) — the support-both half of the default.
//   Sections 1 and 2 are further split by KEY PROVENANCE: `statute` vs `authored`, never pooled.
```

### The statistics this runner must report — and the one it must not report alone

**Ruled here rather than left to the build, because the obvious choice is the wrong one.** The measured
label distribution is `broken 11 · degraded 19 · cosmetic 12 · unrecoverable 0` — mass concentrated in two
or three of four categories. That is precisely the regime in which a plain kappa **misreports**: the
prevalence paradox drives chance-agreement toward observed-agreement, so a system at 85–90% literal
agreement can report κ ≈ 0.04–0.30. Worse, kappa **rewards raters whose base rates differ**, so tuning to
raise it partly tunes jurors toward disagreeing about the distribution. A real instance from the literature:
three raters, 57 trials, observed agreement **0.842** and Cohen's κ **0.042**, because ~92% of items fell in
one category.

So the runner reports **four things together, and never the third alone**:

1. **Raw observed agreement, plus adjacent agreement** (within one level) — the levels are ordinal, so a
   `degraded`/`broken` split and a `cosmetic`/`unrecoverable` split are not the same error.
2. **The full confusion matrix, or at minimum per-rater marginals.** Everything else is a function of the
   marginals; this is the piece most often omitted and the most diagnostic.
3. **Krippendorff's α with the ordinal metric** — one coefficient, named, not a choice left to the build.
   It is picked over quadratic-weighted κ for three reasons that all bite here: it takes **any number of
   raters** (the inter-juror section varies them), it **tolerates missing data by design** (a juror that
   fails to answer one of the three questions leaves a hole the other coefficients cannot take), and it is
   the only one whose author framed a threshold as a decision rule rather than a discussion convention.
   Quadratic-weighted κ may be printed beside it as a cross-check. **Never unweighted κ**, which scores a
   one-level and a three-level disagreement identically.
   > *Narrowed from "α or quadratic-weighted κ" after the second two-confusion screen*, which caught the
   > section promising a ruling — *"ruled here rather than left to the build"* — and then leaving the actual
   > coefficient to the builder.
4. **Prevalence and bias indices**, which turn *"agreement is low"* into a diagnosis: low because one level
   dominates (a taxonomy problem, which is Fork 5's question) or low because one juror grades harder (a
   calibration problem). Different fixes.

**No benchmark band is adopted as a pass/fail gate.** The familiar *"κ > 0.61 = substantial"* scale is an
arbitrary convention its own authors disclaimed as *"clearly arbitrary"*, and a competing published scale
would call the same 0.45 *"fair to good"*. The only threshold any author intended as a decision rule is
Krippendorff's α ≥ .800 (≥ .667 for tentative conclusions), and even that is recorded here as **context for
the operator's judgment, not as a gate** — see *Supported by default* item 4.

`Skeptic:` **SURVIVES-WITH-AMENDMENT — the authored key stands; its premise and its seed were corrected.** (1) *"The artifact does not exist for any lens" is false* — **accepted**: `#claim-accuracy-advisory-blocks-on-impact` carries two ratified, level-assigned worked examples. The grounding table and this fork's ground 1 were corrected, and the key is now **seeded from those ratified examples** rather than authored fresh. (2) *The proposed anchor set is circular — its key is the ruling being tested* — **accepted, and it was the better half of the attack**; the statute seed is the fix, and key provenance (`statute` vs `authored`) is now reported separately so a reader can see how much rests on an independent key. (3) *After Fork 2 the metric degenerates, and n is small* — **accepted in part**: the statistics section now rules raw + adjacent agreement, per-rater marginals, an ordinal coefficient and prevalence/bias indices, on the prior-art evidence that a plain kappa misreports at exactly this label distribution. The small-n criticism is fair and is answered by reporting counts with every rate, the same discipline `#3310` applies to itself. The prior-art survey added an amendment neither pass raised: static exemplars are the *weak* half of anchoring, so this fork must claim only that anchors make agreement **measurable**, never that they improve it.

`Screen:` **flagged(prio) → fork REPLACED.** The screen refuted the first Fork 4 (*"should an anchor set exist at all"*) as a build decision wearing a fork heading: *"a branch **contained in** another branch is not a fork — it is the same branch with less of it, and the only reason to pick less is that more costs something."* Accepted in full. The existence question moved to *Supported by default* item 7 as an entailment of Fork 2 plus `#3338`'s ratified criterion, and the fork was re-cut onto the question the screen found genuinely open inside it — **whose labels are the answer key** — which it showed survives zero cost, since an authored key installs one reading as ground truth however cheap it is to write. **Second screen, fresh context, on the re-cut fork: `clear` on both questions** — (a)-vs-(b) survives zero cost, since *"an authored key installs one reading as ground truth however cheap it is to write"* and (b)'s circularity is *"a merit defect, not a cost"*. Two findings acted on: the ordinal coefficient was left as *"α or quadratic-weighted κ"* under a heading promising a ruling (now narrowed to Krippendorff's α, with the three reasons); and the *"at least one per level per half"* coverage rule was unsatisfiable by construction for `unrecoverable` given Fork 5 (now worded to admit the exception). It also noted that option (c) has been made support-both, so the fork is a two-option one with a rider — which is what the text now says.

## Fork 5 — does `unrecoverable` stay, given it has never once fired?

> **Added by the two-confusion screen**, which found this sitting in the prose outside every fork: the item
> mined the fact (*"`unrecoverable` has never once been used — 0 of 42 … the top level is decorative in
> practice"*), conceded its consequence in a code comment, and never ruled on it. *"A finding in search of a
> ruling"* was the screen's phrase, and it was right.

**Fork-existence justification.** An enum has four members or three; a level with no observed referent is
either kept or removed, and the two cannot coexist. This is a genuine either/or and both branches are
coherent — a scale whose top rung never fires is a real design smell, and prior art on rating scales treats
an unused extreme as evidence the scale is mis-sized.

**Crux with refs.** `IMPACT_LEVELS` (`we:scripts/lib/jury-core.mjs:197`) has four members;
`IMPACT_STRICTNESS` ranks `unrecoverable` at 3, one above `PREVENTION_IMPACT_BAR`
(`we:scripts/lib/jury-core.mjs:264`). Two live consumers read *above* the bar rather than at it:
`EVIDENCE_EXEMPT_IMPACT_BAR` is `IMPACT_LEVELS.UNRECOVERABLE` (`we:scripts/lib/jury-core.mjs:734`), and the
evidence floor at `:856` exempts a finding at or above it. So the level is not inert in the code even
though it is empty in the data — dropping it would collapse the evidence exemption onto `broken`, silently
widening it.

### Options

- **(a) Keep all four levels.** Cost: the anchor set must include an authored `unrecoverable` anchor with no
  recorded referent — the one place Fork 4's *"drawn from a real recorded finding"* rule cannot be met.
- **(b) Drop it; collapse to three.** Cost: `EVIDENCE_EXEMPT_IMPACT_BAR` has to be re-pointed at `broken`,
  which widens the evidence exemption from "irreversible only" to "anything at the blocking bar" — a real
  loosening, ruled as a side effect of a vocabulary tidy-up rather than on its merits.

### **Recommended default: (a) — keep it, because Fork 2 is precisely the change that makes it reachable.**

Three grounds, **in ascending order of weight — the first is contested and the default does not rest on
it**:

1. **(Contested.) The emptiness may be evidence about the *asserted* scale rather than about the world.**
   Today `unrecoverable` requires a juror to reach for the top word unprompted, and nothing in the mandate
   makes that likely; under Fork 2 it is reached by answering **`reversible: false`**, which every juror
   answers on every finding.
   > **Both later passes attacked this and it no longer carries the default.** The skeptic: for a
   > git-tracked code-review subject `reversible: false` is *near-unreachable* — every one of the 11
   > recorded `broken` findings is revertable — so the derivation would leave the level just as empty. The
   > prior-art survey, independently: where most items land in one or two of four levels, *"two of your
   > levels are doing almost no work"*, and re-cutting boundaries improves measurement more than any change
   > of coefficient. Kept as a **prediction with a measured trigger** (below), not as a ground.
2. **It is the only level naming an irreversible outcome, which is the class where blocking is least
   arguable.** Every other level describes something recoverable. Collapsing the ladder would leave the
   scale unable to say the one thing that most obviously justifies a hard stop.
3. **Dropping it makes *"irreversible only"* INEXPRESSIBLE, and this is what the default rests on.**
   `EVIDENCE_EXEMPT_IMPACT_BAR` is `IMPACT_LEVELS.UNRECOVERABLE` (`we:scripts/lib/jury-core.mjs:734`), and
   the evidence floor at `:856` exempts anything at or above it. **You cannot point an exemption at a rung
   that does not exist** — at any budget. So (b) does not merely *raise a question* about that exemption; it
   forcibly widens it from *"irreversible only"* to *"anything at the blocking bar"*, because there is
   nothing narrower left to name. That is a loosening of the `#3312` evidence floor that survives the
   zero-cost test: it is not that ruling it separately would cost something, it is that after (b) the
   narrower rule **cannot be stated at all**. *Rider, not the ground:* it would also be a ruling arriving as
   a side effect of a vocabulary tidy-up, which is its own reason to refuse it.

   > *Re-ordered after the second two-confusion screen*, which found the first version led with the
   > don't-bundle framing — *"its own decision and must not ride a vocabulary tidy-up"* — and observed that
   > at zero cost "that's a separate decision" costs nothing, so the ground read as hygiene rather than
   > merit. The inexpressibility point was in the item only in passing; it is the merit argument and now
   > leads.

**The measured trigger that re-opens this fork**, since ground 1 is now a prediction rather than a ground —
**stated with its number and its owner**, because a trigger named only in form is a deferral in disguise:
once Fork 2's shadow record holds **42 or more findings carrying all three answers** — the size of the
existing labelled population, so the two are comparable — and **`reversible: false` has still never been
answered**, Fork 5 re-opens as a merge-the-levels decision, and `EVIDENCE_EXEMPT_IMPACT_BAR` is ruled on its
own merits at the same time rather than as a side effect. **Owner: the `#3318` watch**, whose conformance
read already runs on exactly this kind of standing signal; Fork 4's prevalence and bias indices are the
instrument that reports it, so no separate measurement is filed.

> *Number and owner added after the second two-confusion screen, which found the first version said only
> "a stated number of reviews" with the number stated nowhere and nobody named — and noted that Fork 5's
> whole demotion of ground 1 rests on this trigger being real.*

**The cost is real, and the default constrains it rather than waving it away.** Fork 4's admissibility rule
requires an anchor drawn from a recorded finding, and no recorded finding is `unrecoverable`. The rule for
this one level, ruled here: **the `unrecoverable` anchor is drawn from a real, reproducible operation this
repo can actually perform** — a `git reset --hard` in a lane holding uncommitted work, or a force-push
discarding a published version — **and is marked `synthetic: true`, excluded from the held-out half.** It
may teach; it may not score. An authored example with no observed referent is a teaching aid, never an
answer key.

**Rejected — (b):** it deletes the level Fork 2 revives and quietly widens an evidence exemption.

*No code example: the fork rules that an existing enum is unchanged. Its alternative's shape is the deletion
of one line from `IMPACT_LEVELS` plus a re-point of `EVIDENCE_EXEMPT_IMPACT_BAR`, both named above.*

`Skeptic:` **SURVIVES-WITH-AMENDMENT — the default `(a) keep` stands, but on ground 3 alone; ground 1 was demoted.** The pass argued `reversible: false` is near-unreachable for a git-tracked code-review subject (every one of the 11 recorded `broken` findings is revertable), so Fork 2 would **not** revive the level — attacking the ground the first draft leaned on hardest. The prior-art survey reached the same place independently from the other side: where mass sits in two of four categories, *"two of your levels are doing almost no work"*. **Both accepted.** Ground 1 is now recorded as a contested prediction with a measured re-open trigger, and the default rests on ground 3 — that dropping the level silently widens `EVIDENCE_EXEMPT_IMPACT_BAR` (`we:scripts/lib/jury-core.mjs:734`) from *irreversible-only* to *anything at the bar*, which is a real loosening of the `#3312` evidence floor and must not ride a vocabulary tidy-up.

`Screen:` **clear — and this fork exists BECAUSE of the screen.** It found the `unrecoverable` question sitting in the prose outside every fork (*"a finding in search of a ruling"*): the item mined *"0 of 42 … the top level is decorative in practice"*, conceded the consequence in a code comment, and never ruled. Q1: an enum's membership is observable to every consumer that ranks a finding. Q2: at zero cost the choice still turns on whether an empty level should stay, which is a taxonomy-merit question, not a schedule. **Second screen, fresh context: `clear` on both questions**, with the ruling confirmed and its *argument* corrected — *"Fork 5's conclusion is right but is argued in a way that makes it sound like postponing rather than deciding."* Two fixes applied: ground 3 now leads with **inexpressibility** (with the level gone, *"irreversible only"* cannot be stated at any budget) rather than with the don't-bundle framing, which at zero cost costs nothing; and the re-open trigger now carries **a number (42 findings carrying all three answers) and an owner (the `#3318` watch)**, where it previously said only *"a stated number of reviews"* with the number stated nowhere. *Corrected again this round: the number was first stated as 40, off by two against the 42-item labelled population it is meant to match ("the size of the existing labelled population, so the two are comparable"); fixed to 42.*

## Does this dissolve #3338? — No. Its ground dissolves; its question survives. Edge set.

A required output of this prep, so it is answered explicitly and the edge is set on disk.

**What `#3338` rests on.** Its Fork-1 recommended default is (a) *keep the blocking set narrow*, on three
grounds, of which its own text says: *"the last one is the only one that discriminates, and it is the one
the default rests on."* That ground is the admission criterion:

> **`simplicity` fails on the criterion.** Its findings have no artifact to check an impact level against,
> so it stays out **however large a future above-bar population turns out to be**. This half of the ruling
> is permanent unless the criterion itself is overturned.

**What this item does to it.** Fork 2 moves the level from a juror's assertion to a derivation over three
answers, and Fork 4 builds the artifact those answers are checked against. Both are lens-independent: a
`simplicity` juror answers `breaksSomething` / `reversible` / `selfEvident` about its own finding exactly as
a `correctness` juror does, and both are scored against the same held-out anchors. So after this item the
criterion **no longer discriminates between lenses** — it becomes a property of the derivation, which every
lens shares. `#3338`'s "permanent" half loses its ground.

> **A second prop was withdrawn after the skeptic pass.** An earlier draft added: *"the artifact does not
> exist for `claim-accuracy` either — no lens currently passes."* **That was wrong**, and the skeptic was
> right to kill it: `#claim-accuracy-advisory-blocks-on-impact` carries two ratified worked examples, and
> they are lens-specific to prose claims *by construction*, which is exactly what the criterion asks for.
> `simplicity` has nothing comparable, and **this item does not build it anything comparable** — Fork 4's
> anchors are mined from a corpus whose lens rows are 86 `correctness`, 1 `security`, **0 advisory**. On
> that narrow reading the criterion does still discriminate today. The argument above rests only on what
> Forks 2 and 4 *change*, not on a claim that the criterion is currently vacuous.

**Why it is nonetheless not dissolved.** Two of `#3338`'s facts survive untouched, and they are the two that
decide its question:

1. **Generalising still moves the merge path from 2-of-4 to 4-of-4 blocking lenses.** That is arithmetic
   about seats. Calibration changes what a level *means*; it does not remove a seat.
2. **The advisory lenses never dissented in 6 of 6 observed subjects.** A calibrated scale does not
   manufacture evidence for a promotion, and `#3338`'s ground 2 — the burden of proof sits on the branch
   that adds blocking — is untouched by anything here.

A third reason to keep it live cuts the other way, and is why it must not be ratified *first*: Fork 2's
default predicts that a `simplicity` finding will usually derive to `cosmetic`, because *"this abstraction is
unnecessary"* rarely answers `breaksSomething: true`. If that holds, generalising becomes **safe for a
reason `#3338` never argued** — the rubric, not the roster, is what holds low-consequence findings below the
bar. That is a *different case for (b)* than the one `#3338` rejected, and a decider ratifying `#3338` today
would never see it. **This sharpens `#3338`'s own data rather than adding new data**: its ledger table
already records `simplicity` producing 10 findings across 6 subjects with zero dissent, and its proxy table
already puts none above the bar. What is new is the *mechanism* — a rubric that would hold them there by
construction rather than by observed luck.

**Verdict, and the edge.** `#3338` is set **`blockedBy` this item.** Ratifying it first would freeze a
criterion this item may retire and would spend the operator's ratification on a default whose load-bearing
ground is about to change — and `#1886`'s rule is that a ratified call is immutable, so the only honest
repair afterwards would be a new reconciliation item. That is precisely the cost the statute-overlap
discipline exists to avoid, applied to a decision edge instead of an anchor.

> **The skeptic pass argued the opposite — drop the edge, `#3338` is ready today — and its counter is
> answered rather than ignored.** Its strongest move was a reversal: *"ratifying **this** item first freezes
> a derivation whose faithfulness is unmeasured, so don't-ratify-on-a-ground-about-to-change applies with
> more force to Fork 2 than to `#3338`."* **That was a good hit against the first draft, and it is why Fork
> 2's default is now shadow-first**: ratifying this item no longer freezes any governance, because the
> derivation is recorded and does not decide anything until the Fork 4 measurement is in. With that
> amendment the asymmetry runs the other way — this item can be ratified without committing to an
> unmeasured claim, and `#3338` cannot.
>
> Its other two counters were absorbed: the *"no lens passes"* prop was withdrawn above, and its point that
> `#3338` already records `simplicity`'s low-impact profile in its own proxy and ledger tables is **correct**
> — so the third reason below is stated as *sharpening `#3338`'s own data*, not as a new fact.

**What `#3338` should become after this is ruled** (recorded so the edge is actionable rather than merely a
block): its Fork 1 keeps options (a)/(b)/(c) and re-derives the default with the criterion **retired as a
discriminator**, so grounds 1 and 2 — the seat count and the burden of proof — carry it alone; and its
Done-when measurement gains the anchor-agreement number as an input it did not previously have.

## Supported by default (not decisions)

Recorded so a later reader does not re-litigate them as forks.

1. **Teaching anchors and held-out anchors are disjoint sets.** Not a fork — an authoring constraint that
   follows from what an anchor is. `check:standards` enforces the disjointness; nothing is ratified.
2. **`PREVENTION_IMPACT_BAR` stays `broken` and is not ruled here.** The *level* of the bar is already a
   config dimension, parameterised as `bar` at `we:scripts/lib/jury-core.mjs:895` and `:1353`, and its own
   docblock names it *"the knob to TURN, not the code to rewrite"* (`:264`). Nothing here moves it.
3. **Reporting stays unconditional at every level.** The notice-wide / verdict-narrow split (#2942) is
   untouched: every finding — cosmetic, carve-out, nit — still reaches the notice, the ledger and the posted
   comment. Do not filter a reporting surface on a derived level.
4. **No number authored here gates anything.** Whether a reviewer-quality number arms a probation or an
   auto-disable belongs to [`#3315`](/backlog/3315/), which already carries that contract (per-category
   effective-FP under 10%, probation at 10%, auto-disable at 25%) under `#3318`. Authoring a second
   reviewer-quality gate here would duplicate a live contract by a different test. Route any such proposal
   to `#3315`.
5. **Any enum or lookup added here inherits the existing totality discipline.** A new rank/gloss table is a
   `frozenLookup` with a null prototype, is asserted total at module load, and carries the
   `@impact-total`-style marker its `check:standards` rule reads
   (`we:scripts/lib/verdict-totality.mjs:73`). Convention, not a call.
6. **Fork 1's deletion is scoped BY FILENAME to two files — a statement of file scope, and nothing more.**
   The edits are confined to `we:scripts/lib/jury-core.mjs` and `we:scripts/lib/review-render.mjs`, never to
   `we:scripts/lib/` as a directory: the Web Reporting report model in the same directory has a *required*
   `severity` field (`we:scripts/lib/buildReport.mjs:42`) that this item does not touch. They also do not
   touch `we:docs/agent/vision-tiers.md:156` — which records that the design open-findings contract's
   *"severity scale `{severity 0–4}` is Nielsen's (`nielsen-heuristics`, cosmetic → catastrophe)"* — nor the
   `#trainable-judge` anchor, which uses the word for that same vision-judge vocabulary. **No design-critique
   subject is routed through the jury spine today**, so no conversion between the two scales exists, and
   none is designed here. If one is ever built it is **its own decision**, and a hard one: after Fork 2 an
   adapter would have to produce three booleans, which a 0–4 score cannot yield without inventing facts.
   Recorded as a named hand-off, not as a composition rule this item is entitled to assert.

   > *Narrowed after the two-confusion screen*, which correctly flagged the previous wording — *"a design
   > critique routed through a jury adapter converts at the adapter"* — as a disguised unify/convert choice
   > asserting a mapping nobody has written.
7. **A two-part anchor set exists — teaching and held-out, disjoint.** Not a fork: it is entailed by Fork
   2's default (three answers need anchoring) and by `#3338`'s ratified admission criterion (*"checkable
   against an artifact"*), and at zero cost nothing competes with it. Its *disjointness* follows from what
   an anchor is — one a juror has been shown cannot test that juror. `check:standards` enforces the
   disjointness; the build is the already-carved child. **What is ruled about it is only the answer key
   (Fork 4) and the `unrecoverable` anchor's admissibility (Fork 5).**

## Statute-overlap check

The rule this decision would codify, drafted:

> **A jury finding carries exactly one graded consequence axis — `impactIfUnfixed` — and its level is
> derived in code from three factual answers, SHADOW-FIRST: the derivation is computed and recorded, and the
> declared word a juror writes keeps governing until the Fork 4 measurement says the derivation is faithful,
> at which point a later, separate decision may arm the flip. There is no `severity` field *on a jury
> finding*; the design-critique rubric's own Nielsen scale is a separate surface this rule does not reach.
> Reach and likelihood are typed, DISPLAY/AUDIT-ONLY fields carried on the finding and read by no reducer.
> `IMPACT_LEVELS` keeps all four members. What a level means is fixed by a two-part anchor set — a teaching
> half rendered into the mandate from data, and a disjoint held-out half — whose answer key is authored
> against `IMPACT_GLOSS` and whose level is computed, never typed. The agreement number it produces gates
> nothing. If any future extension folds a *change-level* signal into the impact derivation,
> [`#blast-radius-advisory-care-not-a-gate`](../docs/agent/platform-decisions.md#blast-radius-advisory-care-not-a-gate)
> clause 1 governs and that extension must re-convene #2563.**

> *Scoped after the two-confusion screen.* The first draft read flatly *"There is no `severity` field"* while
> the item's own scope note confined the deletion to `we:scripts/lib/` — an unscoped statute line over a
> scoped intent, which is the exact failure class this item opens by citing (`#3314`'s anchor had to retract
> a field name twice).
>
> *Re-synced after this round.* Two more clauses had drifted from the forks they codify: this paragraph
> previously read *"derived in code from three factual answers, never asserted by the juror"* with no
> shadow-first qualifier, contradicting Fork 2's actual ruling; and *"Reach and likelihood stay narrative and
> enter no derivation"*, contradicting Fork 3's default of typed, display/audit-only fields. Both are
> corrected above to match the Digest and the forks themselves.

`we:docs/agent/platform-decisions.md` was grepped for same-subject anchors. Four neighbours; each quoted at
the clause the rule would live in, not summarised.

### 1. `#claim-accuracy-advisory-blocks-on-impact` (#3314) — closest neighbour, composes, no collision

> **The right axis is already typed, and it is `impactIfUnfixed`.** What should stop a land is what shipping
> the finding *costs*, not which reviewer noticed it. `IMPACT_LEVELS` / `IMPACT_GLOSS` in
> `we:scripts/lib/jury-core.mjs` already carry that, enum-constrained and fail-loud, and
> `PREVENTION_IMPACT_BAR` (`broken`) already dials the panel's other findings-derived block. So the blocking
> sub-class is **`impactIfUnfixed >= broken`** and needs no new field: a wrong acceptance criterion or a
> wrong `file:line` a card directs work to is `broken` (*"real work is lost, duplicated, or silently
> skipped"*); a wrong figure no criterion depends on is `cosmetic`. **A sub-class defined by a typed field
> is the whole point** — the objection to a sometimes-blocking advisory lens ("mandatory with extra steps")
> holds only where the sub-class is reviewer discretion, so any future rule of this shape must name a typed
> field or take plain advisory instead.

**How they compose.** `#3314` governs *what a level does* — `>= broken` blocks, below it advises. This rule
governs *how a level is set*. Disjoint powers over the same field, and this rule strictly strengthens
`#3314`'s own requirement: `#3314` demands *a typed field* rather than *reviewer discretion*, and Fork 2
removes the residual discretion **inside** the typed field. Nothing here changes the bar, the ordering, or
the blocking sub-class.

**Two things stated rather than left implicit.** (i) `#3314`'s worked example — *"a wrong acceptance
criterion or a wrong `file:line` a card directs work to is `broken`"* — must survive the derivation, and it
does: a wrong `file:line` breaks something (an artifact asserts a false location a builder acts on), is
reversible, and is **not** self-evident (the builder follows it and finds out later) ⇒ `broken`. (ii) *"a
wrong figure no criterion depends on is `cosmetic`"* likewise derives: `breaksSomething: false` ⇒
`cosmetic`. **Neither of `#3314`'s two worked examples is re-ranked by this rule** — a check worth running
explicitly, since Fork 2 does re-rank other classes.

**Two further paragraphs of this same anchor, quoted because the first draft of this section stopped at the
one above and both of the others bear directly on this item.** *Added after the skeptic pass, which named
this the strongest single find of the pass.*

> **A ruling that needs a build says so on its face.** `derivePanelVerdict` blocks on an advisory lens's
> findings only for **resolved** ones owing an uncaptured guard; an **outstanding** above-bar advisory
> finding still rides the accept. Until that third scan ships (`#3339`), this rule's blocking half is inert
> and the lens behaves as plain advisory. The two-stage form is part of the ruling, not a caveat on it — a
> decision recorded as if it binds while nothing enforces it is worse than one recorded as pending.

**Consequence, and a correction to this item.** An earlier draft argued the priority of this work from
*"`#3314` has already made `impactIfUnfixed >= broken` blocking … this is a repair to a rule in force."*
**That over-claimed, and the anchor says so in terms**: `#3314`'s blocking half is **inert** until `#3339`
ships, and `#3338` separately records that `claim-accuracy` is *not seated on the land path*. The corrected
priority argument, which is still strong: **impact is load-bearing today via `blocksAcceptance` (#2942),
which reads the level on every verdict** — and it will additionally become load-bearing via `#3314` the
moment `#3339` lands. So the level is already deciding lands, just through a different predicate than the
first draft named. Corrected in the grounding section.

> **The bar is unconditional on prevention — the scan may not be built on `blocksAcceptance`.** That
> existing predicate (`we:scripts/lib/jury-core.mjs:530`) opens `if (!hasUncapturedPrevention(finding))
> return false;`, so it blocks only where a *named, uncaptured* guard is also owed. Reusing it for this rule
> would let the worked example above through … The predicate this rule requires reads impact and nothing
> else: outstanding **and** `impactStrictness(impactIfUnfixed) >= impactStrictness(bar)`, **fail-closed on
> an undeclared level**.

**Consequence, and it is the one that costs most.** This paragraph forecloses the *"the weight is carried by
the `prevention` field"* answer wherever the question is **blocking** rather than reporting. Under `#3339`
there is **no prevention backstop at all** — a finding derived to `cosmetic` is un-blocked unconditionally.
Fork 2's re-rank 1 is therefore a genuine loosening of the gate, not a re-labelling, and that is a principal
reason its default is amended to shadow-first.

### 2. `#blast-radius-advisory-care-not-a-gate` (#2563) clause 1 — the live collision, reconciled

Quoted in full, including the clause the rule would live in:

> **1. Scored signals are advisory, not a gate.** Blast-radius, size, dismissed-findings, cross-repo, and
> 1-in-N sampling **annotate a care-level** that raises the convergence loop's scrutiny; they do **not**
> block the land on a review verdict. Gating a computed *risk score* is a documented anti-pattern (advisory
> dominates: CODEOWNERS/SonarQube gate *ownership*, not scores); the review still happens (via the loop),
> just not a human park. A repo may *tighten* a scored signal to a gate as config — where **`gate` means
> route-to-a-human, never hard-block-with-no-reviewer**.

**This is the anchor to be careful about, and it bites in two places.**

**(i) Fork 3 (c) would run against it, which is one reason Fork 3 refuses (c).** "Blast-radius" is the
*first* signal this clause names. Typing reach as a fourth `deriveFindingDisposition` input would let a
blast-radius signal decide whether a finding blocks a land — the move clause 1 refuses. **Scope discipline
(#1932):** clause 1's authoring scope is signals about the *change* that route review depth; a
finding-level reach signal is not literally inside that scope, so this is **supporting context, not
authority**, and Fork 3 (c) is refused on its own merits (it changes what disposition *is*) with the anchor
as reinforcement.

**(ii) Fork 2 does *not* run against it, and here is why, stated so a reader can check it.** Three
distinctions, all of which must hold:

- **Subject.** Clause 1's signals are properties of the *change* — how much it touches, how big it is, how
  often it is sampled. `impactIfUnfixed` is a property of a *finding*, and `#3314` has already ratified that
  a finding's impact blocks. That ruling is the governing one for this turf.
- **Form.** Clause 1's target is a *computed risk score* — a number crossing a threshold.
  `deriveFindingImpact` computes no number: it is a total function from three booleans onto a four-member
  enum that already exists, with no arithmetic, no weights and no threshold of its own. The threshold it
  feeds (`PREVENTION_IMPACT_BAR`) predates it and is unchanged.
- **Direction.** Clause 1 is about a signal *acquiring* blocking power. Fork 2 gives no signal power it did
  not have — the same field blocks at the same bar. It changes only who writes the field, and only in the
  strictness-preserving direction (a self-declared level is honoured when stricter), so the change cannot
  un-block anything that blocks today.

**And the guard, so this reconciliation cannot be quietly widened later:** if any future extension folds a
*change-level* signal into the impact derivation, clause 1 governs and the extension needs `#2563`
re-convened. That restriction belongs in the codified anchor's own text.

### 3. `#deterministic-core-thin-judgment` (#2607) — the governing anchor for Fork 2, and it COMPOSES

*Added after the skeptic pass, which found this anchor missing from the overlap section entirely and argued
it is the real governing rule for "asserted by the model vs derived in code" — not `#2950`'s docblock. The
first half of that is correct.*

> **Ratified 2026-07-22 (#2607).** In delivery-loop machinery (skills, the conveyor, the console), every
> **script-decidable** decision lives as a **deterministic, tested script single-sourced in `we:scripts`** —
> model judgment is reserved for genuinely judgment-shaped work. Three clauses:
>
> 1. **Script-decidable → a deterministic, tested script in `we:scripts`.** If a rule can be computed from
>    readable state … it is a script with unit tests — never a policy the model re-derives at run time. …
> 2. **Judgment is reserved for judgment-shaped work.** Spending model context re-deriving a computable plan
>    is both a latency source and a drift source (a prose rule re-interpreted per tick gives
>    non-reproducible, untestable decisions) …
> 3. **One source — skills and UIs SHELL the same script.**

**How they compose — and why the skeptic's version of the attack does not land.** The skeptic read this as
putting Fork 2 on the wrong side, on the ground that `breaksSomething` and `selfEvident` are not
script-decidable. That misreads what `deriveFindingImpact` claims. The **judgment** — are these three things
true of this finding? — stays with the model, exactly as clause 2 requires. What becomes a deterministic,
tested script is the **routing from answers to level**, which *is* computable from readable state and is
therefore squarely clause 1's subject. This anchor is closer to **authority for** Fork 2's default than
against it.

**And the asymmetry the attack rested on does not hold.** It argued `#2950`'s three questions are
*"near-script-decidable"* where these are not. `worseThanBase` — *"are we NET WORSE than the base, not
merely less than ideal"* — is plainly a judgment, and the mandate calls answering it *"the single most
expensive mistake a reviewer makes here"* (`we:scripts/lib/jury-core.mjs:2005`). Both triples are
model-answered judgments feeding a scripted route. They are the same shape.

**The restriction this composition carries into the codified anchor:** the routing function must stay
**pure, total and unit-tested** — no I/O, no dates, totality asserted at module load — which is clause 1's
own requirement and already the discipline every table in this file follows.

### 4. `#statute-anchor-states-rule-not-status` (#2854) — governs how this rule may be WRITTEN

*Added after the skeptic pass, which found the drafted rule breaching it.*

> **Ratified 2026-08-17 by the operator (Nicolas Gilbert) (#2854).** A ratified rule is timeless; what is
> built so far is not, so the two do not share a home. An anchor states the rule and remains cite-able
> authority that should read the same in a year; build status — what is enforced today, what is still owed,
> which item retires a gap — belongs on the backlog item and the open guards that already track it, linked
> by id, never narrated in the anchor body.

**How it binds this item.** The drafted rule's first version contained *"There is no `severity` field."*
That is point-in-time repo status, not a timeless rule — **and it was false**, per
`we:scripts/lib/buildReport.mjs:42`. Both defects are the same defect this anchor exists to prevent, and
they are the same failure class `#claim-accuracy-advisory-blocks-on-impact` had to retract when it asserted
*"There is no `impact` field on a finding."* **The drafted rule above is rewritten accordingly**: it states
what a jury finding *carries*, scoped, with no negative existence claim about a token elsewhere in the tree,
and the shadow-first flip condition is written as a rule about what must be measured rather than as a status
report on what is built. Build status for this item lives on the card and on its two carved children.

### 5. `#detection-claim-matches-evidence-tier` (#1673) — cited as context, explicitly not as authority

> **The load-bearing rule:** the strength of the claim the tool prints must **match the evidence tier it
> actually has** — passive probe ⇒ *presence* only ("detected"), a self-declared manifest ⇒ the asserted
> level **badged unverified**, an on-demand verify run ⇒ the **only** tier permitted to print a *verified*
> result. Tiers escalate the **assertion, not the toolset**.

Its phrase *"the level is self-asserted-and-trusted, never behaviour-verified"* describes exactly the status
quo Fork 2 changes. **But its authoring scope is a live-page detection extension**, not review findings — so
per the citation-scope discipline it is **supporting context, not authority**, and no fork's default rests
on it. Recorded because the principle recurs and a later reader will notice the resemblance.

### 6. `#trainable-judge` (#1553) — vocabulary neighbour, deletion scoped so they cannot collide

> **Two composable feedback channels, both captured.** A *verdict on a candidate* trains precision +
> severity; a *missed-issue capture* (a human authors a finding the judge never flagged) is the **only**
> channel that trains **recall**.

This anchor uses the word *severity* for the trainable vision judge's own label vocabulary, whose scale is
`we:docs/agent/vision-tiers.md:156`'s Nielsen 0–4. Fork 1 (a)'s deletion is scoped to the jury spine
(`we:scripts/lib/jury-core.mjs`, `we:scripts/lib/review-render.mjs`) and touches neither this anchor nor
`we:docs/agent/vision-tiers.md`. The composition rule is *Supported by default* item 6. **No collision —
because the deletion is a scoped one, and stating the scope is what makes that true rather than merely
likely.**

### Anchors checked and found not same-subject

`#size-adds-reviewers-never-refuses` (size, not consequence) · `#every-pr-gets-a-look-advisory-floor`
(seating, ruled distinct from blocking by `#3313`) · `#build-lane-self-review-non-zero-floor` (Layer-1
depth) · `#memory-admission-verified-grounding` (memory admission) · `#non-verdict-conformance-matcher`
(conformance matcher vocabulary) · `#enforce-flip-triple-gated` (the `landMode` flip).

**What this check scans and matches, stated per #3362:** a `grep` of
`we:docs/agent/platform-decisions.md` for the tokens `severity`, `impact`, `finding`, `lens`, `review`,
`verdict`, `blocker`, `prevention`, `evidence`, `care` and `escalat`, plus a read of every `### … {#anchor}`
heading in that file. It matches anchors whose heading or body contains one of those tokens. It does not
match an anchor governing this turf that uses none of them, and no claim of completeness is made.

## Review jury (provisional — pre-registered #2638)

Care level: `high`. This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

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

## What ratification carves — the buildable children and their scope slices

Stated so the carve is mechanical, and deliberately **not** pre-filed: a spin-off build must not enter the
board off an un-ratified call. Predicted touch-set (#2619), sliced so the children do not overlap and can
run in parallel:

| child | what it builds | scope slice |
|---|---|---|
| **The derivation, in shadow** (Forks 1, 2, 3, 5) | `deriveFindingImpact` + the `normalizeFinding` wiring that records the derived level **without letting it govern**; the `reach`/`likelihood` display-only fields and their two enums; the mandate paragraphs; the deletion of the dangling `severity` references | `we:scripts/lib/jury-core.mjs`, `we:scripts/lib/review-render.mjs` |
| **The anchor set and the agreement runner** (Fork 4) | `FINDING_ANCHORS` seeded from `#3314`'s ratified examples, the teaching/held-out split with its disjointness gate, and the three-section runner reporting Krippendorff's α with the ordinal metric | `we:scripts/lib/finding-anchors.mjs`, `we:scripts/review-corpus/anchor-agreement.mjs` |

**A third child exists only after the flip, and is not carved now:** turning shadow off, so the derived level
governs. It is its own decision (Fork 2), taken on the report Fork 2 specifies, and nothing may pre-file it.

## Done when

1. **Ratified** — every fork above carries a dated ruling, and `codifiedIn` names the
   `we:docs/agent/platform-decisions.md` anchor the drafted rule lands as.
2. **The two children are carved** with the scope slices above, each `blockedBy` this item until it is
   ratified.
3. **`#3338`'s edge is honoured** — it stays `blockedBy` this item and is re-derived, not ratified, before
   this one is ruled.
