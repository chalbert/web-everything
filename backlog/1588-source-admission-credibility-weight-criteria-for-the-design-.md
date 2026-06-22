---
kind: decision
parent: "1585"
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#credibility-weighting"
preparedDate: "2026-06-22"
relatedProject: webaudit
relatedReport: reports/2026-06-22-design-knowledge-source-admission-credibility.md
tags: []
---

# Source admission + credibility-weight criteria for the design-knowledge corpus

**RESOLVED 2026-06-22** (ruling below, codified at [#credibility-weighting](../docs/agent/platform-decisions.md#credibility-weighting)).
The core fork of the design-knowledge intake program ([#1585](1585-design-knowledge-intake-program-a-standing-watch-that-distil.md)):
standardize the **meta-criteria** by which the curated corpus admits a source and computes its `credibilityWeight`,
so durable peer-reviewed research outranks a trend blog — **not** a frozen source list (open-design: custom/project
sources must coexist). Three forks (grounded in a [prior-art survey](/research/design-knowledge-source-admission-credibility/)),
all ratified at their bold defaults. Graduating build [#1591](1591-author-the-design-knowledge-weighting-meta-schema-computatio.md);
feeds the #1586 ledger weight column + #1587 rubric provenance; unblocks #1589 distillation.

The concern decomposes into three orthogonal axes the survey kept independent: **admission** (the binary in/out gate),
**weight** (the scalar credibility a source carries once admitted), and **governance** (mandate vs. project-extensible).
The strongest grounding is internal: [`we:src/_data/benchmarkCorpus.json`](../src/_data/benchmarkCorpus.json) already
governs source admission for the gap-analysis program (#315) with a `selectionCriteria` array + an `inclusionRule`
("scores on ≥3 criteria AND occupies a category axis") + category axes — the **same multi-criteria-gate shape**, but
for *coverage breadth* and *binary* inclusion, not *credibility* and a *weight*. The consumer is the #1034
design-critique rubric ([`we:docs/agent/vision-tiers.md:110`](../docs/agent/vision-tiers.md#L110)), whose 8 closed
axes each already name a grounding source; [#1586](1586-design-knowledge-corpus-ledger-front-a-conformance-metric.md)
seeds the ledger rows `{ id, source, kind, credibilityWeight, distilledInto, trackingItem }` at provisional equal
weight *pending this decision*.

### Standing invariant (ratify, not a fork)

Per #1585 and the [Intents-Open-Design](../docs/agent/platform-decisions.md) precedent, the deliverable is **meta-criteria,
never a frozen source list** — any coherent source is admissible if it clears the gate, and the weighting *structure*
(not a fixed table of names) is what WE standardizes. This frames all three forks below; it is not itself a choice.

### Recommended path at a glance

Ratify all three rows, or override just the one you'd change. The **confidence** column says where judgment is
actually needed vs. where to nod.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · admission ⟂ weight** | two-stage — permissive provenance *floor*, then a *separate* weight | one-stage: admit iff weight ≥ threshold *(rejected — excludes low-weight custom sources)* | **High** — forced by open-posture |
| **2 · weight computation** | GRADE-shaped — baseline tier from source-type **+** fixed named optional up/down modifiers (each with recorded rationale) | flat tier-by-type only | **Med-high** — modifiers are the only contested layer |
| **3 · mandate vs config** | config-extends-platform-default — WE ships meta-schema + default flavor; project extends weights/kinds | WE hardcodes weights as constants *(rejected — closed)* | **High** — Config-Extends-Default + open-design |

## Fork 1 — is admission a separate stage from the weight, or weight-above-threshold?

**Why it's a fork (forced invariant):** the one-stage branch is *flawed against the open-design posture* — collapsing
admission into the weight means a brand-new custom/project source with low credibility is **excluded** from the corpus,
but #1585 mandates such sources **coexist**. The two branches produce *observably different corpora* (a hand-written
project source present-but-discounted vs. absent), so it is a real either/or, and one branch is broken.

The crux: a source's *presence* in the corpus and its *authority* are different properties. Admission must gate on
**provenance/content** (is this an identifiable source on-topic?), never on **quality** (or it smuggles the weight back
into stage 1 and the open posture is lost).

- **(a — recommended) Two-stage.** *Admission floor* (binary): a source is admitted iff it has an **identifiable
  authoritative author/body + traceable provenance + is on-topic** (a CRAAP/SIFT-style minimal pass — Authority +
  Purpose-declared + traceable-to-origin). Then a **separate** `credibilityWeight` is computed (Fork 2) for admitted
  sources. A low-credibility custom source is *admitted-but-downweighted*, never excluded — open posture preserved.
- **(b) One-stage:** compute the weight, admit iff `weight ≥ threshold`. Simpler (one formula), but **Rejected** —
  excludes low-weight custom/project sources, breaking the open posture.

**Skeptic:** SURVIVES — the two stages yield observably different corpora, so it is a real fork, not a distinction
without a difference. Amendment folded in: stage 1 is a **provenance/content gate, not a quality gate** (else it
collapses into one-stage).

## Fork 2 — how is `credibilityWeight` computed?

**Why it's a fork (genuine merit either/or on the *standard's* contract):** the contested question is whether the
*standard* mandates **only** a flat type→weight map (foreclosing per-source modifiers) or a structure that carries
**optional modifiers**. The flat-only branch is coherent but *worse on merit* — it cannot let a rigorous practitioner
study outrank a weak peer-reviewed paper (NN/g's central claim: credibility tracks diversity/rigor, not just venue),
collapsing exactly the distinction the corpus exists to make. The free-manual branch is *flawed* (un-auditable).
Flat-only and GRADE-shaped do not coexist *as the contract*: the contract is either type-closed or modifier-open.

The crux: GRADE is the reusable template — a **baseline tier from source-type**, then **named modifiers** adjust it.
The `kind` enum #1586 already proposes (`peer-reviewed / standard / guideline / book / blog`) *is* the baseline tier.

- **(a — recommended) GRADE-shaped: baseline tier + fixed, named, optional modifiers.** Baseline weight from
  source-`kind` (peer-reviewed usability study & W3C/APG standard highest; vendor design-system guideline / HIG high;
  reputable book medium; practitioner blog low). Then a **small fixed named set** of optional up/down modifiers
  borrowed from GRADE + NN/g's UX-evidence factors — **upgrade:** breadth/diversity across users-tasks-platforms,
  independent replication; **downgrade:** narrow/non-generalizable sample, vendor-funded bias, staleness. Modifiers
  are *optional* — a source with none is just its baseline tier (so flat-by-type is the degenerate config, not a rival).
  **Each applied modifier records a `rationale` + attribution** (and a citation where possible); only *staleness* is
  deterministic (publish-date → decay). This keeps the weight **auditable and contestable** rather than claiming a
  false determinism.
- **(b) Flat tier-by-type only** (no modifiers). Deterministic and cheap, but **Rejected as the contract** — two
  sources of the same `kind` get identical weight regardless of rigor; can't honor the durable-vs-blog distinction
  beyond the venue tier. (It survives as the *degenerate* configuration of (a), so nothing is lost by choosing (a).)
- **(c) Free manual per-source number.** **Rejected** — un-reproducible, un-auditable; it *is* the ungoverned state
  this decision replaces.

**Skeptic:** SURVIVES-WITH-AMENDMENT — modifier scoring is structured **judgment**, not deterministic (GRADE
inter-rater κ ~0.5–0.7). Amendments folded in: **drop any "reproducible/deterministic" framing** for the modifier
layer; **require each applied modifier to carry a recorded rationale + attribution** (this is what keeps (a) strictly
better than the rejected free-manual (c)); make only **staleness** deterministic.

## Fork 3 — does WE mandate the weights, or ship a config-extends-platform-default?

**Why it's a fork (forced invariant):** hardcoding tier weights + the modifier list as frozen WE constants is *flawed*
against the open-design posture (#1585), the [Config-Extends-Platform-Default](../docs/agent/platform-decisions.md)
rule, and Conventions-Fold-Into-Compliance — a project must be able to retune weights and add custom source-kinds.
This is the *"a fork that picks a default set is really mandate-vs-config-driven-open-default"* shape (#370): the
locked table and the free-for-all are *configurations* of one registry, not rival branches.

- **(a — recommended) Config-extends-platform-default.** WE ships the **meta-schema** (the source-`kind` enum, the
  modifier vocabulary, the weight-computation function) **+ a default flavor** (sensible baseline tier weights); a
  project **extends/overrides** tier weights and **adds** custom source-kinds & modifiers in the platform config it
  extends. The **meta-schema is frozen as the comparable spine** (every corpus shares the same dimensions + modifier
  names); only the *numbers and additions* flex. An admitted source carries a **nonzero floor weight** so it cannot be
  covertly re-excluded by weighting it to zero (the mirror of Fork 1's open-posture guarantee). At graduation, the
  tunable tier-weight set spins out a **Technical Configurator** card (plateau-app).
- **(b) WE hardcodes tier weights + modifier list** as constants. **Rejected** — closed; breaks the open-design posture.

**Skeptic:** SURVIVES-WITH-AMENDMENT — overridable weights kill cross-project *absolute* comparability. Amendments
folded in: **intra-corpus *ordering* is the only contract** (cross-project absolute-weight comparison is a non-goal —
say so); **freeze the meta-schema** as the comparable structural spine; **add a nonzero floor** on admitted sources so
weight-to-zero can't covertly re-exclude.

## Ruling (ratified 2026-06-22)

All three forks ratified at their **bold defaults**: Fork 1 = two-stage admission ⟂ weight;
Fork 2 = GRADE-shaped (baseline tier + fixed named optional modifiers, each with recorded
rationale + attribution; only staleness deterministic); Fork 3 = config-extends-platform-default
(meta-schema frozen as the comparable spine, nonzero floor on admitted sources, cross-project
*absolute* comparability a non-goal). A throwaway skeptic (prompted only to refute) attacked all
three and **none landed a fork reversal** — the rejected arms are each forced-out (one-stage breaks
the open posture; hardcoding is closed) or strictly dominated ((a) contains flat-by-type as its
degenerate config). Two red-team tightenings folded in, neither a branch change:

- **Fork 1 — admission floor is provenance, not quality.** Read "identifiable authoritative
  author/body" as *identifiable + attributable + traceable-to-origin*, **not** a credibility bar. A
  self-published practitioner blog is admissible (identifiable author, on-topic, traceable); its low
  credibility is expressed by the Fork-2 *weight*, never by exclusion. If "authoritative" is read as
  a quality gate, the weight smuggles back into stage 1 and two-stage collapses into one-stage.
- **Fork 3 — the "absolute comparability is a non-goal" carries a revisit trigger.** Intra-corpus
  *ordering* is the only contract *today* (one corpus). **Un-park trigger:** when a cross-corpus
  consumer lands (e.g. #1589 distillation pulling from multiple corpora, or a constellation-wide
  rubric), revisit whether a normalized/absolute weight semantics is needed — do not treat the
  non-goal as permanently closed.

The graduated build authors the meta-schema (kind enum + modifier vocabulary + weight-computation
function) + the default flavor; the tunable tier-weight Configurator UI is its own card.

## Context

- **What you have to decide.** Ratify (or override) the three bold defaults above; resolving spins out the meta-schema
  build. The only genuinely contested layer is Fork 2's modifier set (med-high); Forks 1 & 3 are forced by the
  open-design posture.
- **Lineage / consumers.** Resolving this decision unblocks: #1586 (ledger `credibilityWeight` column — currently
  provisional equal weight), #1587 (rubric source-provenance weighting), and #1589 (distillation pipeline, also
  `blockedBy: #490`). The graduated build authors the meta-schema + default flavor + the computation function; the
  Configurator UI for tunable weights is its own card.
- **Classification (per-fork pass).** The corpus + weighting is **not a protocol** (a deterministic transform with no
  swappable-vendor interop story — making it one would be lock-in for no gain); it is **config + data** over the
  #1586 ledger and the #1034 rubric contract. The weight is consumed *within one project's corpus* to order *that
  project's* sources — intra-corpus ordering, not a global absolute.
- **AI over a contract.** Distillation (#1589) turns weighted sources into codified rubric heuristics carrying
  provenance — never raw source text into weights (the #490 no-leakage discipline). This decision settles only the
  *weighting*; the distillation format is #490's call.
