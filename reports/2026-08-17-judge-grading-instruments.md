# Judge grading instruments — numeric ratings vs categorical verdicts, and how a candidate set gets ranked

**Date**: 2026-08-17
**Point**: #2576's "per-option 1–5 ratings" and jury-core's categorical `VERDICTS` were never rival answers
to one question — they grade different objects — and the evidence-correct form of the rating move already
ships in the engine as `IMPACT_LEVELS` + a bar; the survey settles the reconciliation and leaves one narrow
doc-scope fork.
**Research page**: `/research/judge-grading-instruments/`
**Prepared item**: [#3128](/backlog/3128-reconcile-2576-per-option-1-5-ratings-text-against-jury-core/)

---

## Question

[#2576](/backlog/2576-jury-refinement-method-reusable-template-for-high-leverage-u/) (resolved) ratified a
jury-refinement method naming **per-option RATINGS 1-5** as a guardrail. The engine shipped under epic
[#2649](/backlog/2649-jury-core-subject-agnostic-jury-engine-thin-skill-ratified-f/) grades each juror with a
four-member categorical `VERDICTS` enum instead. No ratified amendment reconciles the two, and
[#2575](/backlog/2575-decision-record-schema-persist-rationale-so-decisions-are-ex/)'s decision-record schema
needs to know which shape is authoritative.

So: **when a panel of judges — especially LLM judges — evaluates work, should the output be a numeric
per-option rating or a categorical verdict, and how should a set of candidate options be ranked?**

## Recommendation

**The card's dichotomy has no correct answer, because the two instruments grade different objects.** A
verdict answers *"does this one subject pass my lens?"*; a rating answers *"how does candidate A compare to
candidate B?"*. `we:scripts/lib/jury-core.mjs` has no candidate axis at all — a grep for `candidate` returns
zero hits, and `option` appears only inside the word `optional`. The gap is **dimensional, not lexical**:
replacing `accept/changes/…` with `1..5` would still not implement the method's move 3.

Three further findings settle almost everything the card frames as open:

1. **The evidence-correct form of "rate, don't just pick" already ships**, on the finding axis rather than
   the option axis — `IMPACT_LEVELS` is a closed four-step ordinal grade, each step carrying a written
   descriptor in `IMPACT_GLOSS`, tested against a configurable bar `PREVENTION_IMPACT_BAR`. Closed labelled
   grades reduced by a bar is precisely what the prior art prescribes.
2. **The aggregation question is already codified** — `AGGREGATION` is a frozen single-member enum
   (`diversity-selection`) returned on every care-level rigor dial, derived from
   `#blast-radius-advisory-care-not-a-gate` clause 3. A mean was never on the table in the engine.
3. **WE has already ratified a 1–5 scale**, in [#1034](/backlog/1034-design-critique-rubric-what-a-page-review-measures-and-how-w/)'s
   design-critique rubric — and it composes, because those scores are *advisory and training signal, never a
   reducer*.

The one open call left is narrow: whether WE's method doc keeps moves 3–4 at all, given that its only
practitioner today is plateau-app.

## Key findings

### LLM judges rank better than they score

- **MT-Bench / "Judging LLM-as-a-Judge"** (Zheng et al., NeurIPS 2023, arXiv:2306.05685) — the founding text
  states that single-answer grading "may be unable to discern subtle differences… absolute scores are likely
  to fluctuate more than relative pairwise results if the judge model changes." Position-bias consistency
  ranged from 23.8% (Claude-v1) to 65.0% (GPT-4).
- **"VLM Judges Can Rank but Cannot Score"** (arXiv:2604.25235, preprint) — names the failure
  *ranking–scoring decoupling*: Pearson 0.507 on ordering, with a conformal interval **3.08 points wide on a
  5-point scale (68% of the scale)**.
- **G-Eval** (Liu et al., EMNLP 2023) — motivates probability-weighted scoring because "one digit usually
  dominates the distribution of the scores (such as 3 for a 1-5 scale)". The raw emitted integer was not good
  enough.
- **Range compression** (arXiv:2606.03043, preprint) — on subjective evaluation judges use only **30–50% of
  the human score range**; inter-LLM agreement (0.35) exceeds LLM↔human agreement (0.27–0.32), i.e. consensus
  inside a collapsed subspace.
- **Score-range bias** — the emitted number shifts with the *labelling* of the scale (0–4 vs 1–5 vs 2–6),
  independent of content.
- **Honest counter-evidence.** Pairwise is *more* vulnerable to distractor injection than pointwise (~35% vs
  ~9% preference flips — Tripathi et al., COLM 2025, arXiv:2504.14716), and **Prometheus 2** reaches Pearson
  0.897 with humans using pointwise scoring *conditioned on a per-instance rubric with written level
  descriptors*. The rubric is the instrument; the integer serializes it. The pointwise-vs-pairwise question is
  genuinely contested, not settled.

### Nobody who ships code or standards at scale grades with an averaged rating

- **Gerrit** is the decisive case. `Code-Review` runs `−2…+2`, but the values are **never summed or
  averaged**: the default `MaxWithBlock` label function makes one `−2` block regardless of how many `+2`s
  exist, and two `+1`s do not equal a `+2`. It is a **categorical ordinal ballot with numeric names**.
- **GitHub** collapses to three states; `COMMENTED` is an explicit "I looked and I'm not ruling".
- **W3C Process** — consensus / dissent / Formal Objection, with no numeric scale anywhere; a Formal
  Objection escalates to Council and must carry technical argument.
- **RFC 7282** ("On Consensus and Humming in the IETF") makes *counting* the named failure mode: "more and
  more IETF actions are now indistinguishable from voting".
- **NIH study section** runs a 1–9 numeric panel and still **explicitly forbids** deriving the overall impact
  score by averaging the criterion scores.

### Averaging ordinal grades is the wrong operation

- **Stevens (1946)** — for an ordinal scale the permissible statistics are median and percentiles, not the
  mean. The robustness results that soften this (Norman 2010) concern *many* raters; a jury of 3–7 correlated
  LLM jurors is the worst corner of that literature.
- **Balinski & Laraki, *Majority Judgment*** (MIT Press, 2011) — escapes Arrow's impossibility precisely by
  having judges assign an ordered grade from a **shared common language of words**, aggregated by the
  middlemost grade rather than the mean.
- **Delphi** reports median + interquartile range and makes outliers justify themselves, rather than
  smoothing dissent away.
- A caution the survey surfaced against a naive "use the median" prescription: at even panel sizes the
  statistical median is itself an average of the two middle values, which is why Majority Judgment specifies
  the **lower middlemost** grade. WE's own `panelRigorForCareLevel` tops out at 2 jurors per lens.

### The below-bar rule is the best-corroborated idea in #2576

"If the top candidate is below the bar, go find more candidates rather than settling" is independently
reinvented across a century of practice:

| domain | mechanism |
| --- | --- |
| Engineering design | **Pugh Controlled Convergence** — `+/0/−` against a datum; the documented main payoff is ideation *between* matrix runs |
| Prizes | **Nobel** reserve clause (withheld 49 times since 1901); **AIA** Twenty-five Year Award 2018 (no winner); **EFQM**; **IDSA IDEA** |
| Auctions | **Myerson (1981)** — the revenue-optimal reserve price is independent of the number of bidders |
| Judgment | **Simon**'s satisficing aspiration threshold; **Trust-or-Escalate** (ICLR 2025) — abstain below a confidence bar |

### Where the evidence is thin

No study covers exactly this setup — a small panel of LLM jurors rating a handful of *design candidates* for
a *specification*. Several load-bearing 2026 citations are unreviewed preprints. Small-N median behaviour for
LLM jurors is not something the literature addresses. This thinness is itself a finding: it argues for
pinning the *surface* of a comparison instrument and leaving the instrument swappable, rather than mandating
pointwise-vs-pairwise now.

## Files created/modified

| File | Action |
| --- | --- |
| `we:backlog/3128-reconcile-2576-per-option-1-5-ratings-text-against-jury-core.md` | Rewritten to prepared shape; `preparedDate` stamped |
| `we:src/_data/researchTopics/judge-grading-instruments.json` | Created — research registry entry |
| `we:src/_includes/research-descriptions/judge-grading-instruments.njk` | Created — research write-up |
| `we:reports/2026-08-17-judge-grading-instruments.md` | Created — this report |
