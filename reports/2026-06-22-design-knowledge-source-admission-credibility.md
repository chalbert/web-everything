# Design-knowledge source admission + credibility-weight — prep survey (#1588)

**Date:** 2026-06-22 · **For:** decision [#1588](/backlog/1588-source-admission-credibility-weight-criteria-for-the-design-/), child of the
design-knowledge intake program [#1585](/backlog/1585-design-knowledge-intake-program-a-standing-watch-that-distil/).
**Research topic:** [/research/design-knowledge-source-admission-credibility/](/research/design-knowledge-source-admission-credibility/).

## The question

How does the curated design-knowledge corpus (Nielsen heuristics, Apple HIG, W3C/WAI-ARIA APG, academic critique
sets like UICrit/UIST'24, UX books, trend blogs) **admit** a source, and how is its **credibilityWeight** computed
so durable peer-reviewed usability research outranks a trend blog — while the system stays **open** (custom/project
sources must coexist, per #1585's open-design posture)? Standardize the *meta-criteria*, not a frozen source list.

## Internal precedent (the strongest grounding)

`we:src/_data/benchmarkCorpus.json` already governs source admission for the competitive gap-analysis program
(#315): a `selectionCriteria` array (adoption · breadth · philosophy · native-alignment · docs-quality · currency),
an `inclusionRule` ("scores on **≥3** criteria AND occupies a category **axis**"), and category axes. That is exactly
the multi-criteria-gate shape #1588 needs — but for *coverage breadth* and *binary* inclusion, not *credibility* and
a *weight*. #1588 reuses the shape and adds the weight axis.

The consumer side is the #1034 design-critique rubric (`we:docs/agent/vision-tiers.md` §Design-critique rubric): each
of its 8 closed axes already names a grounding source (Nielsen 0–4 severity, HIG "clarity", etc.); #1587 adds a
provenance field linking each axis to admitted-source ids; #1586's ledger holds the per-source rows
(`{ id, source, kind, credibilityWeight, distilledInto, trackingItem }`).

## External prior art (survey)

- **Evidence-based medicine pyramid** — tier *purely by study type* (systematic review > RCT > cohort > expert
  opinion). Reusable: a cheap, deterministic baseline from source-*type*.
- **GRADE** — the richest template: a **baseline tier from study type**, then **named downgrade modifiers**
  (risk-of-bias, inconsistency, indirectness, imprecision, publication-bias) and **upgrade modifiers** (large effect,
  dose-response), each moving the rating a level. → baseline + independent up/down modifiers.
- **CRAAP** (Currency · Relevance · Authority · Accuracy · Purpose) and **SIFT** (Stop · Investigate · Find better ·
  Trace to original) — multi-factor independent scoring; credibility judged *laterally* so a re-reporter inherits less
  authority than the primary it cites.
- **Nielsen-Norman "UX Evidence"** — credibility **rises** with diversity/breadth across users-tasks-platforms-
  geographies-methods and longitudinal span; **falls** with methodological flaws, narrow samples, publication bias.
  NN/g explicitly **rejects** importing the medical pyramid wholesale, and **no accepted UX-specific evidence
  hierarchy exists** — so #1588 *defines* one by borrowing GRADE's *shape* + NN/g's *factors*.
- **RAG knowledge-base weighting** — tiered source classes + a composite trust weight feeding a downstream blended
  score (`final = relevance × balance × credibility`) so a high-relevance blog can't outrank a durable source.
  (Practitioner/preprint sources — illustrative pattern, weak authority.)
- **UICrit (UIST'24)** — records per-annotator provenance (design-expertise area + years 1–16) as first-class
  metadata and a multi-factor rubric; only one annotator per UI (no inter-rater/consensus signal).

**Four recurring patterns:** (A) baseline tier from source-type; (B) multi-factor independent scoring; (C)
GRADE-shaped downgrade/upgrade modifiers on the baseline; (D) authority is composite (peer-review × adoption ×
currency), traced laterally.

## What the survey reshaped

The original item framed three flat "criteria to settle". The survey reshaped them into three **orthogonal axes**,
and the skeptic pass amended two defaults materially:

- **Modifier scoring is structured *judgment*, not deterministic** (GRADE inter-rater κ ~0.5–0.7). Drop any
  "reproducible" framing; require each applied modifier to carry a recorded **rationale + attribution**. Only
  *staleness* is deterministic (from publish-date).
- **Cross-project *absolute* weight comparability is a non-goal** — intra-corpus *ordering* is the only contract.
  Freeze the **meta-schema** as the comparable spine; add a **nonzero floor** so an admitted source can't be covertly
  re-excluded by weighting it to zero (the mirror of the open-posture concern).

## Forks (see #1588 for the prepared shape + bold defaults)

1. **Admission vs weight** → **two-stage**: a permissive provenance *admission floor*, then a *separate* weight (so a
   low-credibility custom source is admitted-but-discounted, never excluded).
2. **Weight computation** → **GRADE-shaped**: baseline tier from source-type + a fixed, named, *optional* set of
   up/down modifiers, each applied with a recorded rationale.
3. **Mandate vs config-extends-platform-default** → **config-extends-default**: WE ships the meta-schema + a default
   flavor; a project extends tier weights / adds source-kinds & modifiers; meta-schema frozen as the spine; nonzero
   floor on admitted sources.

All three carry a `Skeptic:` verdict in #1588 (1 SURVIVES, 2 SURVIVES-WITH-AMENDMENT).
