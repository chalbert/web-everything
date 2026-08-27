# Replaying the review corpus per advisory lens — what the blocking set would cost

**Date:** 2026-08-26 · **For:** [#3338](/backlog/3338/) (prep) · **Under:** the Review-efficacy watch (#3318)

#3314 ruled that *what blocks a land is a finding's impact, not the lens that found it*, and then scoped the
blocking set to `claim-accuracy` alone. #3338 asks the general form: should **every** advisory lens block at
`impactIfUnfixed >= broken`? Its point 1 asks for the corpus replay per advisory lens. This report is that
replay, plus the wiring survey the replay turned out to need.

---

## 1. The headline: two populations, and neither answers the question as posed

**In the mined replay corpus, zero of the 92 recorded cases seated `simplicity` or
`standards-conformance`** — every case is a **single-lens** run. That is not a sampling accident: the corpus
is mined from `review-pr` verdict comments, and `review-pr` seats one caller-chosen lens plus (since #3319) a
pinned `security` seat, so a lens that is never seated cannot produce a recorded finding.

**But the corpus is not the only durable record, and the claim "no recorded review ever seated an advisory
lens" would be false repo-wide.** A second artifact exists: the **jury ledgers** at `we:.conveyor/jury/`,
written by the drain's parked-PR loop, which really does fan out four lenses. Six real runs there produced
**17 advisory-lens findings** — the population §3's proxy was standing in for.

**Neither population answers the card's question, and they fail for opposite reasons:**

| population | seats advisory lenses? | carries `impactIfUnfixed`? |
| --- | --- | --- |
| replay corpus (92 cases) | **no** | yes, on all 42 findings |
| jury ledgers (6 subjects) | **yes** | **no — absent on all 26 findings** |

So the per-lens above-bar count for `simplicity` and `standards-conformance` is **not measurable from any
artifact in this repo**: where the lens ran, the field did not exist yet; where the field exists, the lens
never ran. That gap is the finding, and §7 turns it into a trigger.

---

## 2. The count: predicate and candidate set, stated

Per [#3362](/backlog/3362/) — state what the count scans and what it excludes; never assert completeness.

**Candidate set.** The 92 JSON case files in `we:scripts/review-corpus/cases/`, excluding the corpus index
`we:scripts/review-corpus/cases/index.json`. Re-derived 2026-08-26 by direct enumeration; not carried forward
from any prior card.

| property | measured |
| --- | --- |
| case files | **92** |
| distinct PRs | **59** |
| PR range | **#1456 – #1567** |
| `corpusAsOf` | 2026-08-25T21:12:54-04:00 |
| cases carrying ≥1 lens row | **87** |
| lens rows: `correctness` | **86** |
| lens rows: `security` | **1** (#1457 r2) |
| lens rows: `simplicity` | **0** |
| lens rows: `standards-conformance` | **0** |
| lens rows: `claim-accuracy` | **0** |
| lens rows marked `advisory` | **0** |
| cases with `singleLens: true` | **92 of 92** |
| operator decision `accept` / `changes` | **55 / 37** |
| cross-tab: correctness juror accepted **and** operator recorded `changes` | **27** |

**Excluded, explicitly:**

- **62 recorded verdicts the miner could not parse into a case at all** (the corpus index's
  `skipped.unstructuredVerdicts: 62`). The corpus is therefore **92 of 154** recorded verdicts — a 40%
  exclusion whose composition is unknown. Nothing here is a statement about those 62.
- **5 of the 92 cases carry no lens row**, so the lens tally denominator is 87, not 92. Their findings *are*
  in the finding pool below (the finding pool is keyed on the case, not on the lens row).
- `skipped.unreachableCommits: 0` — nothing was dropped for a missing commit.

**Reproduce:** enumerate the case files under `we:scripts/review-corpus/cases/`, read `lensRows[].lens` and
`decision`. The gate-recall figure below is `node we:scripts/review-corpus/replay-gates.mjs`.

---

## 3. The proxy: hand-attributing the 42 findings to the lens that would own them

The corpus records 42 findings across the 92 cases. Each carries a free-text `category` written by the
reviewing session — **18 distinct values, only 15 of the 42 inside the five-lens vocabulary.** Values like
`test-flakiness`, `prose-accuracy`, `dangling-citation` and `goal-completeness` are topic labels, not lens
ids (`parseFindings`, `we:scripts/review-corpus/mine-review-corpus.mjs:254`, lifts whatever bold heading
the reviewer typed). **So `category` is not a lens attribution either**, and within this corpus the only
per-lens signal is a hand-attribution. (The jury ledgers in §3b *do* carry a true per-juror lens attribution
— but no impact level. The two artifacts are complementary and neither is sufficient.)

**Predicate:** for each of the 42 findings, one reading of its recorded summary, assigned to the single lens
whose charter most nearly owns it. **Candidate set:** all 42, none skipped. **Attributor:** this prep session
(one reader, not an independent panel).

| lens | findings | at/above `broken` |
| --- | --- | --- |
| `correctness` | 17 | **7** |
| `claim-accuracy` | 21 | **3** |
| `security` | 2 | **1** |
| `simplicity` | **1** | **0** |
| `standards-conformance` | **1** | **0** |
| **total** | **42** | **11** |

Declared impact across all 42: `broken` 11, `degraded` 19, `cosmetic` 12. **No finding is undeclared**, and
none is `unrecoverable`. Verdict labels: 39 `CONFIRMED`, 3 `PLAUSIBLE`.

The single `simplicity`-shaped finding is #1497 r1 — *"`factsFromRun` re-implements the applier's own
repo-slug and PR validation instead of importing it"* — declared **`degraded`**. The single
`standards-conformance`-shaped one is #1560 r1 — a card's `scope:` omitting a file its own Done-when
requires — also **`degraded`**.

### What this proxy does NOT establish, stated plainly

**It under-counts `simplicity` by construction, and that is the limitation that matters.** These 42 findings
were produced by jurors seated at `correctness` (86 of 87) or `security` (1). They record what a
correctness juror *incidentally* noticed about duplication and convention — not what a juror briefed
*"judge this diff for simplicity"* would report. A dedicated simplicity juror would produce a larger
population, and nothing here bounds how much of it would land at `broken`.

So the honest reading is: **"0 above bar for `simplicity`" is a weak upper-bound signal, not evidence the
general form is free.** It is enough to say the corpus contains *no observed instance* of the failure the
general form would newly block. It is not enough to say the general form is cheap.

Three further limits: the attribution is one session's reading, not an adjudicated label; the corpus index's
own provenance note warns that a `CONFIRMED` label is the reviewing session's unadjudicated self-assessment,
so these are sound as a relative comparison and not as absolute rates; and the 62 unstructured verdicts are
outside all of it.

---

## 3b. The second population — the jury ledgers, where the advisory lenses really ran

**Candidate set.** The six `.jsonl` files in `we:.conveyor/jury/` — `we#974`, `we#983`, `we#985`, `we#987`,
`we#1018`, `we#1049` — 84 append-only events, timestamped 2026-08-02T15:15Z to 2026-08-05T21:52Z. Written by
the drain's parked-PR loop (`recordJuryLedger` → `we:scripts/lib/jury-ledger.mjs`), whose roster is the
four-lens literal at `we:scripts/workflows/review-parked-prs.mjs:153`. **Six roster events, six subjects, 24
juror seats** (4 lenses × 6 subjects). Every figure below re-derived by parsing the files directly.

**Exclusion, and it is a serious one:** `we:.conveyor/` is **gitignored**. These ledgers exist on this
machine (and as byte-identical copies inside lane clones), not in the repository. They are evidence, but
they are **not replayable from a fresh checkout**, and no gate or harness reads them.

| lens | findings | verdicts |
| --- | --- | --- |
| `correctness` | 4 | 4 accept · 2 changes |
| `security` | 5 | 4 accept · 2 changes |
| **`simplicity`** | **10** | 4 accept · 2 changes |
| **`standards-conformance`** | **7** | 4 accept · 2 changes |
| total | **26** | 24 events |

`impactIfUnfixed` is present on **0 of 26** findings — the field postdates these runs.

### Three things this population settles, and they do not all point the same way

**(i) The card's premise about volume is refuted.** The card asks *"if `simplicity` rarely produces above-bar
findings, the general form is free."* `simplicity` is not a low-volume lens: across six subjects it produced
**10 findings, more than `correctness` (4) and more than `security` (5)** — the most of any lens in the only
real four-lens data that exists. The findings are substantive, not stubs. So the "rarely produces" half of
the card's conditional is false, and the argument for (a) cannot rest on it.

**(ii) But the advisory lenses never dissented.** In **6 of 6** subjects all four lenses returned the
**same** verdict — `accept` in four, `changes` in two. There is **no observed case** where an advisory lens
wanted changes and the mandatory pair did not. On this evidence the general form would have changed **zero**
outcomes: every subject an advisory lens would have blocked was already blocked by a mandatory one.

**(iii) The above-bar question stays unmeasurable, and retrofitting it is unsafe.** With `impactIfUnfixed`
absent on all 26, these findings cannot be stratified by impact. Worse for anyone tempted to reason over
them: the blocking scan #3339 specifies is **fail-closed on undeclared**, so applied literally to this
population **all 17 advisory findings would block** — an artifact of a missing field, not a measurement of
impact. The lesson is that *the general form cannot be evaluated against a population recorded before the
field it turns on existed*, and any future measurement must post-date the field.

---

## 4. The wiring survey — where the general form would actually bind

The replay's null result made the second question unavoidable: *if no advisory lens is seated in the recorded
corpus, is any advisory lens seated anywhere in production today?* It is — on the land path, and not the
lens #3314 ruled on.

| surface | lenses seated | can an advisory finding block? |
| --- | --- | --- |
| `we:scripts/operations/review-pr.mjs` (`JUDGE_SEATS`, :193) | caller's `--lens` + pinned `security` | both seats are mandatory today; `--lens` at an advisory lens is refused by `assertMandatoryLensSeated` (:282) only when **no** mandatory seat remains — dormant while `judgeSecurity` is pinned |
| `we:scripts/workflows/review-parked-prs.mjs` (`LENSES`, :153) — **the drain's parked-PR loop** | `correctness`, `security`, **`simplicity`, `standards-conformance`** | **no** — :141 states *"ADVISORY (surfaced, never blocking): simplicity, standards-conformance"* |
| `we:scripts/converge-cli.mjs` (`resolveRoster` → `panelRigorForCareLevel`) | the full five, per the care bands in `we:scripts/lib/review-policy.contract.json` | the loop is advisory end-to-end — it reports, it never lands |

**The inversion this exposes.** `claim-accuracy` — the one lens #3314 gave a blocking sub-class — is
**deliberately not seated** on the parked-PR loop (`we:scripts/workflows/review-parked-prs.mjs:145-152` says
the four-lens width is the fan-out budget and the #3314 ruling did not widen it). Meanwhile `simplicity` and
`standards-conformance` **are** seated there, on the path that lands PRs.

So the two rules have opposite reach:

- **#3314's rule reaches nothing today.** Its lens is not seated on the land path, and `derivePanelVerdict`'s
  outstanding-finding scan is still unbuilt (#3339, open).
- **The general form would reach the land path immediately**, at exactly the two seats where #3314's ruling
  has none.

The card frames the general form as *"a large behaviour change wearing a small diff"* if `simplicity` produces
many above-bar findings. The wiring says the diff is small and the reach is immediate **regardless of the
finding rate** — on the parked-PR loop it takes the blocking **lenses** from **2 of 4 to 4 of 4**, and in
seats (that loop clamps at 2 jurors per lens — `JURORS_PER_LENS_CEILING`,
`we:scripts/workflows/review-parked-prs.mjs:161`) from **4 of 8 to 8 of 8** at the top band.

**Count the two powers separately, or the figure overstates its own case.** The four seats a promotion adds
are not equivalent to the four that already block: a mandatory seat blocks on **any** outstanding blocker
finding, a promoted advisory seat only on one at or above the bar. On the corpus's measured impact
distribution (11 `broken` of 42 findings, §3) a promoted seat would fire on roughly a quarter of what a
mandatory one does. So the honest statement is **"the number of seats that can stop a land doubles, and the
added seats fire at roughly a quarter the rate"** — not "blocking doubles".

The five-lens, ten-seat roster the care contract declares (`we:scripts/lib/review-policy.contract.json`,
`high`) is **not** the land path: it is the roster `/converge` and `/jury` resolve, and both are advisory
end-to-end. Quoted only to size the general form's reach on those surfaces (4 of 10 → 10 of 10), never as a
land-path figure.

---

## 5. The asymmetry the mandatory/advisory split already contains

Worth recording because both #3338 forks turn on it. **A mandatory lens's juror blocks at *any* impact.**
`deriveVerdict` (`we:scripts/lib/jury-core.mjs:616`) returns `changes` on any outstanding blocker finding
with **no impact test at all**; `derivePanelVerdict` (:1074) then propagates any mandatory `changes` straight
through. The impact bar appears only in the *prevention* scan (`blocksAcceptance`, :692).

So the live shape is already two-tier, and #3314 made it three:

| seat | blocks when |
| --- | --- |
| mandatory lens (`correctness`, `security`) | any outstanding blocker finding, **any impact** |
| `claim-accuracy` (post-#3314, once #3339 ships) | outstanding **and** `impactIfUnfixed >= broken` |
| other advisory lenses | never |

An advisory lens promoted under the general form would therefore hold **strictly less** unilateral power than
a mandatory juror already holds — it must clear a typed bar; the mandatory juror need not. That is the load
this fact carries against the incentive objection, and it is why the objection is about *how many* seats can
block rather than about self-declaration as such.

---

## 6. Gate-recall figure, re-derived

`node we:scripts/review-corpus/replay-gates.mjs`, run 2026-08-26: **`recall over all confirmed labels: 5/39 =
12.8%`** over 92 cases, 39 confirmed labels, content matcher. Five labels matched; 81 gate fires carried no
matching label (a queue to adjudicate, not a false-positive rate). Line-number agreement 1 of 4 within three
lines. Quoted here only because two sibling cards had carried retracted versions of it (*"3 of 13"*); the
figure is re-run, not inherited.

---

## 7. What the replay settles, and what it does not

**Settles:**

1. The mined corpus contains **no** advisory-lens verdicts, and the jury ledgers that do carry them predate
   `impactIfUnfixed`. **No artifact in this repo can stratify advisory findings by impact.** Point 1 of
   #3338's card is unanswerable as written; that is the finding, not a gap in the search.
2. **`simplicity` is not a low-volume lens.** In the only real four-lens data it produced 10 findings across
   6 subjects — more than either mandatory lens. The card's *"if `simplicity` rarely produces above-bar
   findings"* conditional fails on its own premise.
3. **But the advisory lenses never dissented**: 6 of 6 subjects saw all four lenses return the same verdict,
   so the general form would have changed zero outcomes in the observed population.
4. The general form's live reach is **not** contingent on any finding rate: it takes the drain's parked-PR
   loop from 2 blocking lenses of 4 to 4 of 4 (4 of 8 seats to 8 of 8), with the added seats firing at
   roughly a quarter of a mandatory seat's rate.
5. `MANDATORY_LENSES` is **not** a subset of "blocks above the bar" — mandatory jurors block at any impact,
   so the two mechanisms are not redundant and the general form does not collapse them.

**Does not settle:** how much of a briefed advisory juror's finding population lands at `broken`. **That
measurement is not merely absent, it is currently unreachable**: the one surface that seats advisory lenses
(the parked-PR loop) writes only the gitignored ledger and posts no minable verdict, and the one surface the
miner can read seats a single lens. Closing that is a build, not a re-run — and it is the concrete trigger
#3338's ruling owes.

---

**Sources.** `we:scripts/review-corpus/cases/` (92 case files plus the corpus index), `we:.conveyor/jury/`
(6 ledgers, gitignored — machine-local), `we:scripts/lib/jury-ledger.mjs`,
`we:scripts/review-corpus/mine-review-corpus.mjs`, `we:scripts/review-corpus/replay-gates.mjs`,
`we:scripts/lib/jury-core.mjs`, `we:scripts/operations/review-pr.mjs`,
`we:scripts/workflows/review-parked-prs.mjs`, `we:scripts/converge-cli.mjs`,
`we:scripts/lib/review-policy.contract.json`, `we:docs/agent/platform-decisions.md`.
