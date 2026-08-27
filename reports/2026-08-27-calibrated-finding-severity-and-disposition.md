# Calibrated finding severity and derived disposition — prep grounding

**Date**: 2026-08-27
**Point**: Prep research and authoring for decision `#xg7hrd5` (under `#3318`, the review-efficacy watch) — a
calibrated severity-and-disposition model for review findings. Five forks, all attacked and screened. The
durable output is the item; this report records the measurements, the passes, and what changed because of
them.
**Research page**: `/research/review-finding-severity-classification/`
**Item**: `we:backlog/xg7hrd5-calibrate-the-finding-consequence-scale-one-axis-or-two-asse.md`

---

## Question

Two requirements, from the operator:

1. **Calibrated severity** — *"so that a medium severity across many reviews is about the same severity, and
   so is a low or high."* Inter-review consistency, not a category exemption.
2. **Disposition derived, not asserted** — *"each finding must be classified by its blocking nature, probably
   derived from other criteria… I feel we are missing some criteria to derive this, we can probably use
   classic testing or review models."*

---

## Measurements re-derived in this lane (lane-6 at `6b03a7bd`, 2026-08-27)

Everything below was run here, not carried forward from a sibling card.

### 1. The label population — 42 findings

Counting every finding's mined `impact` value across the 92 case files in `we:scripts/review-corpus/cases/`:

```
findings total: 42     keys seen: category, impact, line, path, summary, verdict     with severity: 0
by level:   broken 11 · degraded 19 · cosmetic 12 · unrecoverable 0
at or above PREVENTION_IMPACT_BAR: 11 of 42 (26.2%)
by lens row: correctness {broken 6, degraded 18, cosmetic 12} · security {degraded 1} · (no lens row) {broken 5}
```

Three facts, none previously written down:

- **A level population exists.** Mined from the rendered `_[impact if unfixed: <level>]_` marker
  (`we:scripts/review-corpus/mine-review-corpus.mjs:272`). This corrects a natural misreading of `#3338`'s
  replay: *"where the advisory lenses ran, `impactIfUnfixed` did not yet exist"* is true of the **advisory**
  lenses; the `correctness` lens (86 of 87 recorded lens rows) has been labelling all along.
- **`unrecoverable` has never once been used** — 0 of 42.
- **One defect class spans three levels.** Six findings about missing/insufficient test coverage, all
  `CONFIRMED`: `cosmetic` ×2, `degraded` ×3, `broken` ×1. Not identical findings, and some spread is real —
  but nothing in the record says which part, and one of the six crosses the blocking bar.

### 2. Four labels a *ratified anchor* already contradicts

`#claim-accuracy-advisory-blocks-on-impact` rules that *"a wrong acceptance criterion or a wrong `file:line`
a card directs work to is `broken`."* Four corpus findings are exactly that, labelled `cosmetic`:
`1556 r3`, `1556 r6`, `1560 r2`, `1560 r6`.

**This is the sharpest calibration evidence found** — a failure measured against an independently ratified
key rather than against this item's opinion. It was surfaced by the skeptic pass, not by the initial
grounding.

### 3. Reproducibility

```
$ node we:scripts/review-corpus/stability.mjs --missed-on-unchanged-input --replay-cases=all
pairs 5   pooled findings 7   pairs where both runs found nothing 1
  defect  churn 100.0% pooled   80.0% per-pair mean   (0/7 findings agreed)  <- headline
  verdict flips: 1/5 pairs = 20.0%
```

**0 of 7 findings recurred across 5 same-head-sha pairs; one verdict flipped `accept → changes` on a
byte-identical diff.** Caveats carried, not softened: n=5, a convenience sample biased toward rounds going
badly, and no per-round model/prompt/roster recorded, so juror nondeterminism cannot be separated from
version drift (`#3363`, already filed).

**What it licenses, precisely.** Not *"the levels are miscalibrated"* — you cannot measure label agreement on
findings that do not recur. It licenses the narrower premise the decision needs: no property of a juror's
output may be assumed stable without measurement, and `broken` is such a property. Churn and agreement are
**independent quantities**; re-labelling a fixed finding set isolates the second.

### 4. The four dangling `severity` references — and the scope correction

`severity` is named four times on the review path with no field behind it, including
`we:scripts/lib/review-render.mjs:120`, whose docblock claims each finding shows *"severity/category"* while
`renderFinding` renders `category` and an impact marker only.

**But the unscoped claim is false, and the first draft made it.** `we:scripts/lib/buildReport.mjs:40-45`
declares `finding({ id, severity, … })` with `need(severity, …)` — a *required* `severity` field on a
function named `finding`, four files away, belonging to the unrelated Web Reporting report model (#431).
`we:scripts/lib/conformanceReport.mjs:44` and `we:scripts/lib/visual-comparator.mjs:59` use it too. The
deletion is now scoped **by filename** to two files, never to `we:scripts/lib/` as a directory.

---

## Prior art — what changed because of it

Full survey with URLs, verbatim quotes and a could-not-verify list at
`/research/review-finding-severity-classification/`. What it did to the forks:

| Source | Load-bearing finding | Effect on the item |
|---|---|---|
| IEEE 1044-2009 | Keeps Severity/Priority/Disposition separate, but **removed mandatory level values** and demoted its one-line glosses to *informative* | Names the exact state `IMPACT_GLOSS` is in; motivates the whole item |
| ODC | **No severity field, by name** — IBM's spec lists it among *"non-ODC attributes"* beside `open date`. But its one judgment-defined attribute, `Impact`, measured **κ 0.26–0.33** with 5 raters | Reinforces Fork 1 (a); warns that `impactIfUnfixed` is `Impact`'s analogue |
| CVSS | Anchoring exemplar (v4.0 `User Interaction`), and cautionary tale: **Finn's 0.021–0.33** on *anchored* metrics, 196 practitioners; **68%** gave different ratings 9 months later | Anchoring binds only when *which fact* is uncontested |
| **SSVC** | Anchored inputs agree (`Exploitation` **0.807**, `Technical Impact` **0.679** via a three-yes/no rubric) — but **derived outcomes scored WORSE** (0.226 / 0.295) | **Amended Fork 2's default to shadow-first** |
| Fagan | Major = *"would cause a malfunction or unexpected result if left uncorrected"* — binary and functional. Severity assigned unilaterally by one moderator, so **no agreement statistic was ever collectible** | Validates `breaksSomething`'s shape |
| Tricorder | Removed all severity/priority — because a filter axis lets consumers **silence a broken analyzer instead of reporting it** | New ground for Fork 1 (a) |
| BARS / rater training | Rubric structure did nothing; **descriptor specificity** moved ICC ~.49→.64; what replicates is calibration-with-feedback. Anchoring raises **confidence** whether or not it raises agreement | Demoted Fork 4's teaching half; the item claims anchors make agreement *measurable*, never that they improve it |
| Kappa paradox | A 4-level scale with skewed mass can report **κ 0.042 at 0.842 observed agreement** | **Ruled Fork 4's statistics explicitly** rather than leaving them to the build |

---

## The five forks, and their defaults

| Fork | Question | Recommended default |
|---|---|---|
| 1 | Does `severity` exist as a second typed axis? | **No — one axis; delete the dangling refs, scoped by filename** |
| 2 | Is `impactIfUnfixed` asserted or derived? | **Derived from `breaksSomething`/`reversible`/`selfEvident` — but SHADOW-FIRST; the declared level keeps governing until measured** |
| 3 | Do reach and likelihood become typed, and where? | **Typed, but DISPLAY/AUDIT-ONLY — read by no reducer** |
| 4 | Whose labels are the anchor set's answer key? | **Authored, seeded from `#3314`'s two ratified examples; level computed, never typed; key-free spread reported alongside** |
| 5 | Does `unrecoverable` stay, at 0 of 42? | **Yes — dropping it silently widens `EVIDENCE_EXEMPT_IMPACT_BAR`** |

**The derivation is not a new scale** — it is `IMPACT_GLOSS`'s own ladder with its discriminators made
answerable. The four glosses are already monotone in *can it be undone* and *does it announce itself*.

---

## The passes, and what each one changed

### Two-confusion screen (fresh-context agent, ran first)

- Forks 1–3: `clear`.
- **Fork 4: `flagged(prio)` → the fork was replaced.** *"A branch contained in another branch is not a fork
  — it is the same branch with less of it, and the only reason to pick less is that more costs something."*
  Accepted in full. The existence question moved to *Supported by default*; the fork was re-cut onto the
  question genuinely open inside it — **whose labels are the answer key**.
- **Found a live choice outside every fork:** `unrecoverable` proven dead and never ruled on. **Became Fork
  5.**
- Found *Supported by default* item 6 asserting a Nielsen-scale→enum conversion nobody has written
  (narrowed to a file-scope statement plus an explicit hand-off), and the drafted statute rule missing the
  scope its own text said was load-bearing (scoped).

### Skeptic pass (throwaway agent, prompted only to refute, four axes)

Landed hard and changed four of five defaults in some way:

- **Fork 1 — SURVIVES-WITH-AMENDMENT.** Three supports refuted: the false *"severity exists nowhere"* claim;
  the destructive directory-wide deletion scope; and a statute collision with
  `#statute-anchor-states-rule-not-status` (#2854), since *"There is no `severity` field"* is point-in-time
  status **and** false.
- **Fork 2 — SURVIVES-WITH-AMENDMENT, substantially.** Six kills, five accepted: `breaksSomething` was used
  two incompatible ways in one card (pinned to commission-vs-omission); the code snippet's
  `filter(Boolean)` left the self-certification seam wide open and was **not** `disposition`'s contract as
  claimed (rewritten); ground 4's *"no consumer changes"* was false in effect; the coverage rule keyed on a
  category slug and mis-ranked its own exhibit (`#1504 r1`); and **`#3314` was over-extended** — its
  blocking half is *inert* until `#3339` ships, so *"a rule in force"* was wrong. It also found
  `#deterministic-core-thin-judgment` (#2607) missing from the overlap section entirely. **Not accepted:**
  the claim that `#2950`'s three questions are script-decidable where these are not — `worseThanBase` is
  plainly a judgment.
- **Fork 3 — REFUTED → default flipped** from *"neither is typed"* to **(d) display/audit-only**, an option
  the first draft never enumerated despite the repo shipping it twice (`citationScope`, `evidenceKind`).
  Its sharpest point: (a) deferred to evidence that (a) made uncollectable.
- **Fork 4 — SURVIVES-WITH-AMENDMENT.** The *"artifact does not exist for any lens"* premise was **false**
  (`#3314` carries two ratified worked examples), and the proposed anchor set was **circular** — keyed to
  the ruling being tested. Both fixed by seeding the key from the statute.
- **Fork 5 — SURVIVES-WITH-AMENDMENT.** Ground 1 demoted to a contested prediction with a measured
  re-open trigger.
- **#3338 — the skeptic argued to drop the edge.** Its best move was a reversal: *"ratifying THIS item first
  freezes a derivation whose faithfulness is unmeasured."* **That was a good hit, and it is why Fork 2 is
  now shadow-first** — with which the asymmetry runs the other way. Two of its three counters were
  absorbed; the edge stands.

**Strongest single find of the pass:** two ratified paragraphs of the item's own closest-neighbour anchor
that the overlap section never quoted — one saying the rule is **inert**, the other saying the blocking
predicate **may not** route through prevention, which kills the *"the `prevention` field carries the
weight"* escape hatch that two forks leaned on.

---

## Statute-overlap check

Six neighbours quoted at the clause the rule would live in:

1. `#claim-accuracy-advisory-blocks-on-impact` (#3314) — closest; **composes** (it governs what a level
   *does*; this governs how it is *set*). Both its worked examples survive the derivation unchanged.
2. `#blast-radius-advisory-care-not-a-gate` (#2563) clause 1 — the live collision. Reconciled on three
   distinctions (subject / form / direction) and, more decisively, by Fork 3's flipped default *satisfying*
   the clause rather than dodging it: a display-only field annotates and does not gate.
3. `#deterministic-core-thin-judgment` (#2607) — **added after the skeptic pass**; composes, and is closer
   to authority *for* Fork 2 than against it (judgment stays with the model; the routing becomes a script).
4. `#statute-anchor-states-rule-not-status` (#2854) — **added after the skeptic pass**; governs how the rule
   may be written, and the drafted rule was rewritten to comply.
5. `#detection-claim-matches-evidence-tier` (#1673) — supporting context only; its authoring scope is a
   live-page detection extension.
6. `#trainable-judge` (#1553) — vocabulary neighbour; the deletion's file scope keeps them apart.

---

## Answer on #3338 — not dissolved; ground dissolved; edge set

`#3338`'s Fork-1 default rests, by its own text, on one discriminating ground: a lens joins the blocking set
only if its impact levels are *"checkable against an artifact rather than asserted"*, and `simplicity`'s
exclusion is *"permanent unless the criterion itself is overturned."*

Forks 2 and 4 make that criterion **lens-independent** — a `simplicity` juror answers the same three
questions and is scored against the same anchors — so it stops discriminating between lenses. **The
"permanent" half loses its ground.**

But two facts survive untouched and they decide the question: generalising still takes the merge path from
**2-of-4 to 4-of-4** blocking lenses, and the advisory lenses **never dissented in 6 of 6** observed
subjects. So the question is live and only its third ground is not.

**Edge set:** `blockedBy: ["xg7hrd5"]` on `#3338`, plus a "do not rule this yet" block on the card
explaining what changes and what survives.

**Withdrawn after the skeptic pass:** an additional prop claiming *"the artifact does not exist for
`claim-accuracy` either — no lens currently passes."* False — `#3314`'s two ratified worked examples are
lens-specific to prose claims by construction, and this item builds `simplicity` nothing comparable.

---

## Found but not fixed

- **`we:scripts/lib/review-render.mjs:120`'s docblock is factually wrong today** — it claims each finding
  renders "severity/category" and no severity is rendered. Left for Fork 1's carved child rather than fixed
  here, so the prep PR stays a prep PR.
- **`#3310` is `status: open` with `we:scripts/review-corpus/stability.mjs` already built and passing.** Its
  Done-when criteria appear met; resolving it is not this session's call.
- **The 42-finding population is not a clean sample.** `we:scripts/review-corpus/mine-review-corpus.mjs`
  drops findings without a path-shaped locus and without a verdict tag, on top of the 62-of-154 unparsed
  verdicts `#3338` records. Stated in the item; not corrected.
- **A latent second severity vocabulary** — `we:docs/agent/vision-tiers.md:156`'s Nielsen 0–4 for design
  critiques. No design subject routes through the jury spine today, so no conversion exists; recorded as a
  named hand-off rather than designed here.
